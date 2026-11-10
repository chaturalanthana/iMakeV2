const express = require('express');
const salesController = require('../controllers/salesController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/quotations', salesController.getQuotations);
router.post('/quotations', validateBody(schemas.salesCreate), salesController.createQuotation);
router.put('/quotations/:id', validateBody(schemas.documentUpdate), salesController.updateQuotation);
router.delete('/quotations/:id', salesController.deleteQuotation);

router.get('/orders', salesController.getOrders);
router.post('/orders', validateBody(schemas.salesCreate), salesController.createOrder);
router.put('/orders/:id', validateBody(schemas.documentUpdate), salesController.updateOrder);
router.delete('/orders/:id', salesController.deleteOrder);

router.get('/deliveries', salesController.getDeliveries);
router.post('/deliveries', validateBody(schemas.deliveryCreate), salesController.createDelivery);
router.put('/deliveries/:id', validateBody(schemas.documentUpdate), salesController.updateDelivery);
router.post('/deliveries/:id/cancel', salesController.cancelDelivery);
router.delete('/deliveries/:id', salesController.deleteDelivery);

router.get('/invoices', salesController.getInvoices);
router.post('/invoices', validateBody(schemas.salesCreate), salesController.createInvoice);
router.put('/invoices/:id', validateBody(schemas.documentUpdate), salesController.updateInvoice);
router.post('/invoices/:id/cancel', salesController.cancelInvoice);
router.delete('/invoices/:id', salesController.deleteInvoice);

router.get('/customer-aging', salesController.getCustomerAging);
router.get('/customer-statement/:id', salesController.getCustomerStatement);

module.exports = router;
