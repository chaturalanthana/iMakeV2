const express = require('express');
const supplierController = require('../controllers/supplierController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', supplierController.getSuppliers);
router.post('/', validateBody(schemas.supplier), supplierController.createSupplier);
router.put('/:id', validateBody(schemas.supplier), supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);

module.exports = router;
