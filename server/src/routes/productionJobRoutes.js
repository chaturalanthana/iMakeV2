const express = require('express');
const productionJobController = require('../controllers/productionJobController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', productionJobController.getProductionJobs);
router.post('/', productionJobController.createProductionJob);
router.post('/merge', productionJobController.mergeProductionJobs);
router.post('/:id/split', productionJobController.splitProductionJob);
router.put('/:id', productionJobController.updateProductionJob);
router.patch('/:id/status', productionJobController.updateJobStatus);
router.delete('/:id', productionJobController.deleteProductionJob);

module.exports = router;
