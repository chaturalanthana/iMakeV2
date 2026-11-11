const express = require('express');
const productionJobController = require('../controllers/productionJobController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', productionJobController.getProductionJobs);
router.post('/', validateBody(schemas.jobCreate), productionJobController.createProductionJob);
router.post('/merge', validateBody(schemas.jobMerge), productionJobController.mergeProductionJobs);
router.post('/:id/split', validateBody(schemas.jobSplit), productionJobController.splitProductionJob);
router.put('/:id', validateBody(schemas.jobUpdate), productionJobController.updateProductionJob);
router.patch('/:id/status', validateBody(schemas.jobStatus), productionJobController.updateJobStatus);
router.delete('/:id', productionJobController.deleteProductionJob);

module.exports = router;
