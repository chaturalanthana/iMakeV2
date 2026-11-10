const express = require('express');
const currencyController = require('../controllers/currencyController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', currencyController.getCurrencies);
router.post('/', validateBody(schemas.currency), currencyController.createCurrency);
router.put('/:id', validateBody(schemas.currency), currencyController.updateCurrency);
router.delete('/:id', currencyController.deleteCurrency);

module.exports = router;
