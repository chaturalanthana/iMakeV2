const express = require('express');
const customerController = require('../controllers/customerController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', customerController.getCustomers);
router.post('/', validateBody(schemas.customerCreate), customerController.createCustomer);
router.put('/:id', validateBody(schemas.customerUpdate), customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
