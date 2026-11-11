const express = require('express');
const multer = require('multer');
const controller = require('../controllers/importController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();
router.get('/:entity/template', controller.downloadTemplate);
router.post('/:entity', upload.single('file'), controller.upload);

module.exports = router;
