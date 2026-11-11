const { DocumentError } = require('../errors');
const { num } = require('../money');
const { expired, layerRows } = require('./positions');

const STATUSES = ['UNRESTRICTED', 'QUARANTINE', 'BLOCKED'];

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DocumentError('Enter a valid date.', { date: 'Enter a valid date.' });
  }
  return date;
}

async function recordBatch(db, {
  tenantId,
  productId,
  lotNumber,
  expiryDate,
  supplierId,
  status = 'UNRESTRICTED',
  receiptDate,
  notes
}) {
  const lot = String(lotNumber || '').trim();
  if (!lot) return null;
  if (status && !STATUSES.includes(status)) {
    throw new DocumentError('Unknown stock status.', { stockStatus: 'Unknown stock status.' });
  }
  const expiry = expiryDate ? asDate(expiryDate) : null;
  const existing = await db.stockBatch.findFirst({ where: { tenantId, productId, lotNumber: lot } });
  if (existing) {
    return db.stockBatch.update({
      where: { id: existing.id },
      data: {
        expiryDate: existing.expiryDate || expiry,
        originalExpiryDate: existing.originalExpiryDate || expiry,
        status: status || existing.status
      }
    });
  }
  return db.stockBatch.create({
    data: {
      tenantId,
      productId,
      lotNumber: lot,
      expiryDate: expiry,
      originalExpiryDate: expiry,
      status: status || 'UNRESTRICTED',
      supplierId: supplierId || null,
      receiptDate: receiptDate ? asDate(receiptDate) : new Date(),
      notes: notes || null
    }
  });
}

async function productWithType(db, tenantId, productId) {
  return db.product.findFirst({
    where: { id: productId, tenantId },
    include: { productType: true }
  });
}

function controlledKind(product) {
  const kind = product?.productType?.kind;
  return kind === 'RAW_MATERIAL' || kind === 'PACKAGING';
}

async function assertConsumable(db, tenantId, product, batch) {
  if (!product) throw new DocumentError('Item was not found.', { productId: 'Item was not found.' });
  if (product.batchTracked && !batch) {
    throw new DocumentError('This item needs a known batch.', { lotNumber: 'This item needs a known batch.' });
  }
  if (!batch) return;
  if (batch.tenantId && batch.tenantId !== tenantId) {
    throw new DocumentError('Unknown batch.', { lotNumber: 'Unknown batch.' });
  }
  if (batch.status === 'BLOCKED' || batch.status === 'QUARANTINE') {
    throw new DocumentError('Blocked or quarantine stock cannot be allocated or consumed.', {
      lotNumber: 'Blocked or quarantine stock cannot be allocated or consumed.'
    });
  }
  const past = expired({ expiryDate: batch.expiryDate });
  if (past && (controlledKind(product) || product.expiryTracked)) {
    throw new DocumentError('Expired lots are blocked until QA approves a retest.', {
      expiryDate: 'Expired lots are blocked until QA approves a retest.'
    });
  }
}

async function suggestPicks(db, tenantId, { productId, warehouseId, quantity }) {
  const product = await productWithType(db, tenantId, productId);
  if (!product) throw new DocumentError('Item was not found.', { productId: 'Item was not found.' });
  const layers = await layerRows(db, tenantId, productId, warehouseId || null);
  const batchIds = [...new Set(layers.map((layer) => layer.batchId).filter(Boolean))];
  const palletIds = [...new Set(layers.map((layer) => layer.palletId).filter(Boolean))];
  const [batches, pallets] = await Promise.all([
    batchIds.length ? db.stockBatch.findMany({ where: { tenantId, id: { in: batchIds } } }) : [],
    palletIds.length ? db.pallet.findMany({ where: { tenantId, id: { in: palletIds } } }) : []
  ]);
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const palletById = new Map(pallets.map((pallet) => [pallet.id, pallet]));
  const eligible = layers.filter((layer) => {
    if ((layer.stockStatus || 'UNRESTRICTED') !== 'UNRESTRICTED') return false;
    if (expired(layer)) return false;
    const batch = layer.batchId ? batchById.get(layer.batchId) : null;
    if (batch && (batch.status === 'BLOCKED' || batch.status === 'QUARANTINE')) return false;
    if (batch && expired(batch) && (controlledKind(product) || product.expiryTracked)) return false;
    if (layer.palletId) {
      const pallet = palletById.get(layer.palletId);
      if (pallet && pallet.status !== 'ACTIVE') return false;
    }
    return num(layer.quantityRemaining) > 0;
  });
  const rule = controlledKind(product) ? 'FIFO' : (product.pickRule || 'FIFO');
  eligible.sort((a, b) => {
    if (rule === 'FEFO') {
      const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (ae !== be) return ae - be;
    }
    return new Date(a.receivedAt) - new Date(b.receivedAt);
  });
  let left = num(quantity);
  const suggestions = [];
  for (const layer of eligible) {
    if (left <= 0.00005) break;
    const take = Math.min(left, num(layer.quantityRemaining));
    if (!(take > 0)) continue;
    const batch = layer.batchId ? batchById.get(layer.batchId) : null;
    suggestions.push({
      layerId: layer.id,
      productId,
      batchId: layer.batchId,
      lotNumber: batch?.lotNumber || layer.lotNumber,
      expiryDate: batch?.expiryDate || layer.expiryDate,
      palletId: layer.palletId,
      quantity: Math.round(take * 10000) / 10000,
      rule
    });
    left -= take;
  }
  return { rule, suggestions, short: Math.round(Math.max(0, left) * 10000) / 10000 };
}

async function proposeRetest(db, { tenantId, batchId, proposedExpiry, evidence, requestedBy }) {
  const batch = await db.stockBatch.findFirst({ where: { id: batchId, tenantId } });
  if (!batch) throw new DocumentError('Batch was not found.', { batchId: 'Batch was not found.' });
  const proposed = asDate(proposedExpiry);
  const retest = await db.qaRetest.create({
    data: {
      tenantId,
      batchId,
      originalExpiry: batch.originalExpiryDate || batch.expiryDate,
      proposedExpiry: proposed,
      evidence: evidence || null,
      requestedBy: requestedBy || null,
      status: 'PROPOSED'
    }
  });
  await db.stockBatch.update({
    where: { id: batch.id },
    data: { retestStatus: 'PROPOSED', proposedExpiry: proposed, retestDate: new Date() }
  });
  return retest;
}

async function decideRetest(db, { tenantId, batchId, decision, decidedBy }) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new DocumentError('Decision must be approved or rejected.', { decision: 'Decision must be approved or rejected.' });
  }
  const batch = await db.stockBatch.findFirst({ where: { id: batchId, tenantId } });
  if (!batch) throw new DocumentError('Batch was not found.', { batchId: 'Batch was not found.' });
  const open = await db.qaRetest.findFirst({
    where: { tenantId, batchId, status: 'PROPOSED' },
    orderBy: { createdAt: 'desc' }
  });
  if (!open) throw new DocumentError('There is no retest waiting for a decision.', { status: 'There is no retest waiting for a decision.' });
  await db.qaRetest.update({
    where: { id: open.id },
    data: { status: decision, decidedBy: decidedBy || null, decidedAt: new Date() }
  });
  if (decision === 'APPROVED') {
    await db.costLayer.updateMany({
      where: { tenantId, batchId: batch.id },
      data: { expiryDate: open.proposedExpiry, stockStatus: 'UNRESTRICTED' }
    });
    return db.stockBatch.update({
      where: { id: batch.id },
      data: {
        expiryDate: open.proposedExpiry,
        retestStatus: 'APPROVED',
        status: 'UNRESTRICTED',
        qaReleaseDate: new Date()
      }
    });
  }
  return db.stockBatch.update({
    where: { id: batch.id },
    data: { retestStatus: 'REJECTED', proposedExpiry: null }
  });
}

async function setBatchStatus(db, { tenantId, batchId, status, qaReleaseDate }) {
  if (!STATUSES.includes(status)) {
    throw new DocumentError('Unknown stock status.', { status: 'Unknown stock status.' });
  }
  const batch = await db.stockBatch.findFirst({ where: { id: batchId, tenantId } });
  if (!batch) throw new DocumentError('Batch was not found.', { batchId: 'Batch was not found.' });
  await db.costLayer.updateMany({
    where: { tenantId, batchId },
    data: { stockStatus: status }
  });
  return db.stockBatch.update({
    where: { id: batch.id },
    data: {
      status,
      qaReleaseDate: status === 'UNRESTRICTED' ? (qaReleaseDate ? asDate(qaReleaseDate) : new Date()) : batch.qaReleaseDate
    }
  });
}

async function traceBatch(db, tenantId, { batchId, lotNumber }) {
  const batch = batchId
    ? await db.stockBatch.findFirst({ where: { id: batchId, tenantId }, include: { product: true, supplier: true, retests: true } })
    : await db.stockBatch.findFirst({ where: { tenantId, lotNumber: String(lotNumber || '').trim() }, include: { product: true, supplier: true, retests: true } });
  if (!batch) throw new DocumentError('Batch was not found.', { lotNumber: 'Batch was not found.' });
  const [layers, movements] = await Promise.all([
    db.costLayer.findMany({ where: { tenantId, OR: [{ batchId: batch.id }, { lotNumber: batch.lotNumber }] }, orderBy: { receivedAt: 'asc' } }),
    db.stockMovement.findMany({
      where: { tenantId, productId: batch.productId, OR: [{ batchId: batch.id }, { lotNumber: batch.lotNumber }] },
      orderBy: { createdAt: 'asc' },
      include: { warehouse: true }
    })
  ]);
  const whereFrom = movements.filter((row) => row.type !== 'GI').map(presentMovement);
  const whereUsed = movements.filter((row) => row.type === 'GI').map(presentMovement);
  return {
    batch,
    layers: layers.map((layer) => ({
      id: layer.id,
      warehouseId: layer.warehouseId,
      quantityReceived: num(layer.quantityReceived),
      quantityRemaining: num(layer.quantityRemaining),
      unitCost: num(layer.unitCost),
      sourceType: layer.sourceType,
      sourceId: layer.sourceId,
      receivedAt: layer.receivedAt,
      stockStatus: layer.stockStatus
    })),
    whereFrom,
    whereUsed
  };
}

function presentMovement(row) {
  return {
    id: row.id,
    type: row.type,
    quantity: num(row.quantity),
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    warehouse: row.warehouse?.code || null,
    createdAt: row.createdAt
  };
}

module.exports = {
  STATUSES,
  recordBatch,
  assertConsumable,
  suggestPicks,
  proposeRetest,
  decideRetest,
  setBatchStatus,
  traceBatch,
  productWithType,
  controlledKind
};
