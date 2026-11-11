const express = require('express');
const controller = require('../controllers/costingController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateQuery } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requireTenant);

router.get('/rollup', validateQuery(schemas.costQuery), controller.rollup);
router.get('/variances', controller.variances);

module.exports = router;
