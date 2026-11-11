const express = require('express');
const productionOrderController = require('../controllers/productionOrderController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requireTenant);

router.get('/', productionOrderController.getProductionOrders);
router.post('/', validateBody(schemas.orderCreate), productionOrderController.createProductionOrder);
router.put('/:id', validateBody(schemas.orderUpdate), productionOrderController.updateProductionOrder);
router.delete('/:id', productionOrderController.deleteProductionOrder);

module.exports = router;
