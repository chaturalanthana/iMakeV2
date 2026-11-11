const express = require('express');
const warehouseMasterController = require('../controllers/warehouseMasterController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', warehouseMasterController.getWarehouses);
router.post('/', validateBody(schemas.warehouse), warehouseMasterController.createWarehouse);
router.put('/:id', validateBody(schemas.warehouse), warehouseMasterController.updateWarehouse);
router.delete('/:id', warehouseMasterController.deleteWarehouse);

module.exports = router;
