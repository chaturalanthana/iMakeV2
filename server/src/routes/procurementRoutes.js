const express = require('express');
const procurementController = require('../controllers/procurementController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const purchaseTaxRoutes = require('./purchaseTaxRoutes');
const purchaseWithholdingTaxRoutes = require('./purchaseWithholdingTaxRoutes');
const purchaseRequisitionRoutes = require('./purchaseRequisitionRoutes');

const router = express.Router();

router.use(requireTenant);

router.get('/purchase-orders', procurementController.getPurchaseOrders);
router.post('/purchase-orders', procurementController.createPurchaseOrder);
router.put('/purchase-orders/:id', procurementController.updatePurchaseOrder);
router.delete('/purchase-orders/:id', procurementController.deletePurchaseOrder);

router.get('/grn', procurementController.getGrns);
router.post('/grn', procurementController.createGrn);
router.delete('/grn/:id', procurementController.deleteGrn);

router.use('/tax-groups', purchaseTaxRoutes);
router.use('/withholding-tax-groups', purchaseWithholdingTaxRoutes);
router.use('/purchase-requisitions', purchaseRequisitionRoutes);

module.exports = router;
