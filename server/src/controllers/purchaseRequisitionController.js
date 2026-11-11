const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { sendError } = require('../services/errors');
const { writeAudit } = require('../services/auditService');
const { loadRule, levelsForAmount, submitForApproval } = require('../services/approvalService');
const { classifyPurchase } = require('../services/phase2/procurement');

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

    const capexRule = String(req.body.spendClass || '').toUpperCase() === 'CAPEX'
      ? await loadRule(prisma, req.tenantId, 'CAPEX_PR')
      : null;
    const capexNeeded = levelsForAmount(capexRule, totalAmount);
    const holdCapex = Boolean(capexRule?.enabled && capexNeeded.length);

    const requisition = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseRequisition.create({
        data: {
          tenantId: req.tenantId,
          supplierId: supplierId || null,
          prNumber,
          date: new Date(date),
          status: (hold || holdCapex) ? 'PENDING_APPROVAL' : (status || 'PENDING'),
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
      if (req.body.spendClass) {
        await classifyPurchase(tx, {
          tenantId: req.tenantId,
          documentType: 'PR',
          documentId: created.id,
          spendClass: req.body.spendClass,
          glAccountId: req.body.glAccountId,
          costCenterId: req.body.costCenterId,
          profitCenterId: req.body.profitCenterId,
          capitalProjectId: req.body.capitalProjectId,
          amountBase: totalAmount * (parseFloat(exchangeRate) || 1),
          date,
          executiveOverride: req.body.executiveOverride,
          overrideReason: req.body.overrideReason
        });
      }
      if (holdCapex) {
        await submitForApproval(tx, {
          tenantId: req.tenantId,
          documentType: 'CAPEX_PR',
          documentId: created.id,
          documentNumber: created.prNumber,
          amount: totalAmount,
          userId: req.user.userId
        });
      }
      return created;
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

const deletePurchaseRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.purchaseRequisition.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Purchase requisition not found' });
    if (String(existing.status).toUpperCase() !== 'DRAFT') {
      return res.status(400).json({ error: 'Purchase requisitions cannot be deleted. Cancel the requisition and give a reason.' });
    }
    await prisma.purchaseRequisition.delete({ where: { id } });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.userId,
      action: 'DELETE',
      entity: 'PR',
      entityId: id,
      before: existing,
      after: null
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete purchase requisition' });
  }
};

const cancelPurchaseRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    const existing = await prisma.purchaseRequisition.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Purchase requisition not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Purchase requisition is already cancelled.' });
    if (['ORDERED', 'PARTIALLY_ORDERED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cancel the purchase orders before cancelling this requisition.' });
    }
    const { cancelOpenRequests } = require('../services/approvalService');
    const updated = await prisma.$transaction(async (tx) => {
      await cancelOpenRequests(tx, { tenantId: req.tenantId, documentId: id });
      return tx.purchaseRequisition.update({ where: { id }, data: { status: 'CANCELLED' } });
    });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user?.userId,
      action: 'STATUS',
      entity: 'PR',
      entityId: id,
      before: existing,
      after: { ...updated, reason }
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel purchase requisition');
  }
};

module.exports = {
  getPurchaseRequisitions,
  getPurchaseRequisitionById,
  createPurchaseRequisition,
  updatePurchaseRequisition,
  deletePurchaseRequisition,
  cancelPurchaseRequisition
};
