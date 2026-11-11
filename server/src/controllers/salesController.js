const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { sendError } = require('../services/errors');
const { dec, money, rateOf } = require('../services/money');
const {
  postIssueDocument,
  cancelStockAndJournal,
  assertQuotationQuantity,
  refreshQuotationStatus,
  assessCredit,
  creditWarning,
  finalizeSalesInvoice,
  customerAging,
  customerStatement
} = require('../services/documentPosting');
const { createDraftsForSalesOrder } = require('../services/production/workOrders');
const { DocumentError } = require('../services/errors');
const { writeAudit } = require('../services/auditService');
const { respondList } = require('../services/listQuery');
const { loadRule, levelsForAmount, submitForApproval } = require('../services/approvalService');
const { num } = require('../services/money');

const isDocumentModifiable = (status) => {
  if (!status) return true;
  return ['DRAFT', 'PENDING', 'RETURNED'].includes(status.toUpperCase());
};

const BLOCKED_ORDER = ['PENDING_APPROVAL', 'REJECTED', 'RETURNED', 'CANCELLED'];

async function creditHold(db, { tenantId, customerId, amount, status }) {
  const releasing = !['DRAFT'].includes(String(status || 'PENDING').toUpperCase());
  const exposure = await assessCredit(db, { tenantId, customerId, documentBase: amount });
  if (!releasing || !exposure.blocked) return { exposure, hold: false };
  const rule = await loadRule(db, tenantId, 'SALES_ORDER_CREDIT');
  const needed = levelsForAmount(rule, amount);
  if (!rule?.enabled) {
    throw new DocumentError(exposure.message, { credit: exposure.message });
  }
  if (!needed.length) return { exposure, hold: false, auto: true };
  return { exposure, hold: true };
}

async function priceVariance(db, { tenantId, customerId, items }) {
  const customer = await db.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer?.priceList || !items?.length) return 0;
  const list = await db.priceList.findFirst({
    where: { tenantId, name: customer.priceList },
    include: { prices: true }
  });
  if (!list) return 0;
  let variance = 0;
  for (const item of items) {
    const row = list.prices.find((price) => price.productId === item.productId);
    if (!row) continue;
    const diff = Math.abs(num(item.unitPrice) - num(row.price));
    if (diff > 0.0001) variance += diff * num(item.quantity);
  }
  return variance;
}

// --- QUOTATIONS ---
const getQuotations = async (req, res) => {
  try {
    const quotations = await prisma.salesQuotation.findMany({
      where: { tenantId: req.tenantId },
      include: { 
        customer: true,
        currency: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(quotations);
  } catch (error) {
    console.error('Fetch quotations error:', error);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
};

const createQuotation = async (req, res) => {
  try {
    const { customerId, date, status, items, currencyId, exchangeRate } = req.body;
    
    const finalQuotationNumber = await generateDocumentNumber(
      req.tenantId, 
      'salesQuotation', 
      'QUO', 
      'quotationNumber'
    );

    let totalAmount = 0;
    if (items && items.length > 0) {
      for (const item of items) {
        totalAmount += parseFloat(item.total || 0);
      }
    }

    const quotation = await prisma.salesQuotation.create({
      data: {
        tenantId: req.tenantId,
        customerId,
        quotationNumber: finalQuotationNumber,
        date: new Date(date),
        status: status || 'DRAFT',
        total: totalAmount,
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        createdBy: req.user.userId,
        items: items && items.length > 0 ? {
          create: items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity || 0),
            unitPrice: parseFloat(item.unitPrice || 0),
            total: parseFloat(item.total || 0)
          }))
        } : undefined
      },
      include: { 
        customer: true,
        currency: true,
        items: { include: { product: true } }
      }
    });

    res.status(201).json(quotation);
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
};

const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, date, status, items, currencyId, exchangeRate } = req.body;
    
    const existing = await prisma.salesQuotation.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Quotation not found' });
    
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be modified' });
    }

    let totalAmount = 0;
    if (items && items.length > 0) {
      for (const item of items) {
        totalAmount += parseFloat(item.total || 0);
      }
    }

    // Update main quotation record
    const quotation = await prisma.salesQuotation.update({
      where: { id, tenantId: req.tenantId },
      data: {
        customerId,
        date: date ? new Date(date) : undefined,
        status: status || undefined,
        total: totalAmount,
        currencyId: currencyId !== undefined ? currencyId : undefined,
        exchangeRate: exchangeRate !== undefined ? parseFloat(exchangeRate) : undefined,
        // Delete all items first for a clean sync
        items: items ? {
          deleteMany: {},
          create: items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity || 0),
            unitPrice: parseFloat(item.unitPrice || 0),
            total: parseFloat(item.total || 0)
          }))
        } : undefined
      },
      include: { 
        customer: true,
        currency: true,
        items: { include: { product: true } }
      }
    });

    res.json(quotation);
  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(500).json({ error: 'Failed to update quotation' });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salesQuotation.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Quotation not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be deleted' });
    }
    await prisma.salesQuotation.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete quotation' });
  }
};

// --- SALES ORDERS ---
const getOrders = async (req, res) => {
  try {
    await respondList(req, res, {
      model: prisma.salesOrder,
      where: { tenantId: req.tenantId },
      include: {
        customer: true,
        quotation: true,
        currency: true,
        items: { include: { product: true } },
        deliveries: { include: { items: true } },
        salesInvoices: { include: { items: true } }
      },
      search: ['orderNumber', 'status', 'customer.name'],
      sortFields: ['date', 'orderNumber', 'total', 'status', 'createdAt'],
      defaultSort: 'date',
      filename: 'sales-orders.xlsx',
      exportHeaders: ['date', 'orderNumber', 'customer', 'total', 'status'],
      toExport: (row) => ({
        date: row.date?.toISOString?.().slice(0, 10) || '',
        orderNumber: row.orderNumber,
        customer: row.customer?.name || '',
        total: String(row.total),
        status: row.status
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const createOrder = async (req, res) => {
  try {
    const { customerId, quotationId, date, status, items, currencyId, exchangeRate } = req.body;
    
    const finalOrderNumber = await generateDocumentNumber(
      req.tenantId, 
      'salesOrder', 
      'SO', 
      'orderNumber'
    );

    if (quotationId) {
      await assertQuotationQuantity(prisma, {
        tenantId: req.tenantId,
        quotationId,
        items
      });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));
    const baseTotal = totalAmount * (parseFloat(exchangeRate) || 1);
    const hold = await creditHold(prisma, {
      tenantId: req.tenantId,
      customerId,
      amount: baseTotal,
      status: status || 'PENDING'
    });
    const variance = await priceVariance(prisma, { tenantId: req.tenantId, customerId, items });
    const priceRule = variance > 0 ? await loadRule(prisma, req.tenantId, 'PRICE_OVERRIDE') : null;
    const priceNeeded = levelsForAmount(priceRule, variance);
    const holdPrice = Boolean(priceRule?.enabled && priceNeeded.length);

    const order = await prisma.salesOrder.create({
      data: {
        tenantId: req.tenantId,
        customerId,
        quotationId: quotationId || null,
        orderNumber: finalOrderNumber,
        date: new Date(date),
        status: (hold.hold || holdPrice) ? 'PENDING_APPROVAL' : (status || 'PENDING'),
        total: totalAmount,
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        createdBy: req.user.userId,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            total: parseFloat(item.total)
          }))
        }
      }
    });

    if (quotationId) await refreshQuotationStatus(prisma, quotationId);
    if (hold.exposure.blocked && (hold.hold || hold.auto)) {
      await submitForApproval(prisma, {
        tenantId: req.tenantId,
        documentType: 'SALES_ORDER_CREDIT',
        documentId: order.id,
        documentNumber: order.orderNumber,
        amount: baseTotal,
        userId: req.user.userId
      });
    }
    if (variance > 0 && priceRule?.enabled) {
      await submitForApproval(prisma, {
        tenantId: req.tenantId,
        documentType: 'PRICE_OVERRIDE',
        documentId: order.id,
        documentNumber: order.orderNumber,
        amount: variance,
        userId: req.user.userId
      });
    }
    order.creditWarning = hold.exposure.message;
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'CREATE',
      entity: 'SALES_ORDER',
      entityId: order.id,
      after: order
    });
    await createDraftsForSalesOrder({
      tenantId: req.tenantId,
      userId: req.user?.userId || null,
      salesOrderId: order.id
    });
    res.status(201).json(order);
  } catch (error) {
    return sendError(res, error, 'Failed to create order');
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, quotationId, date, status, items, currencyId, exchangeRate } = req.body;

    const existing = await prisma.salesOrder.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be modified' });
    }

    const linkedQuotationId = quotationId !== undefined ? quotationId : existing.quotationId;
    if (linkedQuotationId && items) {
      const sourceQuo = await prisma.salesQuotation.findFirst({
        where: { id: linkedQuotationId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (sourceQuo) {
        const sourceProductIds = sourceQuo.items.map(item => item.productId);
        const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
        if (invalidItem) {
          return res.status(400).json({ error: 'Cannot add new products that are not in the source quotation.' });
        }
      }
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    await prisma.salesOrderItem.deleteMany({
      where: { orderId: id }
    });

    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        customerId,
        date: new Date(date),
        status: status || 'PENDING',
        total: totalAmount,
        currencyId: currencyId !== undefined ? currencyId : existing.currencyId,
        exchangeRate: exchangeRate !== undefined ? parseFloat(exchangeRate) : existing.exchangeRate,
        items: items && items.length > 0 ? {
          create: items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity || 0),
            unitPrice: parseFloat(item.unitPrice || 0),
            total: parseFloat(item.total || 0)
          }))
        } : undefined
      },
      include: { 
        customer: true,
        currency: true,
        items: { include: { product: true } }
      }
    });

    await createDraftsForSalesOrder({
      tenantId: req.tenantId,
      userId: req.user?.userId || null,
      salesOrderId: order.id
    });

    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salesOrder.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be deleted' });
    }
    await prisma.salesOrder.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
};

// --- SALES DELIVERIES ---
const updateOrderStatusOnDelivery = async (orderId, db = prisma) => {
  if (!orderId) return;
  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) return;

  const completedDeliveries = await db.salesDelivery.findMany({
    where: { orderId, status: 'DELIVERED' },
    include: { items: true }
  });

  const shippedQtyMap = {};
  for (const delivery of completedDeliveries) {
    for (const item of delivery.items) {
      shippedQtyMap[item.productId] = (shippedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
    }
  }

  let allFullyShipped = true;
  let anyShipped = false;
  for (const ordItem of order.items) {
    const shippedQty = shippedQtyMap[ordItem.productId] || 0;
    if (shippedQty < ordItem.quantity) {
      allFullyShipped = false;
    }
    if (shippedQty > 0) {
      anyShipped = true;
    }
  }

  let newStatus = order.status;
  if (allFullyShipped) {
    newStatus = 'DELIVERED';
  } else if (anyShipped) {
    newStatus = 'PARTIALLY_DELIVERED';
  } else {
    newStatus = 'PENDING';
  }

  await db.salesOrder.update({
    where: { id: orderId },
    data: { status: newStatus }
  });
};

const getDeliveries = async (req, res) => {
  try {
    const deliveries = await prisma.salesDelivery.findMany({
      where: { tenantId: req.tenantId },
      include: { 
        customer: true, 
        order: true, 
        items: { include: { product: true } },
        invoices: { include: { items: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
};

const createDelivery = async (req, res) => {
  try {
    const { customerId, orderId, date, status, items, warehouseId } = req.body;
    
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse is required' });
    }

    if (orderId) {
      const sourceOrd = await prisma.salesOrder.findFirst({
        where: { id: orderId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (!sourceOrd) {
        return res.status(404).json({ error: 'Source order not found' });
      }
      if (BLOCKED_ORDER.includes(String(sourceOrd.status || '').toUpperCase())) {
        return res.status(400).json({ error: 'This sales order cannot be released until it is approved.' });
      }
      const sourceProductIds = sourceOrd.items.map(item => item.productId);
      const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
      if (invalidItem) {
        return res.status(400).json({ error: 'Cannot add new products that are not in the source order.' });
      }

      // Check cumulative delivery quantity limits (over-delivery validation)
      const completedDeliveries = await prisma.salesDelivery.findMany({
        where: { orderId, status: 'DELIVERED', tenantId: req.tenantId },
        include: { items: true }
      });

      const shippedQtyMap = {};
      for (const delivery of completedDeliveries) {
        for (const item of delivery.items) {
          shippedQtyMap[item.productId] = (shippedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
        }
      }

      for (const item of items) {
        const ordItem = sourceOrd.items.find(oi => oi.productId === item.productId);
        const orderedQty = ordItem ? ordItem.quantity : 0;
        const alreadyShipped = shippedQtyMap[item.productId] || 0;
        const newQty = parseFloat(item.quantity || 0);

        if (alreadyShipped + newQty > orderedQty) {
          return res.status(400).json({
            error: `Requested delivery quantity (${newQty}) exceeds the remaining ordered quantity (${orderedQty - alreadyShipped}).`
          });
        }
      }
    }

    const finalDeliveryNumber = await generateDocumentNumber(
      req.tenantId, 
      'salesDelivery', 
      'DO', 
      'deliveryNumber'
    );

    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.salesDelivery.create({
        data: {
          tenantId: req.tenantId,
          customerId,
          orderId: orderId || null,
          deliveryNumber: finalDeliveryNumber,
          date: new Date(date),
          warehouseId: warehouseId,
          status: status || 'DELIVERED',
          createdBy: req.user.userId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity)
            }))
          }
        }
      });

      if (created.status === 'DELIVERED') {
        const savedItems = await tx.salesDeliveryItem.findMany({ where: { deliveryId: created.id } });
        const posted = await postIssueDocument(tx, {
          tenantId: req.tenantId,
          warehouseId,
          items: savedItems,
          referenceType: 'SALES_DELIVERY',
          referenceId: created.id,
          date,
          createdBy: req.user.userId,
          description: `Delivery ${finalDeliveryNumber}`,
          quantitySign: -1
        });
        for (const result of posted.results) {
          if (!result.itemId) continue;
          await tx.salesDeliveryItem.update({
            where: { id: result.itemId },
            data: { unitCost: dec(result.unitCost), costValue: dec(result.value) }
          });
        }
        if (orderId) await updateOrderStatusOnDelivery(orderId, tx);
      }
      return created;
    });

    res.status(201).json(delivery);
  } catch (error) {
    return sendError(res, error, 'Failed to create delivery');
  }
};

const updateDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, orderId, date, status, items } = req.body;

    const existing = await prisma.salesDelivery.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) return res.status(404).json({ error: 'Delivery not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be modified' });
    }

    const linkedOrderId = orderId !== undefined ? orderId : existing.orderId;
    if (linkedOrderId && items) {
      const sourceOrd = await prisma.salesOrder.findFirst({
        where: { id: linkedOrderId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (sourceOrd) {
        const sourceProductIds = sourceOrd.items.map(item => item.productId);
        const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
        if (invalidItem) {
          return res.status(400).json({ error: 'Cannot add new products that are not in the source order.' });
        }

        // Check cumulative delivery quantity limits (over-delivery validation)
        const completedDeliveries = await prisma.salesDelivery.findMany({
          where: { 
            orderId: linkedOrderId, 
            status: 'DELIVERED', 
            tenantId: req.tenantId,
            id: { not: id } // Exclude the current delivery being updated
          },
          include: { items: true }
        });

        const shippedQtyMap = {};
        for (const delivery of completedDeliveries) {
          for (const item of delivery.items) {
            shippedQtyMap[item.productId] = (shippedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
          }
        }

        for (const item of items) {
          const ordItem = sourceOrd.items.find(oi => oi.productId === item.productId);
          const orderedQty = ordItem ? ordItem.quantity : 0;
          const alreadyShipped = shippedQtyMap[item.productId] || 0;
          const newQty = parseFloat(item.quantity || 0);

          if (alreadyShipped + newQty > orderedQty) {
            return res.status(400).json({
              error: `Requested delivery quantity (${newQty}) exceeds the remaining ordered quantity (${orderedQty - alreadyShipped}).`
            });
          }
        }
      }
    }

    const delivery = await prisma.$transaction(async (tx) => {
      await tx.salesDeliveryItem.deleteMany({
        where: { deliveryId: id }
      });

      const updated = await tx.salesDelivery.update({
        where: { id },
        data: {
          customerId,
          orderId: orderId || null,
          date: new Date(date),
          status: status || 'PENDING',
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity || 0)
            }))
          } : undefined
        },
        include: {
          customer: true,
          items: { include: { product: true } }
        }
      });

      if (updated.status === 'DELIVERED' && existing.status !== 'DELIVERED') {
        const savedItems = await tx.salesDeliveryItem.findMany({ where: { deliveryId: updated.id } });
        const posted = await postIssueDocument(tx, {
          tenantId: req.tenantId,
          warehouseId: existing.warehouseId,
          items: savedItems,
          referenceType: 'SALES_DELIVERY',
          referenceId: updated.id,
          date: updated.date,
          createdBy: req.user.userId,
          description: `Delivery ${existing.deliveryNumber}`,
          quantitySign: -1
        });
        for (const result of posted.results) {
          if (!result.itemId) continue;
          await tx.salesDeliveryItem.update({
            where: { id: result.itemId },
            data: { unitCost: dec(result.unitCost), costValue: dec(result.value) }
          });
        }
      }

      if (linkedOrderId) await updateOrderStatusOnDelivery(linkedOrderId, tx);
      return updated;
    });

    res.json(delivery);
  } catch (error) {
    return sendError(res, error, 'Failed to update delivery');
  }
};

const deleteDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salesDelivery.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Delivery not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be deleted' });
    }
    const orderId = existing.orderId;
    await prisma.$transaction(async (tx) => {
      await tx.salesDelivery.delete({ where: { id } });
      if (orderId) await updateOrderStatusOnDelivery(orderId, tx);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete delivery' });
  }
};

// --- SALES INVOICES ---
const getInvoices = async (req, res) => {
  try {
    await respondList(req, res, {
      model: prisma.salesInvoice,
      where: { tenantId: req.tenantId },
      include: {
        customer: true,
        order: true,
        delivery: true,
        currency: true,
        items: { include: { product: true } }
      },
      search: ['invoiceNumber', 'status', 'customer.name'],
      sortFields: ['date', 'invoiceNumber', 'total', 'status', 'createdAt'],
      defaultSort: 'date',
      filename: 'invoices.xlsx',
      exportHeaders: ['date', 'invoiceNumber', 'customer', 'total', 'status'],
      toExport: (row) => ({
        date: row.date?.toISOString?.().slice(0, 10) || '',
        invoiceNumber: row.invoiceNumber,
        customer: row.customer?.name || '',
        total: String(row.total),
        status: row.status
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

const createInvoice = async (req, res) => {
  try {
    const { customerId, orderId, deliveryId, date, status, items, currencyId, exchangeRate } = req.body;
    
    const finalInvoiceNumber = await generateDocumentNumber(
      req.tenantId, 
      'salesInvoice', 
      'INV', 
      'invoiceNumber'
    );

    if (orderId) {
      const sourceOrd = await prisma.salesOrder.findFirst({
        where: { id: orderId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (!sourceOrd) {
        return res.status(404).json({ error: 'Source order not found' });
      }
      if (BLOCKED_ORDER.includes(String(sourceOrd.status || '').toUpperCase())) {
        return res.status(400).json({ error: 'This sales order cannot be released until it is approved.' });
      }
      const sourceProductIds = sourceOrd.items.map(item => item.productId);
      const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
      if (invalidItem) {
        return res.status(400).json({ error: 'Cannot add new products that are not in the source order.' });
      }

      // Check cumulative invoiced quantity limits
      const existingInvoices = await prisma.salesInvoice.findMany({
        where: { orderId, tenantId: req.tenantId },
        include: { items: true }
      });
      const invoicedQtyMap = {};
      for (const inv of existingInvoices) {
        for (const item of inv.items) {
          invoicedQtyMap[item.productId] = (invoicedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
        }
      }
      for (const item of items) {
        const ordItem = sourceOrd.items.find(oi => oi.productId === item.productId);
        const orderedQty = ordItem ? ordItem.quantity : 0;
        const alreadyInvoiced = invoicedQtyMap[item.productId] || 0;
        const newQty = parseFloat(item.quantity || 0);
        if (alreadyInvoiced + newQty > orderedQty) {
          return res.status(400).json({
            error: `Requested invoice quantity (${newQty}) exceeds the remaining ordered quantity (${orderedQty - alreadyInvoiced}).`
          });
        }
      }
    }

    if (deliveryId) {
      const sourceDel = await prisma.salesDelivery.findFirst({
        where: { id: deliveryId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (!sourceDel) {
        return res.status(404).json({ error: 'Source delivery docket not found' });
      }
      const sourceProductIds = sourceDel.items.map(item => item.productId);
      const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
      if (invalidItem) {
        return res.status(400).json({ error: 'Cannot add new products that are not in the source delivery docket.' });
      }

      // Check cumulative invoiced quantity limits
      const existingInvoices = await prisma.salesInvoice.findMany({
        where: { deliveryId, tenantId: req.tenantId },
        include: { items: true }
      });
      const invoicedQtyMap = {};
      for (const inv of existingInvoices) {
        for (const item of inv.items) {
          invoicedQtyMap[item.productId] = (invoicedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
        }
      }
      for (const item of items) {
        const delItem = sourceDel.items.find(di => di.productId === item.productId);
        const deliveredQty = delItem ? delItem.quantity : 0;
        const alreadyInvoiced = invoicedQtyMap[item.productId] || 0;
        const newQty = parseFloat(item.quantity || 0);
        if (alreadyInvoiced + newQty > deliveredQty) {
          return res.status(400).json({
            error: `Requested invoice quantity (${newQty}) exceeds the remaining delivered quantity (${deliveredQty - alreadyInvoiced}).`
          });
        }
      }
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const invoiceStatus = status || 'UNPAID';
    const warning = await creditWarning(prisma, {
      tenantId: req.tenantId,
      customerId,
      documentBase: totalAmount * rateOf(exchangeRate)
    });
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.salesInvoice.create({
        data: {
          tenantId: req.tenantId,
          customerId,
          orderId: orderId || null,
          deliveryId: deliveryId || null,
          invoiceNumber: finalInvoiceNumber,
          date: new Date(date),
          status: invoiceStatus,
          total: totalAmount,
          subtotal: totalAmount,
          currencyId: currencyId || null,
          exchangeRate: rateOf(exchangeRate),
          createdBy: req.user.userId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total)
            }))
          }
        }
      });
      if (!['DRAFT', 'PENDING'].includes(String(invoiceStatus).toUpperCase())) {
        return finalizeSalesInvoice(tx, { tenantId: req.tenantId, invoiceId: created.id, createdBy: req.user.userId });
      }
      return created;
    });
    invoice.creditWarning = warning;
    res.status(201).json(invoice);
  } catch (error) {
    return sendError(res, error, 'Failed to create invoice');
  }
};

const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, orderId, deliveryId, date, status, items, currencyId, exchangeRate } = req.body;

    const existing = await prisma.salesInvoice.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) return res.status(404).json({ error: 'Invoice not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be modified' });
    }

    const linkedOrderId = orderId !== undefined ? orderId : existing.orderId;
    const linkedDeliveryId = deliveryId !== undefined ? deliveryId : existing.deliveryId;
    if (linkedOrderId && items) {
      const sourceOrd = await prisma.salesOrder.findFirst({
        where: { id: linkedOrderId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (sourceOrd) {
        const sourceProductIds = sourceOrd.items.map(item => item.productId);
        const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
        if (invalidItem) {
          return res.status(400).json({ error: 'Cannot add new products that are not in the source order.' });
        }

        // Check cumulative invoiced quantity limits
        const existingInvoices = await prisma.salesInvoice.findMany({
          where: { 
            orderId: linkedOrderId, 
            tenantId: req.tenantId,
            id: { not: id }
          },
          include: { items: true }
        });
        const invoicedQtyMap = {};
        for (const inv of existingInvoices) {
          for (const item of inv.items) {
            invoicedQtyMap[item.productId] = (invoicedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
          }
        }
        for (const item of items) {
          const ordItem = sourceOrd.items.find(oi => oi.productId === item.productId);
          const orderedQty = ordItem ? ordItem.quantity : 0;
          const alreadyInvoiced = invoicedQtyMap[item.productId] || 0;
          const newQty = parseFloat(item.quantity || 0);
          if (alreadyInvoiced + newQty > orderedQty) {
            return res.status(400).json({
              error: `Requested invoice quantity (${newQty}) exceeds the remaining ordered quantity (${orderedQty - alreadyInvoiced}).`
            });
          }
        }
      }
    }
    if (linkedDeliveryId && items) {
      const sourceDel = await prisma.salesDelivery.findFirst({
        where: { id: linkedDeliveryId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (sourceDel) {
        const sourceProductIds = sourceDel.items.map(item => item.productId);
        const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
        if (invalidItem) {
          return res.status(400).json({ error: 'Cannot add new products that are not in the source delivery docket.' });
        }

        // Check cumulative invoiced quantity limits
        const existingInvoices = await prisma.salesInvoice.findMany({
          where: { 
            deliveryId: linkedDeliveryId, 
            tenantId: req.tenantId,
            id: { not: id }
          },
          include: { items: true }
        });
        const invoicedQtyMap = {};
        for (const inv of existingInvoices) {
          for (const item of inv.items) {
            invoicedQtyMap[item.productId] = (invoicedQtyMap[item.productId] || 0) + parseFloat(item.quantity);
          }
        }
        for (const item of items) {
          const delItem = sourceDel.items.find(di => di.productId === item.productId);
          const deliveredQty = delItem ? delItem.quantity : 0;
          const alreadyInvoiced = invoicedQtyMap[item.productId] || 0;
          const newQty = parseFloat(item.quantity || 0);
          if (alreadyInvoiced + newQty > deliveredQty) {
            return res.status(400).json({
              error: `Requested invoice quantity (${newQty}) exceeds the remaining delivered quantity (${deliveredQty - alreadyInvoiced}).`
            });
          }
        }
      }
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));
    const nextStatus = status || 'PENDING';

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.salesInvoiceItem.deleteMany({ where: { invoiceId: id } });
      const updated = await tx.salesInvoice.update({
        where: { id },
        data: {
          customerId,
          orderId: orderId || null,
          deliveryId: deliveryId || null,
          date: new Date(date),
          status: nextStatus,
          total: totalAmount,
          subtotal: totalAmount,
          currencyId: currencyId !== undefined ? currencyId : existing.currencyId,
          exchangeRate: exchangeRate !== undefined ? parseFloat(exchangeRate) : existing.exchangeRate,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity || 0),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          customer: true,
          currency: true,
          items: { include: { product: true } }
        }
      });
      if (!['DRAFT', 'PENDING'].includes(String(nextStatus).toUpperCase())) {
        return finalizeSalesInvoice(tx, { tenantId: req.tenantId, invoiceId: id, createdBy: req.user.userId });
      }
      return updated;
    });

    res.json(invoice);
  } catch (error) {
    return sendError(res, error, 'Failed to update invoice');
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salesInvoice.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });
    if (!isDocumentModifiable(existing.status)) {
      return res.status(403).json({ error: 'Document is finalized and cannot be deleted' });
    }
    await prisma.salesInvoice.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};

const cancelDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salesDelivery.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Delivery not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Delivery is already cancelled.' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    const billed = await prisma.salesInvoice.count({
      where: { deliveryId: id, tenantId: req.tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }
    });
    if (billed) return res.status(400).json({ error: 'Cancel the sales invoice before cancelling this delivery.' });
    await prisma.$transaction(async (tx) => {
      if (existing.status === 'DELIVERED') {
        await cancelStockAndJournal(tx, {
          tenantId: req.tenantId,
          referenceType: 'SALES_DELIVERY',
          referenceId: id,
          date: new Date(),
          createdBy: req.user?.userId,
          description: existing.deliveryNumber
        });
      }
      await tx.salesDelivery.update({ where: { id }, data: { status: 'CANCELLED' } });
      if (existing.orderId) await updateOrderStatusOnDelivery(existing.orderId, tx);
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user?.userId,
        action: existing.status === 'DELIVERED' ? 'REVERSE' : 'STATUS',
        entity: 'SALES_DELIVERY',
        entityId: id,
        before: existing,
        after: { status: 'CANCELLED', reason }
      });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel delivery');
  }
};

const cancelInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salesInvoice.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Invoice is already cancelled.' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    if (money(existing.amountPaid) > 0.0001) {
      return res.status(400).json({ error: 'Remove the receipt allocation before cancelling this invoice.' });
    }
    await prisma.$transaction(async (tx) => {
      await cancelStockAndJournal(tx, {
        tenantId: req.tenantId,
        referenceType: 'SALES_INVOICE',
        referenceId: id,
        date: new Date(),
        createdBy: req.user?.userId,
        description: existing.invoiceNumber
      });
      await tx.salesInvoice.update({ where: { id }, data: { status: 'CANCELLED' } });
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user?.userId,
        action: 'REVERSE',
        entity: 'SALES_INVOICE',
        entityId: id,
        before: existing,
        after: { status: 'CANCELLED', reason }
      });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel invoice');
  }
};

const getCustomerAging = async (req, res) => {
  try {
    res.json(await customerAging(prisma, req.tenantId));
  } catch (error) {
    res.status(500).json({ error: 'Failed to build customer aging' });
  }
};

const getCustomerStatement = async (req, res) => {
  try {
    const statement = await customerStatement(prisma, req.tenantId, req.params.id);
    if (!statement) return res.status(404).json({ error: 'Customer not found' });
    res.json(statement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to build customer statement' });
  }
};

module.exports = {
  getQuotations, createQuotation, updateQuotation, deleteQuotation,
  getOrders, createOrder, deleteOrder, updateOrder,
  getDeliveries, createDelivery, deleteDelivery, updateDelivery, cancelDelivery,
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  cancelInvoice,
  getCustomerAging,
  getCustomerStatement
};
