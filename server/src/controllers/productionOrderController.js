const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { syncLegacy } = require('../services/production/workOrders');

const mirrorOrder = async (order, { receiptOnComplete = false, userId = null, db = prisma } = {}) => {
  if (!order) return null;
  return syncLegacy(db, {
    tenantId: order.tenantId,
    userId: userId || order.createdBy || null,
    legacy: order,
    kind: 'order',
    sourceType: 'MIGRATED_ORDER',
    receiptOnComplete
  });
};

const getProductionOrders = async (req, res) => {
  try {
    const orders = await prisma.productionOrder.findMany({
      where: { tenantId: req.tenantId },
      include: {
        product: {
          select: { id: true, code: true, name: true, standardCost: true }
        },
        bom: {
          select: { id: true, code: true, name: true, version: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error('Fetch production orders error:', error);
    res.status(500).json({ error: 'Failed to fetch production orders' });
  }
};

const createProductionOrder = async (req, res) => {
  try {
    const { productId, bomId, quantity, status, startDate, endDate, assignedTo, workCenterId, notes } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product is required' });
    }
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });
    if (!product) {
      return res.status(400).json({ error: 'Product not found' });
    }
    if (product.activeStatus === 'INACTIVE') {
      return res.status(400).json({ error: 'Inactive products cannot be planned' });
    }

    let finalBomId = bomId;
    if (!finalBomId) {
      const activeBom = await prisma.bOM.findFirst({
        where: {
          tenantId: req.tenantId,
          productId,
          status: 'ACTIVE',
          isDefault: true
        }
      });
      if (activeBom) {
        finalBomId = activeBom.id;
      }
    }

    const orderNumber = await generateDocumentNumber(
      req.tenantId,
      'productionOrder',
      'MPO',
      'orderNumber'
    );

    const order = await prisma.productionOrder.create({
      data: {
        tenantId: req.tenantId,
        orderNumber,
        productId,
        bomId: finalBomId || null,
        quantity: parsedQty,
        status: status || 'DRAFT',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        assignedTo,
        workCenterId,
        notes,
        createdBy: req.user?.userId || null
      },
      include: {
        product: true,
        bom: true
      }
    });

    await mirrorOrder(order, {
      userId: req.user?.userId || null,
      receiptOnComplete: (status || 'DRAFT') === 'COMPLETED'
    });
    res.status(201).json(order);
  } catch (error) {
    console.error('Create production order error:', error);
    res.status(500).json({ error: 'Failed to create production order' });
  }
};

const updateProductionOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, bomId, quantity, status, startDate, endDate, assignedTo, workCenterId, notes } = req.body;

    const order = await prisma.productionOrder.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!order) {
      return res.status(404).json({ error: 'Production order not found' });
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot update a completed or cancelled production order' });
    }

    let parsedQty = order.quantity;
    if (quantity !== undefined) {
      parsedQty = parseFloat(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than zero' });
      }
    }

    if (productId && productId !== order.productId) {
      const nextProduct = await prisma.product.findFirst({
        where: { id: productId, tenantId: req.tenantId }
      });
      if (!nextProduct) return res.status(400).json({ error: 'Product not found' });
      if (nextProduct.activeStatus === 'INACTIVE') {
        return res.status(400).json({ error: 'Inactive products cannot be planned' });
      }
    }

    const updated = await prisma.productionOrder.update({
      where: { id },
      data: {
        productId: productId !== undefined ? productId : order.productId,
        bomId: bomId !== undefined ? (bomId || null) : order.bomId,
        quantity: parsedQty,
        status: status !== undefined ? status : order.status,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : order.startDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : order.endDate,
        assignedTo: assignedTo !== undefined ? assignedTo : order.assignedTo,
        workCenterId: workCenterId !== undefined ? workCenterId : order.workCenterId,
        notes: notes !== undefined ? notes : order.notes
      },
      include: {
        product: true,
        bom: true
      }
    });

    await mirrorOrder(updated, {
      userId: req.user?.userId || null,
      receiptOnComplete: status === 'COMPLETED' && order.status !== 'COMPLETED'
    });
    res.json(updated);
  } catch (error) {
    console.error('Update production order error:', error);
    res.status(500).json({ error: 'Failed to update production order' });
  }
};

const deleteProductionOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.productionOrder.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!order) {
      return res.status(404).json({ error: 'Production order not found' });
    }

    if (!['DRAFT', 'CANCELLED'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot delete active production orders' });
    }

    await prisma.productionOrder.delete({
      where: { id }
    });

    res.json({ message: 'Production order deleted successfully' });
  } catch (error) {
    console.error('Delete production order error:', error);
    res.status(500).json({ error: 'Failed to delete production order' });
  }
};

module.exports = {
  getProductionOrders,
  createProductionOrder,
  updateProductionOrder,
  deleteProductionOrder
};
