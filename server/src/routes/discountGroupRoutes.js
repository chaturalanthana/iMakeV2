const express = require('express');
const { 
  getDiscountGroups, 
  getDiscountGroupById, 
  createDiscountGroup, 
  updateDiscountGroup, 
  deleteDiscountGroup 
} = require('../controllers/discountGroupController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getDiscountGroups);
router.get('/:id', getDiscountGroupById);
router.post('/', createDiscountGroup);
router.put('/:id', updateDiscountGroup);
router.delete('/:id', deleteDiscountGroup);

module.exports = router;
