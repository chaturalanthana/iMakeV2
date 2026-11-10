const express = require('express');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

// Enforce Zero-Trust Architecture: All category routes require validated JWT and Tenant ID
router.use(requireTenant);

router.get('/', getCategories);
router.post('/', validateBody(schemas.category), createCategory);
router.put('/:id', validateBody(schemas.category), updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
