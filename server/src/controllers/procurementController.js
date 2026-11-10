const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');

// --- PURCHASE ORDERS ---
const getPurchaseOrders = async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { tenantId: req.tenantId },
      include: { 
        supplier: true,
        currency: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(orders);
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

    const order = await prisma.purchaseOrder.create({
      data: {
        tenantId: req.tenantId,
        supplierId,
        poNumber,
        date: new Date(date),
        status: status || 'PENDING',
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

    if (prId) {
      await prisma.purchaseRequisition.update({
        where: { id: prId },
        data: { status: 'CONVERTED' }
      });
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Failed to create PO:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.purchaseOrder.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete purchase order' });
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

    const grnNumber = await generateDocumentNumber(
      req.tenantId,
      'gRN',
      'GRN',
      'grnNumber'
    );

    // Create the GRN
    const grn = await prisma.gRN.create({
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
            quantityOrdered: parseFloat(item.quantityOrdered || item.quantityReceived)
          }))
        }
      }
    });

    // Create stock movements to increase stock (Goods Receipt)
    for (const item of items) {
      await prisma.stockMovement.create({
        data: {
          tenantId: req.tenantId,
          productId: item.productId,
          type: 'GR',
          quantity: parseFloat(item.quantityReceived),
          referenceType: 'GRN',
          referenceId: grn.id,
          warehouseId: warehouseId,
          createdBy: req.user.userId
        }
      });
    }

    // Optionally update PurchaseOrder status to RECEIVED
    if (poId) {
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'RECEIVED' }
      });
    }

    res.status(201).json(grn);
  } catch (error) {
    console.error('Failed to create GRN:', error);
    res.status(500).json({ error: 'Failed to create GRN' });
  }
};

const deleteGrn = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.gRN.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete GRN' });
  }
};

module.exports = {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getGrns,
  createGrn,
  deleteGrn
};
