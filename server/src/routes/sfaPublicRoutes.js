const express = require('express');
const phase3 = require('../controllers/phase3Controller');
const { sfaAuth } = require('../middlewares/sfaAuth');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/phase3');

const router = express.Router();

router.use(sfaAuth);
router.post('/orders', validateBody(schemas.sfaOrder), phase3.importOrder);
router.post('/customers', validateBody(schemas.sfaCustomer), phase3.importCustomer);
router.post('/collections', validateBody(schemas.sfaCollection), phase3.importCollection);
router.post('/returns', validateBody(schemas.sfaReturn), phase3.importReturn);
router.post('/routes', validateBody(schemas.sfaRoute), phase3.importRoute);
router.post('/visits', validateBody(schemas.sfaVisit), phase3.importVisit);
router.get('/items', phase3.exportItems);
router.get('/prices', phase3.exportPrices);
router.get('/stock', phase3.exportStock);
router.get('/balances', phase3.exportBalances);

module.exports = router;
