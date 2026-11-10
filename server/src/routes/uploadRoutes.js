const express = require('express');
const { serveUpload } = require('../controllers/uploadController');

const router = express.Router();

router.use(serveUpload);

module.exports = router;
