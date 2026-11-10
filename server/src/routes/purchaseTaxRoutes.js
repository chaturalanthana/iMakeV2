const express = require('express');
const { 
  getPurchaseTaxGroups, 
  getPurchaseTaxGroupById, 
  createPurchaseTaxGroup, 
  updatePurchaseTaxGroup, 
  deletePurchaseTaxGroup 
} = require('../controllers/purchaseTaxController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPurchaseTaxGroups);
router.get('/:id', getPurchaseTaxGroupById);
router.post('/', createPurchaseTaxGroup);
router.put('/:id', updatePurchaseTaxGroup);
router.delete('/:id', deletePurchaseTaxGroup);

module.exports = router;
