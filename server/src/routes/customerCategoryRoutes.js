const express = require('express');
const { 
  getCustomerCategories, 
  createCustomerCategory, 
  updateCustomerCategory, 
  deleteCustomerCategory 
} = require('../controllers/customerCategoryController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getCustomerCategories);
router.post('/', createCustomerCategory);
router.put('/:id', updateCustomerCategory);
router.delete('/:id', deleteCustomerCategory);

module.exports = router;
