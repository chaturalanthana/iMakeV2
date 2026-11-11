const express = require('express');
const { getBrands, createBrand, updateBrand, deleteBrand } = require('../controllers/brandController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

// Enforce Zero-Trust Architecture: All brand routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getBrands);
router.post('/', validateBody(schemas.brand), createBrand);
router.put('/:id', validateBody(schemas.brand), updateBrand);
router.delete('/:id', deleteBrand);

module.exports = router;
