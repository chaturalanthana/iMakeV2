const express = require('express');
const { getProducts, getAttributes, createProduct, updateProduct, deleteProduct, duplicateProduct, batchUpdateProducts } = require('../controllers/productController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

// Enforce Zero-Trust Architecture: All product routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getProducts);
router.get('/attributes', getAttributes);
router.post('/', createProduct);
router.post('/batch', batchUpdateProducts);
router.post('/:id/duplicate', duplicateProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
