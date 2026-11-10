const express = require('express');
const { getProductGroups, createProductGroup, updateProductGroup, deleteProductGroup } = require('../controllers/productGroupController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

// Enforce Zero-Trust Architecture
router.use(requireTenant);

router.get('/', getProductGroups);
router.post('/', createProductGroup);
router.put('/:id', updateProductGroup);
router.delete('/:id', deleteProductGroup);

module.exports = router;
