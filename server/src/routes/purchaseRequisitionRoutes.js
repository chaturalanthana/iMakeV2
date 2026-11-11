const express = require('express');
const prController = require('../controllers/purchaseRequisitionController');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.get('/', prController.getPurchaseRequisitions);
router.get('/:id', prController.getPurchaseRequisitionById);
router.post('/', validateBody(schemas.purchaseRequisition), prController.createPurchaseRequisition);
router.put('/:id', validateBody(schemas.documentUpdate), prController.updatePurchaseRequisition);
router.delete('/:id', prController.deletePurchaseRequisition);

module.exports = router;
