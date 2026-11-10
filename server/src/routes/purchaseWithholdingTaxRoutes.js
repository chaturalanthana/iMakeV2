const express = require('express');
const { 
  getPurchaseWithholdingTaxGroups, 
  getPurchaseWithholdingTaxGroupById, 
  createPurchaseWithholdingTaxGroup, 
  updatePurchaseWithholdingTaxGroup, 
  deletePurchaseWithholdingTaxGroup 
} = require('../controllers/purchaseWithholdingTaxController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPurchaseWithholdingTaxGroups);
router.get('/:id', getPurchaseWithholdingTaxGroupById);
router.post('/', createPurchaseWithholdingTaxGroup);
router.put('/:id', updatePurchaseWithholdingTaxGroup);
router.delete('/:id', deletePurchaseWithholdingTaxGroup);

module.exports = router;
