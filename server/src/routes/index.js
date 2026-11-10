const express = require('express');
const authRoutes = require('./authRoutes');

const productRoutes = require('./productRoutes');
const brandRoutes = require('./brandRoutes');
const categoryRoutes = require('./categoryRoutes');
const productTypeRoutes = require('./productTypeRoutes');
const productGroupRoutes = require('./productGroupRoutes');
const financeRoutes = require('./financeRoutes');
const customerRoutes = require('./customerRoutes');
const salesRoutes = require('./salesRoutes');
const supplierRoutes = require('./supplierRoutes');
const procurementRoutes = require('./procurementRoutes');
const warehouseRoutes = require('./warehouseRoutes');
const warehouseMasterRoutes = require('./warehouseMasterRoutes');
const hrRoutes = require('./hrRoutes');
const roleRoutes = require('./roleRoutes');
const userRoutes = require('./userRoutes');
const preferenceRoutes = require('./preferenceRoutes');
const uomRoutes = require('./uomRoutes');
const customerCategoryRoutes = require('./customerCategoryRoutes');
const priceListRoutes = require('./priceListRoutes');
const discountGroupRoutes = require('./discountGroupRoutes');
const paymentTermRoutes = require('./paymentTermRoutes');
const bomRoutes = require('./bomRoutes');
const productionCalendarRoutes = require('./productionCalendarRoutes');
const productionJobRoutes = require('./productionJobRoutes');
const productionOrderRoutes = require('./productionOrderRoutes');
const mrpRoutes = require('./mrpRoutes');
const workstationRoutes = require('./workstationRoutes');
const machineRoutes = require('./machineRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes); // Secured internally by tenantMiddleware
router.use('/brands', brandRoutes);     // Secured internally by tenantMiddleware
router.use('/categories', categoryRoutes);
router.use('/product-types', productTypeRoutes);
router.use('/product-groups', productGroupRoutes);
router.use('/uoms', uomRoutes);
router.use('/finance', financeRoutes); // Needs to be secured
router.use('/customers', customerRoutes);
router.use('/customer-categories', customerCategoryRoutes);
router.use('/price-lists', priceListRoutes);
router.use('/discount-groups', discountGroupRoutes);
router.use('/payment-terms', paymentTermRoutes);
router.use('/boms', bomRoutes);
router.use('/production-calendar', productionCalendarRoutes);
router.use('/production-jobs', productionJobRoutes);
router.use('/production-orders', productionOrderRoutes);
router.use('/workstations', workstationRoutes);
router.use('/machines', machineRoutes);
router.use('/mrp', mrpRoutes);
router.use('/sales', salesRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/procurement', procurementRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/warehouses', warehouseMasterRoutes);
router.use('/hr', hrRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/me/preferences', preferenceRoutes);

module.exports = router;

