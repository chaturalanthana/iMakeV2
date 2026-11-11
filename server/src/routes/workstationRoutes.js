const express = require('express');
const router = express.Router();
const workstationController = require('../controllers/workstationController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

// Secure all endpoints with tenant check
router.use(requireTenant);

router.get('/', workstationController.getWorkstations);
router.get('/:id', workstationController.getWorkstationById);
router.post('/', validateBody(schemas.workstation), workstationController.createWorkstation);
router.put('/:id', validateBody(schemas.workstationUpdate), workstationController.updateWorkstation);
router.delete('/:id', workstationController.deleteWorkstation);

module.exports = router;
