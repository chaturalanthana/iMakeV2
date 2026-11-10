const express = require('express');
const controller = require('../controllers/alertController');

const router = express.Router();
router.get('/', controller.inbox);

module.exports = router;
