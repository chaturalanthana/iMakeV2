const express = require('express');
const { getProductGroups, createProductGroup, updateProductGroup, deleteProductGroup } = require('../controllers/productGroupController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

// Enforce Zero-Trust Architecture
router.use(requireTenant);

router.get('/', getProductGroups);
router.post('/', validateBody(schemas.productGroup), createProductGroup);
router.put('/:id', validateBody(schemas.productGroup), updateProductGroup);
router.delete('/:id', deleteProductGroup);

module.exports = router;
