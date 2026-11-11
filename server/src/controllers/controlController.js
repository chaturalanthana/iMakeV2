const prisma = require('../lib/prisma');
const { sendError } = require('../services/errors');
const { DocumentError } = require('../services/errors');
const { respondList } = require('../services/listQuery');
const { ensureYear, syncChecklistFromFiscal } = require('../services/periodService');
const { writeAudit } = require('../services/auditService');
const {
  DOCUMENT_TYPES,
  ensureDefaultRules,
  decide,
  present
} = require('../services/approvalService');
const { summary } = require('../services/dashboard');

const getApprovalCount = async (req, res) => {
  try {
    const count = await prisma.approvalRequest.count({
      where: { tenantId: req.tenantId, status: 'PENDING' }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count approvals' });
  }
};

const getApprovals = async (req, res) => {
  try {
    const completed = String(req.query.status || 'pending').toLowerCase() === 'completed';
    const rows = await prisma.approvalRequest.findMany({
      where: {
        tenantId: req.tenantId,
        status: completed ? { in: ['APPROVED', 'REJECTED', 'RETURNED'] } : 'PENDING'
      },
      include: { actions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rows.map(present));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load approvals' });
  }
};

const decideApproval = async (req, res) => {
  try {
    const saved = await prisma.$transaction((tx) => decide(tx, {
      tenantId: req.tenantId,
      requestId: req.params.id,
      userId: req.user.userId,
      action: req.body.action,
      reason: req.body.reason
    }));
    res.json(present(saved));
  } catch (error) {
    return sendError(res, error, 'Failed to update the approval');
  }
};

const getApprovalRules = async (req, res) => {
  try {
    await ensureDefaultRules(prisma, req.tenantId);
    const rules = await prisma.approvalRule.findMany({
      where: { tenantId: req.tenantId },
      include: { levels: { orderBy: { sequence: 'asc' } } },
      orderBy: { documentType: 'asc' }
    });
    const roles = await prisma.role.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true }
    });
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId, status: 'ACTIVE' },
      select: { id: true, email: true, firstName: true, lastName: true }
    });
    res.json({
      rules,
      roles,
      users,
      types: DOCUMENT_TYPES.map((row) => ({ type: row.type, label: row.label }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load approval rules' });
  }
};

const updateApprovalRule = async (req, res) => {
  try {
    const documentType = req.params.documentType;
    if (!DOCUMENT_TYPES.some((row) => row.type === documentType)) {
      return res.status(400).json({ error: 'Unknown document type.' });
    }
    const levels = Array.isArray(req.body.levels) ? req.body.levels.slice(0, 2) : [];
    if (!levels.length) return res.status(400).json({ error: 'Add at least one approval level.', fields: { levels: 'Add at least one approval level.' } });
    for (const level of levels) {
      if (!level.approverRoleId && !level.approverUserId) {
        return res.status(400).json({ error: 'Each level needs an approver role or user.', fields: { approver: 'Each level needs an approver role or user.' } });
      }
      if (level.threshold === undefined || level.threshold === '' || Number.isNaN(Number(level.threshold)) || Number(level.threshold) < 0) {
        return res.status(400).json({ error: 'Threshold must be zero or more.', fields: { threshold: 'Threshold must be zero or more.' } });
      }
    }
    const saved = await prisma.$transaction(async (tx) => {
      await ensureDefaultRules(tx, req.tenantId);
      const rule = await tx.approvalRule.findUnique({
        where: { tenantId_documentType: { tenantId: req.tenantId, documentType } }
      });
      await tx.approvalLevel.deleteMany({ where: { ruleId: rule.id } });
      return tx.approvalRule.update({
        where: { id: rule.id },
        data: {
          enabled: Boolean(req.body.enabled),
          allowSelfApprove: Boolean(req.body.allowSelfApprove),
          levels: {
            create: levels.map((level, index) => ({
              tenantId: req.tenantId,
              sequence: index + 1,
              threshold: Number(level.threshold) || 0,
              approverRoleId: level.approverRoleId || null,
              approverUserId: level.approverUserId || null
            }))
          }
        },
        include: { levels: { orderBy: { sequence: 'asc' } } }
      });
    });
    res.json(saved);
  } catch (error) {
    return sendError(res, error, 'Failed to save the approval rule');
  }
};

const getPeriods = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
    const periods = await ensureYear(prisma, req.tenantId, year);
    const settings = await prisma.operationsSetting.findUnique({ where: { tenantId: req.tenantId } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { hrEnabled: true } });
    res.json({
      year,
      periods,
      allowNegativeStock: Boolean(settings?.allowNegativeStock),
      hrEnabled: Boolean(tenant?.hrEnabled)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load fiscal periods' });
  }
};

const updatePeriod = async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10);
    const month = parseInt(req.body.month, 10);
    const status = String(req.body.status || '').toUpperCase();
    if (!year || month < 1 || month > 12) return res.status(400).json({ error: 'Choose a month.', fields: { month: 'Choose a month.' } });
    if (!['OPEN', 'SOFT_CLOSED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be open, soft-closed, or closed.', fields: { status: 'Status must be open, soft-closed, or closed.' } });
    }
    await ensureYear(prisma, req.tenantId, year);
    const before = await prisma.fiscalPeriod.findUnique({
      where: { tenantId_year_month: { tenantId: req.tenantId, year, month } }
    });
    const saved = await prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.update({
        where: { tenantId_year_month: { tenantId: req.tenantId, year, month } },
        data: { status, updatedBy: req.user.userId }
      });
      await syncChecklistFromFiscal(tx, { tenantId: req.tenantId, year, month, status });
      return period;
    });
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'STATUS',
      entity: 'FISCAL_PERIOD',
      entityId: saved.id,
      before,
      after: saved
    });
    res.json(saved);
  } catch (error) {
    return sendError(res, error, 'Failed to update the period');
  }
};

const updateControls = async (req, res) => {
  try {
    const allowNegativeStock = Boolean(req.body.allowNegativeStock);
    const saved = await prisma.operationsSetting.upsert({
      where: { tenantId: req.tenantId },
      update: { allowNegativeStock },
      create: { tenantId: req.tenantId, allowNegativeStock }
    });
    res.json({ allowNegativeStock: saved.allowNegativeStock });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save the setting' });
  }
};

const getAudit = async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.entity) where.entity = String(req.query.entity);
    if (req.query.entityId) where.entityId = String(req.query.entityId);
    if (req.query.action) where.action = String(req.query.action);
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) {
        const end = new Date(req.query.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    await respondList(req, res, {
      model: prisma.auditLog,
      where,
      search: ['action', 'entity', 'entityId'],
      sortFields: ['createdAt', 'action', 'entity'],
      defaultSort: 'createdAt',
      filename: 'audit-log.xlsx',
      exportHeaders: ['when', 'action', 'entity', 'entityId', 'userId'],
      toExport: (row) => ({
        when: row.createdAt?.toISOString?.() || '',
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        userId: row.userId || ''
      })
    });
  } catch (error) {
    if (error instanceof DocumentError) return sendError(res, error, 'Failed to load the audit log');
    res.status(500).json({ error: 'Failed to load the audit log' });
  }
};

const getDashboard = async (req, res) => {
  try {
    const period = ['today', '7d', '30d', 'ytd'].includes(req.query.period) ? req.query.period : '7d';
    res.json(await summary(prisma, req.tenantId, period));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load the dashboard' });
  }
};

const getModules = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { hrEnabled: true } });
    res.json({ hrEnabled: Boolean(tenant?.hrEnabled) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load module settings' });
  }
};

const updateModules = async (req, res) => {
  try {
    const hrEnabled = Boolean(req.body.hrEnabled);
    const saved = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { hrEnabled },
      select: { hrEnabled: true }
    });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save module settings' });
  }
};

module.exports = {
  getDashboard,
  getModules,
  updateModules,
  getApprovalCount,
  getApprovals,
  decideApproval,
  getApprovalRules,
  updateApprovalRule,
  getPeriods,
  updatePeriod,
  updateControls,
  getAudit
};
