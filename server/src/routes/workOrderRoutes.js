const express = require('express');
const controller = require('../controllers/workOrderController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requireTenant);

router.get('/settings', controller.settings);
router.put('/settings', validateBody(schemas.workOrderSettings), controller.saveSettings);
router.get('/capacity', controller.capacity);
router.get('/reason-codes', controller.reasons);
router.get('/scan', controller.scan);
router.post('/migrate', controller.migrate);
router.get('/', controller.list);
router.post('/', validateBody(schemas.workOrderCreate), controller.create);
router.get('/:id/cost', controller.cost);
router.post('/:id/release', controller.release);
router.post('/:id/issues', validateBody(schemas.workOrderIssue), controller.issue);
router.post('/:id/operations/:operationId/start', validateBody(schemas.clockBody), controller.start);
router.post('/:id/operations/:operationId/pause', validateBody(schemas.clockBody), controller.pause);
router.post('/:id/operations/:operationId/stop', validateBody(schemas.clockBody), controller.stop);
router.post('/:id/confirmations', validateBody(schemas.confirmation), controller.confirm);
router.post('/:id/teco', controller.teco);
router.post('/:id/close', controller.close);
router.post('/:id/close-now', controller.closeNow);
router.post('/:id/short-close', controller.shortClose);
router.post('/:id/cancel', controller.cancel);
router.get('/:id', controller.getOne);
router.put('/:id', validateBody(schemas.workOrderUpdate), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
