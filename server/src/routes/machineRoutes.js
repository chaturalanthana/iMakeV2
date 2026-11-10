const express = require('express');
const machineController = require('../controllers/machineController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', machineController.getMachines);
router.post('/', validateBody(schemas.machineCreate), machineController.createMachine);
router.put('/:id', validateBody(schemas.machineUpdate), machineController.updateMachine);
router.delete('/:id', machineController.deleteMachine);

module.exports = router;
