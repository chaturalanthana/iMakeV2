const express = require('express');
const procurementController = require('../controllers/procurementController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const purchaseTaxRoutes = require('./purchaseTaxRoutes');
const purchaseWithholdingTaxRoutes = require('./purchaseWithholdingTaxRoutes');
const purchaseRequisitionRoutes = require('./purchaseRequisitionRoutes');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/purchase-orders', procurementController.getPurchaseOrders);
router.post('/purchase-orders', validateBody(schemas.purchaseOrder), procurementController.createPurchaseOrder);
router.put('/purchase-orders/:id', validateBody(schemas.documentUpdate), procurementController.updatePurchaseOrder);
router.delete('/purchase-orders/:id', procurementController.deletePurchaseOrder);
router.post('/purchase-orders/:id/cancel', procurementController.cancelPurchaseOrder);

router.get('/grn', procurementController.getGrns);
router.post('/grn', validateBody(schemas.goodsReceipt), procurementController.createGrn);
router.post('/grn/:id/cancel', procurementController.cancelGrn);
router.delete('/grn/:id', procurementController.deleteGrn);

router.get('/supplier-invoices', procurementController.getSupplierInvoices);
router.post('/supplier-invoices', validateBody(schemas.supplierInvoice), procurementController.postSupplierInvoice);
router.post('/supplier-invoices/:id/cancel', procurementController.cancelSupplierInvoice);
router.get('/supplier-aging', procurementController.getSupplierAging);
router.get('/supplier-statement/:id', procurementController.getSupplierStatement);

router.use('/tax-groups', purchaseTaxRoutes);
router.use('/withholding-tax-groups', purchaseWithholdingTaxRoutes);
router.use('/purchase-requisitions', purchaseRequisitionRoutes);

module.exports = router;
