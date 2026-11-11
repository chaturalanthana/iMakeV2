const { money, num } = require('./money');

function startOf(period, now = new Date()) {
  if (period === 'today') {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day;
  }
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000);
  if (period === 'ytd') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return new Date(now.getTime() - 7 * 86400000);
}

function monthKey(date) {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-');
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
}

async function summary(db, tenantId, period = '7d') {
  const from = startOf(period);
  const [invoices, orders, products, customers, warehouses, stations, boms, jobs, layers, audit] = await Promise.all([
    db.salesInvoice.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING', 'PENDING_APPROVAL'] } },
      select: { date: true, total: true, subtotal: true }
    }),
    db.salesOrder.findMany({ where: { tenantId }, select: { date: true, status: true, total: true } }),
    db.product.count({ where: { tenantId } }),
    db.customer.count({ where: { tenantId } }),
    db.warehouse.count({ where: { tenantId } }),
    db.workstation.count({ where: { tenantId } }),
    db.bOM.count({ where: { tenantId } }),
    db.workOrder.findMany({ where: { tenantId }, select: { status: true } }),
    db.costLayer.groupBy({
      by: ['productId'],
      where: { tenantId, quantityRemaining: { gt: 0 } },
      _sum: { quantityRemaining: true }
    }),
    db.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { createdAt: true, action: true, entity: true, entityId: true }
    })
  ]);
  const watched = await db.product.findMany({
    where: { tenantId, reorderLevel: { gt: 0 } },
    select: { id: true, reorderLevel: true }
  });
  const onHand = new Map(layers.map((row) => [row.productId, num(row._sum.quantityRemaining)]));
  const lowStock = watched.filter((product) => (onHand.get(product.id) || 0) < num(product.reorderLevel)).length;
  const inPeriod = (row) => new Date(row.date) >= from;
  const periodInvoices = invoices.filter(inPeriod);
  const periodOrders = orders.filter(inPeriod);
  const revenue = money(periodInvoices.reduce((sum, row) => sum + num(row.total), 0));
  const delivered = periodOrders.filter((row) => ['DELIVERED', 'CLOSED'].includes(row.status)).length;
  const activeJobs = jobs.filter((row) => !['CLOSED', 'CANCELLED', 'DRAFT'].includes(row.status)).length;
  const months = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let index = 5; index >= 0; index -= 1) {
    const point = new Date(cursor);
    point.setUTCMonth(point.getUTCMonth() - index);
    months.push(monthKey(point));
  }
  const monthly = months.map((key) => ({
    key,
    label: monthLabel(key),
    revenue: money(invoices.filter((row) => monthKey(row.date) === key).reduce((sum, row) => sum + num(row.total), 0))
  }));
  return {
    period,
    revenue,
    orders: periodOrders.length,
    delivered,
    fulfillment: periodOrders.length ? Math.round((delivered / periodOrders.length) * 1000) / 10 : 0,
    averageOrder: periodOrders.length ? money(periodOrders.reduce((sum, row) => sum + num(row.total), 0) / periodOrders.length) : 0,
    customers,
    products,
    warehouses,
    workstations: stations,
    boms,
    activeJobs,
    lowStock,
    monthly,
    activity: audit.map((row) => ({
      at: row.createdAt,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId
    }))
  };
}

module.exports = { summary };
