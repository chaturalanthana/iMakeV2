const express = require('express');
const salesController = require('../controllers/salesController');
const phase3 = require('../controllers/phase3Controller');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');
const phase3Schemas = require('../validation/phase3');

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

router.get('/dispatch/defaults', phase3.getDefaults);
router.get('/dispatch/settings', phase3.getSettingsRow);
router.put('/dispatch/settings', validateBody(phase3Schemas.settings), phase3.putSettings);
router.get('/dispatch/board', phase3.getBoard);
router.get('/dispatch/quote', phase3.quote);
router.get('/dispatch/routes', phase3.listRoutes);
router.post('/dispatch/routes', validateBody(phase3Schemas.route), phase3.createRoute);
router.get('/dispatch/vehicles', phase3.listVehicles);
router.post('/dispatch/vehicles', validateBody(phase3Schemas.vehicle), phase3.createVehicle);
router.get('/dispatch/ship-tos', phase3.listShipTos);
router.post('/dispatch/ship-tos', validateBody(phase3Schemas.shipTo), phase3.createShipTo);
router.get('/dispatch/prices', phase3.listPrices);
router.post('/dispatch/prices', validateBody(phase3Schemas.priceRule), phase3.createPrice);
router.post('/dispatch/orders/:id/release', validateBody(phase3Schemas.release), phase3.release);
router.post('/dispatch/orders/:id/cancel', validateBody(phase3Schemas.cancel), phase3.cancel);
router.get('/dispatch/picks', phase3.listPicks);
router.post('/dispatch/picks', validateBody(phase3Schemas.pick), phase3.createPick);
router.post('/dispatch/picks/:id/advance', validateBody(phase3Schemas.advance), phase3.advance);
router.post('/dispatch/picks/:id/deliveries', phase3.deliver);
router.get('/dispatch/trips', phase3.listTrips);
router.post('/dispatch/trips', validateBody(phase3Schemas.trip), phase3.createTrip);
router.post('/dispatch/trips/:id/invoices', phase3.invoiceTrip);
router.post('/dispatch/trips/:id/gate-pass', phase3.gatePass);
router.post('/dispatch/trips/:id/depart', phase3.depart);
router.post('/dispatch/trips/:id/cancel', validateBody(phase3Schemas.cancel), phase3.cancelTrip);
router.post('/dispatch/trips/:id/return', phase3.returnTrip);
router.post('/dispatch/proofs', validateBody(phase3Schemas.proof), phase3.recordProof);
router.post('/dispatch/proofs/:id/credit', phase3.creditProof);
router.get('/dispatch/returns', phase3.listReturns);
router.post('/dispatch/returns', validateBody(phase3Schemas.salesReturn), phase3.createReturn);
router.post('/dispatch/returns/:id/cancel', validateBody(phase3Schemas.cancel), phase3.cancelReturn);
router.post('/dispatch/cash-sales', validateBody(phase3Schemas.cashSale), phase3.cashSale);
router.post('/dispatch/cash-sales/:id/cancel', validateBody(phase3Schemas.cancel), phase3.cancelCash);
router.get('/dispatch/notifications', phase3.listNotes);
router.post('/dispatch/notifications/:id/read', phase3.readNote);
router.get('/dispatch/bank-file', phase3.getBank);
router.put('/dispatch/bank-file', validateBody(phase3Schemas.bankColumns), phase3.putBank);
router.post('/dispatch/bank-file/export', phase3.exportBank);

module.exports = router;
