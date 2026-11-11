const { DocumentError } = require('./errors');
const { num } = require('./money');
const { writeAudit } = require('./auditService');
const { assertPeriodOpen } = require('./periodService');

const DOCUMENT_TYPES = [
  { type: 'PR', label: 'Purchase requisition', roleName: 'Procurement', thresholds: [0] },
  { type: 'CAPEX_PR', label: 'Capex purchase requisition', roleName: 'Finance', thresholds: [0] },
  { type: 'PO', label: 'Purchase order', roleName: 'Procurement', thresholds: [50000, 250000] },
  { type: 'SUPPLIER_PAYMENT', label: 'Supplier payment', roleName: 'Finance', thresholds: [10000, 100000] },
  { type: 'JOURNAL', label: 'Journal', roleName: 'Finance', thresholds: [0] },
  { type: 'PARTY_NOTE', label: 'Credit or debit note', roleName: 'Finance', thresholds: [0] },
  { type: 'STOCK_ADJUSTMENT', label: 'Stock adjustment', roleName: 'Finance', thresholds: [0] },
  { type: 'CYCLE_COUNT', label: 'Cycle count variance', roleName: 'Finance', thresholds: [0] },
  { type: 'MATERIAL_REQUEST', label: 'Material request', roleName: 'Procurement', thresholds: [0] },
  { type: 'PRICE_OVERRIDE', label: 'Price override', roleName: 'Sales', thresholds: [0] },
  { type: 'SALES_ORDER_CREDIT', label: 'Sales order credit release', roleName: 'Finance', thresholds: [0] },
  { type: 'CASH_SALE', label: 'Van or factory cash sale', roleName: 'Sales', thresholds: [0] },
  { type: 'SALES_RETURN', label: 'Sales return', roleName: 'Finance', thresholds: [0] },
  { type: 'GATE_PASS', label: 'Gate pass', roleName: 'Warehouse', thresholds: [0] }
];

const LINKS = {
  PR: (row) => `/procurement/purchase-requisitions/${encodeURIComponent(row.documentNumber)}`,
  CAPEX_PR: (row) => `/procurement/purchase-requisitions/${encodeURIComponent(row.documentNumber)}`,
  PO: (row) => `/procurement/purchase-orders/${encodeURIComponent(row.documentNumber)}`,
  SUPPLIER_PAYMENT: (row) => `/finance/vouchers/${encodeURIComponent(row.documentNumber)}`,
  JOURNAL: (row) => `/finance/journals/${encodeURIComponent(row.documentNumber)}`,
  PARTY_NOTE: (row) => `/finance/notes`,
  STOCK_ADJUSTMENT: (row) => `/warehouse/adjustments/${encodeURIComponent(row.documentNumber)}`,
  CYCLE_COUNT: (row) => `/warehouse/cycle-counts/${row.documentId}`,
  MATERIAL_REQUEST: (row) => `/warehouse/material-requests/${row.documentId}`,
  PRICE_OVERRIDE: (row) => `/sales/orders/${encodeURIComponent(row.documentNumber)}`,
  SALES_ORDER_CREDIT: (row) => `/sales/orders/${encodeURIComponent(row.documentNumber)}`,
  CASH_SALE: (row) => `/sales/cash-sales`,
  SALES_RETURN: (row) => `/sales/returns`,
  GATE_PASS: (row) => `/sales/trips`
};

function levelsForAmount(rule, amount) {
  if (!rule?.enabled) return [];
  const value = num(amount);
  return (rule.levels || [])
    .filter((level) => value + 0.0000001 >= num(level.threshold))
    .sort((a, b) => a.sequence - b.sequence);
}

async function loadRule(db, tenantId, documentType) {
  return db.approvalRule.findUnique({
    where: { tenantId_documentType: { tenantId, documentType } },
    include: { levels: { orderBy: { sequence: 'asc' } } }
  });
}

async function ensureDefaultRules(db, tenantId) {
  const roles = await db.role.findMany({ where: { tenantId } });
  const byName = new Map(roles.map((role) => [role.name, role]));
  for (const def of DOCUMENT_TYPES) {
    const existing = await db.approvalRule.findUnique({
      where: { tenantId_documentType: { tenantId, documentType: def.type } }
    });
    if (existing) continue;
    const role = byName.get(def.roleName);
    await db.approvalRule.create({
      data: {
        tenantId,
        documentType: def.type,
        enabled: false,
        allowSelfApprove: false,
        levels: {
          create: def.thresholds.map((threshold, index) => ({
            tenantId,
            sequence: index + 1,
            threshold,
            approverRoleId: role?.id || null
          }))
        }
      }
    });
  }
}

function present(request) {
  if (!request) return null;
  const linkFor = LINKS[request.documentType];
  return {
    ...request,
    link: linkFor ? linkFor(request) : null
  };
}

async function submitForApproval(db, {
  tenantId, documentType, documentId, documentNumber, amount, userId, payload
}) {
  const rule = await loadRule(db, tenantId, documentType);
  if (!rule || !rule.enabled) return { required: false, status: 'NOT_REQUIRED', rule };
  const needed = levelsForAmount(rule, amount);
  const open = await db.approvalRequest.findFirst({
    where: { tenantId, documentType, documentId, status: 'PENDING' }
  });
  if (open) return { required: true, status: 'PENDING', request: open, rule };

  if (!needed.length) {
    const request = await db.approvalRequest.create({
      data: {
        tenantId,
        documentType,
        documentId,
        documentNumber: documentNumber || '',
        amount,
        status: 'APPROVED',
        currentLevel: 0,
        requestedBy: userId || null,
        payload: payload === undefined ? undefined : payload,
        actions: {
          create: [{
            tenantId,
            level: 0,
            action: 'AUTO_APPROVE',
            actorId: userId || null,
            reason: 'Below the approval threshold'
          }]
        }
      },
      include: { actions: true }
    });
    await writeAudit(db, {
      tenantId,
      userId,
      action: 'APPROVE',
      entity: documentType,
      entityId: documentId,
      before: null,
      after: { approvalStatus: 'APPROVED', amount, auto: true }
    });
    return { required: false, status: 'APPROVED', auto: true, request, rule };
  }

  const request = await db.approvalRequest.create({
    data: {
      tenantId,
      documentType,
      documentId,
      documentNumber: documentNumber || '',
      amount,
      status: 'PENDING',
      currentLevel: needed[0].sequence,
      requestedBy: userId || null,
      payload: payload === undefined ? undefined : payload,
      actions: {
        create: [{ tenantId, level: 0, action: 'SUBMIT', actorId: userId || null }]
      }
    },
    include: { actions: true }
  });
  await writeAudit(db, {
    tenantId,
    userId,
    action: 'STATUS',
    entity: documentType,
    entityId: documentId,
    before: null,
    after: { approvalStatus: 'PENDING', amount, level: needed[0].sequence }
  });
  return { required: true, status: 'PENDING', request, rule };
}

async function actorMatches(db, level, userId) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || user.status !== 'ACTIVE') return false;
  if (level.approverUserId && level.approverUserId === userId) return true;
  if (level.approverRoleId && user.roleId === level.approverRoleId) return true;
  return false;
}

async function setDocumentStatus(db, request, status) {
  const id = request.documentId;
  const tenantId = request.tenantId;
  if (request.documentType === 'PR' || request.documentType === 'CAPEX_PR') {
    await db.purchaseRequisition.updateMany({ where: { id, tenantId }, data: { status } });
  } else if (request.documentType === 'PO') {
    await db.purchaseOrder.updateMany({ where: { id, tenantId }, data: { status } });
  } else if (request.documentType === 'PRICE_OVERRIDE' || request.documentType === 'SALES_ORDER_CREDIT') {
    await db.salesOrder.updateMany({ where: { id, tenantId }, data: { status } });
  } else if (request.documentType === 'JOURNAL') {
    await db.journalEntry.updateMany({
      where: { id, tenantId },
      data: { status, isPosted: status === 'POSTED' }
    });
  } else if (request.documentType === 'STOCK_ADJUSTMENT') {
    await db.stockAdjustment.updateMany({ where: { id, tenantId }, data: { status } });
  } else if (request.documentType === 'SUPPLIER_PAYMENT') {
    await db.paymentVoucher.updateMany({ where: { id, tenantId }, data: { status } });
  } else if (request.documentType === 'PARTY_NOTE') {
    await db.partyNote.updateMany({ where: { id, tenantId }, data: { status } });
  } else if (request.documentType === 'CYCLE_COUNT') {
    await db.cycleCount.updateMany({ where: { id, tenantId }, data: { status, financeStatus: status } });
  } else if (request.documentType === 'MATERIAL_REQUEST') {
    await db.materialRequest.updateMany({
      where: { id, tenantId },
      data: { status, approvalStatus: status === 'APPROVED' ? 'APPROVED' : status }
    });
  }
}

async function otherPending(db, request) {
  return db.approvalRequest.count({
    where: {
      tenantId: request.tenantId,
      documentId: request.documentId,
      status: 'PENDING',
      id: { not: request.id }
    }
  });
}

async function releaseDocument(db, request, userId) {
  if (await otherPending(db, request)) return;
  const { postAdjustmentDocument, allocateSupplierPayment } = require('./documentPosting');
  if (request.documentType === 'JOURNAL') {
    const entry = await db.journalEntry.findFirst({ where: { id: request.documentId, tenantId: request.tenantId } });
    if (!entry) return;
    await assertPeriodOpen(db, { tenantId: request.tenantId, date: entry.date, userId });
    await db.journalEntry.update({
      where: { id: entry.id },
      data: { isPosted: true, status: 'POSTED' }
    });
    await writeAudit(db, {
      tenantId: request.tenantId,
      userId,
      action: 'POST',
      entity: 'JOURNAL',
      entityId: entry.id,
      before: { isPosted: false, status: entry.status },
      after: { isPosted: true, status: 'POSTED' }
    });
    return;
  }
  if (request.documentType === 'STOCK_ADJUSTMENT') {
    const adj = await db.stockAdjustment.findFirst({
      where: { id: request.documentId, tenantId: request.tenantId },
      include: { items: true }
    });
    if (!adj || adj.status === 'COMPLETED') return;
    await postAdjustmentDocument(db, {
      tenantId: request.tenantId,
      warehouseId: adj.warehouseId,
      items: adj.items,
      referenceId: adj.id,
      date: adj.date,
      createdBy: userId
    });
    await db.stockAdjustment.update({ where: { id: adj.id }, data: { status: 'COMPLETED' } });
    await writeAudit(db, {
      tenantId: request.tenantId,
      userId,
      action: 'POST',
      entity: 'STOCK_ADJUSTMENT',
      entityId: adj.id,
      before: { status: adj.status },
      after: { status: 'COMPLETED' }
    });
    return;
  }
  if (request.documentType === 'SUPPLIER_PAYMENT') {
    const voucher = await db.paymentVoucher.findFirst({
      where: { id: request.documentId, tenantId: request.tenantId }
    });
    if (!voucher || voucher.status === 'POSTED') return;
    const allocations = Array.isArray(request.payload?.allocations) ? request.payload.allocations : [];
    if (allocations.length) {
      await allocateSupplierPayment(db, {
        tenantId: request.tenantId,
        voucher,
        allocations,
        createdBy: userId
      });
    }
    await db.paymentVoucher.update({ where: { id: voucher.id }, data: { status: 'POSTED' } });
    await writeAudit(db, {
      tenantId: request.tenantId,
      userId,
      action: 'POST',
      entity: 'SUPPLIER_PAYMENT',
      entityId: voucher.id,
      before: { status: voucher.status },
      after: { status: 'POSTED' }
    });
    return;
  }
  if (request.documentType === 'PARTY_NOTE') {
    const { postHeldPartyNote } = require('./phase2/treasury');
    await postHeldPartyNote(db, { tenantId: request.tenantId, id: request.documentId, createdBy: userId });
    return;
  }
  if (request.documentType === 'CYCLE_COUNT') {
    const { postApprovedCycleCount } = require('./inventory/ops');
    await postApprovedCycleCount(db, { tenantId: request.tenantId, id: request.documentId, createdBy: userId });
    return;
  }
  if (request.documentType === 'MATERIAL_REQUEST') {
    const { releaseMaterialRequest } = require('./inventory/ops');
    await releaseMaterialRequest(db, { tenantId: request.tenantId, id: request.documentId, userId });
    return;
  }
  await setDocumentStatus(db, request, 'APPROVED');
}

async function cancelOpenRequests(db, { tenantId, documentId }) {
  await db.approvalRequest.updateMany({
    where: { tenantId, documentId, status: 'PENDING' },
    data: { status: 'REJECTED' }
  });
}

async function decide(db, { tenantId, requestId, userId, action, reason }) {
  const verb = String(action || '').toUpperCase();
  if (!['APPROVE', 'REJECT', 'RETURN'].includes(verb)) {
    throw new DocumentError('Choose approve, reject, or return.');
  }
  if ((verb === 'REJECT' || verb === 'RETURN') && !String(reason || '').trim()) {
    throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  }
  const request = await db.approvalRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { actions: { orderBy: { createdAt: 'asc' } } }
  });
  if (!request) throw new DocumentError('Approval request not found.', {}, 404);
  if (request.status !== 'PENDING') throw new DocumentError('This request is already completed.');

  const rule = await loadRule(db, tenantId, request.documentType);
  const level = (rule?.levels || []).find((row) => row.sequence === request.currentLevel);
  if (!level) throw new DocumentError('This approval step is not configured.');
  if (verb === 'APPROVE' && request.requestedBy && request.requestedBy === userId && !rule.allowSelfApprove) {
    throw new DocumentError('You cannot approve your own document.');
  }
  const allowed = await actorMatches(db, level, userId);
  if (!allowed) throw new DocumentError('You are not the approver for this step.');

  await db.approvalAction.create({
    data: {
      tenantId,
      requestId: request.id,
      level: request.currentLevel,
      action: verb,
      actorId: userId,
      reason: String(reason || '').trim() || null
    }
  });

  if (verb === 'REJECT') {
    await db.approvalRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
    await setDocumentStatus(db, request, 'REJECTED');
  } else if (verb === 'RETURN') {
    await db.approvalRequest.update({ where: { id: request.id }, data: { status: 'RETURNED' } });
    await setDocumentStatus(db, request, 'RETURNED');
  } else {
    const needed = levelsForAmount(rule, request.amount);
    const index = needed.findIndex((row) => row.sequence === request.currentLevel);
    const next = needed[index + 1];
    if (next) {
      await db.approvalRequest.update({
        where: { id: request.id },
        data: { currentLevel: next.sequence }
      });
    } else {
      await db.approvalRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } });
      await releaseDocument(db, request, userId);
    }
  }

  await writeAudit(db, {
    tenantId,
    userId,
    action: verb === 'APPROVE' ? 'APPROVE' : 'STATUS',
    entity: request.documentType,
    entityId: request.documentId,
    before: { approvalStatus: 'PENDING', level: request.currentLevel },
    after: { approvalStatus: verb === 'RETURN' ? 'RETURNED' : verb === 'REJECT' ? 'REJECTED' : 'APPROVED', reason: reason || null }
  });

  return db.approvalRequest.findUnique({
    where: { id: request.id },
    include: { actions: { orderBy: { createdAt: 'asc' } } }
  });
}

module.exports = {
  DOCUMENT_TYPES,
  levelsForAmount,
  loadRule,
  ensureDefaultRules,
  submitForApproval,
  decide,
  present,
  cancelOpenRequests
};
