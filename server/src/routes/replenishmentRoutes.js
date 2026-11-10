const express = require('express');
const controller = require('../controllers/replenishmentController');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
const emptyBody = (req, _res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  next();
};

router.get('/policies', controller.policies);
router.post('/policies', validateBody(schemas.replenishmentPolicy), controller.savePolicy);
router.delete('/policies/:id', controller.deletePolicy);
router.get('/settings', controller.current);
router.put('/settings', validateBody(schemas.replenishmentSettings), controller.saveSettings);
router.post('/run', emptyBody, validateBody(schemas.mrpPlan), controller.run);
router.post('/approve', emptyBody, validateBody(schemas.mrpPlan), controller.approve);
router.post('/schedule-tick', emptyBody, validateBody(schemas.mrpPlan), controller.tick);

module.exports = router;
