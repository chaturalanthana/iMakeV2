const express = require('express');
const taxGroupController = require('../controllers/taxGroupController');

const router = express.Router();

router.get('/', taxGroupController.getTaxGroups);
router.get('/:id', taxGroupController.getTaxGroupById);
router.post('/', taxGroupController.createTaxGroup);
router.put('/:id', taxGroupController.updateTaxGroup);
router.delete('/:id', taxGroupController.deleteTaxGroup);

module.exports = router;
