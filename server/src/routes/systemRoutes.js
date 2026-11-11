const express = require('express');
const { flushSystemData } = require('../controllers/systemController');
const { requirePermission } = require('../middlewares/rbacMiddleware');

const router = express.Router();

router.post('/flush', requirePermission('settings', 'write'), flushSystemData);

module.exports = router;
