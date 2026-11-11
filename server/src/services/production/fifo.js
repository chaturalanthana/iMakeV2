const { round4, num } = require('./costing');
const { DocumentError } = require('../errors');

/**
 * Minimal FIFO cost-layer service.
 *
 * Finance can extend this with journals, returns, and transfers. The contract is:
 *   receiveLayer()  appends a layer at the receipt's unit cost (GRN, stock receipt, FG receipt).
 *   issueFifo()     consumes the oldest open layers first and returns the cost taken.
 *   Opening layer   if a product has no layers at all on its first issue, one OPENING layer is
 *                   created for the current on-hand at standard cost (or cost price). This does
 *                   not rewrite history when any layer already exists. A shortfall is rejected
 *                   unless the tenant allows negative stock. When that setting is on, the
 *                   short quantity is valued at the last FIFO unit cost (or zero), not at
 *                   standard cost.
 * Sales issues, deliveries, and adjustments call issueFifo as well.
 * Pass strictWarehouse: true to consume only layers in that warehouse.
 * The default keeps the original fallback (null-warehouse layers, then any warehouse).
 */

const onHandFromMovements = (movements) => movements.reduce((total, movement) => {
  const qty = num(movement.quantity);
  if (movement.type === 'GI') return total - Math.abs(qty);
  return total + qty;
}, 0);

async function receiveLayer(db, {
  tenantId,
  productId,
  warehouseId = null,
  quantity,
  unitCost = 0,
  sourceType,
  sourceId = null,
  lotNumber = null,
  receivedAt = null
}) {
  const qty = round4(quantity);
  if (!(qty > 0)) return null;
  return db.costLayer.create({
    data: {
      tenantId,
      productId,
      warehouseId: warehouseId || null,
      quantityReceived: qty,
      quantityRemaining: qty,
      unitCost: round4(unitCost || 0),
      sourceType,
      sourceId: sourceId || null,
      lotNumber: lotNumber || null,
      receivedAt: receivedAt || new Date()
    }
  });
}

async function ensureOpeningLayer(db, { tenantId, productId, warehouseId = null }) {
  const existing = await db.costLayer.count({ where: { tenantId, productId } });
  if (existing > 0) return null;
  const where = { tenantId, productId };
  if (warehouseId) where.warehouseId = warehouseId;
  const movements = await db.stockMovement.findMany({ where });
  const onHand = onHandFromMovements(movements);
  if (!(onHand > 0.00005)) return null;
  const product = await db.product.findFirst({ where: { id: productId, tenantId } });
  const unit = num(product?.standardCost) > 0 ? num(product.standardCost) : num(product?.costPrice);
  return db.costLayer.create({
    data: {
      tenantId,
      productId,
      warehouseId: warehouseId || null,
      quantityReceived: round4(onHand),
      quantityRemaining: round4(onHand),
      unitCost: round4(unit),
      sourceType: 'OPENING',
      sourceId: null
    }
  });
}

async function issueFifo(db, { tenantId, productId, warehouseId = null, quantity, strictWarehouse = false }) {
  const requested = round4(quantity);
  if (!(requested > 0)) return { totalCost: 0, unitCost: 0, consumptions: [] };

  const where = { tenantId, productId, quantityRemaining: { gt: 0 } };
  let layers = await db.costLayer.findMany({ where, orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }] });
  if (warehouseId) {
    const local = strictWarehouse
      ? layers.filter((layer) => layer.warehouseId === warehouseId)
      : layers.filter((layer) => layer.warehouseId === warehouseId || layer.warehouseId === null);
    if (local.length || strictWarehouse) layers = local;
  }
  if (!layers.length) {
    const opening = await ensureOpeningLayer(db, { tenantId, productId, warehouseId });
    if (opening) layers = [opening];
  }

  let left = requested;
  let total = 0;
  const consumptions = [];
  for (const layer of layers) {
    if (left <= 0.00005) break;
    const take = round4(Math.min(left, num(layer.quantityRemaining)));
    if (!(take > 0)) continue;
    await db.costLayer.update({
      where: { id: layer.id },
      data: { quantityRemaining: round4(num(layer.quantityRemaining) - take) }
    });
    const cost = round4(take * num(layer.unitCost));
    total = round4(total + cost);
    consumptions.push({ layerId: layer.id, quantity: take, unitCost: num(layer.unitCost), cost, unlayered: false });
    left = round4(left - take);
  }

  if (left > 0.00005) {
    const settings = await db.operationsSetting.findUnique({ where: { tenantId } });
    if (!settings?.allowNegativeStock) {
      throw new DocumentError('Not enough stock in this warehouse.', {
        quantity: 'Not enough stock in this warehouse.'
      });
    }
    const unit = consumptions.length ? num(consumptions[consumptions.length - 1].unitCost) : 0;
    const cost = round4(left * unit);
    total = round4(total + cost);
    consumptions.push({ layerId: null, quantity: left, unitCost: unit, cost, unlayered: true });
  }

  return {
    totalCost: total,
    unitCost: requested > 0 ? round4(total / requested) : 0,
    consumptions
  };
}

async function nextFifoUnitCost(db, { tenantId, productId, warehouseId = null }) {
  const layers = await db.costLayer.findMany({
    where: { tenantId, productId, quantityRemaining: { gt: 0 } },
    orderBy: { receivedAt: 'asc' }
  });
  const match = warehouseId
    ? layers.find((layer) => layer.warehouseId === warehouseId || layer.warehouseId === null) || layers[0]
    : layers[0];
  return match ? num(match.unitCost) : 0;
}

async function lastReceiptUnitCost(db, { tenantId, productId }) {
  const layer = await db.costLayer.findFirst({
    where: { tenantId, productId },
    orderBy: { receivedAt: 'desc' }
  });
  return layer ? num(layer.unitCost) : 0;
}

module.exports = {
  receiveLayer,
  issueFifo,
  nextFifoUnitCost,
  lastReceiptUnitCost,
  onHandFromMovements
};
