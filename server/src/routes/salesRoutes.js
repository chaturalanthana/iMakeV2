const express = require('express');
const salesController = require('../controllers/salesController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/quotations', salesController.getQuotations);
router.post('/quotations', salesController.createQuotation);
router.put('/quotations/:id', salesController.updateQuotation);
router.delete('/quotations/:id', salesController.deleteQuotation);

router.get('/orders', salesController.getOrders);
router.post('/orders', salesController.createOrder);
router.put('/orders/:id', salesController.updateOrder);
router.delete('/orders/:id', salesController.deleteOrder);

router.get('/deliveries', salesController.getDeliveries);
router.post('/deliveries', salesController.createDelivery);
router.put('/deliveries/:id', salesController.updateDelivery);
router.delete('/deliveries/:id', salesController.deleteDelivery);

router.get('/invoices', salesController.getInvoices);
router.post('/invoices', salesController.createInvoice);
router.put('/invoices/:id', salesController.updateInvoice);
router.delete('/invoices/:id', salesController.deleteInvoice);

module.exports = router;
