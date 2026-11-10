const express = require('express');
const productionOrderController = require('../controllers/productionOrderController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();
router.use(requireTenant);

router.get('/', productionOrderController.getProductionOrders);
router.post('/', productionOrderController.createProductionOrder);
router.put('/:id', productionOrderController.updateProductionOrder);
router.delete('/:id', productionOrderController.deleteProductionOrder);

module.exports = router;
