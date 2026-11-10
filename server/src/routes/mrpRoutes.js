const express = require('express');
const mrpController = require('../controllers/mrpController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();
router.use(requireTenant);

router.post('/plan', mrpController.runMRPAna);
router.post('/convert-purchase', mrpController.convertPurchaseSuggestion);
router.post('/convert-production', mrpController.convertProductionSuggestion);

module.exports = router;
