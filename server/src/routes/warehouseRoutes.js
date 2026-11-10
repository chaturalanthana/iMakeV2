const express = require('express');
const warehouseController = require('../controllers/warehouseController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/ledger', warehouseController.getStockLedger);
router.get('/inventory-report', warehouseController.getInventoryReport);
router.get('/movements', warehouseController.getStockMovements);
router.post('/movements', warehouseController.createStockMovement);
router.delete('/movements/:id', warehouseController.deleteStockMovement);

router.get('/issues', warehouseController.getGoodsIssues);
router.post('/issues', warehouseController.createGoodsIssue);
router.put('/issues/:id', warehouseController.updateGoodsIssue);
router.delete('/issues/:id', warehouseController.deleteGoodsIssue);

router.get('/receipts', warehouseController.getStockReceipts);
router.post('/receipts', warehouseController.createStockReceipt);
router.put('/receipts/:id', warehouseController.updateStockReceipt);
router.delete('/receipts/:id', warehouseController.deleteStockReceipt);

router.get('/transfers', warehouseController.getStockTransfers);
router.post('/transfers', warehouseController.createStockTransfer);
router.put('/transfers/:id', warehouseController.updateStockTransfer);
router.delete('/transfers/:id', warehouseController.deleteStockTransfer);

router.get('/adjustments', warehouseController.getStockAdjustments);
router.post('/adjustments', warehouseController.createStockAdjustment);
router.put('/adjustments/:id', warehouseController.updateStockAdjustment);
router.delete('/adjustments/:id', warehouseController.deleteStockAdjustment);

module.exports = router;
