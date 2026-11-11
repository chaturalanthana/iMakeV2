const { receiveLayer, issueFifo } = require('./production/fifo');
const { DocumentError } = require('./errors');
const { num, money, dec } = require('./money');

/**
 * Inventory movements on top of the shared FIFO service
 * (server/src/services/production/fifo.js).
 *
 * Production calls receiveLayer and issueFifo directly and posts its own
 * stock movements. Purchasing, warehouse, and sales call these helpers, which
 * write the movement and the cost layer in the same transaction.
 * Pass a Prisma transaction client. These helpers do not post the ledger.
 */

function movementEffect(movement) {
  const qty = num(movement.quantity);
  if (movement.type === 'GI') return -Math.abs(qty);
  if (movement.type === 'ADJ') return qty;
  return Math.abs(qty);
}

async function receive(tx, {
  tenantId,
  productId,
  warehouseId,
  quantity,
  unitCost,
  referenceType,
  referenceId,
  movementType = 'GR',
  createdBy,
  receivedAt,
  lotNumber = null
}) {
  const qty = money(quantity);
  if (qty <= 0) {
    throw new DocumentError('Receipt quantity must be greater than zero.', {
      quantity: 'Quantity must be greater than zero.'
    });
  }
  const cost = money(unitCost);
  const value = money(qty * cost);
  const when = receivedAt ? new Date(receivedAt) : new Date();

  const movement = await tx.stockMovement.create({
    data: {
      tenantId,
      productId,
      type: movementType,
      quantity: dec(qty),
      unitCost: dec(cost),
      value: dec(value),
      referenceType,
      referenceId: referenceId || null,
      warehouseId: warehouseId || null,
      createdBy: createdBy || null,
      lotNumber: lotNumber || null
    }
  });
  const layer = await receiveLayer(tx, {
    tenantId,
    productId,
    warehouseId: warehouseId || null,
    quantity: qty,
    unitCost: cost,
    sourceType: referenceType,
    sourceId: referenceId || null,
    lotNumber: lotNumber || null,
    receivedAt: when
  });
  return { layer, movement, unitCost: cost, value, quantity: qty };
}

async function issue(tx, {
  tenantId,
  productId,
  warehouseId,
  quantity,
  referenceType,
  referenceId,
  movementType = 'GI',
  quantitySign = 1,
  createdBy
}) {
  const qty = money(Math.abs(num(quantity)));
  if (qty <= 0) {
    throw new DocumentError('Issue quantity must be greater than zero.', {
      quantity: 'Quantity must be greater than zero.'
    });
  }

  const fifo = await issueFifo(tx, {
    tenantId,
    productId,
    warehouseId: warehouseId || null,
    quantity: qty,
    strictWarehouse: true
  });
  // A shortfall is returned as an unlayered slice at standard or cost price.
  // Callers that must not go short (transfers) check `consumptions`.

  const signedQty = money(qty * (quantitySign < 0 ? -1 : 1));
  const movement = await tx.stockMovement.create({
    data: {
      tenantId,
      productId,
      type: movementType,
      quantity: dec(signedQty),
      unitCost: dec(fifo.unitCost),
      value: dec(fifo.totalCost),
      referenceType,
      referenceId: referenceId || null,
      warehouseId: warehouseId || null,
      createdBy: createdBy || null
    }
  });

  return {
    movement,
    unitCost: fifo.unitCost,
    value: fifo.totalCost,
    quantity: qty,
    consumptions: fifo.consumptions
  };
}

async function transfer(tx, {
  tenantId,
  productId,
  fromWarehouseId,
  toWarehouseId,
  quantity,
  referenceType,
  referenceId,
  createdBy,
  receivedAt
}) {
  if (!fromWarehouseId || !toWarehouseId) {
    throw new DocumentError('Choose the source and destination warehouses.', {
      warehouseId: 'Choose the source and destination warehouses.'
    });
  }
  if (fromWarehouseId === toWarehouseId) {
    throw new DocumentError('Transfer warehouses must be different.', {
      toWarehouseId: 'Transfer warehouses must be different.'
    });
  }

  const issued = await issue(tx, {
    tenantId,
    productId,
    warehouseId: fromWarehouseId,
    quantity,
    referenceType,
    referenceId,
    movementType: 'GI',
    createdBy
  });
  if (issued.consumptions.some((row) => row.unlayered)) {
    throw new DocumentError('Not enough stock to transfer this quantity.', {
      quantity: 'Not enough stock to transfer this quantity.'
    });
  }

  const received = [];
  for (const row of issued.consumptions) {
    received.push(await receive(tx, {
      tenantId,
      productId,
      warehouseId: toWarehouseId,
      quantity: row.quantity,
      unitCost: row.unitCost,
      referenceType,
      referenceId,
      movementType: 'GR',
      createdBy,
      receivedAt
    }));
  }
  return { issued, received, unitCost: issued.unitCost, value: issued.value, quantity: issued.quantity };
}

async function reverseReceipt(tx, { tenantId, referenceType, referenceId, createdBy }) {
  const layers = await tx.costLayer.findMany({
    where: { tenantId, sourceType: referenceType, sourceId: referenceId || null }
  });
  for (const layer of layers) {
    if (num(layer.quantityRemaining) + 0.0001 < num(layer.quantityReceived)) {
      throw new DocumentError('This receipt cannot be cancelled because some of its stock has already been issued.');
    }
  }
  for (const layer of layers) {
    const qty = num(layer.quantityReceived);
    const cost = num(layer.unitCost);
    if (qty <= 0) continue;
    await tx.stockMovement.create({
      data: {
        tenantId,
        productId: layer.productId,
        type: 'GI',
        quantity: dec(qty),
        unitCost: dec(cost),
        value: dec(money(qty * cost)),
        referenceType: `${referenceType}_REVERSAL`,
        referenceId: referenceId || null,
        warehouseId: layer.warehouseId,
        createdBy: createdBy || null
      }
    });
    await tx.costLayer.update({
      where: { id: layer.id },
      data: { quantityRemaining: dec(0) }
    });
  }
  return layers.length;
}

async function reverseIssue(tx, { tenantId, referenceType, referenceId, createdBy }) {
  const movements = await tx.stockMovement.findMany({
    where: { tenantId, referenceType, referenceId: referenceId || null, type: 'GI' }
  });
  for (const movement of movements) {
    const qty = money(Math.abs(num(movement.quantity)));
    const cost = num(movement.unitCost);
    if (qty <= 0) continue;
    await receiveLayer(tx, {
      tenantId,
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      quantity: qty,
      unitCost: cost,
      sourceType: `${referenceType}_REVERSAL`,
      sourceId: referenceId || null
    });
    await tx.stockMovement.create({
      data: {
        tenantId,
        productId: movement.productId,
        type: 'GR',
        quantity: dec(qty),
        unitCost: dec(cost),
        value: dec(num(movement.value) || money(qty * cost)),
        referenceType: `${referenceType}_REVERSAL`,
        referenceId: referenceId || null,
        warehouseId: movement.warehouseId,
        createdBy: createdBy || null
      }
    });
  }
  return movements.length;
}

async function onHand(db, { tenantId, productId, warehouseId }) {
  const where = { tenantId, quantityRemaining: { gt: 0 } };
  if (productId) where.productId = productId;
  if (warehouseId) where.warehouseId = warehouseId;
  const layers = await db.costLayer.findMany({ where });
  return money(layers.reduce((sum, layer) => sum + num(layer.quantityRemaining), 0));
}

async function valuation(db, { tenantId, warehouseId, productId }) {
  const where = { tenantId, quantityRemaining: { gt: 0 } };
  if (warehouseId) where.warehouseId = warehouseId;
  if (productId) where.productId = productId;
  const layers = await db.costLayer.findMany({
    where,
    include: { product: true },
    orderBy: [{ productId: 'asc' }, { receivedAt: 'asc' }]
  });
  const warehouses = await db.warehouse.findMany({
    where: { tenantId },
    select: { id: true, name: true }
  });
  const warehouseName = new Map(warehouses.map((row) => [row.id, row.name]));

  const products = new Map();
  for (const layer of layers) {
    const key = layer.productId;
    if (!products.has(key)) {
      products.set(key, {
        productId: layer.productId,
        code: layer.product?.code || '',
        name: layer.product?.name || '',
        quantity: 0,
        value: 0,
        layers: []
      });
    }
    const row = products.get(key);
    const qty = num(layer.quantityRemaining);
    const value = money(qty * num(layer.unitCost));
    row.quantity = money(row.quantity + qty);
    row.value = money(row.value + value);
    row.layers.push({
      id: layer.id,
      warehouseId: layer.warehouseId,
      warehouse: warehouseName.get(layer.warehouseId) || '',
      receivedAt: layer.receivedAt,
      sourceType: layer.sourceType,
      sourceId: layer.sourceId,
      quantity: qty,
      unitCost: num(layer.unitCost),
      value
    });
  }

  const rows = [...products.values()].map((row) => ({
    ...row,
    unitCost: row.quantity > 0 ? money(row.value / row.quantity) : 0
  }));
  return { rows, totalValue: money(rows.reduce((sum, row) => sum + row.value, 0)) };
}

module.exports = {
  movementEffect,
  receive,
  issue,
  transfer,
  reverseReceipt,
  reverseIssue,
  onHand,
  valuation
};
