const express = require('express');
const { 
  getDiscountGroups, 
  getDiscountGroupById, 
  createDiscountGroup, 
  updateDiscountGroup, 
  deleteDiscountGroup 
} = require('../controllers/discountGroupController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getDiscountGroups);
router.get('/:id', getDiscountGroupById);
router.post('/', validateBody(schemas.discountGroup), createDiscountGroup);
router.put('/:id', validateBody(schemas.discountGroup), updateDiscountGroup);
router.delete('/:id', deleteDiscountGroup);

module.exports = router;
