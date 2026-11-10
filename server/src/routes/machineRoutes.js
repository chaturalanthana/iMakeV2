const express = require('express');
const machineController = require('../controllers/machineController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', machineController.getMachines);
router.post('/', machineController.createMachine);
router.put('/:id', machineController.updateMachine);
router.delete('/:id', machineController.deleteMachine);

module.exports = router;
