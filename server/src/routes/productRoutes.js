const express = require('express');
const { getProducts, getAttributes, createProduct, updateProduct, deleteProduct, duplicateProduct, batchUpdateProducts } = require('../controllers/productController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

// Enforce Zero-Trust Architecture: All product routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getProducts);
router.get('/attributes', getAttributes);
router.post('/', validateBody(schemas.productCreate), createProduct);
router.post('/batch', validateBody(schemas.productBatch), batchUpdateProducts);
router.post('/:id/duplicate', validateBody(schemas.productDuplicate), duplicateProduct);
router.put('/:id', validateBody(schemas.productUpdate), updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
