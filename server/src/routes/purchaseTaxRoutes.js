const express = require('express');
const { 
  getPurchaseTaxGroups, 
  getPurchaseTaxGroupById, 
  createPurchaseTaxGroup, 
  updatePurchaseTaxGroup, 
  deletePurchaseTaxGroup 
} = require('../controllers/purchaseTaxController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPurchaseTaxGroups);
router.get('/:id', getPurchaseTaxGroupById);
router.post('/', validateBody(schemas.purchaseTaxGroup), createPurchaseTaxGroup);
router.put('/:id', validateBody(schemas.purchaseTaxGroup), updatePurchaseTaxGroup);
router.delete('/:id', deletePurchaseTaxGroup);

module.exports = router;
