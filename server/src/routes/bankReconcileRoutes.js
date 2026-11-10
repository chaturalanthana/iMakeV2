const express = require('express');
const bankReconcileController = require('../controllers/bankReconcileController');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.get('/list/:accountId', bankReconcileController.getReconciliations);
router.post('/start', validateBody(schemas.reconcileStart), bankReconcileController.startReconciliation);
router.post('/import', validateBody(schemas.reconcileImport), bankReconcileController.importStatement);
router.get('/workspace/:reconciliationId', bankReconcileController.getWorkspaceData);
router.post('/auto-match', validateBody(schemas.reconcileId), bankReconcileController.autoMatchEngine);
router.post('/manual-match', validateBody(schemas.reconcileMatch), bankReconcileController.manualMatch);
router.post('/unmatch', validateBody(schemas.reconcileId), bankReconcileController.unmatch);
router.post('/adjustment', validateBody(schemas.reconcileAdjustment), bankReconcileController.createAdjustment);
router.post('/finalize', validateBody(schemas.reconcileId), bankReconcileController.finalizeReconciliation);
router.get('/reports', bankReconcileController.getReconciliationReports);

module.exports = router;
