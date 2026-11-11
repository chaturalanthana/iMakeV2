const { DocumentError } = require('../errors');
const { ensureGlMap, postJournal } = require('../glService');
const { money, num, dec } = require('../money');
const { allocateShares } = require('./math');
const { runDepreciation } = require('./assets');

const STEPS = [
  ['INVENTORY', 'Inventory'],
  ['PRODUCTION', 'Production'],
  ['AP', 'Accounts payable'],
  ['AR', 'Accounts receivable'],
  ['CASH_BANK', 'Cash and bank'],
  ['FIXED_ASSETS', 'Fixed assets'],
  ['GL', 'General ledger']
];

async function openPeriod(tx, input) {
  const year = parseInt(input.year, 10);
  const month = parseInt(input.month, 10);
  if (!(year > 2000) || month < 1 || month > 12) {
    throw new DocumentError('Choose a valid month.', { month: 'Choose a valid month.' });
  }
  const existing = await tx.periodClose.findFirst({ where: { tenantId: input.tenantId, year, month }, include: { steps: true } });
  if (existing) return existing;
  return tx.periodClose.create({
    data: {
      tenantId: input.tenantId,
      year,
      month,
      steps: {
        create: STEPS.map(([code, name], index) => ({
          tenantId: input.tenantId,
          code,
          name,
          sequence: index + 1
        }))
      }
    },
    include: { steps: { orderBy: { sequence: 'asc' } } }
  });
}

async function completeStep(tx, input) {
  const close = await tx.periodClose.findFirst({
    where: { id: input.closeId, tenantId: input.tenantId },
    include: { steps: true }
  });
  if (!close) throw new DocumentError('Close checklist not found.', { closeId: 'Close checklist not found.' });
  if (close.status === 'HARD') throw new DocumentError('This period is already closed.', { closeId: 'This period is already closed.' });
  const step = close.steps.find((row) => row.code === input.code);
  if (!step) throw new DocumentError('Unknown close step.', { code: 'Unknown close step.' });
  const status = String(input.status || 'DONE').toUpperCase();
  if (!['DONE', 'EXCEPTION'].includes(status)) throw new DocumentError('Mark the step done or record an exception.', { status: 'Mark the step done or record an exception.' });
  if (status === 'EXCEPTION' && (!input.note || String(input.note).trim().length < 3)) {
    throw new DocumentError('An exception needs a note.', { note: 'An exception needs a note.' });
  }
  const blocked = close.steps.filter((row) => row.sequence < step.sequence && row.status === 'PENDING');
  if (blocked.length) {
    throw new DocumentError('Complete the earlier close steps first.', { code: 'Complete the earlier close steps first.' });
  }
  await tx.periodCloseStep.update({
    where: { id: step.id },
    data: { status, note: input.note || null, completedAt: new Date() }
  });
  const remaining = close.steps.filter((row) => row.id !== step.id && row.status === 'PENDING');
  const nextStatus = remaining.length ? 'OPEN' : 'SOFT';
  return tx.periodClose.update({
    where: { id: close.id },
    data: { status: nextStatus },
    include: { steps: { orderBy: { sequence: 'asc' } } }
  });
}

async function runAllocations(tx, input) {
  const rules = await tx.allocationRule.findMany({
    where: { tenantId: input.tenantId, active: true },
    include: { lines: true }
  });
  const year = parseInt(input.year, 10);
  const month = parseInt(input.month, 10);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const journals = [];
  for (const rule of rules) {
    if (!rule.lines.length) continue;
    const movement = await tx.journalLine.findMany({
      where: {
        accountId: rule.sourceAccountId,
        journalEntry: { tenantId: input.tenantId, isPosted: true, date: { gte: start, lt: end } }
      }
    });
    const amount = money(movement.reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0));
    if (!(amount > 0)) continue;
    const shares = allocateShares(rule.lines.map((line) => num(line.percent)), amount);
    const lines = [
      { accountId: rule.sourceAccountId, debit: 0, credit: amount, costCenterId: rule.sourceCenterId, description: rule.name }
    ];
    rule.lines.forEach((line, index) => {
      lines.push({
        accountId: rule.sourceAccountId,
        debit: shares[index],
        credit: 0,
        costCenterId: line.targetCostCenterId,
        description: rule.name
      });
    });
    const journal = await postJournal(tx, {
      tenantId: input.tenantId,
      date: new Date(Date.UTC(year, month, 0)),
      createdBy: input.createdBy,
      description: `Allocate ${rule.name}`,
      referenceType: 'ALLOCATION',
      referenceId: rule.id,
      lines
    });
    if (journal) journals.push(journal);
  }
  return journals;
}

async function closeProfitAndLoss(tx, input) {
  const year = parseInt(input.year, 10);
  const month = parseInt(input.month, 10);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const rows = await tx.journalLine.findMany({
    where: { journalEntry: { tenantId: input.tenantId, isPosted: true, date: { gte: start, lt: end } } },
    include: { account: true }
  });
  const byAccount = new Map();
  for (const line of rows) {
    if (!['REVENUE', 'EXPENSE'].includes(line.account?.type)) continue;
    if (!byAccount.has(line.accountId)) byAccount.set(line.accountId, { account: line.account, debit: 0, credit: 0 });
    const bucket = byAccount.get(line.accountId);
    bucket.debit = money(bucket.debit + num(line.debit));
    bucket.credit = money(bucket.credit + num(line.credit));
  }
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const lines = [];
  for (const bucket of byAccount.values()) {
    if (bucket.account.type === 'REVENUE') {
      const net = money(bucket.credit - bucket.debit);
      if (net > 0) lines.push({ accountId: bucket.account.id, debit: net, credit: 0, description: 'Close period' });
      if (net < 0) lines.push({ accountId: bucket.account.id, debit: 0, credit: Math.abs(net), description: 'Close period' });
    } else {
      const net = money(bucket.debit - bucket.credit);
      if (net > 0) lines.push({ accountId: bucket.account.id, debit: 0, credit: net, description: 'Close period' });
      if (net < 0) lines.push({ accountId: bucket.account.id, debit: Math.abs(net), credit: 0, description: 'Close period' });
    }
  }
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  const profit = money(debit - credit);
  if (profit > 0) lines.push({ accountId: map.RETAINED_EARNINGS, debit: 0, credit: profit, description: 'Retained earnings' });
  if (profit < 0) lines.push({ accountId: map.RETAINED_EARNINGS, debit: Math.abs(profit), credit: 0, description: 'Retained earnings' });
  return postJournal(tx, {
    tenantId: input.tenantId,
    date: new Date(Date.UTC(year, month, 0)),
    createdBy: input.createdBy,
    description: `Close profit and loss ${year}-${String(month).padStart(2, '0')}`,
    referenceType: 'PERIOD_CLOSE',
    referenceId: input.closeId,
    lines
  });
}

async function postClosingEntries(tx, input) {
  const close = await tx.periodClose.findFirst({
    where: { id: input.closeId, tenantId: input.tenantId },
    include: { steps: true }
  });
  if (!close) throw new DocumentError('Close checklist not found.', { closeId: 'Close checklist not found.' });
  if (close.status === 'HARD') throw new DocumentError('Closing entries are already posted.', { closeId: 'Closing entries are already posted.' });
  const pending = close.steps.filter((step) => step.status === 'PENDING');
  if (pending.length) {
    if (!input.exceptionReason || String(input.exceptionReason).trim().length < 3) {
      throw new DocumentError('Finish the checklist, or record why a step is still open.', { exceptionReason: 'Finish the checklist, or record why a step is still open.' });
    }
    await tx.periodClose.update({ where: { id: close.id }, data: { exceptionReason: String(input.exceptionReason).trim() } });
  }
  const dep = await tx.depreciationRun.findFirst({ where: { tenantId: input.tenantId, year: close.year, month: close.month } });
  if (!dep) {
    await runDepreciation(tx, { tenantId: input.tenantId, year: close.year, month: close.month, createdBy: input.createdBy });
  }
  await runAllocations(tx, { tenantId: input.tenantId, year: close.year, month: close.month, createdBy: input.createdBy });
  await closeProfitAndLoss(tx, { tenantId: input.tenantId, year: close.year, month: close.month, createdBy: input.createdBy, closeId: close.id });
  return tx.periodClose.update({
    where: { id: close.id },
    data: { status: 'HARD' },
    include: { steps: { orderBy: { sequence: 'asc' } } }
  });
}

async function saveAllocationRule(tx, input) {
  if (!input.name) throw new DocumentError('Name the allocation.', { name: 'Name the allocation.' });
  if (!input.sourceAccountId) throw new DocumentError('Choose the expense account.', { sourceAccountId: 'Choose the expense account.' });
  const lines = input.lines || [];
  const total = lines.reduce((sum, line) => sum + num(line.percent), 0);
  if (Math.abs(total - 100) > 0.05) {
    throw new DocumentError('Allocation percentages must add up to 100.', { lines: 'Allocation percentages must add up to 100.' });
  }
  return tx.allocationRule.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      sourceAccountId: input.sourceAccountId,
      sourceCenterId: input.sourceCenterId || null,
      lines: {
        create: lines.map((line) => ({
          tenantId: input.tenantId,
          targetCostCenterId: line.targetCostCenterId,
          percent: dec(line.percent)
        }))
      }
    },
    include: { lines: true }
  });
}

async function postRecurring(tx, input) {
  const template = await tx.recurringJournal.findFirst({ where: { id: input.templateId, tenantId: input.tenantId } });
  if (!template || !template.active) throw new DocumentError('Recurring journal not found.', { templateId: 'Recurring journal not found.' });
  const lines = Array.isArray(template.lines) ? template.lines : [];
  if (lines.length < 2) throw new DocumentError('The template needs at least two lines.', { lines: 'The template needs at least two lines.' });
  return postJournal(tx, {
    tenantId: input.tenantId,
    date: input.date,
    createdBy: input.createdBy,
    description: template.description || template.name,
    referenceType: 'RECURRING',
    referenceId: template.id,
    lines
  });
}

module.exports = {
  STEPS,
  openPeriod,
  completeStep,
  postClosingEntries,
  saveAllocationRule,
  postRecurring,
  runAllocations
};
