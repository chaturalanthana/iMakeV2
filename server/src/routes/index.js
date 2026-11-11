const express = require('express');
const authRoutes = require('./authRoutes');

const productRoutes = require('./productRoutes');
const brandRoutes = require('./brandRoutes');
const categoryRoutes = require('./categoryRoutes');
const productTypeRoutes = require('./productTypeRoutes');
const productGroupRoutes = require('./productGroupRoutes');
const financeRoutes = require('./financeRoutes');
const phase2Routes = require('./phase2Routes');
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
const workOrderRoutes = require('./workOrderRoutes');
const costingRoutes = require('./costingRoutes');
const mrpRoutes = require('./mrpRoutes');
const workstationRoutes = require('./workstationRoutes');
const machineRoutes = require('./machineRoutes');
const uploadRoutes = require('./uploadRoutes');
const replenishmentRoutes = require('./replenishmentRoutes');
const alertRoutes = require('./alertRoutes');
const importRoutes = require('./importRoutes');
const labelRoutes = require('./labelRoutes');
const { work: controlWorkRoutes, controls: controlSettingsRoutes } = require('./controlRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const { secureModule, secureAny } = require('../middlewares/rbacMiddleware');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/me/preferences', ...requireTenant, preferenceRoutes);

router.use('/products', ...secureModule('products'), productRoutes);
router.use('/brands', ...secureModule('products'), brandRoutes);
router.use('/categories', ...secureModule('products'), categoryRoutes);
router.use('/product-types', ...secureModule('products'), productTypeRoutes);
router.use('/product-groups', ...secureModule('products'), productGroupRoutes);
router.use('/uoms', ...secureModule('products'), uomRoutes);

router.use('/customers', ...secureModule('sales'), customerRoutes);
router.use('/customer-categories', ...secureModule('sales'), customerCategoryRoutes);
router.use('/price-lists', ...secureModule('sales'), priceListRoutes);
router.use('/discount-groups', ...secureModule('sales'), discountGroupRoutes);
router.use('/sales', ...secureModule('sales'), salesRoutes);

router.use('/suppliers', ...secureModule('procurement'), supplierRoutes);
router.use('/payment-terms', ...secureModule('procurement'), paymentTermRoutes);
router.use('/procurement', ...secureModule('procurement'), procurementRoutes);

router.use('/warehouse', ...secureModule('warehouse'), warehouseRoutes);
router.use('/warehouses', ...secureModule('warehouse'), warehouseMasterRoutes);
router.use('/inventory', ...secureModule('warehouse'), inventoryRoutes);

router.use('/finance', ...secureModule('finance'), financeRoutes);
router.use('/phase2', ...secureAny(['finance', 'procurement']), phase2Routes);
router.use('/hr', ...secureModule('hr'), hrRoutes);

router.use('/boms', ...secureModule('production'), bomRoutes);
router.use('/production-calendar', ...secureModule('production'), productionCalendarRoutes);
router.use('/production-jobs', ...secureModule('production'), productionJobRoutes);
router.use('/production-orders', ...secureModule('production'), productionOrderRoutes);
router.use('/work-orders', ...secureModule('production'), workOrderRoutes);
router.use('/workstations', ...secureModule('production'), workstationRoutes);
router.use('/machines', ...secureModule('production'), machineRoutes);
router.use('/mrp', ...secureModule('production'), mrpRoutes);
router.use('/replenishment', ...secureAny(['production', 'procurement']), replenishmentRoutes);
router.use('/alerts', ...secureAny(['sales', 'procurement', 'finance', 'hr', 'warehouse', 'production']), alertRoutes);
router.use('/imports', ...secureAny(['products', 'sales', 'procurement', 'production', 'warehouse', 'finance']), importRoutes);
router.use('/labels', ...secureAny(['products', 'warehouse', 'production', 'sales', 'procurement']), labelRoutes);
router.use('/uploads', ...secureModule('production'), uploadRoutes);
router.use('/costing', ...secureModule('costing'), costingRoutes);

router.use('/roles', ...secureModule('settings'), roleRoutes);
router.use('/users', ...secureModule('settings'), userRoutes);
router.use('/controls', ...secureModule('settings'), controlSettingsRoutes);
router.use('/', ...secureAny(['sales', 'procurement', 'finance', 'hr', 'warehouse', 'production', 'products', 'settings']), controlWorkRoutes);

module.exports = router;
