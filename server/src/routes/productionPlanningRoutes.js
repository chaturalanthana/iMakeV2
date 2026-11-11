const express = require('express');
const controller = require('../controllers/productionPlanningController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/phase4');

const router = express.Router();
router.use(requireTenant);

const empty = (req, _res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  next();
};

router.get('/defaults', controller.defaults);
router.get('/mps', controller.mps);
router.post('/mps/run', empty, validateBody(schemas.reconcile), controller.runMps);
router.get('/forecasts', controller.forecasts);
router.put('/forecasts', validateBody(schemas.forecast), controller.saveForecast);
router.post('/planned-orders/:id/firm', empty, validateBody(schemas.firm), controller.firm);
router.get('/alternates', controller.alternates);
router.post('/alternates', validateBody(schemas.alternate), controller.saveAlternate);
router.get('/lines', controller.lines);
router.put('/lines/:id', validateBody(schemas.lineStandard), controller.saveLine);
router.put('/operations/:id/milestone', validateBody(schemas.milestone), controller.milestone);
router.get('/captures', controller.captures);
router.post('/captures', validateBody(schemas.capture), controller.capture);
router.get('/losses', controller.losses);
router.post('/losses/:id/approve', validateBody(schemas.lossApproval), controller.approveLoss);
router.post('/payroll-imports', validateBody(schemas.payroll), controller.payroll);
router.post('/overhead-reconcile', empty, validateBody(schemas.reconcile), controller.reconcile);
router.get('/contracts', controller.contracts);
router.post('/contracts', validateBody(schemas.contract), controller.createContract);
router.post('/contracts/:id/issue', validateBody(schemas.contractIssue), controller.issueContract);
router.post('/contracts/:id/receive', validateBody(schemas.contractReceive), controller.receiveContract);
router.post('/contracts/:id/charge', empty, validateBody(schemas.contractCharge), controller.chargeContract);
router.get('/reports/:key', controller.report);

module.exports = router;
