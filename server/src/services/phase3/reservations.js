const { num, money, dec } = require('../money');
const { onHand } = require('../stockService');
const { allocationApi, positionApi } = require('./bridges');

async function availableQty(db, { tenantId, productId, warehouseId, exceptSourceId }) {
  const positions = positionApi();
  if (positions?.availableQty && db.stockAllocation) {
    return num(await positions.availableQty(db, tenantId, productId, warehouseId || null, exceptSourceId || null));
  }
  const hand = await onHand(db, { tenantId, productId, warehouseId });
  const rows = await db.salesReservation.findMany({
    where: {
      tenantId,
      productId,
      status: 'OPEN',
      ...(warehouseId ? { warehouseId } : {}),
      ...(exceptSourceId ? { orderId: { not: exceptSourceId } } : {})
    }
  });
  const reserved = rows.reduce((sum, row) => sum + num(row.quantity), 0);
  return money(Math.max(0, hand - reserved));
}

async function reserveOrder(db, { tenantId, orderId, warehouseId, lines }) {
  const api = allocationApi();
  if (api?.syncHard && db.stockAllocation) {
    return api.syncHard(db, {
      tenantId,
      sourceType: 'SALES_ORDER',
      sourceId: orderId,
      lines: lines.map((line) => ({
        productId: line.productId,
        warehouseId,
        quantity: line.quantity,
        lineId: line.orderItemId
      }))
    });
  }
  await db.salesReservation.deleteMany({ where: { tenantId, orderId, status: 'OPEN' } });
  const created = [];
  for (const line of lines) {
    if (!(num(line.quantity) > 0)) continue;
    created.push(await db.salesReservation.create({
      data: {
        tenantId,
        orderId,
        orderItemId: line.orderItemId,
        productId: line.productId,
        warehouseId: warehouseId || null,
        quantity: dec(line.quantity),
        status: 'OPEN'
      }
    }));
  }
  return { allocations: created, shortages: [] };
}

async function reservedForOrder(db, tenantId, orderId) {
  if (db.stockAllocation) {
    const rows = await db.stockAllocation.findMany({
      where: { tenantId, sourceType: 'SALES_ORDER', sourceId: orderId, status: 'OPEN' }
    });
    if (rows.length) {
      return rows.map((row) => ({
        orderItemId: row.sourceLineId,
        productId: row.productId,
        quantity: num(row.quantity) - num(row.releasedQty)
      }));
    }
  }
  const rows = await db.salesReservation.findMany({ where: { tenantId, orderId, status: 'OPEN' } });
  return rows.map((row) => ({
    orderItemId: row.orderItemId,
    productId: row.productId,
    quantity: num(row.quantity)
  }));
}

async function consumeOrder(db, { tenantId, orderId, lines }) {
  const api = allocationApi();
  if (api?.consumeSource && db.stockAllocation) {
    await api.consumeSource(db, { tenantId, sourceType: 'SALES_ORDER', sourceId: orderId, lines });
    return;
  }
  for (const line of lines) {
    let left = num(line.quantity);
    const rows = await db.salesReservation.findMany({
      where: { tenantId, orderId, productId: line.productId, status: 'OPEN' },
      orderBy: { createdAt: 'asc' }
    });
    for (const row of rows) {
      if (left <= 0.00005) break;
      const take = Math.min(num(row.quantity), left);
      const remain = money(num(row.quantity) - take);
      await db.salesReservation.update({
        where: { id: row.id },
        data: remain <= 0.00005 ? { quantity: dec(0), status: 'CONSUMED' } : { quantity: dec(remain) }
      });
      left = money(left - take);
    }
  }
}

async function releaseOrderHold(db, tenantId, orderId) {
  const api = allocationApi();
  if (api?.releaseSource && db.stockAllocation) {
    await api.releaseSource(db, tenantId, 'SALES_ORDER', orderId);
  }
  await db.salesReservation.updateMany({
    where: { tenantId, orderId, status: 'OPEN' },
    data: { status: 'RELEASED' }
  });
}

async function reduceHold(db, { tenantId, orderId, productId, quantity }) {
  let left = num(quantity);
  const rows = await db.salesReservation.findMany({
    where: { tenantId, orderId, productId, status: 'OPEN' }
  });
  for (const row of rows) {
    if (left <= 0.00005) break;
    const take = Math.min(num(row.quantity), left);
    const remain = money(num(row.quantity) - take);
    await db.salesReservation.update({
      where: { id: row.id },
      data: remain <= 0.00005 ? { quantity: dec(0), status: 'RELEASED' } : { quantity: dec(remain) }
    });
    left = money(left - take);
  }
  const api = allocationApi();
  if (api?.consumeSource && db.stockAllocation) {
    await api.consumeSource(db, {
      tenantId,
      sourceType: 'SALES_ORDER',
      sourceId: orderId,
      lines: [{ productId, quantity }]
    });
  }
}

module.exports = {
  availableQty,
  reserveOrder,
  reservedForOrder,
  consumeOrder,
  releaseOrderHold,
  reduceHold
};
