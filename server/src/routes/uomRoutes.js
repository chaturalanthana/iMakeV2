const express = require('express');
const { getUoms, createUom, updateUom, deleteUom } = require('../controllers/uomController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

router.get('/', getUoms);
router.post('/', validateBody(schemas.uom), createUom);
router.put('/:id', validateBody(schemas.uom), updateUom);
router.delete('/:id', deleteUom);

module.exports = router;
