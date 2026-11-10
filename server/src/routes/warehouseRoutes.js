const express = require('express');
const warehouseController = require('../controllers/warehouseController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/ledger', warehouseController.getStockLedger);
router.get('/inventory-report', warehouseController.getInventoryReport);
router.get('/movements', warehouseController.getStockMovements);
router.post('/movements', validateBody(schemas.stockMovement), warehouseController.createStockMovement);
router.delete('/movements/:id', warehouseController.deleteStockMovement);

router.get('/issues', warehouseController.getGoodsIssues);
router.post('/issues', validateBody(schemas.stockLines), warehouseController.createGoodsIssue);
router.put('/issues/:id', validateBody(schemas.stockLines), warehouseController.updateGoodsIssue);
router.delete('/issues/:id', warehouseController.deleteGoodsIssue);

router.get('/receipts', warehouseController.getStockReceipts);
router.post('/receipts', validateBody(schemas.stockLines), warehouseController.createStockReceipt);
router.put('/receipts/:id', validateBody(schemas.stockLines), warehouseController.updateStockReceipt);
router.delete('/receipts/:id', warehouseController.deleteStockReceipt);

router.get('/transfers', warehouseController.getStockTransfers);
router.post('/transfers', validateBody(schemas.stockLines), warehouseController.createStockTransfer);
router.put('/transfers/:id', validateBody(schemas.stockLines), warehouseController.updateStockTransfer);
router.delete('/transfers/:id', warehouseController.deleteStockTransfer);

router.get('/adjustments', warehouseController.getStockAdjustments);
router.post('/adjustments', validateBody(schemas.stockLines), warehouseController.createStockAdjustment);
router.put('/adjustments/:id', validateBody(schemas.stockLines), warehouseController.updateStockAdjustment);
router.delete('/adjustments/:id', warehouseController.deleteStockAdjustment);

module.exports = router;
