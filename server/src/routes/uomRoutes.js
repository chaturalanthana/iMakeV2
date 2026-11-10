const express = require('express');
const { getUoms, createUom, updateUom, deleteUom } = require('../controllers/uomController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

router.get('/', getUoms);
router.post('/', createUom);
router.put('/:id', updateUom);
router.delete('/:id', deleteUom);

module.exports = router;
