const express = require('express');
const supplierController = require('../controllers/supplierController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', supplierController.getSuppliers);
router.post('/', supplierController.createSupplier);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);

module.exports = router;
