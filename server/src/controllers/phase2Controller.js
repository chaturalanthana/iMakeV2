const prisma = require('../lib/prisma');
const { sendError } = require('../services/errors');
const { dec } = require('../services/money');
const procurement = require('../services/phase2/procurement');
const { postLandedCost } = require('../services/phase2/landedCost');
const assets = require('../services/phase2/assets');
const treasury = require('../services/phase2/treasury');
const close = require('../services/phase2/close');
const { catalog, buildReport } = require('../services/phase2/reports');
const { sendReport } = require('../services/phase2/reportExport');

const actor = (req) => req.user?.userId || null;

function ok(res, status, body) {
  return res.status(status).json(body);
}

function guard(fallback, work) {
  return async (req, res) => {
    try {
      await work(req, res);
    } catch (error) {
      return sendError(res, error, fallback);
    }
  };
}

const getSettings = guard('Could not load finance settings.', async (req, res) => {
  const settings = await procurement.ensureSettings(prisma, req.tenantId);
  ok(res, 200, { settings, defaults: procurement.CONFIGURABLE_DEFAULTS });
});

const saveSettings = guard('Could not save finance settings.', async (req, res) => {
  ok(res, 200, await procurement.updateSettings(prisma, req.tenantId, req.body));
});

const listCenters = guard('Could not load centers.', async (req, res) => {
  ok(res, 200, await prisma.orgCenter.findMany({ where: { tenantId: req.tenantId }, orderBy: { code: 'asc' } }));
});

const createCenter = guard('Could not save the center.', async (req, res) => {
  const row = await prisma.orgCenter.create({
    data: {
      tenantId: req.tenantId,
      code: String(req.body.code).trim(),
      name: String(req.body.name).trim(),
      kind: req.body.kind || 'BOTH',
      isAdministration: Boolean(req.body.isAdministration)
    }
  });
  ok(res, 201, row);
});

const listBudgets = guard('Could not load budgets.', async (req, res) => {
  ok(res, 200, await prisma.budget.findMany({ where: { tenantId: req.tenantId }, orderBy: [{ year: 'desc' }, { month: 'asc' }] }));
});

const createBudget = guard('Could not save the budget.', async (req, res) => {
  ok(res, 201, await prisma.budget.create({
    data: {
      tenantId: req.tenantId,
      kind: req.body.kind,
      year: parseInt(req.body.year, 10),
      month: parseInt(req.body.month, 10) || 0,
      accountId: req.body.accountId || null,
      costCenterId: req.body.costCenterId || null,
      capitalProjectId: req.body.capitalProjectId || null,
      amount: dec(req.body.amount)
    }
  }));
});

const listProjects = guard('Could not load projects.', async (req, res) => {
  ok(res, 200, await prisma.capitalProject.findMany({ where: { tenantId: req.tenantId }, orderBy: { code: 'asc' } }));
});

const createProject = guard('Could not save the project.', async (req, res) => {
  ok(res, 201, await prisma.capitalProject.create({
    data: {
      tenantId: req.tenantId,
      code: String(req.body.code).trim(),
      name: String(req.body.name).trim(),
      budgetAmount: dec(req.body.budgetAmount),
      costCenterId: req.body.costCenterId || null
    }
  }));
});

const listContracts = guard('Could not load contract prices.', async (req, res) => {
  ok(res, 200, await prisma.contractPrice.findMany({ where: { tenantId: req.tenantId }, orderBy: { validFrom: 'desc' } }));
});

const createContract = guard('Could not save the contract price.', async (req, res) => {
  const row = await prisma.$transaction((tx) => procurement.createContract(tx, { ...req.body, tenantId: req.tenantId }));
  ok(res, 201, row);
});

const listRfqs = guard('Could not load RFQs.', async (req, res) => {
  ok(res, 200, await prisma.requestForQuotation.findMany({
    where: { tenantId: req.tenantId },
    include: { lines: true, quotations: true, selection: true },
    orderBy: { date: 'desc' }
  }));
});

const createRfq = guard('Could not save the RFQ.', async (req, res) => {
  const row = await prisma.$transaction((tx) => procurement.createRfq(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const cancelRfq = guard('Could not cancel the RFQ.', async (req, res) => {
  const row = await prisma.$transaction((tx) => procurement.cancelRfq(tx, {
    tenantId: req.tenantId, id: req.params.id, createdBy: actor(req), reason: req.body?.reason
  }));
  ok(res, 200, row);
});

const getRfq = guard('Could not load the RFQ.', async (req, res) => {
  ok(res, 200, await procurement.comparison(prisma, req.tenantId, req.params.id));
});

const addQuote = guard('Could not save the quotation.', async (req, res) => {
  const row = await prisma.$transaction((tx) => procurement.addQuotation(tx, { ...req.body, tenantId: req.tenantId, rfqId: req.params.id }));
  ok(res, 201, row);
});

const selectQuote = guard('Could not record the selection.', async (req, res) => {
  const row = await prisma.$transaction((tx) => procurement.selectQuotation(tx, {
    ...req.body, tenantId: req.tenantId, rfqId: req.params.id, createdBy: actor(req)
  }));
  ok(res, 200, row);
});

const scorecard = guard('Could not score the supplier.', async (req, res) => {
  ok(res, 200, await procurement.supplierScorecard(prisma, req.tenantId, req.params.supplierId));
});

const listCommitments = guard('Could not load commitments.', async (req, res) => {
  ok(res, 200, await procurement.commitments(prisma, req.tenantId));
});

const listLanded = guard('Could not load landed costs.', async (req, res) => {
  ok(res, 200, await prisma.landedCost.findMany({
    where: { tenantId: req.tenantId },
    include: { charges: true, allocations: true },
    orderBy: { date: 'desc' }
  }));
});

const createLanded = guard('Could not post landed cost.', async (req, res) => {
  const row = await prisma.$transaction((tx) => postLandedCost(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const listClasses = guard('Could not load asset classes.', async (req, res) => {
  ok(res, 200, await prisma.fixedAssetClass.findMany({ where: { tenantId: req.tenantId }, orderBy: { code: 'asc' } }));
});

const createClass = guard('Could not save the asset class.', async (req, res) => {
  ok(res, 201, await assets.createClass(prisma, { ...req.body, tenantId: req.tenantId }));
});

const listAssets = guard('Could not load fixed assets.', async (req, res) => {
  ok(res, 200, await prisma.fixedAsset.findMany({ where: { tenantId: req.tenantId }, include: { assetClass: true }, orderBy: { code: 'asc' } }));
});

const capitalize = guard('Could not capitalize the asset.', async (req, res) => {
  const row = await prisma.$transaction((tx) => assets.capitalizeAsset(tx, { ...req.body, tenantId: req.tenantId, assetId: req.params.id, createdBy: actor(req) }));
  ok(res, 200, row);
});

const depreciate = guard('Could not run depreciation.', async (req, res) => {
  const row = await prisma.$transaction((tx) => assets.runDepreciation(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const dispose = guard('Could not dispose of the asset.', async (req, res) => {
  const row = await prisma.$transaction((tx) => assets.disposeAsset(tx, { ...req.body, tenantId: req.tenantId, assetId: req.params.id, createdBy: actor(req) }));
  ok(res, 200, row);
});

const impair = guard('Could not impair the asset.', async (req, res) => {
  const row = await prisma.$transaction((tx) => assets.impairAsset(tx, { ...req.body, tenantId: req.tenantId, assetId: req.params.id, createdBy: actor(req) }));
  ok(res, 200, row);
});

const transfer = guard('Could not transfer the asset.', async (req, res) => {
  const row = await prisma.$transaction((tx) => assets.transferAsset(tx, { ...req.body, tenantId: req.tenantId, assetId: req.params.id }));
  ok(res, 200, row);
});

const listNotes = guard('Could not load notes.', async (req, res) => {
  ok(res, 200, await prisma.partyNote.findMany({ where: { tenantId: req.tenantId }, orderBy: { date: 'desc' } }));
});

const createNote = guard('Could not post the note.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.postPartyNote(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const cancelNote = guard('Could not cancel the note.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.cancelPartyNote(tx, {
    tenantId: req.tenantId, id: req.params.id, createdBy: actor(req), reason: req.body?.reason
  }));
  ok(res, 200, row);
});

const listCollections = guard('Could not load collections.', async (req, res) => {
  const cases = await prisma.collectionCase.findMany({ where: { tenantId: req.tenantId } });
  const activities = await prisma.collectionActivity.findMany({ where: { tenantId: req.tenantId }, orderBy: { date: 'desc' } });
  ok(res, 200, { cases, activities });
});

const saveCollection = guard('Could not save the collection note.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.saveCollection(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 200, row);
});

const listCheques = guard('Could not load cheques.', async (req, res) => {
  ok(res, 200, await prisma.cheque.findMany({ where: { tenantId: req.tenantId }, orderBy: { chequeDate: 'desc' } }));
});

const createCheque = guard('Could not record the cheque.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.createCheque(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const cancelCheque = guard('Could not cancel the cheque.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.cancelCheque(tx, {
    tenantId: req.tenantId, id: req.params.id, createdBy: actor(req), reason: req.body?.reason
  }));
  ok(res, 200, row);
});

const chequeAction = (next) => guard('Could not update the cheque.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.setChequeStatus(tx, { ...req.body, tenantId: req.tenantId, chequeId: req.params.id, createdBy: actor(req) }, next));
  ok(res, 200, row);
});

const listFunds = guard('Could not load petty cash.', async (req, res) => {
  ok(res, 200, await prisma.pettyCashFund.findMany({ where: { tenantId: req.tenantId }, orderBy: { name: 'asc' } }));
});

const createFund = guard('Could not open the petty cash fund.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.openPettyCash(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const listIous = guard('Could not load IOUs.', async (req, res) => {
  ok(res, 200, await prisma.iouAdvance.findMany({ where: { tenantId: req.tenantId }, include: { settlements: true }, orderBy: { date: 'desc' } }));
});

const createIou = guard('Could not issue the IOU.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.issueIou(tx, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }));
  ok(res, 201, row);
});

const cancelIou = guard('Could not cancel the IOU.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.cancelIou(tx, {
    tenantId: req.tenantId, id: req.params.id, createdBy: actor(req), reason: req.body?.reason
  }));
  ok(res, 200, row);
});

const settleIou = guard('Could not settle the IOU.', async (req, res) => {
  const row = await prisma.$transaction((tx) => treasury.settleIou(tx, { ...req.body, tenantId: req.tenantId, iouId: req.params.id, createdBy: actor(req) }));
  ok(res, 200, row);
});

const listCloses = guard('Could not load the close checklist.', async (req, res) => {
  const rows = await prisma.periodClose.findMany({
    where: { tenantId: req.tenantId },
    include: { steps: { orderBy: { sequence: 'asc' } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  });
  const periods = await prisma.fiscalPeriod.findMany({ where: { tenantId: req.tenantId } });
  const locks = new Map(periods.map((period) => [`${period.year}-${period.month}`, period.status]));
  ok(res, 200, rows.map((row) => ({ ...row, fiscalStatus: locks.get(`${row.year}-${row.month}`) || 'OPEN' })));
});

const openClose = guard('Could not open the period.', async (req, res) => {
  const row = await prisma.$transaction((tx) => close.openPeriod(tx, { ...req.body, tenantId: req.tenantId }));
  ok(res, 201, row);
});

const completeCloseStep = guard('Could not update the close step.', async (req, res) => {
  const row = await prisma.$transaction((tx) => close.completeStep(tx, { ...req.body, tenantId: req.tenantId, closeId: req.params.id, code: req.params.code }));
  ok(res, 200, row);
});

const postClose = guard('Could not post closing entries.', async (req, res) => {
  const row = await prisma.$transaction((tx) => close.postClosingEntries(tx, { ...req.body, tenantId: req.tenantId, closeId: req.params.id, createdBy: actor(req) }));
  ok(res, 200, row);
});

const listRules = guard('Could not load allocation rules.', async (req, res) => {
  ok(res, 200, await prisma.allocationRule.findMany({ where: { tenantId: req.tenantId }, include: { lines: true } }));
});

const createRule = guard('Could not save the allocation.', async (req, res) => {
  const row = await prisma.$transaction((tx) => close.saveAllocationRule(tx, { ...req.body, tenantId: req.tenantId }));
  ok(res, 201, row);
});

const listRecurring = guard('Could not load recurring journals.', async (req, res) => {
  ok(res, 200, await prisma.recurringJournal.findMany({ where: { tenantId: req.tenantId } }));
});

const createRecurring = guard('Could not save the recurring journal.', async (req, res) => {
  ok(res, 201, await prisma.recurringJournal.create({
    data: {
      tenantId: req.tenantId,
      name: req.body.name,
      description: req.body.description || null,
      lines: req.body.lines
    }
  }));
});

const postRecurring = guard('Could not post the recurring journal.', async (req, res) => {
  const row = await prisma.$transaction((tx) => close.postRecurring(tx, { tenantId: req.tenantId, templateId: req.params.id, date: req.body.date, createdBy: actor(req) }));
  ok(res, 201, row || { posted: false });
});

const saveDimension = guard('Could not save the cost center.', async (req, res) => {
  const row = await prisma.documentDimension.upsert({
    where: {
      tenantId_documentType_documentId: {
        tenantId: req.tenantId,
        documentType: req.body.documentType,
        documentId: req.body.documentId
      }
    },
    create: {
      tenantId: req.tenantId,
      documentType: req.body.documentType,
      documentId: req.body.documentId,
      costCenterId: req.body.costCenterId || null,
      profitCenterId: req.body.profitCenterId || null
    },
    update: { costCenterId: req.body.costCenterId || null, profitCenterId: req.body.profitCenterId || null }
  });
  ok(res, 200, row);
});

const getReport = guard('Could not build that report.', async (req, res) => {
  if (req.params.key === 'catalog') return ok(res, 200, catalog());
  const built = await buildReport(prisma, req.tenantId, req.params.key, req.query);
  return sendReport(res, built, req.query.format);
});

const getCatalog = guard('Could not list reports.', async (req, res) => {
  ok(res, 200, catalog());
});

module.exports = {
  getSettings,
  saveSettings,
  listCenters,
  createCenter,
  listBudgets,
  createBudget,
  listProjects,
  createProject,
  listContracts,
  createContract,
  listRfqs,
  createRfq,
  cancelRfq,
  getRfq,
  addQuote,
  selectQuote,
  scorecard,
  listCommitments,
  listLanded,
  createLanded,
  listClasses,
  createClass,
  listAssets,
  capitalize,
  depreciate,
  dispose,
  impair,
  transfer,
  listNotes,
  createNote,
  cancelNote,
  listCollections,
  saveCollection,
  listCheques,
  createCheque,
  cancelCheque,
  chequeAction,
  listFunds,
  createFund,
  listIous,
  createIou,
  cancelIou,
  settleIou,
  listCloses,
  openClose,
  completeCloseStep,
  postClose,
  listRules,
  createRule,
  listRecurring,
  createRecurring,
  postRecurring,
  saveDimension,
  getReport,
  getCatalog
};
