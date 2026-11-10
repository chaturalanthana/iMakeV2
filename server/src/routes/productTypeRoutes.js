const express = require('express');
const { getProductTypes, createProductType, updateProductType, deleteProductType } = require('../controllers/productTypeController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

// Enforce strict Tenant isolation: All product type routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getProductTypes);
router.post('/', createProductType);
router.put('/:id', updateProductType);
router.delete('/:id', deleteProductType);

module.exports = router;
