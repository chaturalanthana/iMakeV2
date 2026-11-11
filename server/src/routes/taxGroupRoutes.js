const express = require('express');
const taxGroupController = require('../controllers/taxGroupController');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.get('/', taxGroupController.getTaxGroups);
router.get('/:id', taxGroupController.getTaxGroupById);
router.post('/', validateBody(schemas.taxGroup), taxGroupController.createTaxGroup);
router.put('/:id', validateBody(schemas.taxGroup), taxGroupController.updateTaxGroup);
router.delete('/:id', taxGroupController.deleteTaxGroup);

module.exports = router;
