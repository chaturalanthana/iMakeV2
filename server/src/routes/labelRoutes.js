const express = require('express');
const controller = require('../controllers/labelController');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.get('/catalog', controller.catalog);
router.get('/resolve', controller.resolve);
router.post('/render', validateBody(schemas.labelRender), controller.render);

module.exports = router;
