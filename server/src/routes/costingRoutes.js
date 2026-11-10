const express = require('express');
const controller = require('../controllers/costingController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();
router.use(requireTenant);

router.get('/rollup', controller.rollup);
router.get('/variances', controller.variances);

module.exports = router;
