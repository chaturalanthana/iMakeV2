const express = require('express');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

// Enforce Zero-Trust Architecture: All category routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getCategories);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
