const express = require('express');
const { getBrands, createBrand, updateBrand, deleteBrand } = require('../controllers/brandController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

// Enforce Zero-Trust Architecture: All brand routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getBrands);
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.delete('/:id', deleteBrand);

module.exports = router;
