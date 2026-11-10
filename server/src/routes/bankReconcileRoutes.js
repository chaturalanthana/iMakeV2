const express = require('express');
const bankReconcileController = require('../controllers/bankReconcileController');

const router = express.Router();

// Get list of reconciliation records for an account
router.get('/list/:accountId', bankReconcileController.getReconciliations);

// Start/Create or update draft reconciliation
router.post('/start', bankReconcileController.startReconciliation);

// Import statement lines
router.post('/import', bankReconcileController.importStatement);

// Get workspace comparison datasets
router.get('/workspace/:reconciliationId', bankReconcileController.getWorkspaceData);

// Auto match engine
router.post('/auto-match', bankReconcileController.autoMatchEngine);

// Manual pairing (multi-to-multi)
router.post('/manual-match', bankReconcileController.manualMatch);

// Unmatch action
router.post('/unmatch', bankReconcileController.unmatch);

// Adjustment creation & post journal line
router.post('/adjustment', bankReconcileController.createAdjustment);

// Finalize/Lock reconciliation
router.post('/finalize', bankReconcileController.finalizeReconciliation);

// Reconciliation Reports
router.get('/reports', bankReconcileController.getReconciliationReports);

module.exports = router;
