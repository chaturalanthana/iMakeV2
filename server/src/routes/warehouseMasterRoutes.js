const express = require('express');
const warehouseMasterController = require('../controllers/warehouseMasterController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', warehouseMasterController.getWarehouses);
router.post('/', warehouseMasterController.createWarehouse);
router.put('/:id', warehouseMasterController.updateWarehouse);
router.delete('/:id', warehouseMasterController.deleteWarehouse);

module.exports = router;
