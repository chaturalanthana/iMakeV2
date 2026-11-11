const phase4 = require('../services/production/phase4');
const { sendReport } = require('../services/production/xlsx');

const send = (res, error, label) => {
  if (error instanceof phase4.ProductionError || error?.status) {
    return res.status(error.status || 400).json({ error: error.message, ...(error.extra || {}) });
  }
  console.error(label, error);
  return res.status(500).json({ error: label });
};

const wrap = (label, fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    send(res, error, label);
  }
};

module.exports = {
  defaults: wrap('Failed to load planning defaults', () => phase4.defaults()),
  mps: wrap('Failed to load the MPS', (req) => phase4.latestMps(req.tenantId)),
  runMps: wrap('Failed to run the MPS', (req) => phase4.runMps({
    tenantId: req.tenantId,
    userId: req.user?.userId || null,
    horizonWeeks: req.body?.horizonWeeks
  })),
  forecasts: wrap('Failed to load forecasts', (req) => phase4.listForecasts(req.tenantId)),
  saveForecast: wrap('Failed to save the forecast', (req) => phase4.saveForecast(req.tenantId, req.body)),
  firm: wrap('Failed to firm the planned order', (req) => phase4.firmPlannedOrder(req.tenantId, req.user?.userId || null, req.params.id)),
  alternates: wrap('Failed to load alternates', (req) => phase4.listAlternates(req.tenantId, req.query)),
  saveAlternate: wrap('Failed to save the alternate', (req) => phase4.saveAlternate(req.tenantId, req.body)),
  lines: wrap('Failed to load product lines', (req) => phase4.listLineStandards(req.tenantId)),
  saveLine: wrap('Failed to save the product line', (req) => phase4.saveLineStandard(req.tenantId, req.params.id, req.body)),
  milestone: wrap('Failed to save the milestone weight', (req) => phase4.setMilestoneWeight(req.tenantId, req.params.id, req.body)),
  captures: wrap('Failed to load machine captures', (req) => phase4.listCaptures(req.tenantId, req.query)),
  capture: wrap('Failed to capture machine output', (req) => phase4.captureMachine(req.tenantId, req.user?.userId || null, req.body)),
  losses: wrap('Failed to load abnormal losses', (req) => phase4.listLosses(req.tenantId)),
  approveLoss: wrap('Failed to approve the abnormal loss', (req) => phase4.approveLoss(req.tenantId, req.user?.userId || null, req.params.id, req.body)),
  payroll: wrap('Failed to import payroll', (req) => phase4.importPayroll(req.tenantId, req.user?.userId || null, req.body)),
  reconcile: wrap('Failed to reconcile overhead', (req) => phase4.reconcileOverhead(req.tenantId, req.user?.userId || null, req.body)),
  contracts: wrap('Failed to load contract orders', (req) => phase4.listContracts(req.tenantId)),
  createContract: wrap('Failed to create the contract order', (req) => phase4.createContract(req.tenantId, req.user?.userId || null, req.body)),
  issueContract: wrap('Failed to issue material to the subcontractor', (req) => phase4.issueContract(req.tenantId, req.user?.userId || null, req.params.id, req.body)),
  receiveContract: wrap('Failed to receive finished goods', (req) => phase4.receiveContract(req.tenantId, req.user?.userId || null, req.params.id, req.body)),
  chargeContract: wrap('Failed to post the service charge', (req) => phase4.chargeContract(req.tenantId, req.user?.userId || null, req.params.id, req.body)),
  async report(req, res) {
    try {
      const report = await phase4.reportByKey(req.tenantId, req.params.key, req.query);
      return sendReport(res, report, req.query.format);
    } catch (error) {
      return send(res, error, 'Failed to build the report');
    }
  }
};
