const { DocumentError } = require('../errors');
const { writeAudit } = require('../auditService');
const { ensureGlMap, postJournal } = require('../glService');
const { money, num, dec, rateOf } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { allocateShares } = require('./math');
const { capitalDebitKey } = require('./capitalTreatment');

async function postLandedCost(tx, input) {
  const grn = await tx.gRN.findFirst({
    where: { id: input.grnId, tenantId: input.tenantId, status: { not: 'CANCELLED' } },
    include: { items: true }
  });
  if (!grn) throw new DocumentError('Goods receipt not found.', { grnId: 'Goods receipt not found.' });
  if (!grn.items.length) throw new DocumentError('The goods receipt has no lines.', { grnId: 'The goods receipt has no lines.' });
  if (!input.charges || !input.charges.length) {
    throw new DocumentError('Add freight, duty, clearing, or insurance.', { charges: 'Add freight, duty, clearing, or insurance.' });
  }
  const grnRate = rateOf(grn.exchangeRate);
  const basis = String(input.basis || 'VALUE').toUpperCase();
  if (!['VALUE', 'QTY', 'WEIGHT'].includes(basis)) {
    throw new DocumentError('Allocation basis must be value, quantity, or weight.', { basis: 'Allocation basis must be value, quantity, or weight.' });
  }
  const productIds = grn.items.map((item) => item.productId);
  const measures = await tx.itemMeasure.findMany({ where: { tenantId: input.tenantId, productId: { in: productIds } } });
  const overrides = new Map((input.weights || []).map((row) => [row.productId, num(row.weightKg)]));
  const lines = grn.items.map((item) => {
    const qty = num(item.quantityReceived);
    const valueBase = money(qty * num(item.unitPrice) * grnRate);
    const measure = measures.find((row) => row.productId === item.productId);
    const unitWeight = overrides.has(item.productId) ? overrides.get(item.productId) : num(measure?.weightKg);
    return { item, qty, valueBase, weight: money(unitWeight * qty) };
  });
  const weights = lines.map((line) => (basis === 'QTY' ? line.qty : basis === 'WEIGHT' ? line.weight : line.valueBase));
  const chargeRows = [];
  let baseAtInvoice = 0;
  let baseAtGrn = 0;
  for (const charge of input.charges) {
    const kind = String(charge.kind || '').toUpperCase();
    if (!['FREIGHT', 'DUTY', 'CLEARING', 'INSURANCE'].includes(kind)) {
      throw new DocumentError('Charge type must be freight, duty, clearing, or insurance.', { kind: 'Charge type must be freight, duty, clearing, or insurance.' });
    }
    const rate = rateOf(charge.exchangeRate == null || charge.exchangeRate === '' ? grnRate : charge.exchangeRate);
    const amount = money(charge.amount);
    if (!(amount > 0)) throw new DocumentError('Charge amount must be greater than zero.', { amount: 'Charge amount must be greater than zero.' });
    baseAtInvoice = money(baseAtInvoice + amount * rate);
    baseAtGrn = money(baseAtGrn + amount * grnRate);
    chargeRows.push({
      kind,
      amount: dec(amount),
      exchangeRate: dec(rate),
      amountBase: dec(money(amount * rate)),
      reference: charge.reference || null
    });
  }
  let shares;
  let fxShares;
  try {
    shares = allocateShares(weights, baseAtGrn);
    fxShares = allocateShares(weights, money(baseAtInvoice - baseAtGrn));
  } catch (error) {
    throw new DocumentError(error.message, { basis: error.message });
  }
  const treatment = await capitalDebitKey(tx, input.tenantId, grn.poId);
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const debitAccount = treatment === 'CWIP' ? map.CWIP : map.INVENTORY;
  let inventoryDebit = 0;
  let cogsDebit = 0;
  const allocations = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const share = shares[index];
    const fx = fxShares[index];
    let invPart = share;
    let cogsPart = 0;
    let batchId = null;
    if (treatment !== 'CWIP') {
      const layers = await grnBatchLayers(tx, input.tenantId, grn.id, line.item);
      if (!layers.length) {
        throw new DocumentError('Receipt has no FIFO cost layer to update.', { grnId: 'Receipt has no FIFO cost layer to update.' });
      }
      batchId = layers.find((layer) => layer.batchId)?.batchId || null;
      const received = layers.reduce((sum, layer) => sum + num(layer.quantityReceived), 0);
      const remaining = layers.reduce((sum, layer) => sum + num(layer.quantityRemaining), 0);
      invPart = received > 0 ? money(share * (remaining / received)) : 0;
      cogsPart = money(share - invPart);
      if (remaining > 0 && invPart !== 0) {
        const open = layers.filter((layer) => num(layer.quantityRemaining) > 0);
        let left = invPart;
        for (let layerIndex = 0; layerIndex < open.length; layerIndex += 1) {
          const layer = open[layerIndex];
          const rem = num(layer.quantityRemaining);
          const add = layerIndex === open.length - 1 ? left : money(invPart * rem / remaining);
          left = money(left - add);
          const newUnit = money((num(layer.unitCost) * rem + add) / rem);
          await tx.costLayer.update({ where: { id: layer.id }, data: { unitCost: dec(newUnit) } });
        }
      }
    }
    inventoryDebit = money(inventoryDebit + invPart);
    cogsDebit = money(cogsDebit + cogsPart);
    allocations.push({
      tenantId: input.tenantId,
      productId: line.item.productId,
      grnItemId: line.item.id,
      batchId,
      quantity: dec(line.qty),
      weight: dec(line.weight),
      valueBase: dec(line.valueBase),
      allocatedBase: dec(share),
      inventoryAmount: dec(invPart),
      cogsAmount: dec(cogsPart),
      fxAmount: dec(fx)
    });
  }
  const fx = money(baseAtInvoice - baseAtGrn);
  const journalLines = [
    { accountId: debitAccount, debit: inventoryDebit, credit: 0, description: 'Landed cost' },
    { accountId: map.COGS, debit: cogsDebit, credit: 0, description: 'Landed cost on issued quantity' },
    { accountId: map.FX_LOSS, debit: fx > 0 ? fx : 0, credit: 0, description: 'Landed cost FX' },
    { accountId: map.FX_GAIN, debit: 0, credit: fx < 0 ? Math.abs(fx) : 0, description: 'Landed cost FX' },
    { accountId: map.LANDED_CLEARING, debit: 0, credit: baseAtInvoice, description: 'Landed cost accrual' }
  ];
  const number = await generateDocumentNumber(input.tenantId, 'landedCost', 'LC', 'number', tx);
  const created = await tx.landedCost.create({
    data: {
      tenantId: input.tenantId,
      number,
      date: new Date(input.date || grn.date),
      grnId: grn.id,
      basis,
      grnExchangeRate: dec(grnRate),
      createdBy: input.createdBy || null,
      charges: { create: chargeRows.map((row) => ({ ...row, tenantId: input.tenantId })) },
      allocations: { create: allocations }
    },
    include: { charges: true, allocations: true }
  });
  await postJournal(tx, {
    tenantId: input.tenantId,
    date: created.date,
    createdBy: input.createdBy,
    description: `Landed cost ${number}`,
    referenceType: 'LANDED_COST',
    referenceId: created.id,
    lines: journalLines
  });
  if (treatment === 'CWIP') {
    const asset = await tx.fixedAsset.findFirst({ where: { tenantId: input.tenantId, sourceGrnId: grn.id } });
    if (asset) {
      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          cost: dec(money(num(asset.cost) + baseAtGrn)),
          cwipBalance: dec(money(num(asset.cwipBalance) + baseAtGrn)),
          accountingNbv: dec(money(num(asset.accountingNbv) + baseAtGrn)),
          taxNbv: dec(money(num(asset.taxNbv) + baseAtGrn))
        }
      });
    }
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'POST',
    entity: 'LANDED_COST',
    entityId: created.id,
    after: { status: created.status, grnId: grn.id }
  });
  return created;
}

async function grnBatchLayers(tx, tenantId, grnId, item) {
  const layers = await tx.costLayer.findMany({
    where: { tenantId, productId: item.productId, sourceType: 'GRN', sourceId: grnId },
    orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }]
  });
  if (!item.lotNumber) return layers;
  const batch = await tx.stockBatch.findFirst({
    where: { tenantId, productId: item.productId, lotNumber: item.lotNumber }
  });
  const matched = layers.filter((layer) => layer.lotNumber === item.lotNumber || (batch && layer.batchId === batch.id));
  return matched.length ? matched : layers;
}

module.exports = { postLandedCost };
