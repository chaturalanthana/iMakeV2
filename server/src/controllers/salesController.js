const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { createDraftsForSalesOrder } = require('../services/production/workOrders');

const isDocumentModifiable = (status) => {
  if (!status) return true;
  return ['DRAFT', 'PENDING'].includes(status.toUpperCase());
};

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
    const orders = await prisma.salesOrder.findMany({
      where: { tenantId: req.tenantId },
      include: { 
        customer: true, 
        quotation: true,
        currency: true,
        items: { include: { product: true } },
        deliveries: { include: { items: true } },
        salesInvoices: { include: { items: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(orders);
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
      const sourceQuo = await prisma.salesQuotation.findFirst({
        where: { id: quotationId, tenantId: req.tenantId },
        include: { items: true }
      });
      if (!sourceQuo) {
        return res.status(404).json({ error: 'Source quotation not found' });
      }
      const sourceProductIds = sourceQuo.items.map(item => item.productId);
      const invalidItem = items.find(item => !sourceProductIds.includes(item.productId));
      if (invalidItem) {
        return res.status(400).json({ error: 'Cannot add new products that are not in the source quotation.' });
      }
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const order = await prisma.salesOrder.create({
      data: {
        tenantId: req.tenantId,
        customerId,
        quotationId: quotationId || null,
        orderNumber: finalOrderNumber,
        date: new Date(date),
        status: status || 'PENDING',
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

    // Optionally update Quotation status
    if (quotationId) {
      await prisma.salesQuotation.update({
        where: { id: quotationId },
        data: { status: 'ACCEPTED' }
      });
    }

    await createDraftsForSalesOrder({
      tenantId: req.tenantId,
      userId: req.user?.userId || null,
      salesOrderId: order.id
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create order' });
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
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GI',
              quantity: -parseFloat(item.quantity),
              referenceType: 'SALES_DELIVERY',
              referenceId: created.id,
              warehouseId: warehouseId,
              createdBy: req.user.userId
            }
          });
        }
        if (orderId) await updateOrderStatusOnDelivery(orderId, tx);
      }
      return created;
    });

    res.status(201).json(delivery);
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({ error: 'Failed to create delivery' });
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
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GI',
              quantity: -parseFloat(item.quantity),
              referenceType: 'SALES_DELIVERY',
              referenceId: updated.id,
              createdBy: req.user.userId
            }
          });
        }
      }

      if (linkedOrderId) await updateOrderStatusOnDelivery(linkedOrderId, tx);
      return updated;
    });

    res.json(delivery);
  } catch (error) {
    console.error('Update delivery error:', error);
    res.status(500).json({ error: 'Failed to update delivery' });
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
    const invoices = await prisma.salesInvoice.findMany({
      where: { tenantId: req.tenantId },
      include: { 
        customer: true, 
        order: true, 
        delivery: true, 
        currency: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(invoices);
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

    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: req.tenantId,
        customerId,
        orderId: orderId || null,
        deliveryId: deliveryId || null,
        invoiceNumber: finalInvoiceNumber,
        date: new Date(date),
        status: status || 'UNPAID',
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

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invoice' });
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

    // Clear old items
    await prisma.salesInvoiceItem.deleteMany({
      where: { invoiceId: id }
    });

    const invoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        customerId,
        orderId: orderId || null,
        deliveryId: deliveryId || null,
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

    res.json(invoice);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
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

module.exports = {
  getQuotations, createQuotation, updateQuotation, deleteQuotation,
  getOrders, createOrder, deleteOrder, updateOrder,
  getDeliveries, createDelivery, deleteDelivery, updateDelivery,
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice
};
