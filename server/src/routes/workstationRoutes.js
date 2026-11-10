const express = require('express');
const router = express.Router();
const workstationController = require('../controllers/workstationController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

// Secure all endpoints with tenant check
router.use(requireTenant);

router.get('/', workstationController.getWorkstations);
router.get('/:id', workstationController.getWorkstationById);
router.post('/', workstationController.createWorkstation);
router.put('/:id', workstationController.updateWorkstation);
router.delete('/:id', workstationController.deleteWorkstation);

module.exports = router;
