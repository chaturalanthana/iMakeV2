const { generateDocumentNumber } = require('../utils/codeGenerator');
const { DocumentError } = require('./errors');
const { num, money, dec } = require('./money');
const { assertPeriodOpen } = require('./periodService');

const DEFAULT_ACCOUNTS = [
  { key: 'CASH', code: '1000', name: 'Cash on Hand', type: 'ASSET' },
  { key: 'BANK', code: '1010', name: 'Bank', type: 'ASSET' },
  { key: 'AR', code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
  { key: 'INVENTORY', code: '1300', name: 'Inventory', type: 'ASSET' },
  { key: 'VAT_INPUT', code: '1310', name: 'VAT Input', type: 'ASSET' },
  { key: 'GRNI', code: '1400', name: 'Goods Received Not Invoiced', type: 'LIABILITY' },
  { key: 'AP', code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { key: 'VAT_OUTPUT', code: '2100', name: 'VAT Output', type: 'LIABILITY' },
  { key: 'WHT', code: '2110', name: 'WHT Payable', type: 'LIABILITY' },
  { key: 'SSCL', code: '2120', name: 'SSCL Payable', type: 'LIABILITY' },
  { key: 'REVENUE', code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
  { key: 'COGS', code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { key: 'STOCK_ADJUSTMENT', code: '5100', name: 'Stock Adjustment', type: 'EXPENSE' },
  { key: 'PPV', code: '5200', name: 'Purchase Price Variance', type: 'EXPENSE' },
  { key: 'INVENTORY_FG', code: '1320', name: 'Finished Goods', type: 'ASSET' },
  { key: 'WIP', code: '1330', name: 'Work in Progress', type: 'ASSET' },
  { key: 'ABSORBED_LABOUR', code: '5400', name: 'Absorbed Labour', type: 'EXPENSE' },
  { key: 'ABSORBED_OVERHEAD', code: '5410', name: 'Absorbed Overhead', type: 'EXPENSE' },
  { key: 'VARIANCE_MATERIAL', code: '5500', name: 'Production Variance - Material', type: 'EXPENSE' },
  { key: 'VARIANCE_LABOUR', code: '5510', name: 'Production Variance - Labour', type: 'EXPENSE' },
  { key: 'VARIANCE_OVERHEAD', code: '5520', name: 'Production Variance - Overhead', type: 'EXPENSE' },
  { key: 'VARIANCE_SCRAP', code: '5530', name: 'Production Variance - Scrap', type: 'EXPENSE' },
  { key: 'FX_GAIN', code: '4150', name: 'Realised FX Gain', type: 'REVENUE' },
  { key: 'FX_LOSS', code: '5300', name: 'Realised FX Loss', type: 'EXPENSE' },
  { key: 'OPENING_EQUITY', code: '3000', name: 'Opening Balance Equity', type: 'EQUITY' },
  { key: 'SALARY_EXPENSE', code: '5600', name: 'Salary Expense', type: 'EXPENSE' },
  { key: 'EMPLOYER_EPF', code: '5610', name: 'Employer EPF Expense', type: 'EXPENSE' },
  { key: 'EMPLOYER_ETF', code: '5620', name: 'Employer ETF Expense', type: 'EXPENSE' },
  { key: 'EPF_PAYABLE', code: '2130', name: 'EPF Payable', type: 'LIABILITY' },
  { key: 'ETF_PAYABLE', code: '2140', name: 'ETF Payable', type: 'LIABILITY' },
  { key: 'SALARIES_PAYABLE', code: '2150', name: 'Salaries Payable', type: 'LIABILITY' },
  { key: 'PAYROLL_DEDUCTIONS', code: '2160', name: 'Payroll Deductions Payable', type: 'LIABILITY' },
  { key: 'CWIP', code: '1500', name: 'Capital Work in Progress', type: 'ASSET' },
  { key: 'FIXED_ASSET', code: '1510', name: 'Fixed Assets', type: 'ASSET' },
  { key: 'ACCUM_DEPRECIATION', code: '1520', name: 'Accumulated Depreciation', type: 'ASSET' },
  { key: 'DEPRECIATION_EXPENSE', code: '5700', name: 'Depreciation Expense', type: 'EXPENSE' },
  { key: 'IMPAIRMENT', code: '5710', name: 'Asset Impairment', type: 'EXPENSE' },
  { key: 'DISPOSAL_GAIN', code: '4160', name: 'Gain on Disposal', type: 'REVENUE' },
  { key: 'DISPOSAL_LOSS', code: '5720', name: 'Loss on Disposal', type: 'EXPENSE' },
  { key: 'LANDED_CLEARING', code: '1410', name: 'Landed Cost Clearing', type: 'LIABILITY' },
  { key: 'PETTY_CASH', code: '1020', name: 'Petty Cash', type: 'ASSET' },
  { key: 'IOU_ADVANCES', code: '1210', name: 'Employee IOU Advances', type: 'ASSET' },
  { key: 'CHEQUES_IN_HAND', code: '1030', name: 'Cheques in Hand', type: 'ASSET' },
  { key: 'OUTSTANDING_CHEQUES', code: '2170', name: 'Outstanding Cheques', type: 'LIABILITY' },
  { key: 'RETAINED_EARNINGS', code: '3100', name: 'Retained Earnings', type: 'EQUITY' }
];

async function ensureGlMap(tx, tenantId, userId) {
  const existing = await tx.glAccountMap.findMany({ where: { tenantId } });
  const accounts = await tx.account.findMany({ where: { tenantId } });
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const map = {};
  for (const row of existing) map[row.key] = row.accountId;

  for (const def of DEFAULT_ACCOUNTS) {
    if (map[def.key]) continue;
    let account = byCode.get(def.code);
    if (!account) {
      account = await tx.account.create({
        data: {
          tenantId,
          code: def.code,
          name: def.name,
          type: def.type,
          createdBy: userId || null
        }
      });
      byCode.set(def.code, account);
    }
    await tx.glAccountMap.create({
      data: { tenantId, key: def.key, accountId: account.id }
    });
    map[def.key] = account.id;
  }
  return map;
}

async function seedTenantFinance(tx, tenantId, baseCurrency = 'LKR') {
  const code = String(baseCurrency || 'LKR').toUpperCase();
  const existingCurrency = await tx.currency.findFirst({ where: { tenantId, code } });
  if (!existingCurrency) {
    await tx.currency.create({
      data: {
        tenantId,
        code,
        name: code === 'LKR' ? 'Sri Lankan Rupee' : code,
        symbol: code === 'LKR' ? 'Rs' : code,
        exchangeRate: 1,
        isBase: true
      }
    });
  }
  await ensureGlMap(tx, tenantId, null);

  const salesVat = await tx.taxGroup.findFirst({ where: { tenantId, name: 'VAT' } });
  if (!salesVat) {
    const vat = await tx.taxGroup.create({
      data: { tenantId, name: 'VAT', description: 'Sri Lanka VAT 18%' }
    });
    await tx.taxSlab.create({
      data: { tenantId, taxGroupId: vat.id, name: 'VAT', rate: 18, calculationOrder: 1 }
    });
    const both = await tx.taxGroup.create({
      data: { tenantId, name: 'VAT + SSCL', description: 'VAT 18% and SSCL 2.5%' }
    });
    await tx.taxSlab.create({
      data: { tenantId, taxGroupId: both.id, name: 'VAT', rate: 18, calculationOrder: 1 }
    });
    await tx.taxSlab.create({
      data: { tenantId, taxGroupId: both.id, name: 'SSCL', rate: 2.5, calculationOrder: 2 }
    });
  }

  const purchaseVat = await tx.purchaseTaxGroup.findFirst({ where: { tenantId, name: 'VAT' } });
  if (!purchaseVat) {
    const group = await tx.purchaseTaxGroup.create({
      data: { tenantId, name: 'VAT', description: 'Input VAT 18%' }
    });
    await tx.purchaseTaxSlab.create({
      data: { tenantId, taxGroupId: group.id, name: 'VAT', rate: 18, calculationOrder: 1 }
    });
  }

  const wht = await tx.purchaseWithholdingTaxGroup.findFirst({ where: { tenantId, name: 'WHT' } });
  if (!wht) {
    const group = await tx.purchaseWithholdingTaxGroup.create({
      data: { tenantId, name: 'WHT', description: 'Withholding tax. Edit the slab rate before assigning it to a supplier.' }
    });
    await tx.purchaseWithholdingTaxSlab.create({
      data: { tenantId, taxGroupId: group.id, name: 'WHT', rate: 5, calculationOrder: 1 }
    });
  }
}

function cleanLines(lines) {
  const cleaned = [];
  for (const line of lines) {
    let debit = money(line.debit);
    let credit = money(line.credit);
    if (debit > 0 && credit > 0) {
      if (debit >= credit) {
        debit = money(debit - credit);
        credit = 0;
      } else {
        credit = money(credit - debit);
        debit = 0;
      }
    }
    if (debit <= 0 && credit <= 0) continue;
    cleaned.push({
      accountId: line.accountId,
      debit,
      credit,
      description: line.description || null,
      costCenterId: line.costCenterId || null,
      profitCenterId: line.profitCenterId || null
    });
  }
  return cleaned;
}

async function postJournal(tx, {
  tenantId,
  date,
  description,
  referenceType,
  referenceId,
  lines,
  createdBy
}) {
  const cleaned = cleanLines(lines);
  let debit = 0;
  let credit = 0;
  for (const line of cleaned) {
    debit = money(debit + line.debit);
    credit = money(credit + line.credit);
  }
  if (Math.abs(debit - credit) > 0.0001) {
    throw new DocumentError(`Journal is not balanced (debits ${debit}, credits ${credit}).`);
  }
  if (cleaned.length === 0 || debit === 0) return null;

  await assertPeriodOpen(tx, { tenantId, date, userId: createdBy });

  const entryNumber = await generateDocumentNumber(tenantId, 'journalEntry', 'JE', 'entryNumber', tx);
  return tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber,
      date: new Date(date),
      description,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      isPosted: true,
      createdBy: createdBy || null,
      lines: {
        create: cleaned.map((line) => ({
          accountId: line.accountId,
          debit: dec(line.debit),
          credit: dec(line.credit),
          description: line.description,
          costCenterId: line.costCenterId,
          profitCenterId: line.profitCenterId
        }))
      }
    },
    include: { lines: true }
  });
}

async function reverseJournal(tx, { tenantId, referenceType, referenceId, date, createdBy, description }) {
  const original = await tx.journalEntry.findFirst({
    where: {
      tenantId,
      referenceType,
      referenceId,
      description: { not: { startsWith: 'Reversal:' } }
    },
    include: { lines: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!original) return null;
  const already = await tx.journalEntry.findFirst({
    where: {
      tenantId,
      referenceType,
      referenceId,
      description: { startsWith: 'Reversal:' }
    }
  });
  if (already) return already;
  return postJournal(tx, {
    tenantId,
    date: date || new Date(),
    createdBy,
    description: `Reversal: ${description || original.description}`,
    referenceType,
    referenceId,
    lines: original.lines.map((line) => ({
      accountId: line.accountId,
      debit: num(line.credit),
      credit: num(line.debit),
      description: 'Reversal'
    }))
  });
}

async function trialBalance(db, tenantId) {
  const lines = await db.journalLine.findMany({
    where: { journalEntry: { tenantId, isPosted: true } },
    include: { account: true }
  });
  const byAccount = new Map();
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (!byAccount.has(line.accountId)) {
      byAccount.set(line.accountId, {
        accountId: line.accountId,
        code: line.account?.code || '',
        name: line.account?.name || '',
        type: line.account?.type || '',
        debit: 0,
        credit: 0
      });
    }
    const row = byAccount.get(line.accountId);
    row.debit = money(row.debit + num(line.debit));
    row.credit = money(row.credit + num(line.credit));
    debit = money(debit + num(line.debit));
    credit = money(credit + num(line.credit));
  }
  return {
    debit,
    credit,
    balanced: Math.abs(debit - credit) < 0.001,
    accounts: [...byAccount.values()].sort((a, b) => a.code.localeCompare(b.code))
  };
}

module.exports = {
  DEFAULT_ACCOUNTS,
  ensureGlMap,
  seedTenantFinance,
  postJournal,
  reverseJournal,
  trialBalance
};
