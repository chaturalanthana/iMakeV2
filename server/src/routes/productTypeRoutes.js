const express = require('express');
const { getProductTypes, createProductType, updateProductType, deleteProductType } = require('../controllers/productTypeController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

// Enforce strict Tenant isolation: All product type routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getProductTypes);
router.post('/', validateBody(schemas.productType), createProductType);
router.put('/:id', validateBody(schemas.productType), updateProductType);
router.delete('/:id', deleteProductType);

module.exports = router;
