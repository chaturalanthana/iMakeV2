const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { sendError } = require('../services/errors');
const { money } = require('../services/money');
const { writeAudit } = require('../services/auditService');
const { loadRule, levelsForAmount, submitForApproval } = require('../services/approvalService');
const { respondList } = require('../services/listQuery');
const {
  postGrn,
  assertPrQuantity,
  refreshPrStatus,
  refreshPoReceiptStatus,
  cancelStockAndJournal,
  createSupplierInvoice,
  supplierAging,
  supplierStatement
} = require('../services/documentPosting');

// --- PURCHASE ORDERS ---
const getPurchaseOrders = async (req, res) => {
  try {
    await respondList(req, res, {
      model: prisma.purchaseOrder,
      where: { tenantId: req.tenantId },
      include: {
        supplier: true,
        currency: true,
        items: { include: { product: true } },
        grns: { where: { status: { not: 'CANCELLED' } }, include: { items: true } }
      },
      search: ['poNumber', 'status', 'supplier.name'],
      sortFields: ['date', 'poNumber', 'total', 'status', 'createdAt'],
      defaultSort: 'date',
      filename: 'purchase-orders.xlsx',
      exportHeaders: ['date', 'poNumber', 'supplier', 'total', 'status'],
      toExport: (row) => ({
        date: row.date?.toISOString?.().slice(0, 10) || '',
        poNumber: row.poNumber,
        supplier: row.supplier?.name || '',
        total: String(row.total),
        status: row.status
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, date, status, items, currencyId, exchangeRate, prId } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const poNumber = await generateDocumentNumber(
      req.tenantId,
      'purchaseOrder',
      'PO',
      'poNumber'
    );
    const rule = await loadRule(prisma, req.tenantId, 'PO');
    const needed = levelsForAmount(rule, totalAmount);
    const hold = Boolean(rule?.enabled && needed.length);
    const requestedStatus = status || 'PENDING';

    const order = await prisma.$transaction(async (tx) => {
      if (prId) await assertPrQuantity(tx, { tenantId: req.tenantId, prId, items: items || [] });
      const created = await tx.purchaseOrder.create({
        data: {
          tenantId: req.tenantId,
          supplierId,
          poNumber,
          date: new Date(date),
          status: hold ? 'PENDING_APPROVAL' : requestedStatus,
          total: totalAmount,
          currencyId: currencyId || null,
          exchangeRate: parseFloat(exchangeRate) || 1.0,
          createdBy: req.user.userId,
          prId: prId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total)
            }))
          } : undefined
        },
        include: {
          supplier: true,
          currency: true,
          items: { include: { product: true } }
        }
      });
      if (prId) await refreshPrStatus(tx, prId);
      if (rule?.enabled) {
        await submitForApproval(tx, {
          tenantId: req.tenantId,
          documentType: 'PO',
          documentId: created.id,
          documentNumber: created.poNumber,
          amount: totalAmount,
          userId: req.user.userId
        });
      }
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user.userId,
        action: 'CREATE',
        entity: 'PO',
        entityId: created.id,
        after: created
      });
      return created;
    });

    res.status(201).json(order);
  } catch (error) {
    return sendError(res, error, 'Failed to create purchase order');
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.purchaseOrder.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' });
    if (String(existing.status).toUpperCase() !== 'DRAFT') {
      return res.status(400).json({ error: 'Purchase orders cannot be deleted. Cancel an unposted order, or reverse its receipts first.' });
    }
    await prisma.purchaseOrder.delete({ where: { id } });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.userId,
      action: 'DELETE',
      entity: 'PO',
      entityId: id,
      before: existing,
      after: null
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
};

const cancelPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    const existing = await prisma.purchaseOrder.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Purchase order is already cancelled.' });
    if (['RECEIVED', 'PARTIALLY_RECEIVED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Reverse the goods receipts before cancelling this purchase order.' });
    }
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.userId,
      action: 'STATUS',
      entity: 'PO',
      entityId: id,
      before: existing,
      after: { ...updated, reason }
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel purchase order');
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierId, poNumber, date, status, items, currencyId, exchangeRate } = req.body;

    // Check if PO exists and belongs to tenant
    const existing = await prisma.purchaseOrder.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' });

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    // Delete existing items
    await prisma.purchaseOrderItem.deleteMany({
      where: { poId: id }
    });

    // Update PO and create new items
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId,
        poNumber: poNumber || existing.poNumber,
        date: date ? new Date(date) : existing.date,
        status: status || existing.status,
        total: totalAmount,
        currencyId: currencyId !== undefined ? currencyId : existing.currencyId,
        exchangeRate: exchangeRate !== undefined ? parseFloat(exchangeRate) : existing.exchangeRate,
        items: items && items.length > 0 ? {
          create: items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total)
          }))
        } : undefined
      },
      include: {
        supplier: true,
        currency: true,
        items: { include: { product: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update PO:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
};

// --- GRNs ---
const getGrns = async (req, res) => {
  try {
    const grns = await prisma.gRN.findMany({
      where: { tenantId: req.tenantId },
      include: { 
        supplier: true, 
        purchaseOrder: true,
        currency: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(grns);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch GRNs' });
  }
};

const createGrn = async (req, res) => {
  try {
    const { supplierId, poId, date, status, items, warehouseId, currencyId, exchangeRate } = req.body;
    
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse is required' });
    }
    if (poId) {
      const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId: req.tenantId } });
      if (po && ['PENDING_APPROVAL', 'REJECTED', 'RETURNED', 'CANCELLED'].includes(po.status)) {
        return res.status(400).json({ error: 'This purchase order is not approved for receipt.' });
      }
    }

    const grnNumber = await generateDocumentNumber(
      req.tenantId,
      'gRN',
      'GRN',
      'grnNumber'
    );

    const grn = await prisma.$transaction(async (tx) => {
      const created = await tx.gRN.create({
        data: {
          tenantId: req.tenantId,
          supplierId,
          poId: poId || null,
          grnNumber,
          date: new Date(date),
          warehouseId: warehouseId,
          status: status || 'RECEIVED',
          currencyId: currencyId || null,
          exchangeRate: parseFloat(exchangeRate) || 1.0,
          createdBy: req.user.userId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantityReceived: parseFloat(item.quantityReceived),
              quantityOrdered: parseFloat(item.quantityOrdered || item.quantityReceived),
              unitPrice: parseFloat(item.unitPrice || 0)
            }))
          }
        },
        include: { items: true }
      });

      if ((created.status || 'RECEIVED') !== 'CANCELLED') {
        await postGrn(tx, {
          tenantId: req.tenantId,
          grn: created,
          items: created.items.map((item, index) => ({
            ...item,
            unitPrice: items[index]?.unitPrice != null ? items[index].unitPrice : item.unitPrice
          })),
          overReceiptTolerance: parseFloat(req.body.overReceiptTolerance || 0),
          createdBy: req.user.userId
        });
      }
      return tx.gRN.findUnique({
        where: { id: created.id },
        include: { supplier: true, purchaseOrder: true, currency: true, items: { include: { product: true } } }
      });
    });

    res.status(201).json(grn);
  } catch (error) {
    return sendError(res, error, 'Failed to create GRN');
  }
};

const cancelGrn = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.gRN.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'GRN not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'GRN is already cancelled.' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    const billed = await prisma.supplierInvoice.count({
      where: { grnId: id, tenantId: req.tenantId, status: { not: 'CANCELLED' } }
    });
    if (billed) return res.status(400).json({ error: 'Cancel the supplier invoice before cancelling this receipt.' });

    await prisma.$transaction(async (tx) => {
      await cancelStockAndJournal(tx, {
        tenantId: req.tenantId,
        referenceType: 'GRN',
        referenceId: id,
        date: new Date(),
        createdBy: req.user?.userId,
        description: existing.grnNumber
      });
      await tx.gRN.update({ where: { id }, data: { status: 'CANCELLED' } });
      await refreshPoReceiptStatus(tx, existing.poId);
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user?.userId,
        action: 'REVERSE',
        entity: 'GRN',
        entityId: id,
        before: existing,
        after: { status: 'CANCELLED', reason }
      });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel GRN');
  }
};

const deleteGrn = async (req, res) => {
  try {
    const existing = await prisma.gRN.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'GRN not found' });
    if (String(existing.status).toUpperCase() !== 'DRAFT') {
      return res.status(400).json({ error: 'Posted receipts cannot be deleted. Reverse the receipt and give a reason.' });
    }
    await prisma.gRN.delete({ where: { id: existing.id } });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.userId,
      action: 'DELETE',
      entity: 'GRN',
      entityId: existing.id,
      before: existing,
      after: null
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete GRN' });
  }
};

const getSupplierInvoices = async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.supplierId) where.supplierId = req.query.supplierId;
    if (req.query.open === '1') where.status = { in: ['UNPAID', 'PARTIAL'] };
    const invoices = await prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: true,
        currency: true,
        grn: true,
        purchaseOrder: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier invoices' });
  }
};

const postSupplierInvoice = async (req, res) => {
  try {
    const invoice = await prisma.$transaction((tx) => createSupplierInvoice(tx, {
      tenantId: req.tenantId,
      supplierId: req.body.supplierId,
      poId: req.body.poId || null,
      grnId: req.body.grnId || null,
      date: req.body.date,
      supplierReference: req.body.supplierReference,
      currencyId: req.body.currencyId || null,
      exchangeRate: req.body.exchangeRate,
      items: (req.body.items || []).map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
      priceTolerance: req.body.priceTolerance != null ? parseFloat(req.body.priceTolerance) : 0.02,
      qtyTolerance: req.body.qtyTolerance != null ? parseFloat(req.body.qtyTolerance) : 0,
      createdBy: req.user.userId
    }));
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'CREATE',
      entity: 'SUPPLIER_INVOICE',
      entityId: invoice.id,
      after: { invoiceNumber: invoice.invoiceNumber, supplierReference: invoice.supplierReference, total: String(invoice.total) }
    });
    res.status(201).json(invoice);
  } catch (error) {
    return sendError(res, error, 'Failed to create supplier invoice');
  }
};

const cancelSupplierInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.supplierInvoice.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Supplier invoice not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Supplier invoice is already cancelled.' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    if (money(existing.amountPaid) > 0.0001) {
      return res.status(400).json({ error: 'Remove the payment allocation before cancelling this invoice.' });
    }
    await prisma.$transaction(async (tx) => {
      await cancelStockAndJournal(tx, {
        tenantId: req.tenantId,
        referenceType: 'SUPPLIER_INVOICE',
        referenceId: id,
        date: new Date(),
        createdBy: req.user?.userId,
        description: existing.invoiceNumber
      });
      await tx.supplierInvoice.update({ where: { id }, data: { status: 'CANCELLED' } });
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user?.userId,
        action: 'REVERSE',
        entity: 'SUPPLIER_INVOICE',
        entityId: id,
        before: existing,
        after: { status: 'CANCELLED', reason }
      });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel supplier invoice');
  }
};

const getSupplierAging = async (req, res) => {
  try {
    res.json(await supplierAging(prisma, req.tenantId));
  } catch (error) {
    res.status(500).json({ error: 'Failed to build supplier aging' });
  }
};

const getSupplierStatement = async (req, res) => {
  try {
    const statement = await supplierStatement(prisma, req.tenantId, req.params.id);
    if (!statement) return res.status(404).json({ error: 'Supplier not found' });
    res.json(statement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to build supplier statement' });
  }
};

module.exports = {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  cancelPurchaseOrder,
  getGrns,
  createGrn,
  deleteGrn,
  cancelGrn,
  getSupplierInvoices,
  postSupplierInvoice,
  cancelSupplierInvoice,
  getSupplierAging,
  getSupplierStatement
};
