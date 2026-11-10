const express = require('express');
const controller = require('../controllers/workOrderController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();
router.use(requireTenant);

router.get('/settings', controller.settings);
router.put('/settings', controller.saveSettings);
router.get('/capacity', controller.capacity);
router.get('/reason-codes', controller.reasons);
router.get('/scan', controller.scan);
router.post('/migrate', controller.migrate);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id/cost', controller.cost);
router.post('/:id/release', controller.release);
router.post('/:id/issues', controller.issue);
router.post('/:id/operations/:operationId/start', controller.start);
router.post('/:id/operations/:operationId/pause', controller.pause);
router.post('/:id/operations/:operationId/stop', controller.stop);
router.post('/:id/confirmations', controller.confirm);
router.post('/:id/teco', controller.teco);
router.post('/:id/close', controller.close);
router.post('/:id/cancel', controller.cancel);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
