const express = require('express');
const { 
  getPriceLists, 
  getPriceListById, 
  createPriceList, 
  updatePriceList, 
  deletePriceList 
} = require('../controllers/priceListController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPriceLists);
router.get('/:id', getPriceListById);
router.post('/', validateBody(schemas.priceList), createPriceList);
router.put('/:id', validateBody(schemas.priceList), updatePriceList);
router.delete('/:id', deletePriceList);

module.exports = router;
