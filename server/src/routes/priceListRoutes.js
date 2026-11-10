const express = require('express');
const { 
  getPriceLists, 
  getPriceListById, 
  createPriceList, 
  updatePriceList, 
  deletePriceList 
} = require('../controllers/priceListController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPriceLists);
router.get('/:id', getPriceListById);
router.post('/', createPriceList);
router.put('/:id', updatePriceList);
router.delete('/:id', deletePriceList);

module.exports = router;
