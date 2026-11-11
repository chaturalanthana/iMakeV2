const { movementEffect } = require('./stockService');
const { loadCapacity } = require('./production/workOrders');
const { hasFullAccess, allows } = require('../permissions/catalog');
const { num, money } = require('./money');

function can(role, moduleName) {
  if (!role) return false;
  if (hasFullAccess(role)) return true;
  return allows(role.permissions, moduleName, 'read');
}

function startOfToday() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function plusDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function onHand(db, tenantId) {
  const movements = await db.stockMovement.findMany({ where: { tenantId } });
  const byWarehouse = new Map();
  const byProduct = new Map();
  movements.forEach((movement) => {
    const effect = movementEffect(movement);
    const key = `${movement.productId}|${movement.warehouseId || ''}`;
    byWarehouse.set(key, money((byWarehouse.get(key) || 0) + effect));
    byProduct.set(movement.productId, money((byProduct.get(movement.productId) || 0) + effect));
  });
  return { byWarehouse, byProduct };
}

async function listAlerts(db, tenantId, role) {
  const alerts = [];
  const today = startOfToday();
  const stock = await onHand(db, tenantId);
  const seeProduction = can(role, 'production');
  const seeWarehouse = can(role, 'warehouse');
  const seeProcurement = can(role, 'procurement');
  const seeSales = can(role, 'sales');
  const seeFinance = can(role, 'finance');
  const seeHr = can(role, 'hr');

  if (seeProduction) {
    const orders = await db.workOrder.findMany({
      where: { tenantId, status: { in: ['RELEASED', 'IN_PROGRESS'] } },
      include: { components: { include: { product: true } }, product: true }
    });
    orders.forEach((order) => {
      order.components.forEach((component) => {
        const remaining = money(num(component.requiredQty) - num(component.issuedQty));
        if (remaining <= 0.00005) return;
        const have = stock.byWarehouse.get(`${component.productId}|${order.warehouseId || ''}`) || 0;
        if (have + 0.00005 >= remaining) return;
        alerts.push({
          id: `shortage:${order.id}:${component.id}`,
          type: 'MATERIAL_SHORTAGE',
          severity: 'high',
          title: `${component.product?.code || 'Material'} is short on ${order.orderNumber}`,
          detail: `Need ${remaining}, on hand ${have}.`,
          href: `/production/work-orders/${order.id}`,
          documentNumber: order.orderNumber
        });
      });
      if (order.endDate && new Date(order.endDate) < today) {
        alerts.push({
          id: `overdue-wo:${order.id}`,
          type: 'OVERDUE_WORK_ORDER',
          severity: 'high',
          title: `${order.orderNumber} is overdue`,
          detail: `${order.product?.code || 'Work order'} was due ${new Date(order.endDate).toISOString().slice(0, 10)}.`,
          href: `/production/work-orders/${order.id}`,
          documentNumber: order.orderNumber
        });
      }
    });
    const createdOverdue = await db.workOrder.findMany({
      where: { tenantId, status: 'CREATED', endDate: { lt: today } },
      include: { product: true },
      take: 30
    });
    createdOverdue.forEach((order) => {
      alerts.push({
        id: `overdue-wo:${order.id}`,
        type: 'OVERDUE_WORK_ORDER',
        severity: 'medium',
        title: `${order.orderNumber} is past its finish date`,
        detail: order.product ? `${order.product.code} is still ${order.status}.` : order.status,
        href: `/production/work-orders/${order.id}`,
        documentNumber: order.orderNumber
      });
    });
    const capacity = await loadCapacity(tenantId, {
      from: today.toISOString().slice(0, 10),
      to: plusDays(today, 14).toISOString().slice(0, 10)
    });
    (capacity.overloads || []).slice(0, 20).forEach((row) => {
      alerts.push({
        id: `overload:${row.workstationId}:${row.date}`,
        type: 'WORKSTATION_OVERLOAD',
        severity: 'medium',
        title: `${row.code} is overloaded on ${row.date}`,
        detail: `${row.loadHours} hours planned, ${row.availableHours} hours available.`,
        href: '/production/planning',
        documentNumber: row.code
      });
    });
  }

  if (seeProcurement) {
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: { tenantId, status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] } },
      include: { supplier: true },
      take: 200
    });
    purchaseOrders.forEach((order) => {
      const lead = num(order.supplier?.leadTime) > 0 ? num(order.supplier.leadTime) : 7;
      if (plusDays(order.date, lead) >= today) return;
      alerts.push({
        id: `overdue-po:${order.id}`,
        type: 'OVERDUE_PURCHASE_ORDER',
        severity: 'high',
        title: `${order.poNumber} is overdue`,
        detail: `${order.supplier?.name || 'Supplier'} lead time is ${lead} days.`,
        href: `/procurement/purchase-orders/${order.id}`,
        documentNumber: order.poNumber
      });
    });
  }

  if (seeSales) {
    const salesOrders = await db.salesOrder.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'COMPLETED', 'DELIVERED', 'CLOSED'] } },
      include: { customer: true },
      take: 200
    });
    salesOrders.forEach((order) => {
      const days = num(order.customer?.creditPeriod) > 0 ? num(order.customer.creditPeriod) : 7;
      if (plusDays(order.date, days) >= today) return;
      alerts.push({
        id: `overdue-so:${order.id}`,
        type: 'OVERDUE_SALES_ORDER',
        severity: 'high',
        title: `${order.orderNumber} is overdue`,
        detail: `${order.customer?.name || 'Customer'} has waited more than ${days} days.`,
        href: `/sales/orders/${order.id}`,
        documentNumber: order.orderNumber
      });
    });
  }

  if (seeSales || seeFinance) {
    const customers = await db.customer.findMany({
      where: { tenantId, creditLimit: { gt: 0 } }
    });
    const invoices = await db.salesInvoice.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }
    });
    const open = new Map();
    invoices.forEach((invoice) => {
      const balance = money((num(invoice.total) - num(invoice.amountPaid)) * (num(invoice.exchangeRate) || 1));
      if (balance <= 0.0001) return;
      open.set(invoice.customerId, money((open.get(invoice.customerId) || 0) + balance));
    });
    customers.forEach((customer) => {
      const balance = open.get(customer.id) || 0;
      if (balance <= num(customer.creditLimit) + 0.0001) return;
      alerts.push({
        id: `credit:${customer.id}`,
        type: 'CREDIT_LIMIT',
        severity: 'high',
        title: `${customer.name} is over the credit limit`,
        detail: `Open ${balance.toFixed(2)} against a limit of ${num(customer.creditLimit).toFixed(2)}.`,
        href: `/sales/customers/${customer.id}`,
        documentNumber: customer.code
      });
    });
  }

  if (seeProcurement || seeProduction) {
    const runs = await db.replenishmentRun.findMany({
      where: { tenantId, status: 'DRAFT' },
      include: { lines: true }
    });
    runs.forEach((run) => {
      const purchaseLines = run.lines.filter((line) => line.kind !== 'MAKE');
      if (!purchaseLines.length) return;
      alerts.push({
        id: `approval:${run.id}`,
        type: 'PENDING_APPROVAL',
        severity: 'medium',
        title: `${run.runNumber} is waiting for approval`,
        detail: `${purchaseLines.length} draft purchase ${purchaseLines.length === 1 ? 'line' : 'lines'}.`,
        href: '/production/replenishment',
        documentNumber: run.runNumber
      });
    });
    const drafts = await db.purchaseRequisition.count({
      where: { tenantId, status: 'DRAFT', sourceType: { not: 'REPLENISHMENT' } }
    });
    if (drafts > 0) {
      alerts.push({
        id: 'approval:purchase-requisitions',
        type: 'PENDING_APPROVAL',
        severity: 'medium',
        title: `${drafts} purchase requisition${drafts === 1 ? '' : 's'} in draft`,
        detail: 'Review and approve them from purchasing.',
        href: '/procurement/purchase-requisitions',
        documentNumber: 'PR'
      });
    }
  }

  if (seeHr) {
    const leaves = await db.leaveApplication.findMany({
      where: { tenantId, status: 'PENDING' },
      include: { employee: true },
      take: 30
    });
    leaves.forEach((leave) => {
      const name = leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'Employee';
      alerts.push({
        id: `approval:leave:${leave.id}`,
        type: 'PENDING_APPROVAL',
        severity: 'medium',
        title: `${name} requested leave`,
        detail: `${num(leave.days)} day${num(leave.days) === 1 ? '' : 's'} awaiting approval.`,
        href: '/hr/leaves',
        documentNumber: leave.employee?.empCode || ''
      });
    });
  }

  if (seeWarehouse || seeProduction) {
    const policies = await db.itemWarehousePolicy.findMany({
      where: { tenantId },
      include: { product: true, warehouse: true }
    });
    const covered = new Set();
    policies.forEach((policy) => {
      covered.add(policy.productId);
      const floor = num(policy.minQty) > 0 ? num(policy.minQty) : num(policy.reorderPoint);
      if (!(floor > 0)) return;
      const have = stock.byWarehouse.get(`${policy.productId}|${policy.warehouseId}`) || 0;
      if (have > floor + 0.00005) return;
      const made = Boolean(policy.product.bomApplicable);
      alerts.push({
        id: `low:${policy.id}`,
        type: 'LOW_STOCK',
        severity: 'medium',
        title: `${policy.product.code} is low at ${policy.warehouse.code}`,
        detail: made
          ? `On hand ${have}, minimum ${floor}. Made items are planned in MRP.`
          : `On hand ${have}, minimum ${floor}.`,
        href: made ? '/production/mrp' : '/production/replenishment',
        documentNumber: policy.product.code
      });
    });
    const products = await db.product.findMany({
      where: { tenantId, reorderLevel: { gt: 0 }, activeStatus: { not: 'INACTIVE' } }
    });
    products.forEach((product) => {
      if (covered.has(product.id)) return;
      const have = stock.byProduct.get(product.id) || 0;
      if (have > product.reorderLevel) return;
      alerts.push({
        id: `low:product:${product.id}`,
        type: 'LOW_STOCK',
        severity: 'medium',
        title: `${product.code} is at or below its reorder level`,
        detail: `On hand ${have}, reorder level ${product.reorderLevel}.`,
        href: `/products/${product.id}`,
        documentNumber: product.code
      });
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
  return { count: alerts.length, alerts: alerts.slice(0, 200) };
}

module.exports = { listAlerts };
