const express = require('express');
const inventory = require('../controllers/inventoryController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requireTenant);

router.get('/branches', inventory.listBranches);
router.post('/branches', validateBody(schemas.inventoryBranch), inventory.saveBranch);
router.put('/branches/:id', validateBody(schemas.inventoryBranch), inventory.saveBranch);
router.get('/bins', inventory.listBins);
router.post('/bins', validateBody(schemas.inventoryBin), inventory.saveBin);
router.put('/bins/:id', validateBody(schemas.inventoryBinUpdate), inventory.saveBin);
router.post('/locations/ensure', inventory.ensureLocations);

router.get('/uom-templates', inventory.listTemplates);
router.post('/uom-templates/ensure', inventory.ensureTemplates);
router.post('/uom-templates/:id/apply', validateBody(schemas.inventoryApplyTemplate), inventory.applyTemplate);

router.get('/batches', inventory.listBatches);
router.post('/batches', validateBody(schemas.inventoryBatch), inventory.saveBatch);
router.post('/batches/:id/retest', validateBody(schemas.inventoryRetest), inventory.retest);
router.post('/batches/:id/retest/decide', validateBody(schemas.inventoryDecision), inventory.decideRetest);
router.post('/batches/:id/status', validateBody(schemas.inventoryBatchStatus), inventory.batchStatus);
router.get('/trace', inventory.trace);
router.get('/suggestions', inventory.suggest);

router.get('/pallets', inventory.listPallets);
router.post('/pallets', validateBody(schemas.inventoryPallet), inventory.savePallet);
router.post('/pallets/:id/deactivate', inventory.deactivatePallet);
router.post('/pallets/:id/renumber', validateBody(schemas.inventoryRenumber), inventory.renumberPallet);

router.get('/positions', inventory.positions);
router.get('/reports/movement', inventory.movementReport);
router.get('/reports/aging', inventory.agingReport);
router.get('/reports/variance', inventory.varianceReport);
router.post('/receipts', validateBody(schemas.inventoryReceipt), inventory.receipt);

router.get('/material-requests', inventory.listRequests);
router.post('/material-requests', validateBody(schemas.materialRequest), inventory.saveRequest);
router.post('/material-requests/:id/approve', inventory.approveRequest);
router.post('/material-requests/:id/pick', inventory.pickRequest);
router.post('/material-requests/:id/fulfil', validateBody(schemas.inventoryFulfil), inventory.fulfilRequest);
router.post('/material-requests/:id/cancel', inventory.cancelRequest);

router.get('/transfers', inventory.listTransfers);
router.post('/transfers', validateBody(schemas.inventoryTransfer), inventory.saveTransfer);
router.post('/transfers/:id/ship', inventory.shipTransfer);
router.post('/transfers/:id/receive', inventory.receiveTransfer);
router.post('/transfers/:id/cancel', inventory.cancelTransfer);

router.get('/returns', inventory.listReturns);
router.post('/returns', validateBody(schemas.inventoryReturn), inventory.saveReturn);
router.post('/returns/:id/post', inventory.postReturn);
router.post('/returns/:id/cancel', inventory.cancelReturn);

router.get('/cycle-counts', inventory.listCounts);
router.post('/cycle-counts', validateBody(schemas.inventoryCount), inventory.saveCount);
router.post('/cycle-counts/:id/finance', validateBody(schemas.inventoryDecision), inventory.financeCount);
router.post('/cycle-counts/:id/post', inventory.postCount);
router.post('/cycle-counts/:id/cancel', inventory.cancelCount);

router.get('/allocations', inventory.listAllocations);

module.exports = router;
