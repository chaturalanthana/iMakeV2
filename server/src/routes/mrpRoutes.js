const express = require('express');
const mrpController = require('../controllers/mrpController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requireTenant);

router.post('/plan', (req, _res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  next();
}, validateBody(schemas.mrpPlan), mrpController.runMRPAna);
router.post('/convert-purchase', validateBody(schemas.mrpConvert), mrpController.convertPurchaseSuggestion);
router.post('/convert-production', validateBody(schemas.mrpConvert), mrpController.convertProductionSuggestion);

module.exports = router;
