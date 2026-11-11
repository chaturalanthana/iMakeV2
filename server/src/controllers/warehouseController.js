const prisma = require('../lib/prisma');
const { sendError } = require('../services/errors');
const { num, money } = require('../services/money');
const { receive, issue, movementEffect, valuation } = require('../services/stockService');
const { receiveLayer, issueFifo } = require('../services/production/fifo');
const {
  postReceiptDocument,
  postIssueDocument,
  postAdjustmentDocument,
  postTransferDocument,
  cancelStockAndJournal
} = require('../services/documentPosting');
const { writeAudit } = require('../services/auditService');
const { loadRule, levelsForAmount, submitForApproval } = require('../services/approvalService');
const { respondList } = require('../services/listQuery');

const getStockLedger = async (req, res) => {
  try {
    const { productId, startDate, endDate, warehouseId } = req.query;
    
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required for ledger' });
    }

    let openingBalance = 0;
    
    if (startDate) {
      const priorWhere = {
        tenantId: req.tenantId,
        productId: productId,
        createdAt: { lt: new Date(startDate) }
      };
      if (warehouseId) priorWhere.warehouseId = warehouseId;

      const priorMovements = await prisma.stockMovement.findMany({
        where: priorWhere
      });
      
      openingBalance = priorMovements.reduce((acc, m) => acc + movementEffect(m), 0);
    }

    const whereClause = {
      tenantId: req.tenantId,
      productId: productId,
    };
    if (warehouseId) whereClause.warehouseId = warehouseId;

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const paged = req.query.page !== undefined;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(200, Math.max(parseInt(req.query.pageSize, 10) || 15, 1));
    const total = await prisma.stockMovement.count({ where: whereClause });
    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: { product: true },
      orderBy: { createdAt: 'asc' },
      ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : {})
    });
    if (paged && startDate) {
      const priorInPage = await prisma.stockMovement.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: (page - 1) * pageSize
      });
      openingBalance += priorInPage.reduce((acc, movement) => acc + movementEffect(movement), 0);
    } else if (paged && page > 1) {
      const priorInPage = await prisma.stockMovement.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: (page - 1) * pageSize
      });
      openingBalance = priorInPage.reduce((acc, movement) => acc + movementEffect(movement), 0);
    }
    
    // Resolve UUIDs to readable document numbers
    const enhancedMovements = await Promise.all(movements.map(async (m) => {
      let readableReference = m.referenceId;
      try {
        if (m.referenceType === 'GI' && m.referenceId) {
          const doc = await prisma.goodsIssue.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.giNumber;
        } else if (m.referenceType === 'ADJ' && m.referenceId) {
          const doc = await prisma.stockAdjustment.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.adjNumber;
        } else if (m.referenceType === 'GR' && m.referenceId) {
          const doc = await prisma.gRN.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.grnNumber;
        } else if (m.referenceType === 'SR' && m.referenceId) {
          const doc = await prisma.stockReceipt.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.receiptNumber;
        } else if (m.referenceType === 'ST' && m.referenceId) {
          const doc = await prisma.stockTransfer.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.transferNumber;
        } else if (m.referenceType === 'SALES_DELIVERY' && m.referenceId) {
          const doc = await prisma.salesDelivery.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.deliveryNumber;
        } else if (m.referenceType === 'GRN' && m.referenceId) {
          const doc = await prisma.gRN.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.grnNumber;
        }
      } catch (err) {
        // Fallback to original referenceId if lookup fails
      }
      return {
        ...m,
        originalReferenceId: m.referenceId,
        referenceId: readableReference || '-',
      };
    }));
    
    const body = { openingBalance, movements: enhancedMovements };
    if (paged) {
      body.total = total;
      body.page = page;
      body.pageSize = pageSize;
    }
    res.json(body);
  } catch (error) {
    console.error('Failed to fetch stock ledger:', error);
    res.status(500).json({ error: 'Failed to fetch stock ledger' });
  }
};


const getStockMovements = async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.type) where.type = req.query.type;
    if (req.query.productId) where.productId = req.query.productId;
    await respondList(req, res, {
      model: prisma.stockMovement,
      where,
      include: { product: true },
      search: ['type', 'referenceType', 'lotNumber', 'product.code', 'product.name'],
      sortFields: ['createdAt', 'type', 'quantity'],
      defaultSort: 'createdAt',
      filename: 'stock-movements.xlsx',
      exportHeaders: ['date', 'type', 'product', 'quantity', 'reference'],
      toExport: (row) => ({
        date: row.createdAt?.toISOString?.() || '',
        type: row.type,
        product: row.product?.code || '',
        quantity: String(row.quantity),
        reference: row.referenceType || ''
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};

const createStockMovement = async (req, res) => {
  try {
    const { type, items, referenceType, referenceId, description } = req.body;
    
    // items: [{ productId, quantity }]
    // type: 'GI' | 'ADJ'
    if (!['GI', 'ADJ', 'GR'].includes(type)) {
      return res.status(400).json({ error: 'Invalid movement type.' });
    }

    const createdMovements = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const reference = referenceType || (type === 'GI' ? 'MANUAL_ISSUE' : type === 'GR' ? 'MANUAL_RECEIPT' : 'MANUAL_ADJ');
        if (type === 'GR' || (type === 'ADJ' && qty >= 0)) {
          const result = await receive(tx, {
            tenantId: req.tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            quantity: Math.abs(qty),
            unitCost: item.unitCost || item.unitPrice || 0,
            referenceType: reference,
            referenceId: referenceId || description || null,
            movementType: type,
            createdBy: req.user.userId
          });
          rows.push(result.movement);
        } else {
          const result = await issue(tx, {
            tenantId: req.tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            quantity: Math.abs(qty),
            referenceType: reference,
            referenceId: referenceId || description || null,
            movementType: type,
            quantitySign: type === 'ADJ' ? -1 : 1,
            createdBy: req.user.userId
          });
          rows.push(result.movement);
        }
      }
      return rows;
    });

    res.status(201).json(createdMovements);
  } catch (error) {
    return sendError(res, error, 'Failed to create stock movement');
  }
};

const deleteStockMovement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockMovement.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stock movement' });
  }
};

const getGoodsIssues = async (req, res) => {
  try {
    const issues = await prisma.goodsIssue.findMany({
      where: { tenantId: req.tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch goods issues' });
  }
};

const createGoodsIssue = async (req, res) => {
  try {
    const { supplierId, date, status, reason, items } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const giNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'goodsIssue',
      'GI',
      'giNumber'
    );

    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.goodsIssue.create({
        data: {
          tenantId: req.tenantId,
          supplierId: supplierId || null,
          giNumber,
          date: new Date(date),
          status: status || 'PENDING',
          reason: reason || null,
          total: totalAmount,
          warehouseId: req.body.warehouseId || null,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED' || created.status === 'ISSUED') {
        await postIssueDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: created.warehouseId,
          items,
          referenceType: 'GI',
          referenceId: created.id,
          date,
          createdBy: req.user?.userId || null,
          description: `Goods issue ${giNumber}`
        });
      }
      return created;
    });

    res.status(201).json(issue);
  } catch (error) {
    return sendError(res, error, 'Failed to create Goods Issue');
  }
};

const updateGoodsIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierId, date, status, reason, items } = req.body;

    const existing = await prisma.goodsIssue.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Goods Issue not found' });
    if (existing.status === 'COMPLETED' || existing.status === 'ISSUED') {
      return res.status(400).json({ error: 'Cannot modify a completed stock movement.' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.goodsIssueItem.deleteMany({
        where: { giId: id }
      });

      const saved = await tx.goodsIssue.update({
        where: { id },
        data: {
          supplierId: supplierId || null,
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          total: totalAmount,
          warehouseId: req.body.warehouseId !== undefined ? req.body.warehouseId : existing.warehouseId,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED' || saved.status === 'ISSUED') {
        await postIssueDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: saved.warehouseId,
          items,
          referenceType: 'GI',
          referenceId: saved.id,
          date: saved.date,
          createdBy: req.user?.userId || null,
          description: `Goods issue ${existing.giNumber}`
        });
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    return sendError(res, error, 'Failed to update Goods Issue');
  }
};

const deleteGoodsIssue = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.goodsIssue.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Goods Issue' });
  }
};

const getStockAdjustments = async (req, res) => {
  try {
    const adjs = await prisma.stockAdjustment.findMany({
      where: { tenantId: req.tenantId },
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(adjs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
};

const createStockAdjustment = async (req, res) => {
  try {
    const { date, status, reason, items } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const adjNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'stockAdjustment',
      'ADJ',
      'adjNumber'
    );
    const rule = await loadRule(prisma, req.tenantId, 'STOCK_ADJUSTMENT');
    const needed = levelsForAmount(rule, totalAmount);
    const posting = status === 'COMPLETED';
    const hold = Boolean(posting && rule?.enabled && needed.length);

    const adj = await prisma.$transaction(async (tx) => {
      const created = await tx.stockAdjustment.create({
        data: {
          tenantId: req.tenantId,
          adjNumber,
          date: new Date(date),
          status: hold ? 'PENDING_APPROVAL' : (status || 'PENDING'),
          reason: reason || null,
          total: totalAmount,
          warehouseId: req.body.warehouseId || null,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              systemQty: parseFloat(item.systemQty || 0),
              actualQty: parseFloat(item.actualQty || 0),
              diffQty: parseFloat(item.diffQty || 0),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          items: { include: { product: true } }
        }
      });

      if (rule?.enabled && posting) {
        await submitForApproval(tx, {
          tenantId: req.tenantId,
          documentType: 'STOCK_ADJUSTMENT',
          documentId: created.id,
          documentNumber: created.adjNumber,
          amount: totalAmount,
          userId: req.user?.userId || null
        });
      }
      if (created.status === 'COMPLETED') {
        await postAdjustmentDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: created.warehouseId,
          items,
          referenceId: created.id,
          date,
          createdBy: req.user?.userId || null
        });
      }
      return created;
    });

    res.status(201).json(adj);
  } catch (error) {
    return sendError(res, error, 'Failed to create Stock Adjustment');
  }
};

const updateStockAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, reason, items } = req.body;

    const existing = await prisma.stockAdjustment.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify a completed document.' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockAdjustmentItem.deleteMany({
        where: { adjId: id }
      });

      const saved = await tx.stockAdjustment.update({
        where: { id },
        data: {
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          total: totalAmount,
          warehouseId: req.body.warehouseId !== undefined ? req.body.warehouseId : existing.warehouseId,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              systemQty: parseFloat(item.systemQty || 0),
              actualQty: parseFloat(item.actualQty || 0),
              diffQty: parseFloat(item.diffQty || 0),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED') {
        await postAdjustmentDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: saved.warehouseId,
          items,
          referenceId: saved.id,
          date: saved.date,
          createdBy: req.user?.userId || null
        });
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    return sendError(res, error, 'Failed to update Stock Adjustment');
  }
};

const deleteStockAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.stockAdjustment.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Stock adjustment not found' });
    if (!['DRAFT', 'PENDING', 'REJECTED', 'RETURNED'].includes(String(existing.status).toUpperCase())) {
      return res.status(400).json({ error: 'Posted adjustments cannot be deleted. Reverse the adjustment and give a reason.' });
    }
    await prisma.stockAdjustment.delete({ where: { id } });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.userId,
      action: 'DELETE',
      entity: 'STOCK_ADJUSTMENT',
      entityId: id,
      before: existing,
      after: null
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Stock Adjustment' });
  }
};

const cancelStockAdjustment = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    const existing = await prisma.stockAdjustment.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Stock adjustment not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Adjustment is already cancelled.' });
    await prisma.$transaction(async (tx) => {
      if (existing.status === 'COMPLETED') {
        await cancelStockAndJournal(tx, {
          tenantId: req.tenantId,
          referenceType: 'ADJ',
          referenceId: existing.id,
          date: new Date(),
          createdBy: req.user?.userId,
          description: existing.adjNumber
        });
      }
      await tx.stockAdjustment.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user?.userId,
        action: existing.status === 'COMPLETED' ? 'REVERSE' : 'STATUS',
        entity: 'STOCK_ADJUSTMENT',
        entityId: existing.id,
        before: existing,
        after: { status: 'CANCELLED', reason }
      });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel the adjustment');
  }
};

const getInventoryReport = async (req, res) => {
  try {
    const { warehouseId } = req.query;

    // We get all products for the tenant
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId },
      include: {
        category: true,
        brand: true,
        uom: true
      },
      orderBy: { name: 'asc' }
    });

    const movementWhere = { tenantId: req.tenantId };
    if (warehouseId) movementWhere.warehouseId = warehouseId;

    // We get all stock movements to calculate balances
    const movements = await prisma.stockMovement.findMany({
      where: movementWhere,
      select: {
        productId: true,
        type: true,
        quantity: true
      }
    });

    const stockMap = {};
    for (const movement of movements) {
      stockMap[movement.productId] = (stockMap[movement.productId] || 0) + movementEffect(movement);
    }
    const valued = await valuation(prisma, { tenantId: req.tenantId, warehouseId });
    const layerByProduct = new Map(valued.rows.map((row) => [row.productId, row]));

    const report = products.map(p => {
      const layer = layerByProduct.get(p.id);
      const currentStock = layer ? layer.quantity : (stockMap[p.id] || 0);
      const costPrice = parseFloat(p.costPrice || 0);
      const sellingPrice = parseFloat(p.sellingPrice || 0);
      const totalCostValue = layer ? layer.value : currentStock * costPrice;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category?.name || '-',
        brand: p.brand?.name || '-',
        uom: p.uom?.name || '-',
        currentStock,
        costPrice,
        sellingPrice,
        totalCostValue,
        totalRetailValue: currentStock * sellingPrice
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Failed to generate inventory report:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
};

// --- STOCK RECEIPTS ---
const getStockReceipts = async (req, res) => {
  try {
    const receipts = await prisma.stockReceipt.findMany({
      where: { tenantId: req.tenantId },
      include: {
        warehouse: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock receipts' });
  }
};

const createStockReceipt = async (req, res) => {
  try {
    const { date, status, reason, items, warehouseId } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const receiptNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'stockReceipt',
      'SR',
      'receiptNumber'
    );

    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.stockReceipt.create({
        data: {
          tenantId: req.tenantId,
          receiptNumber,
          date: new Date(date),
          status: status || 'DRAFT',
          reason: reason || null,
          total: totalAmount,
          warehouseId: warehouseId || null,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          warehouse: true,
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED' || created.status === 'ISSUED' || created.status === 'RECEIVED') {
        await postReceiptDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: created.warehouseId,
          items,
          referenceType: 'SR',
          referenceId: created.id,
          date,
          createdBy: req.user?.userId || null,
          description: `Stock receipt ${receiptNumber}`,
          creditKey: 'STOCK_ADJUSTMENT'
        });
      }
      return created;
    });

    res.status(201).json(receipt);
  } catch (error) {
    return sendError(res, error, 'Failed to create Stock Receipt');
  }
};

const updateStockReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, reason, items, warehouseId } = req.body;

    const existing = await prisma.stockReceipt.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Stock Receipt not found' });
    if (existing.status === 'COMPLETED' || existing.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Cannot modify a completed stock movement.' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockReceiptItem.deleteMany({
        where: { receiptId: id }
      });

      const saved = await tx.stockReceipt.update({
        where: { id },
        data: {
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          total: totalAmount,
          warehouseId: warehouseId !== undefined ? warehouseId : existing.warehouseId,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          warehouse: true,
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED' || saved.status === 'RECEIVED') {
        await postReceiptDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: saved.warehouseId,
          items,
          referenceType: 'SR',
          referenceId: saved.id,
          date: saved.date,
          createdBy: req.user?.userId || null,
          description: `Stock receipt ${existing.receiptNumber}`,
          creditKey: 'STOCK_ADJUSTMENT'
        });
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    return sendError(res, error, 'Failed to update Stock Receipt');
  }
};

const deleteStockReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockReceipt.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Stock Receipt' });
  }
};

// --- STOCK TRANSFERS ---
const getStockTransfers = async (req, res) => {
  try {
    const transfers = await prisma.stockTransfer.findMany({
      where: { tenantId: req.tenantId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock transfers' });
  }
};

const createStockTransfer = async (req, res) => {
  try {
    const { date, status, reason, items, fromWarehouseId, toWarehouseId } = req.body;

    const transferNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'stockTransfer',
      'ST',
      'transferNumber'
    );

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          tenantId: req.tenantId,
          transferNumber,
          date: new Date(date),
          status: status || 'DRAFT',
          reason: reason || null,
          fromWarehouseId: fromWarehouseId || null,
          toWarehouseId: toWarehouseId || null,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity)
            }))
          } : undefined
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED' || created.status === 'ISSUED' || created.status === 'RECEIVED') {
        await postTransferDocument(tx, {
          tenantId: req.tenantId,
          fromWarehouseId,
          toWarehouseId,
          items,
          referenceId: created.id,
          date,
          createdBy: req.user?.userId || null
        });
      }
      return created;
    });

    res.status(201).json(transfer);
  } catch (error) {
    return sendError(res, error, 'Failed to create Stock Transfer');
  }
};

const updateStockTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, reason, items, fromWarehouseId, toWarehouseId } = req.body;

    const existing = await prisma.stockTransfer.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Stock Transfer not found' });
    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify a completed stock movement.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockTransferItem.deleteMany({
        where: { transferId: id }
      });

      const saved = await tx.stockTransfer.update({
        where: { id },
        data: {
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          fromWarehouseId: fromWarehouseId !== undefined ? fromWarehouseId : existing.fromWarehouseId,
          toWarehouseId: toWarehouseId !== undefined ? toWarehouseId : existing.toWarehouseId,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity)
            }))
          } : undefined
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED') {
        await postTransferDocument(tx, {
          tenantId: req.tenantId,
          fromWarehouseId: saved.fromWarehouseId,
          toWarehouseId: saved.toWarehouseId,
          items,
          referenceId: saved.id,
          date: saved.date,
          createdBy: req.user?.userId || null
        });
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    return sendError(res, error, 'Failed to update Stock Transfer');
  }
};

const deleteStockTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockTransfer.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Stock Transfer' });
  }
};

const getValuation = async (req, res) => {
  try {
    const report = await valuation(prisma, {
      tenantId: req.tenantId,
      warehouseId: req.query.warehouseId,
      productId: req.query.productId
    });
    res.json(report);
  } catch (error) {
    return sendError(res, error, 'Failed to value stock');
  }
};

const costingReceive = async (req, res) => {
  try {
    const layer = await prisma.$transaction((tx) => receiveLayer(tx, {
      tenantId: req.tenantId,
      productId: req.body.productId,
      warehouseId: req.body.warehouseId,
      quantity: req.body.quantity,
      unitCost: req.body.unitCost,
      sourceType: req.body.referenceType,
      sourceId: req.body.referenceId || null,
      receivedAt: req.body.receivedAt || null
    }));
    res.status(201).json(layer);
  } catch (error) {
    return sendError(res, error, 'Failed to receive cost layer');
  }
};

const costingIssue = async (req, res) => {
  try {
    const fifo = await prisma.$transaction(async (tx) => {
      const result = await issueFifo(tx, {
        tenantId: req.tenantId,
        productId: req.body.productId,
        warehouseId: req.body.warehouseId,
        quantity: req.body.quantity,
        strictWarehouse: true
      });
      return result;
    });
    res.status(201).json(fifo);
  } catch (error) {
    return sendError(res, error, 'Failed to issue FIFO cost');
  }
};

module.exports = {
  getStockLedger,
  getStockMovements,
  createStockMovement,
  deleteStockMovement,
  getGoodsIssues,
  createGoodsIssue,
  updateGoodsIssue,
  deleteGoodsIssue,
  getStockAdjustments,
  createStockAdjustment,
  updateStockAdjustment,
  deleteStockAdjustment,
  cancelStockAdjustment,
  getInventoryReport,
  getValuation,
  costingReceive,
  costingIssue,
  
  // New Stock Receipts & Transfers
  getStockReceipts,
  createStockReceipt,
  updateStockReceipt,
  deleteStockReceipt,
  getStockTransfers,
  createStockTransfer,
  updateStockTransfer,
  deleteStockTransfer
};
