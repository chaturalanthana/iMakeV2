const { num, dec } = require('../money');

const QUOTATION_HOLD_DAYS = 14;

function openQuantity(row, now = new Date()) {
  if (!row || row.status !== 'OPEN') return 0;
  if (row.kind === 'SOFT' && row.expiresAt && new Date(row.expiresAt) < now) return 0;
  return Math.max(0, num(row.quantity) - num(row.releasedQty));
}

async function releaseExpired(db, tenantId, now = new Date()) {
  const rows = await db.stockAllocation.findMany({
    where: { tenantId, status: 'OPEN', kind: 'SOFT', expiresAt: { lt: now } }
  });
  if (!rows.length) return 0;
  await db.stockAllocation.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { status: 'RELEASED' }
  });
  return rows.length;
}

async function reservedQty(db, tenantId, productId, warehouseId, exceptSourceId) {
  await releaseExpired(db, tenantId);
  const rows = await db.stockAllocation.findMany({
    where: {
      tenantId,
      productId,
      status: 'OPEN',
      kind: 'HARD',
      ...(warehouseId ? { warehouseId } : {}),
      ...(exceptSourceId ? { sourceId: { not: exceptSourceId } } : {})
    }
  });
  return rows.reduce((sum, row) => sum + openQuantity(row), 0);
}

async function replaceAllocations(db, { tenantId, sourceType, sourceId, kind, lines, expiresAt }) {
  await db.stockAllocation.deleteMany({
    where: { tenantId, sourceType, sourceId, status: 'OPEN' }
  });
  const created = [];
  for (const line of lines) {
    const quantity = num(line.quantity);
    if (!(quantity > 0)) continue;
    created.push(await db.stockAllocation.create({
      data: {
        tenantId,
        productId: line.productId,
        warehouseId: line.warehouseId || null,
        batchId: line.batchId || null,
        sourceType,
        sourceId,
        sourceLineId: line.lineId || null,
        kind,
        quantity: dec(quantity),
        status: 'OPEN',
        expiresAt: expiresAt || null
      }
    }));
  }
  return created;
}

async function syncHard(db, input) {
  const shortages = [];
  const lines = [];
  for (const line of input.lines || []) {
    const requested = num(line.quantity);
    if (!(requested > 0)) continue;
    const product = await db.product.findFirst({ where: { id: line.productId, tenantId: input.tenantId } });
    if (!product || product.type === 'SERVICE' || product.nonStock) continue;
    const { availableQty } = require('./positions');
    const available = await availableQty(db, input.tenantId, line.productId, line.warehouseId || null, input.sourceId);
    const reserve = Math.round(Math.min(requested, Math.max(0, available)) * 10000) / 10000;
    if (requested - reserve > 0.00005) {
      shortages.push({ productId: line.productId, requested, reserved: reserve, short: Math.round((requested - reserve) * 10000) / 10000 });
    }
    if (reserve > 0) lines.push({ ...line, quantity: reserve });
  }
  const allocations = await replaceAllocations(db, { ...input, kind: 'HARD', lines });
  return { allocations, shortages };
}

async function syncSoft(db, input) {
  const expiresAt = input.expiresAt || new Date(Date.now() + QUOTATION_HOLD_DAYS * 24 * 60 * 60 * 1000);
  const lines = (input.lines || []).filter((line) => num(line.quantity) > 0);
  const allocations = await replaceAllocations(db, { ...input, kind: 'SOFT', lines, expiresAt });
  return { allocations };
}

async function releaseSource(db, tenantId, sourceType, sourceId) {
  await db.stockAllocation.updateMany({
    where: { tenantId, sourceType, sourceId, status: 'OPEN' },
    data: { status: 'RELEASED' }
  });
}

async function consumeSource(db, { tenantId, sourceType, sourceId, lines }) {
  for (const line of lines || []) {
    let left = num(line.quantity);
    if (!(left > 0)) continue;
    const rows = await db.stockAllocation.findMany({
      where: { tenantId, sourceType, sourceId, productId: line.productId, status: 'OPEN' },
      orderBy: { createdAt: 'asc' }
    });
    for (const row of rows) {
      if (left <= 0.00005) break;
      const open = openQuantity(row);
      const take = Math.min(open, left);
      if (!(take > 0)) continue;
      const released = num(row.releasedQty) + take;
      await db.stockAllocation.update({
        where: { id: row.id },
        data: {
          releasedQty: dec(released),
          status: released + 0.00005 >= num(row.quantity) ? 'FULFILLED' : 'OPEN'
        }
      });
      left -= take;
    }
  }
}

async function mirrorProductionReservation(db, { tenantId, productId, warehouseId, workOrderId, reservationId, quantity }) {
  return db.stockAllocation.create({
    data: {
      tenantId,
      productId,
      warehouseId: warehouseId || null,
      sourceType: 'PRODUCTION_ORDER',
      sourceId: workOrderId,
      sourceLineId: reservationId,
      kind: 'HARD',
      quantity: dec(quantity),
      status: 'OPEN'
    }
  });
}

async function consumeProductionReservation(db, reservationId, take, closed) {
  const row = await db.stockAllocation.findFirst({
    where: { sourceType: 'PRODUCTION_ORDER', sourceLineId: reservationId, status: 'OPEN' }
  });
  if (!row) return;
  const released = num(row.releasedQty) + take;
  await db.stockAllocation.update({
    where: { id: row.id },
    data: {
      releasedQty: dec(released),
      status: closed || released + 0.00005 >= num(row.quantity) ? 'FULFILLED' : 'OPEN'
    }
  });
}

async function releaseProductionOrder(db, workOrderId) {
  await db.stockAllocation.updateMany({
    where: { sourceType: 'PRODUCTION_ORDER', sourceId: workOrderId, status: 'OPEN' },
    data: { status: 'RELEASED' }
  });
}

module.exports = {
  QUOTATION_HOLD_DAYS,
  openQuantity,
  releaseExpired,
  reservedQty,
  syncHard,
  syncSoft,
  releaseSource,
  consumeSource,
  mirrorProductionReservation,
  consumeProductionReservation,
  releaseProductionOrder
};
