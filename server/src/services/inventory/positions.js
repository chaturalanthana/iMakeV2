const { num } = require('../money');
const { movementEffect } = require('../stockService');
const { openQuantity, reservedQty } = require('./allocations');

function todayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function expired(layer, today = todayKey()) {
  if (!layer.expiryDate) return false;
  return todayKey(layer.expiryDate) < today;
}

function statusOf(layer) {
  return layer.stockStatus || 'UNRESTRICTED';
}

async function layerRows(db, tenantId, productId, warehouseId) {
  return db.costLayer.findMany({
    where: {
      tenantId,
      ...(productId ? { productId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      quantityRemaining: { gt: 0 }
    }
  });
}

function summarise(layers, hardReserved, softReserved, inTransit) {
  let onHand = 0;
  let unrestricted = 0;
  let quarantine = 0;
  let blocked = 0;
  let value = 0;
  layers.forEach((layer) => {
    const qty = num(layer.quantityRemaining);
    onHand += qty;
    value += qty * num(layer.unitCost);
    const status = statusOf(layer);
    if (status === 'QUARANTINE') quarantine += qty;
    else if (status === 'BLOCKED') blocked += qty;
    else if (!expired(layer)) unrestricted += qty;
    else blocked += qty;
  });
  const available = Math.max(0, unrestricted - hardReserved);
  return {
    onHand: round(onHand),
    unrestricted: round(unrestricted),
    quarantine: round(quarantine),
    blocked: round(blocked),
    reserved: round(hardReserved),
    soft: round(softReserved),
    inTransit: round(inTransit),
    available: round(available),
    value: round(value)
  };
}

function round(value) {
  return Math.round(num(value) * 10000) / 10000;
}

async function inTransitQty(db, tenantId, productId) {
  const legs = await db.inventoryTransferLeg.findMany({
    where: {
      tenantId,
      productId,
      quantityRemaining: { gt: 0 },
      transfer: { status: 'IN_TRANSIT' }
    }
  });
  return legs.reduce((sum, leg) => sum + num(leg.quantityRemaining), 0);
}

async function softQty(db, tenantId, productId, warehouseId) {
  const rows = await db.stockAllocation.findMany({
    where: {
      tenantId,
      productId,
      status: 'OPEN',
      kind: 'SOFT',
      ...(warehouseId ? { warehouseId } : {})
    }
  });
  return rows.reduce((sum, row) => sum + openQuantity(row), 0);
}

async function availableQty(db, tenantId, productId, warehouseId, exceptSourceId) {
  const layers = await layerRows(db, tenantId, productId, warehouseId);
  const hard = await reservedQty(db, tenantId, productId, warehouseId, exceptSourceId);
  const summary = summarise(layers, hard, 0, 0);
  return summary.available;
}

async function bookQty(db, tenantId, productId, warehouseId) {
  const movements = await db.stockMovement.findMany({
    where: { tenantId, productId, ...(warehouseId ? { warehouseId } : {}) }
  });
  return round(movements.reduce((sum, movement) => sum + movementEffect(movement), 0));
}

async function positionReport(db, tenantId, { warehouseId, productId } = {}) {
  const products = await db.product.findMany({
    where: { tenantId, ...(productId ? { id: productId } : {}), type: { not: 'SERVICE' } },
    include: { stockUom: true, productType: true }
  });
  const rows = [];
  for (const product of products) {
    const layers = await layerRows(db, tenantId, product.id, warehouseId || null);
    const hard = await reservedQty(db, tenantId, product.id, warehouseId || null);
    const soft = await softQty(db, tenantId, product.id, warehouseId || null);
    const transit = warehouseId ? 0 : await inTransitQty(db, tenantId, product.id);
    const summary = summarise(layers, hard, soft, transit);
    if (summary.onHand <= 0 && summary.reserved <= 0 && summary.inTransit <= 0 && summary.soft <= 0) continue;
    rows.push({
      productId: product.id,
      code: product.code,
      name: product.name,
      uom: product.stockUom?.name || '',
      ...summary
    });
  }
  rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return rows;
}

module.exports = {
  expired,
  statusOf,
  availableQty,
  bookQty,
  positionReport,
  layerRows,
  inTransitQty
};
