const express = require('express');
const bomController = require('../controllers/bomController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', bomController.getBOMs);
router.get('/compare', bomController.compareBOMs);
router.get('/by-code/:productCode/:bomCode', bomController.getBOMByCode);
router.get('/:id', bomController.getBOM);
router.post('/', validateBody(schemas.bomCreate), bomController.createBOM);
router.put('/:id', validateBody(schemas.bomUpdate), bomController.updateBOM);
router.delete('/:id', bomController.deleteBOM);
router.post('/:id/activate', bomController.activateBOM);
router.post('/:id/retire', bomController.retireBOM);
router.post('/:id/duplicate', bomController.duplicateBOM);
router.get('/tree/:productId', bomController.getBOMTree);

// BOM Resource uploads management
router.get('/:id/resources', bomController.getBOMResources);
router.post('/:id/resources', upload.single('file'), bomController.uploadBOMResource);
router.delete('/:id/resources/:resourceId', bomController.deleteBOMResource);

module.exports = router;
