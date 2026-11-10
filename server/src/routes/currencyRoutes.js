const express = require('express');
const currencyController = require('../controllers/currencyController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', currencyController.getCurrencies);
router.post('/', currencyController.createCurrency);
router.put('/:id', currencyController.updateCurrency);
router.delete('/:id', currencyController.deleteCurrency);

module.exports = router;
