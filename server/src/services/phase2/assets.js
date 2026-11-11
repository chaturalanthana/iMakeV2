const { DocumentError } = require('../errors');
const { ensureGlMap, postJournal } = require('../glService');
const { writeAudit } = require('../auditService');
const { money, num, dec } = require('../money');
const { daysInMonth, daysInUse, depreciationAmount } = require('./math');

async function createClass(tx, input) {
  return tx.fixedAssetClass.create({
    data: {
      tenantId: input.tenantId,
      code: String(input.code).trim(),
      name: String(input.name).trim(),
      accountingMethod: String(input.accountingMethod || 'SL').toUpperCase(),
      accountingLifeMonths: parseInt(input.accountingLifeMonths, 10) || 60,
      accountingRate: dec(input.accountingRate || 0),
      accountingResidual: dec(input.accountingResidual || 0),
      taxMethod: String(input.taxMethod || 'RB').toUpperCase(),
      taxLifeMonths: parseInt(input.taxLifeMonths, 10) || 60,
      taxRate: dec(input.taxRate == null ? 20 : input.taxRate),
      taxResidual: dec(input.taxResidual || 0)
    }
  });
}

async function capitalizeAsset(tx, input) {
  const asset = await tx.fixedAsset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId } });
  if (!asset || asset.status !== 'CWIP') {
    throw new DocumentError('Only a CWIP balance can be capitalized.', { assetId: 'Only a CWIP balance can be capitalized.' });
  }
  const assetClass = await tx.fixedAssetClass.findFirst({ where: { id: input.classId, tenantId: input.tenantId } });
  if (!assetClass) throw new DocumentError('Choose an asset class.', { classId: 'Choose an asset class.' });
  const amount = num(asset.cwipBalance);
  if (!(amount > 0)) throw new DocumentError('There is no CWIP balance to capitalize.', { amount: 'There is no CWIP balance to capitalize.' });
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const journal = await postJournal(tx, {
    tenantId: input.tenantId,
    date: input.date,
    createdBy: input.createdBy,
    description: `Capitalize ${asset.code}`,
    referenceType: 'CAPITALIZATION',
    referenceId: asset.id,
    lines: [
      { accountId: map.FIXED_ASSET, debit: amount, credit: 0, costCenterId: asset.costCenterId, profitCenterId: asset.profitCenterId, description: asset.code },
      { accountId: map.CWIP, debit: 0, credit: amount, costCenterId: asset.costCenterId, profitCenterId: asset.profitCenterId, description: asset.code }
    ]
  });
  const capitalized = await tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      classId: assetClass.id,
      name: input.name || asset.name,
      status: 'ACTIVE',
      acquiredOn: new Date(input.date),
      cost: dec(amount),
      cwipBalance: dec(0),
      accountingNbv: dec(amount),
      taxNbv: dec(amount),
      events: {
        create: {
          tenantId: input.tenantId,
          type: 'CAPITALIZE',
          date: new Date(input.date),
          amount: dec(amount),
          journalEntryId: journal?.id || null,
          notes: 'Engineering commissioning and finance capitalization'
        }
      }
    },
    include: { assetClass: true }
  });
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'POST',
    entity: 'FIXED_ASSET',
    entityId: asset.id,
    after: { status: 'ACTIVE', code: asset.code }
  });
  return capitalized;
}

async function depreciateAsset(tx, asset, { year, month, createdBy, map, tenantId }) {
  const assetClass = asset.assetClass;
  if (!assetClass) return [];
  const days = daysInUse(asset.acquiredOn, asset.disposedOn, year, month);
  const accounting = depreciationAmount({
    method: assetClass.accountingMethod,
    cost: num(asset.cost),
    residual: num(assetClass.accountingResidual),
    lifeMonths: assetClass.accountingLifeMonths,
    nbv: num(asset.accountingNbv),
    annualRate: num(assetClass.accountingRate),
    days,
    year,
    month
  });
  const tax = depreciationAmount({
    method: assetClass.taxMethod,
    cost: num(asset.cost),
    residual: num(assetClass.taxResidual),
    lifeMonths: assetClass.taxLifeMonths,
    nbv: num(asset.taxNbv),
    annualRate: num(assetClass.taxRate),
    days,
    year,
    month
  });
  if (!(accounting > 0) && !(tax > 0)) return [];
  await tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      accountingNbv: dec(money(num(asset.accountingNbv) - accounting)),
      taxNbv: dec(money(num(asset.taxNbv) - tax)),
      accumDepreciation: dec(money(num(asset.accumDepreciation) + accounting))
    }
  });
  const rows = [];
  if (accounting > 0) {
    rows.push({
      tenantId,
      assetId: asset.id,
      book: 'ACCOUNTING',
      days,
      amount: dec(accounting),
      nbvAfter: dec(money(num(asset.accountingNbv) - accounting)),
      center: asset.costCenterId,
      profit: asset.profitCenterId
    });
  }
  if (tax > 0) {
    rows.push({
      tenantId,
      assetId: asset.id,
      book: 'TAX',
      days,
      amount: dec(tax),
      nbvAfter: dec(money(num(asset.taxNbv) - tax))
    });
  }
  return rows;
}

async function runDepreciation(tx, input) {
  const year = parseInt(input.year, 10);
  const month = parseInt(input.month, 10);
  if (!(year > 2000) || month < 1 || month > 12) {
    throw new DocumentError('Choose a valid month.', { month: 'Choose a valid month.' });
  }
  const existing = await tx.depreciationRun.findFirst({ where: { tenantId: input.tenantId, year, month } });
  if (existing) throw new DocumentError('Depreciation has already been run for that month.', { month: 'Depreciation has already been run for that month.' });
  const assets = await tx.fixedAsset.findMany({
    where: { tenantId: input.tenantId, status: 'ACTIVE' },
    include: { assetClass: true }
  });
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const lineRows = [];
  for (const asset of assets) {
    const rows = await depreciateAsset(tx, asset, { year, month, createdBy: input.createdBy, map, tenantId: input.tenantId });
    lineRows.push(...rows);
  }
  const total = money(lineRows.filter((row) => row.book === 'ACCOUNTING').reduce((sum, row) => sum + num(row.amount), 0));
  const date = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
  const journal = await postJournal(tx, {
    tenantId: input.tenantId,
    date,
    createdBy: input.createdBy,
    description: `Depreciation ${year}-${String(month).padStart(2, '0')}`,
    referenceType: 'DEPRECIATION',
    referenceId: `${year}-${month}`,
    lines: [
      { accountId: map.DEPRECIATION_EXPENSE, debit: total, credit: 0, description: 'Monthly depreciation' },
      { accountId: map.ACCUM_DEPRECIATION, debit: 0, credit: total, description: 'Monthly depreciation' }
    ]
  });
  return tx.depreciationRun.create({
    data: {
      tenantId: input.tenantId,
      year,
      month,
      journalEntryId: journal?.id || null,
      createdBy: input.createdBy || null,
      lines: {
        create: lineRows.map((row) => ({
          tenantId: row.tenantId,
          assetId: row.assetId,
          book: row.book,
          days: row.days,
          amount: row.amount,
          nbvAfter: row.nbvAfter
        }))
      }
    },
    include: { lines: true }
  });
}

async function disposeAsset(tx, input) {
  const asset = await tx.fixedAsset.findFirst({
    where: { id: input.assetId, tenantId: input.tenantId },
    include: { assetClass: true }
  });
  if (!asset || asset.status !== 'ACTIVE') {
    throw new DocumentError('Only an active asset can be disposed.', { assetId: 'Only an active asset can be disposed.' });
  }
  const when = new Date(input.date);
  const year = when.getUTCFullYear();
  const month = when.getUTCMonth() + 1;
  await tx.fixedAsset.update({ where: { id: asset.id }, data: { disposedOn: when } });
  asset.disposedOn = when;
  const already = await tx.depreciationLine.findFirst({
    where: { assetId: asset.id, book: 'ACCOUNTING', run: { year, month } }
  });
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  if (!already && asset.assetClass) {
    const rows = await depreciateAsset(tx, asset, { year, month, tenantId: input.tenantId, map });
    const partial = money(rows.filter((row) => row.book === 'ACCOUNTING').reduce((sum, row) => sum + num(row.amount), 0));
    if (partial > 0) {
      await postJournal(tx, {
        tenantId: input.tenantId,
        date: when,
        createdBy: input.createdBy,
        description: `Depreciation to disposal ${asset.code}`,
        referenceType: 'DEPRECIATION',
        referenceId: asset.id,
        lines: [
          { accountId: map.DEPRECIATION_EXPENSE, debit: partial, credit: 0, description: asset.code },
          { accountId: map.ACCUM_DEPRECIATION, debit: 0, credit: partial, description: asset.code }
        ]
      });
    }
    asset.accumDepreciation = dec(money(num(asset.accumDepreciation) + partial));
    asset.accountingNbv = dec(money(num(asset.accountingNbv) - partial));
  }
  const fresh = await tx.fixedAsset.findUnique({ where: { id: asset.id } });
  const cost = num(fresh.cost);
  const accum = num(fresh.accumDepreciation);
  const nbv = money(cost - accum);
  const proceeds = money(input.proceeds || 0);
  const gain = money(proceeds - nbv);
  const bank = input.bankAccountId || map.BANK;
  const journal = await postJournal(tx, {
    tenantId: input.tenantId,
    date: when,
    createdBy: input.createdBy,
    description: `Dispose ${asset.code}`,
    referenceType: 'ASSET_DISPOSAL',
    referenceId: asset.id,
    lines: [
      { accountId: bank, debit: proceeds, credit: 0, description: 'Disposal proceeds' },
      { accountId: map.ACCUM_DEPRECIATION, debit: accum, credit: 0, description: 'Clear accumulated depreciation' },
      { accountId: map.DISPOSAL_LOSS, debit: gain < 0 ? Math.abs(gain) : 0, credit: 0, description: 'Loss on disposal' },
      { accountId: map.FIXED_ASSET, debit: 0, credit: cost, description: 'Remove asset cost' },
      { accountId: map.DISPOSAL_GAIN, debit: 0, credit: gain > 0 ? gain : 0, description: 'Gain on disposal' }
    ]
  });
  const disposed = await tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      status: 'DISPOSED',
      disposedOn: when,
      accountingNbv: dec(0),
      cwipBalance: dec(0),
      events: {
        create: {
          tenantId: input.tenantId,
          type: 'DISPOSE',
          date: when,
          amount: dec(proceeds),
          journalEntryId: journal?.id || null,
          notes: input.notes || null
        }
      }
    }
  });
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'REVERSE',
    entity: 'FIXED_ASSET',
    entityId: asset.id,
    before: { status: asset.status },
    after: { status: 'DISPOSED' }
  });
  return disposed;
}

async function impairAsset(tx, input) {
  const asset = await tx.fixedAsset.findFirst({
    where: { id: input.assetId, tenantId: input.tenantId },
    include: { assetClass: true }
  });
  if (!asset || asset.status !== 'ACTIVE') throw new DocumentError('Only an active asset can be impaired.', { assetId: 'Only an active asset can be impaired.' });
  const residual = num(asset.assetClass?.accountingResidual);
  const room = money(num(asset.accountingNbv) - residual);
  const amount = money(input.amount);
  if (!(amount > 0) || amount > room + 0.0001) {
    throw new DocumentError('Impairment must be within the carrying amount.', { amount: 'Impairment must be within the carrying amount.' });
  }
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const journal = await postJournal(tx, {
    tenantId: input.tenantId,
    date: input.date,
    createdBy: input.createdBy,
    description: `Impair ${asset.code}`,
    referenceType: 'ASSET_IMPAIRMENT',
    referenceId: asset.id,
    lines: [
      { accountId: map.IMPAIRMENT, debit: amount, credit: 0, description: asset.code },
      { accountId: map.ACCUM_DEPRECIATION, debit: 0, credit: amount, description: asset.code }
    ]
  });
  return tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      accountingNbv: dec(money(num(asset.accountingNbv) - amount)),
      accumDepreciation: dec(money(num(asset.accumDepreciation) + amount)),
      events: {
        create: {
          tenantId: input.tenantId,
          type: 'IMPAIR',
          date: new Date(input.date),
          amount: dec(amount),
          journalEntryId: journal?.id || null,
          notes: input.notes || null
        }
      }
    }
  });
}

async function transferAsset(tx, input) {
  const asset = await tx.fixedAsset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId } });
  if (!asset || asset.status === 'DISPOSED') throw new DocumentError('That asset cannot be transferred.', { assetId: 'That asset cannot be transferred.' });
  return tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      costCenterId: input.costCenterId || null,
      profitCenterId: input.profitCenterId || asset.profitCenterId,
      events: {
        create: {
          tenantId: input.tenantId,
          type: 'TRANSFER',
          date: new Date(input.date || new Date()),
          amount: dec(0),
          notes: input.notes || null
        }
      }
    }
  });
}

module.exports = {
  createClass,
  capitalizeAsset,
  runDepreciation,
  disposeAsset,
  impairAsset,
  transferAsset
};
