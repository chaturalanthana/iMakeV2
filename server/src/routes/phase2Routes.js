const express = require('express');
const controller = require('../controllers/phase2Controller');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/phase2');

const router = express.Router();

router.get('/settings', controller.getSettings);
router.put('/settings', validateBody(schemas.settings), controller.saveSettings);

router.get('/centers', controller.listCenters);
router.post('/centers', validateBody(schemas.center), controller.createCenter);
router.get('/budgets', controller.listBudgets);
router.post('/budgets', validateBody(schemas.budget), controller.createBudget);
router.get('/projects', controller.listProjects);
router.post('/projects', validateBody(schemas.project), controller.createProject);
router.post('/dimensions', validateBody(schemas.dimension), controller.saveDimension);

router.get('/contracts', controller.listContracts);
router.post('/contracts', validateBody(schemas.contract), controller.createContract);
router.get('/rfqs', controller.listRfqs);
router.post('/rfqs', validateBody(schemas.rfq), controller.createRfq);
router.get('/rfqs/:id', controller.getRfq);
router.post('/rfqs/:id/quotes', validateBody(schemas.quotation), controller.addQuote);
router.post('/rfqs/:id/select', validateBody(schemas.selection), controller.selectQuote);
router.get('/scorecard/:supplierId', controller.scorecard);
router.get('/commitments', controller.listCommitments);

router.get('/landed-costs', controller.listLanded);
router.post('/landed-costs', validateBody(schemas.landedCost), controller.createLanded);

router.get('/asset-classes', controller.listClasses);
router.post('/asset-classes', validateBody(schemas.assetClass), controller.createClass);
router.get('/assets', controller.listAssets);
router.post('/assets/:id/capitalize', validateBody(schemas.capitalize), controller.capitalize);
router.post('/assets/:id/dispose', validateBody(schemas.dispose), controller.dispose);
router.post('/assets/:id/impair', validateBody(schemas.impair), controller.impair);
router.post('/assets/:id/transfer', controller.transfer);
router.post('/depreciation-runs', validateBody(schemas.depreciation), controller.depreciate);

router.get('/notes', controller.listNotes);
router.post('/notes', validateBody(schemas.partyNote), controller.createNote);
router.get('/collections', controller.listCollections);
router.post('/collections', validateBody(schemas.collection), controller.saveCollection);

router.get('/cheques', controller.listCheques);
router.post('/cheques', validateBody(schemas.cheque), controller.createCheque);
router.post('/cheques/:id/deposit', controller.chequeAction('DEPOSITED'));
router.post('/cheques/:id/realise', controller.chequeAction('REALISED'));
router.post('/cheques/:id/bounce', controller.chequeAction('BOUNCED'));

router.get('/petty-cash', controller.listFunds);
router.post('/petty-cash', validateBody(schemas.pettyCash), controller.createFund);
router.get('/ious', controller.listIous);
router.post('/ious', validateBody(schemas.iou), controller.createIou);
router.post('/ious/:id/settle', validateBody(schemas.iouSettle), controller.settleIou);

router.get('/period-closes', controller.listCloses);
router.post('/period-closes', validateBody(schemas.period), controller.openClose);
router.post('/period-closes/:id/steps/:code', validateBody(schemas.closeStep), controller.completeCloseStep);
router.post('/period-closes/:id/closing-entries', controller.postClose);

router.get('/allocation-rules', controller.listRules);
router.post('/allocation-rules', validateBody(schemas.allocation), controller.createRule);
router.get('/recurring-journals', controller.listRecurring);
router.post('/recurring-journals', validateBody(schemas.recurring), controller.createRecurring);
router.post('/recurring-journals/:id/post', controller.postRecurring);

router.get('/reports', controller.getCatalog);
router.get('/reports/:key', controller.getReport);

module.exports = router;
