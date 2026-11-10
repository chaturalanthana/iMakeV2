const express = require('express');
const prController = require('../controllers/purchaseRequisitionController');

const router = express.Router();

router.get('/', prController.getPurchaseRequisitions);
router.get('/:id', prController.getPurchaseRequisitionById);
router.post('/', prController.createPurchaseRequisition);
router.put('/:id', prController.updatePurchaseRequisition);
router.delete('/:id', prController.deletePurchaseRequisition);

module.exports = router;
