const express = require('express');
const { getPreference, savePreference } = require('../controllers/preferenceController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);
router.get('/:key', getPreference);
router.put('/:key', savePreference);

module.exports = router;
