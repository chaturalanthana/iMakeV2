const express = require('express');
const { getPreference, savePreference } = require('../controllers/preferenceController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);
router.get('/:key', getPreference);
router.put('/:key', validateBody(schemas.preference), savePreference);

module.exports = router;
