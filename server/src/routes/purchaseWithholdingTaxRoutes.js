const express = require('express');
const { 
  getPurchaseWithholdingTaxGroups, 
  getPurchaseWithholdingTaxGroupById, 
  createPurchaseWithholdingTaxGroup, 
  updatePurchaseWithholdingTaxGroup, 
  deletePurchaseWithholdingTaxGroup 
} = require('../controllers/purchaseWithholdingTaxController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPurchaseWithholdingTaxGroups);
router.get('/:id', getPurchaseWithholdingTaxGroupById);
router.post('/', validateBody(schemas.purchaseWithholdingTaxGroup), createPurchaseWithholdingTaxGroup);
router.put('/:id', validateBody(schemas.purchaseWithholdingTaxGroup), updatePurchaseWithholdingTaxGroup);
router.delete('/:id', deletePurchaseWithholdingTaxGroup);

module.exports = router;
