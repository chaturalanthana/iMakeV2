const express = require('express');
const { getPaymentTerms, createPaymentTerm, updatePaymentTerm, deletePaymentTerm } = require('../controllers/paymentTermController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPaymentTerms);
router.post('/', validateBody(schemas.paymentTerm), createPaymentTerm);
router.put('/:id', validateBody(schemas.paymentTerm), updatePaymentTerm);
router.delete('/:id', deletePaymentTerm);

module.exports = router;
