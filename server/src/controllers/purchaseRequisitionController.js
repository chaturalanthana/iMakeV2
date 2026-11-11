const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { sendError } = require('../services/errors');
const { writeAudit } = require('../services/auditService');
const { loadRule, levelsForAmount, submitForApproval } = require('../services/approvalService');

// Fetch all purchase requisitions
const getPurchaseRequisitions = async (req, res) => {
  try {
    const requisitions = await prisma.purchaseRequisition.findMany({
      where: { tenantId: req.tenantId },
      include: {
        supplier: true,
        currency: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(requisitions);
  } catch (error) {
    console.error('Failed to fetch PRs:', error);
    res.status(500).json({ error: 'Failed to fetch purchase requisitions' });
  }
};

// Fetch a single purchase requisition
const getPurchaseRequisitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await prisma.purchaseRequisition.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        supplier: true,
        currency: true,
        items: { include: { product: true } }
      }
    });
    if (!requisition) {
      return res.status(404).json({ error: 'Purchase requisition not found' });
    }
    const orders = await prisma.purchaseOrder.findMany({
      where: { prId: requisition.id, tenantId: req.tenantId, status: { not: 'CANCELLED' } },
      include: { items: true }
    });
    const ordered = {};
    for (const order of orders) {
      for (const item of order.items) {
        ordered[item.productId] = (ordered[item.productId] || 0) + parseFloat(item.quantity);
      }
    }
    for (const item of requisition.items) {
      item.orderedQuantity = ordered[item.productId] || 0;
      item.remainingQuantity = parseFloat(item.quantity) - item.orderedQuantity;
    }
    res.json(requisition);
  } catch (error) {
    console.error('Failed to fetch PR details:', error);
    res.status(500).json({ error: 'Failed to fetch purchase requisition details' });
  }
};

// Create a new purchase requisition
const createPurchaseRequisition = async (req, res) => {
  try {
    const { supplierId, date, status, items, currencyId, exchangeRate } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const prNumber = await generateDocumentNumber(
      req.tenantId,
      'purchaseRequisition',
      'PR',
      'prNumber'
    );
    const rule = await loadRule(prisma, req.tenantId, 'PR');
    const needed = levelsForAmount(rule, totalAmount);
    const hold = Boolean(rule?.enabled && needed.length);

    const requisition = await prisma.purchaseRequisition.create({
      data: {
        tenantId: req.tenantId,
        supplierId: supplierId || null,
        prNumber,
        date: new Date(date),
        status: hold ? 'PENDING_APPROVAL' : (status || 'PENDING'),
        total: totalAmount,
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        createdBy: req.user.userId,
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

    if (rule?.enabled) {
      await submitForApproval(prisma, {
        tenantId: req.tenantId,
        documentType: 'PR',
        documentId: requisition.id,
        documentNumber: requisition.prNumber,
        amount: totalAmount,
        userId: req.user.userId
      });
    }
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'CREATE',
      entity: 'PR',
      entityId: requisition.id,
      after: requisition
    });
    res.status(201).json(requisition);
  } catch (error) {
    return sendError(res, error, 'Failed to create purchase requisition');
  }
};

// Update an existing purchase requisition
const updatePurchaseRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierId, prNumber, date, status, items, currencyId, exchangeRate } = req.body;

    const existing = await prisma.purchaseRequisition.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Purchase requisition not found' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    // Delete existing items
    await prisma.purchaseRequisitionItem.deleteMany({
      where: { prId: id }
    });

    // Update PR metadata and recreate items
    const updated = await prisma.purchaseRequisition.update({
      where: { id },
      data: {
        supplierId: supplierId || null,
        prNumber: prNumber || existing.prNumber,
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
    console.error('Failed to update PR:', error);
    res.status(500).json({ error: 'Failed to update purchase requisition' });
  }
};

// Delete a purchase requisition
const deletePurchaseRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.purchaseRequisition.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Purchase requisition not found' });
    }

    await prisma.purchaseRequisition.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete PR:', error);
    res.status(500).json({ error: 'Failed to delete purchase requisition' });
  }
};

module.exports = {
  getPurchaseRequisitions,
  getPurchaseRequisitionById,
  createPurchaseRequisition,
  updatePurchaseRequisition,
  deletePurchaseRequisition
};
