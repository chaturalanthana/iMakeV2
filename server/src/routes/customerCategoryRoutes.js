const express = require('express');
const { 
  getCustomerCategories, 
  createCustomerCategory, 
  updateCustomerCategory, 
  deleteCustomerCategory 
} = require('../controllers/customerCategoryController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getCustomerCategories);
router.post('/', validateBody(schemas.customerCategory), createCustomerCategory);
router.put('/:id', validateBody(schemas.customerCategoryUpdate), updateCustomerCategory);
router.delete('/:id', deleteCustomerCategory);

module.exports = router;
