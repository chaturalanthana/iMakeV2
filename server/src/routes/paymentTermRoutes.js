const express = require('express');
const { getPaymentTerms, createPaymentTerm, updatePaymentTerm, deletePaymentTerm } = require('../controllers/paymentTermController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getPaymentTerms);
router.post('/', createPaymentTerm);
router.put('/:id', updatePaymentTerm);
router.delete('/:id', deletePaymentTerm);

module.exports = router;
