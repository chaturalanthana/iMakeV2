const { DocumentError } = require('../errors');
const { money, num } = require('../money');
const { trialBalance } = require('../glService');

const CATALOG = [
  ['trial-balance', 'Trial balance', 'General ledger'],
  ['balance-sheet', 'Statement of financial position', 'General ledger'],
  ['profit-and-loss', 'Statement of profit or loss', 'General ledger'],
  ['cash-flow', 'Statement of cash flows', 'General ledger'],
  ['gl-detail', 'General ledger detail', 'General ledger'],
  ['chart-of-accounts', 'Chart of accounts', 'General ledger'],
  ['sales-register', 'Invoicing list', 'Receivables'],
  ['open-sales-orders', 'Pending delivery list', 'Receivables'],
  ['ar-aging', 'AR ageing', 'Receivables'],
  ['debtor-review', 'Debtor review and collection forecast', 'Receivables'],
  ['ar-credit-notes', 'Credit note list (AR)', 'Receivables'],
  ['sales-analysis', 'Sales analysis by item', 'Receivables'],
  ['grni', 'Goods received not invoiced', 'Payables'],
  ['ap-aging', 'AP ageing', 'Payables'],
  ['ap-credit-notes', 'Credit note list (AP)', 'Payables'],
  ['cash-requirements', 'Cash requirements', 'Payables'],
  ['purchase-analysis', 'Purchase analysis by item', 'Payables'],
  ['bank-reconciliation', 'Bank reconciliation statement', 'Cash'],
  ['cash-position', 'Daily cash position', 'Cash'],
  ['petty-cash', 'Petty cash expense', 'Cash'],
  ['cheque-register', 'Cheque register', 'Cash'],
  ['iou-list', 'IOU list and settlements', 'Cash'],
  ['stock-valuation', 'Stock movement and valuation', 'Inventory'],
  ['inventory-aging', 'Inventory ageing', 'Inventory'],
  ['stock-variance', 'Physical stock variance', 'Inventory'],
  ['production-variance', 'Production cost variance', 'Inventory'],
  ['wip', 'Work in progress valuation', 'Inventory'],
  ['budget-vs-actual', 'Budget versus actual', 'Management'],
  ['cost-center-profitability', 'Cost center profitability', 'Management'],
  ['fixed-assets', 'Fixed asset register and depreciation', 'Management'],
  ['tax-summary', 'Input and output tax', 'Management'],
  ['audit-trail', 'Posted document listing', 'Management'],
  ['landed-cost', 'Landed cost allocation', 'Management']
];

function catalog() {
  return CATALOG.map(([key, title, group]) => ({ key, title, group }));
}

function endOfDay(value) {
  if (!value) return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new DocumentError('Use a YYYY-MM-DD date.', { date: 'Use a YYYY-MM-DD date.' });
  }
  return new Date(`${text}T23:59:59.999Z`);
}

function startOfDay(value) {
  if (!value) return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new DocumentError('Use a YYYY-MM-DD date.', { date: 'Use a YYYY-MM-DD date.' });
  }
  return new Date(`${text}T00:00:00.000Z`);
}

function report(key, title, columns, rows, filters) {
  return { key, title, columns, rows, filters, count: rows.length };
}

function cols(pairs) {
  return pairs.map(([key, label]) => ({ key, label }));
}

function signed(account, debit, credit) {
  if (account.type === 'ASSET' || account.type === 'EXPENSE') return money(debit - credit);
  return money(credit - debit);
}

async function postedLines(db, tenantId, { from, to, asOf } = {}) {
  const date = {};
  if (from) date.gte = startOfDay(from);
  if (to || asOf) date.lte = endOfDay(to || asOf);
  return db.journalLine.findMany({
    where: { journalEntry: { tenantId, isPosted: true, ...(Object.keys(date).length ? { date } : {}) } },
    include: { account: true, journalEntry: true }
  });
}

function bucketDays(due, asOf) {
  const days = Math.floor((asOf - new Date(due)) / 86400000);
  if (days <= 0) return 'current';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'd120';
}

async function noteNet(db, tenantId, partyType) {
  const notes = await db.partyNote.findMany({ where: { tenantId, partyType, status: 'POSTED' } });
  const byInvoice = new Map();
  for (const note of notes) {
    if (!note.invoiceId) continue;
    const signedNote = note.kind === 'CREDIT' ? num(note.total) : -num(note.total);
    byInvoice.set(note.invoiceId, money((byInvoice.get(note.invoiceId) || 0) + signedNote));
  }
  return byInvoice;
}

async function buildReport(db, tenantId, key, query) {
  const found = CATALOG.find((row) => row[0] === key);
  if (!found) throw new DocumentError('Unknown report.', { report: 'Unknown report.' });
  const filters = { ...query };
  if (key === 'trial-balance') {
    const tb = await trialBalance(db, tenantId);
    const accounts = await db.account.findMany({ where: { tenantId } });
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const detailed = tb.accounts.map((row) => ({
      code: row.code, name: row.name, type: row.type, debit: row.debit, credit: row.credit
    }));
    if (query.view === 'summary') {
      const rolled = new Map();
      for (const row of tb.accounts) {
        let current = byId.get(row.accountId);
        const seen = new Set();
        while (current?.parentId && byId.get(current.parentId) && !seen.has(current.id)) {
          seen.add(current.id);
          current = byId.get(current.parentId);
        }
        const id = current?.id || row.accountId;
        if (!rolled.has(id)) rolled.set(id, { code: current?.code || row.code, name: current?.name || row.name, type: current?.type || row.type, debit: 0, credit: 0 });
        const target = rolled.get(id);
        target.debit = money(target.debit + row.debit);
        target.credit = money(target.credit + row.credit);
      }
      return report(key, 'Trial balance (summary)', cols([['code', 'Account code'], ['name', 'Account'], ['type', 'Type'], ['debit', 'Debit'], ['credit', 'Credit']]), [...rolled.values()], filters);
    }
    return report(key, 'Trial balance (detailed)', cols([['code', 'Account code'], ['name', 'Account'], ['type', 'Type'], ['debit', 'Debit'], ['credit', 'Credit']]), detailed, filters);
  }

  if (key === 'chart-of-accounts') {
    const accounts = await db.account.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
    return report(key, 'Chart of accounts', cols([['code', 'Code'], ['name', 'Name'], ['type', 'Type'], ['status', 'Status']]), accounts.map((account) => ({
      code: account.code, name: account.name, type: account.type, status: 'Active'
    })), filters);
  }

  if (key === 'gl-detail') {
    const lines = await postedLines(db, tenantId, query);
    return report(key, 'General ledger detail', cols([
      ['date', 'Date'], ['entry', 'Entry'], ['account', 'Account'], ['description', 'Description'], ['debit', 'Debit'], ['credit', 'Credit'], ['costCenter', 'Cost center'], ['reference', 'Reference']
    ]), lines.map((line) => ({
      date: line.journalEntry.date.toISOString().slice(0, 10),
      entry: line.journalEntry.entryNumber,
      account: `${line.account?.code || ''} ${line.account?.name || ''}`.trim(),
      description: line.description || line.journalEntry.description,
      debit: num(line.debit),
      credit: num(line.credit),
      costCenter: line.costCenterId || '',
      reference: line.journalEntry.referenceType || ''
    })), filters);
  }

  if (key === 'profit-and-loss' || key === 'balance-sheet' || key === 'cash-flow' || key === 'cost-center-profitability' || key === 'tax-summary') {
    return financialStatement(db, tenantId, key, query, filters);
  }
  if (key === 'sales-register') return salesRegister(db, tenantId, query, filters);
  if (key === 'open-sales-orders') return openOrders(db, tenantId, query, filters);
  if (key === 'ar-aging' || key === 'ap-aging') return ageing(db, tenantId, key, query, filters);
  if (key === 'debtor-review') return debtorReview(db, tenantId, query, filters);
  if (key === 'ar-credit-notes' || key === 'ap-credit-notes') return creditNotes(db, tenantId, key, query, filters);
  if (key === 'sales-analysis') return salesAnalysis(db, tenantId, query, filters);
  if (key === 'grni') return grni(db, tenantId, query, filters);
  if (key === 'cash-requirements') return cashRequirements(db, tenantId, query, filters);
  if (key === 'purchase-analysis') return purchaseAnalysis(db, tenantId, query, filters);
  if (key === 'bank-reconciliation') return bankStatement(db, tenantId, query, filters);
  if (key === 'cash-position') return cashPosition(db, tenantId, filters);
  if (key === 'petty-cash') return pettyCash(db, tenantId, query, filters);
  if (key === 'cheque-register') return cheques(db, tenantId, query, filters);
  if (key === 'iou-list') return ious(db, tenantId, query, filters);
  if (key === 'stock-valuation') return stockValuation(db, tenantId, query, filters);
  if (key === 'inventory-aging') return inventoryAging(db, tenantId, query, filters);
  if (key === 'stock-variance') return stockVariance(db, tenantId, query, filters);
  if (key === 'production-variance') return productionVariance(db, tenantId, query, filters);
  if (key === 'wip') return wip(db, tenantId, query, filters);
  if (key === 'budget-vs-actual') return budgetActual(db, tenantId, query, filters);
  if (key === 'fixed-assets') return fixedAssets(db, tenantId, filters);
  if (key === 'audit-trail') return auditListing(db, tenantId, query, filters);
  if (key === 'landed-cost') return landed(db, tenantId, query, filters);
  throw new DocumentError('Unknown report.', { report: 'Unknown report.' });
}

async function financialStatement(db, tenantId, key, query, filters) {
  const lines = await postedLines(db, tenantId, query);
  if (key === 'profit-and-loss') {
    const rows = rollup(lines, ['REVENUE', 'EXPENSE']);
    return report(key, 'Statement of profit or loss', cols([['code', 'Code'], ['name', 'Account'], ['type', 'Type'], ['amount', 'Amount LKR']]), rows, filters);
  }
  if (key === 'balance-sheet') {
    const asOf = query.asOf || query.to || new Date().toISOString().slice(0, 10);
    const current = rollup(await postedLines(db, tenantId, { asOf }), ['ASSET', 'LIABILITY', 'EQUITY']);
    let comparative = [];
    if (query.comparative === 'prior-year') {
      const prior = new Date(asOf);
      prior.setUTCFullYear(prior.getUTCFullYear() - 1);
      comparative = rollup(await postedLines(db, tenantId, { asOf: prior.toISOString().slice(0, 10) }), ['ASSET', 'LIABILITY', 'EQUITY']);
    }
    const priorByCode = new Map(comparative.map((row) => [row.code, row.amount]));
    return report(key, 'Statement of financial position', cols([['code', 'Code'], ['name', 'Account'], ['type', 'Type'], ['amount', 'Amount LKR'], ['priorAmount', 'Comparative LKR']]), current.map((row) => ({
      ...row, priorAmount: priorByCode.get(row.code) || 0
    })), filters);
  }
  if (key === 'cost-center-profitability') {
    const centers = await db.orgCenter.findMany({ where: { tenantId } });
    const byCenter = new Map(centers.map((center) => [center.id, center.name]));
    const buckets = new Map();
    for (const line of lines) {
      if (!['REVENUE', 'EXPENSE'].includes(line.account?.type)) continue;
      const id = line.costCenterId || 'unassigned';
      if (!buckets.has(id)) buckets.set(id, { center: byCenter.get(id) || 'Unassigned', income: 0, expense: 0 });
      const bucket = buckets.get(id);
      const amount = signed(line.account, num(line.debit), num(line.credit));
      if (line.account.type === 'REVENUE') bucket.income = money(bucket.income + amount);
      else bucket.expense = money(bucket.expense + amount);
    }
    return report(key, 'Cost center profitability', cols([['center', 'Cost center'], ['income', 'Income'], ['expense', 'Expense'], ['profit', 'Profit']]), [...buckets.values()].map((row) => ({
      ...row, profit: money(row.income - row.expense)
    })), filters);
  }
  if (key === 'tax-summary') {
    const mapRows = await db.glAccountMap.findMany({ where: { tenantId } });
    const map = Object.fromEntries(mapRows.map((row) => [row.key, row.accountId]));
    const totals = { outputVat: 0, inputVat: 0, sscl: 0, wht: 0 };
    for (const line of lines) {
      const credit = num(line.credit);
      const debit = num(line.debit);
      if (line.accountId === map.VAT_OUTPUT) totals.outputVat = money(totals.outputVat + credit - debit);
      if (line.accountId === map.VAT_INPUT) totals.inputVat = money(totals.inputVat + debit - credit);
      if (line.accountId === map.SSCL) totals.sscl = money(totals.sscl + credit - debit);
      if (line.accountId === map.WHT) totals.wht = money(totals.wht + credit - debit);
    }
    return report(key, 'Input and output tax', cols([['tax', 'Tax'], ['amount', 'Amount LKR']]), [
      { tax: 'Output VAT', amount: totals.outputVat },
      { tax: 'Input VAT', amount: totals.inputVat },
      { tax: 'Net VAT', amount: money(totals.outputVat - totals.inputVat) },
      { tax: 'SSCL payable', amount: totals.sscl },
      { tax: 'WHT payable', amount: totals.wht }
    ], filters);
  }
  const mapRows = await db.glAccountMap.findMany({ where: { tenantId } });
  const map = Object.fromEntries(mapRows.map((row) => [row.key, row.accountId]));
  const cashIds = new Set([map.CASH, map.BANK, map.PETTY_CASH, map.CHEQUES_IN_HAND].filter(Boolean));
  const investing = new Set([map.CWIP, map.FIXED_ASSET, map.ACCUM_DEPRECIATION].filter(Boolean));
  const buckets = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };
  const journals = new Map();
  for (const line of lines) {
    if (!journals.has(line.journalEntryId)) journals.set(line.journalEntryId, []);
    journals.get(line.journalEntryId).push(line);
  }
  for (const group of journals.values()) {
    const cashLines = group.filter((line) => cashIds.has(line.accountId));
    if (!cashLines.length) continue;
    const cashMove = cashLines.reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0);
    const other = group.find((line) => !cashIds.has(line.accountId));
    let activity = 'OPERATING';
    if (other && investing.has(other.accountId)) activity = 'INVESTING';
    else if (other?.account?.type === 'EQUITY') activity = 'FINANCING';
    buckets[activity] = money(buckets[activity] + cashMove);
  }
  return report(key, 'Statement of cash flows', cols([['activity', 'Activity'], ['amount', 'Amount LKR']]), [
    { activity: 'Operating', amount: buckets.OPERATING },
    { activity: 'Investing', amount: buckets.INVESTING },
    { activity: 'Financing', amount: buckets.FINANCING },
    { activity: 'Net change in cash', amount: money(buckets.OPERATING + buckets.INVESTING + buckets.FINANCING) }
  ], filters);
}

function rollup(lines, types) {
  const buckets = new Map();
  for (const line of lines) {
    if (!types.includes(line.account?.type)) continue;
    if (!buckets.has(line.accountId)) buckets.set(line.accountId, { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0 });
    const bucket = buckets.get(line.accountId);
    bucket.debit = money(bucket.debit + num(line.debit));
    bucket.credit = money(bucket.credit + num(line.credit));
  }
  return [...buckets.values()].map((row) => ({
    code: row.code, name: row.name, type: row.type, amount: signed(row, row.debit, row.credit)
  })).sort((a, b) => a.code.localeCompare(b.code));
}

async function salesRegister(db, tenantId, query, filters) {
  const invoices = await db.salesInvoice.findMany({
    where: { tenantId, ...(query.customerId ? { customerId: query.customerId } : {}) },
    include: { customer: true }
  });
  const rows = invoices.filter((invoice) => inRange(invoice.date, query) && (!query.status || invoice.status === query.status)).map((invoice) => ({
    date: invoice.date.toISOString().slice(0, 10),
    number: invoice.invoiceNumber,
    customer: invoice.customer?.name || '',
    customerId: invoice.customerId,
    gross: num(invoice.subtotal) || num(invoice.total),
    tax: num(invoice.taxAmount),
    net: num(invoice.total),
    due: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '',
    status: invoice.status
  }));
  return report('sales-register', 'Invoicing list', cols([
    ['date', 'Invoice date'], ['number', 'Invoice number'], ['customer', 'Customer'], ['gross', 'Gross amount'], ['tax', 'Tax'], ['net', 'Net amount'], ['due', 'Due date'], ['status', 'Status']
  ]), rows, filters);
}

async function openOrders(db, tenantId, query, filters) {
  const orders = await db.salesOrder.findMany({
    where: { tenantId, status: { not: 'CANCELLED' }, ...(query.customerId ? { customerId: query.customerId } : {}) },
    include: { customer: true, items: { include: { product: true } }, deliveries: { include: { items: true } } }
  });
  const rows = [];
  for (const order of orders) {
    for (const item of order.items) {
      const delivered = order.deliveries.reduce((sum, delivery) => sum + delivery.items.filter((row) => row.productId === item.productId).reduce((inner, row) => inner + num(row.quantity), 0), 0);
      const pending = money(num(item.quantity) - delivered);
      if (pending <= 0) continue;
      rows.push({
        number: order.orderNumber,
        date: order.date.toISOString().slice(0, 10),
        customer: order.customer?.name || '',
        item: item.product?.name || '',
        ordered: num(item.quantity),
        delivered,
        pending,
        expected: ''
      });
    }
  }
  return report('open-sales-orders', 'Pending delivery list', cols([
    ['number', 'Sales order'], ['date', 'Order date'], ['customer', 'Customer'], ['item', 'Item'], ['ordered', 'Ordered'], ['delivered', 'Delivered'], ['pending', 'Pending'], ['expected', 'Expected dispatch']
  ]), rows, filters);
}

async function ageing(db, tenantId, key, query, filters) {
  const asOf = endOfDay(query.asOf || new Date().toISOString().slice(0, 10));
  const customerSide = key === 'ar-aging';
  const documents = customerSide
    ? await db.salesInvoice.findMany({ where: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }, include: { customer: true } })
    : await db.supplierInvoice.findMany({ where: { tenantId, status: { not: 'CANCELLED' } }, include: { supplier: true } });
  const notes = await noteNet(db, tenantId, customerSide ? 'CUSTOMER' : 'SUPPLIER');
  const parties = new Map();
  const detail = [];
  for (const document of documents) {
    if (new Date(document.date) > asOf) continue;
    const outstanding = money(num(document.total) - num(document.amountPaid) - (notes.get(document.id) || 0));
    if (Math.abs(outstanding) < 0.0001) continue;
    const name = customerSide ? document.customer?.name : document.supplier?.name;
    const partyId = customerSide ? document.customerId : document.supplierId;
    if (query.customerId && partyId !== query.customerId) continue;
    if (query.supplierId && partyId !== query.supplierId) continue;
    const slot = bucketDays(document.dueDate || document.date, asOf);
    if (!parties.has(partyId)) parties.set(partyId, { name, current: 0, d30: 0, d60: 0, d90: 0, d120: 0, total: 0 });
    const row = parties.get(partyId);
    row[slot] = money(row[slot] + outstanding);
    row.total = money(row.total + outstanding);
    detail.push({ name, number: document.invoiceNumber, due: (document.dueDate || document.date).toISOString().slice(0, 10), bucket: slot, amount: outstanding });
  }
  if (!customerSide) {
    for (const row of parties.values()) row.d90 = money(row.d90 + row.d120);
  }
  const columns = customerSide
    ? cols([['name', 'Customer'], ['current', 'Current'], ['d30', '30 days'], ['d60', '60 days'], ['d90', '90 days'], ['d120', '120+ days'], ['total', 'Total']])
    : cols([['name', 'Vendor'], ['current', 'Current'], ['d30', '30 days'], ['d60', '60 days'], ['d90', '90+ days'], ['total', 'Total']]);
  const rows = query.view === 'detail' ? detail : [...parties.values()];
  return report(key, customerSide ? 'AR ageing' : 'AP ageing', query.view === 'detail'
    ? cols([['name', 'Name'], ['number', 'Invoice'], ['due', 'Due'], ['bucket', 'Bucket'], ['amount', 'Amount']])
    : columns, rows, filters);
}

async function debtorReview(db, tenantId, query, filters) {
  const ageingReport = await ageing(db, tenantId, 'ar-aging', query, filters);
  const cases = await db.collectionCase.findMany({ where: { tenantId } });
  const byCustomer = new Map(cases.map((row) => [row.customerId, row]));
  const customers = await db.customer.findMany({ where: { tenantId } });
  const byName = new Map(customers.map((row) => [row.name, row]));
  const rows = ageingReport.rows.map((row) => {
    const customer = byName.get(row.name);
    const collection = customer ? byCustomer.get(customer.id) : null;
    return {
      customer: row.name,
      outstanding: row.total,
      promised: collection?.promisedDate ? collection.promisedDate.toISOString().slice(0, 10) : '',
      lastContact: collection?.lastContact ? collection.lastContact.toISOString().slice(0, 10) : '',
      dispute: collection?.disputeStatus || 'NONE',
      notes: collection?.notes || ''
    };
  });
  return report('debtor-review', 'Debtor review and collection forecast', cols([
    ['customer', 'Customer'], ['outstanding', 'Outstanding'], ['promised', 'Promised date'], ['lastContact', 'Last contact'], ['dispute', 'Dispute'], ['notes', 'Notes']
  ]), rows, filters);
}

async function creditNotes(db, tenantId, key, query, filters) {
  const partyType = key === 'ar-credit-notes' ? 'CUSTOMER' : 'SUPPLIER';
  const notes = await db.partyNote.findMany({ where: { tenantId, partyType, kind: 'CREDIT' } });
  const ids = notes.map((note) => note.partyId);
  const parties = partyType === 'CUSTOMER'
    ? await db.customer.findMany({ where: { id: { in: ids } } })
    : await db.supplier.findMany({ where: { id: { in: ids } } });
  const names = new Map(parties.map((party) => [party.id, party.name]));
  const rows = notes.filter((note) => inRange(note.date, query) && (!query.reasonCode || note.reasonCode === query.reasonCode)).map((note) => ({
    date: note.date.toISOString().slice(0, 10),
    number: note.noteNumber,
    party: names.get(note.partyId) || '',
    invoice: note.invoiceNumber || '',
    reason: note.reasonCode,
    amount: num(note.total),
    tax: num(note.taxAmount)
  }));
  return report(key, partyType === 'CUSTOMER' ? 'Credit note list (AR)' : 'Credit note list (AP)', cols([
    ['date', 'Date'], ['number', 'Number'], ['party', partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'], ['invoice', 'Original invoice'], ['reason', 'Reason'], ['amount', 'Amount'], ['tax', 'Tax adjustment']
  ]), rows, filters);
}

async function salesAnalysis(db, tenantId, query, filters) {
  const invoices = await db.salesInvoice.findMany({
    where: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] }, ...(query.customerId ? { customerId: query.customerId } : {}) },
    include: { items: { include: { product: true } }, delivery: { include: { items: true } } }
  });
  const buckets = new Map();
  for (const invoice of invoices) {
    if (!inRange(invoice.date, query)) continue;
    for (const item of invoice.items) {
      if (!buckets.has(item.productId)) buckets.set(item.productId, { code: item.product?.code || '', name: item.product?.name || '', qty: 0, gross: 0, discount: 0, net: 0, cogs: 0 });
      const row = buckets.get(item.productId);
      row.qty = money(row.qty + num(item.quantity));
      row.gross = money(row.gross + num(item.quantity) * num(item.unitPrice));
      row.net = money(row.net + num(item.total));
      const delivered = invoice.delivery?.items?.find((line) => line.productId === item.productId);
      const cost = delivered ? num(delivered.costValue) : num(item.product?.costPrice) * num(item.quantity);
      row.cogs = money(row.cogs + cost);
    }
  }
  return report('sales-analysis', 'Sales analysis by item', cols([
    ['code', 'Item code'], ['name', 'Description'], ['qty', 'Quantity sold'], ['gross', 'Gross sales'], ['discount', 'Discount'], ['net', 'Net sales'], ['cogs', 'COGS'], ['profit', 'Gross profit'], ['margin', 'Margin %']
  ]), [...buckets.values()].map((row) => ({
    ...row,
    profit: money(row.net - row.cogs),
    margin: row.net ? money(((row.net - row.cogs) / row.net) * 100) : 0
  })), filters);
}

async function grni(db, tenantId, query, filters) {
  const grns = await db.gRN.findMany({
    where: { tenantId, status: { not: 'CANCELLED' } },
    include: { supplier: true, purchaseOrder: true, items: { include: { product: true } } }
  });
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, status: { not: 'CANCELLED' } },
    include: { items: true }
  });
  const rows = [];
  for (const grn of grns) {
    if (!inRange(grn.date, query)) continue;
    if (query.supplierId && grn.supplierId !== query.supplierId) continue;
    const matched = invoices.filter((invoice) => invoice.grnId === grn.id);
    for (const item of grn.items) {
      const invoiced = matched.reduce((sum, invoice) => sum + invoice.items.filter((line) => line.productId === item.productId).reduce((inner, line) => inner + num(line.quantity), 0), 0);
      const open = money(num(item.quantityReceived) - invoiced);
      const status = open > 0.0001 ? 'Pending' : 'Matched';
      if (query.matchStatus === 'Pending' && status !== 'Pending') continue;
      if (query.matchStatus === 'Matched' && status !== 'Matched') continue;
      rows.push({
        grn: grn.grnNumber,
        date: grn.date.toISOString().slice(0, 10),
        supplier: grn.supplier?.name || '',
        po: grn.purchaseOrder?.poNumber || '',
        item: item.product?.name || '',
        quantity: num(item.quantityReceived),
        value: money(num(item.quantityReceived) * num(item.unitPrice) * (num(grn.exchangeRate) || 1)),
        status
      });
    }
  }
  return report('grni', 'Goods received not invoiced', cols([
    ['grn', 'GRN'], ['date', 'Date received'], ['supplier', 'Supplier'], ['po', 'PO'], ['item', 'Item'], ['quantity', 'Quantity'], ['value', 'Estimated value'], ['status', 'Invoice status']
  ]), rows, filters);
}

async function cashRequirements(db, tenantId, query, filters) {
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, status: { in: ['UNPAID', 'PARTIAL'] }, ...(query.supplierId ? { supplierId: query.supplierId } : {}) },
    include: { supplier: true }
  });
  const today = startOfDay(new Date().toISOString().slice(0, 10));
  const horizon = new Date(today.getTime() + 28 * 86400000);
  const rows = invoices.filter((invoice) => {
    const due = invoice.dueDate || invoice.date;
    if (query.from && new Date(due) < startOfDay(query.from)) return false;
    if (query.to && new Date(due) > endOfDay(query.to)) return false;
    if (!query.from && !query.to && new Date(due) > horizon) return false;
    return true;
  }).map((invoice) => {
    const due = invoice.dueDate || invoice.date;
    const soon = new Date(due) <= new Date(today.getTime() + 7 * 86400000);
    return {
      vendor: invoice.supplier?.name || '',
      due: due.toISOString().slice(0, 10),
      amount: money(num(invoice.total) - num(invoice.amountPaid)),
      priority: soon ? 'High' : 'Normal'
    };
  });
  return report('cash-requirements', 'Cash requirements', cols([['vendor', 'Vendor'], ['due', 'Due date'], ['amount', 'Amount due'], ['priority', 'Priority']]), rows, filters);
}

async function purchaseAnalysis(db, tenantId, query, filters) {
  const grns = await db.gRN.findMany({
    where: { tenantId, status: { not: 'CANCELLED' }, ...(query.supplierId ? { supplierId: query.supplierId } : {}) },
    include: { supplier: true, items: { include: { product: true } } }
  });
  const buckets = new Map();
  for (const grn of grns) {
    if (!inRange(grn.date, query)) continue;
    for (const item of grn.items) {
      if (!buckets.has(item.productId)) buckets.set(item.productId, { code: item.product?.code || '', name: item.product?.name || '', qty: 0, value: 0, suppliers: new Map() });
      const row = buckets.get(item.productId);
      const value = money(num(item.quantityReceived) * num(item.unitPrice) * (num(grn.exchangeRate) || 1));
      row.qty = money(row.qty + num(item.quantityReceived));
      row.value = money(row.value + value);
      row.suppliers.set(grn.supplier?.name || '', (row.suppliers.get(grn.supplier?.name || '') || 0) + value);
    }
  }
  return report('purchase-analysis', 'Purchase analysis by item', cols([
    ['code', 'Item code'], ['name', 'Description'], ['qty', 'Quantity'], ['average', 'Average unit cost'], ['value', 'Purchase value'], ['vendor', 'Primary vendor']
  ]), [...buckets.values()].map((row) => ({
    code: row.code,
    name: row.name,
    qty: row.qty,
    average: row.qty ? money(row.value / row.qty) : 0,
    value: row.value,
    vendor: [...row.suppliers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  })), filters);
}

async function bankStatement(db, tenantId, query, filters) {
  const accountId = query.accountId;
  const reconciliations = await db.bankReconciliation.findMany({
    where: { tenantId, ...(accountId ? { accountId } : {}) },
    include: { statementLines: true, matches: true, account: true },
    orderBy: { endDate: 'desc' }
  });
  const recon = query.reconciliationId ? reconciliations.find((row) => row.id === query.reconciliationId) : reconciliations[0];
  if (!recon) {
    return report('bank-reconciliation', 'Bank reconciliation statement', cols([['item', 'Item'], ['amount', 'Amount']]), [], filters);
  }
  const matched = new Set(recon.matches.map((row) => row.statementLineId));
  const rows = [
    { item: 'Statement closing balance', amount: num(recon.statementClosingBalance) },
    { item: 'Ledger closing balance', amount: num(recon.ledgerClosingBalance) },
    { item: 'Difference', amount: money(num(recon.statementClosingBalance) - num(recon.ledgerClosingBalance)) }
  ];
  for (const line of recon.statementLines) {
    if (matched.has(line.id)) continue;
    rows.push({ item: `Unmatched statement ${line.reference || line.description || ''}`.trim(), amount: num(line.amount) });
  }
  return report('bank-reconciliation', 'Bank reconciliation statement', cols([['item', 'Item'], ['amount', 'Amount']]), rows, filters);
}

async function cashPosition(db, tenantId, filters) {
  const maps = await db.glAccountMap.findMany({ where: { tenantId, key: { in: ['CASH', 'BANK', 'PETTY_CASH', 'CHEQUES_IN_HAND'] } }, include: { account: true } });
  const lines = await postedLines(db, tenantId, {});
  const rows = maps.map((row) => {
    const amount = lines.filter((line) => line.accountId === row.accountId).reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0);
    return { account: `${row.account.code} ${row.account.name}`, key: row.key, amount: money(amount) };
  });
  rows.push({ account: 'Total liquid funds', key: 'TOTAL', amount: money(rows.reduce((sum, row) => sum + row.amount, 0)) });
  return report('cash-position', 'Daily cash position', cols([['account', 'Account'], ['key', 'Key'], ['amount', 'Balance LKR']]), rows, filters);
}

async function pettyCash(db, tenantId, query, filters) {
  const rows = await db.iouSettlement.findMany({ where: { tenantId, kind: 'EXPENSE' }, include: { iou: true } });
  return report('petty-cash', 'Petty cash expense', cols([['date', 'Date'], ['iou', 'IOU'], ['employee', 'Employee'], ['description', 'Description'], ['amount', 'Amount']]), rows.filter((row) => inRange(row.date, query)).map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    iou: row.iou?.reference || '',
    employee: row.iou?.employeeName || '',
    description: row.description || '',
    amount: num(row.amount)
  })), filters);
}

async function cheques(db, tenantId, query, filters) {
  const rows = await db.cheque.findMany({ where: { tenantId, ...(query.status ? { status: query.status } : {}), ...(query.bankAccountId ? { bankAccountId: query.bankAccountId } : {}) } });
  return report('cheque-register', 'Cheque register', cols([
    ['date', 'Cheque date'], ['number', 'Cheque number'], ['payee', 'Payee'], ['direction', 'Direction'], ['amount', 'Amount'], ['bank', 'Bank account'], ['status', 'Status']
  ]), rows.filter((row) => inRange(row.chequeDate, query)).map((row) => ({
    date: row.chequeDate.toISOString().slice(0, 10),
    number: row.chequeNumber,
    payee: row.payee,
    direction: row.direction,
    amount: num(row.amount),
    bank: row.bankAccountId || '',
    status: row.status
  })), filters);
}

async function ious(db, tenantId, query, filters) {
  const rows = await db.iouAdvance.findMany({ where: { tenantId, ...(query.status ? { status: query.status } : {}) }, include: { settlements: true } });
  return report('iou-list', 'IOU list and settlements', cols([
    ['date', 'IOU date'], ['reference', 'Reference'], ['employee', 'Employee'], ['department', 'Department'], ['advance', 'Advance'], ['settled', 'Settled'], ['outstanding', 'Outstanding'], ['status', 'Status']
  ]), rows.filter((row) => inRange(row.date, query)).map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    reference: row.reference,
    employee: row.employeeName,
    department: row.department || '',
    advance: num(row.amount),
    settled: num(row.settled),
    outstanding: money(num(row.amount) - num(row.settled)),
    status: row.status
  })), filters);
}

function inRange(date, query) {
  if (query.from && new Date(date) < startOfDay(query.from)) return false;
  if (query.to && new Date(date) > endOfDay(query.to)) return false;
  return true;
}

async function stockValuation(db, tenantId, query, filters) {
  const products = await db.product.findMany({ where: { tenantId } });
  const movements = await db.stockMovement.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  const from = query.from ? startOfDay(query.from) : null;
  const to = query.to ? endOfDay(query.to) : null;
  const rows = products.map((product) => {
    const mine = movements.filter((row) => row.productId === product.id && (!query.warehouseId || row.warehouseId === query.warehouseId));
    const opening = fifoState(mine.filter((row) => from && new Date(row.createdAt) < from));
    const period = mine.filter((row) => (!from || new Date(row.createdAt) >= from) && (!to || new Date(row.createdAt) <= to));
    const closing = fifoState(mine.filter((row) => !to || new Date(row.createdAt) <= to));
    const received = period.filter((row) => row.type !== 'GI').reduce((sum, row) => sum + Math.abs(num(row.quantity)), 0);
    const issued = period.filter((row) => row.type === 'GI').reduce((sum, row) => sum + Math.abs(num(row.quantity)), 0);
    return {
      code: product.code,
      name: product.name,
      uom: '',
      openingQty: opening.qty,
      received,
      issued,
      closingQty: closing.qty,
      unitCost: closing.qty ? money(closing.value / closing.qty) : 0,
      value: closing.value
    };
  }).filter((row) => row.openingQty || row.received || row.issued || row.closingQty);
  return report('stock-valuation', 'Stock movement and valuation', cols([
    ['code', 'Item code'], ['name', 'Description'], ['openingQty', 'Opening qty'], ['received', 'Received'], ['issued', 'Issued'], ['closingQty', 'Closing qty'], ['unitCost', 'Unit cost'], ['value', 'Total value']
  ]), rows, filters);
}

function fifoState(movements) {
  const layers = [];
  for (const movement of movements) {
    const qty = Math.abs(num(movement.quantity));
    if (movement.type === 'GI') {
      let left = qty;
      while (left > 0.0000001 && layers.length) {
        const take = Math.min(left, layers[0].qty);
        layers[0].qty = money(layers[0].qty - take);
        left = money(left - take);
        if (layers[0].qty <= 0.0000001) layers.shift();
      }
    } else {
      layers.push({ qty, unit: num(movement.unitCost) });
    }
  }
  const qty = money(layers.reduce((sum, layer) => sum + layer.qty, 0));
  const value = money(layers.reduce((sum, layer) => sum + layer.qty * layer.unit, 0));
  return { qty, value };
}

async function inventoryAging(db, tenantId, query, filters) {
  const asOf = endOfDay(query.asOf || new Date().toISOString().slice(0, 10));
  const layers = await db.costLayer.findMany({ where: { tenantId, quantityRemaining: { gt: 0 } }, include: { product: true } });
  const buckets = new Map();
  for (const layer of layers) {
    if (query.warehouseId && layer.warehouseId !== query.warehouseId) continue;
    const age = Math.floor((asOf - new Date(layer.receivedAt)) / 86400000);
    const slot = age <= 30 ? 'd30' : age <= 90 ? 'd90' : age <= 180 ? 'd180' : 'd181';
    if (!buckets.has(layer.productId)) buckets.set(layer.productId, { code: layer.product?.code || '', name: layer.product?.name || '', qty: 0, value: 0, d30: 0, d90: 0, d180: 0, d181: 0 });
    const row = buckets.get(layer.productId);
    const value = money(num(layer.quantityRemaining) * num(layer.unitCost));
    row.qty = money(row.qty + num(layer.quantityRemaining));
    row.value = money(row.value + value);
    row[slot] = money(row[slot] + value);
  }
  return report('inventory-aging', 'Inventory ageing', cols([
    ['code', 'Item code'], ['name', 'Description'], ['qty', 'Qty on hand'], ['value', 'Total value'], ['d30', '0-30'], ['d90', '31-90'], ['d180', '91-180'], ['d181', '180+']
  ]), [...buckets.values()], filters);
}

async function stockVariance(db, tenantId, query, filters) {
  const adjustments = await db.stockAdjustment.findMany({
    where: { tenantId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}) },
    include: { items: { include: { product: true } } }
  });
  const rows = [];
  for (const adjustment of adjustments) {
    if (!inRange(adjustment.date, query)) continue;
    for (const item of adjustment.items) {
      rows.push({
        code: item.product?.code || '',
        system: num(item.systemQty),
        counted: num(item.actualQty),
        varianceQty: num(item.diffQty),
        unitCost: num(item.unitPrice),
        varianceValue: num(item.total),
        reason: adjustment.reason || ''
      });
    }
  }
  return report('stock-variance', 'Physical stock variance', cols([
    ['code', 'Item code'], ['system', 'System qty'], ['counted', 'Physical qty'], ['varianceQty', 'Variance qty'], ['unitCost', 'Unit cost'], ['varianceValue', 'Variance value'], ['reason', 'Reason']
  ]), rows, filters);
}

async function productionVariance(db, tenantId, query, filters) {
  const orders = await db.workOrder.findMany({ where: { tenantId }, include: { product: true } });
  const rows = [];
  for (const order of orders) {
    if (query.from && order.createdAt < startOfDay(query.from)) continue;
    if (query.to && order.createdAt > endOfDay(query.to)) continue;
    const pairs = [
      ['Material', num(order.plannedMaterialCost), num(order.actualMaterialCost)],
      ['Labour', num(order.plannedLabourCost), num(order.actualLabourCost)],
      ['Overhead', num(order.plannedOverheadCost), num(order.actualOverheadCost)]
    ];
    for (const [type, standard, actual] of pairs) {
      const variance = money(actual - standard);
      rows.push({
        order: order.orderNumber,
        item: order.product?.code || '',
        type,
        standard,
        actual,
        variance,
        percent: standard ? money((variance / standard) * 100) : 0
      });
    }
  }
  return report('production-variance', 'Production cost variance', cols([
    ['order', 'Production order'], ['item', 'Finished good'], ['type', 'Cost type'], ['standard', 'Standard'], ['actual', 'Actual'], ['variance', 'Variance'], ['percent', 'Variance %']
  ]), rows, filters);
}

async function wip(db, tenantId, query, filters) {
  const orders = await db.workOrder.findMany({
    where: { tenantId, status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] } },
    include: { product: true }
  });
  return report('wip', 'Work in progress valuation', cols([
    ['order', 'Production order'], ['item', 'Item'], ['stage', 'Stage'], ['material', 'Material'], ['conversion', 'Labour and overhead'], ['total', 'WIP value']
  ]), orders.map((order) => ({
    order: order.orderNumber,
    item: order.product?.name || '',
    stage: order.status,
    material: num(order.actualMaterialCost),
    conversion: money(num(order.actualLabourCost) + num(order.actualOverheadCost)),
    total: money(num(order.actualMaterialCost) + num(order.actualLabourCost) + num(order.actualOverheadCost))
  })), filters);
}

async function budgetActual(db, tenantId, query, filters) {
  const year = query.year ? parseInt(query.year, 10) : new Date().getUTCFullYear();
  const budgets = await db.budget.findMany({ where: { tenantId, year } });
  const centers = await db.orgCenter.findMany({ where: { tenantId } });
  const accounts = await db.account.findMany({ where: { tenantId } });
  const centerName = new Map(centers.map((row) => [row.id, row.name]));
  const accountName = new Map(accounts.map((row) => [row.id, `${row.code} ${row.name}`]));
  const lines = await postedLines(db, tenantId, { from: `${year}-01-01`, to: `${year}-12-31` });
  const rows = budgets.map((budget) => {
    const actual = lines.filter((line) => line.accountId === budget.accountId && (!budget.costCenterId || line.costCenterId === budget.costCenterId))
      .reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0);
    return {
      account: accountName.get(budget.accountId) || budget.capitalProjectId || '',
      center: centerName.get(budget.costCenterId) || '',
      kind: budget.kind,
      budget: num(budget.amount),
      actual: money(actual),
      variance: money(actual - num(budget.amount))
    };
  });
  return report('budget-vs-actual', 'Budget versus actual', cols([
    ['account', 'Account'], ['center', 'Cost center'], ['kind', 'Kind'], ['budget', 'Budget'], ['actual', 'Actual'], ['variance', 'Variance']
  ]), rows, filters);
}

async function fixedAssets(db, tenantId, filters) {
  const assets = await db.fixedAsset.findMany({ where: { tenantId }, include: { assetClass: true, lines: true } });
  return report('fixed-assets', 'Fixed asset register and depreciation', cols([
    ['code', 'Code'], ['name', 'Name'], ['className', 'Class'], ['status', 'Status'], ['cost', 'Cost'], ['accum', 'Accumulated depreciation'], ['nbv', 'Accounting NBV'], ['taxNbv', 'Tax NBV'], ['method', 'Accounting method']
  ]), assets.map((asset) => ({
    code: asset.code,
    name: asset.name,
    className: asset.assetClass?.name || '',
    status: asset.status,
    cost: num(asset.cost),
    accum: num(asset.accumDepreciation),
    nbv: num(asset.accountingNbv),
    taxNbv: num(asset.taxNbv),
    method: asset.assetClass?.accountingMethod || ''
  })), filters);
}

async function auditListing(db, tenantId, query, filters) {
  const journals = await db.journalEntry.findMany({ where: { tenantId, isPosted: true } });
  const notes = await db.partyNote.findMany({ where: { tenantId } });
  const events = await db.assetEvent.findMany({ where: { tenantId } });
  const rows = [
    ...journals.filter((row) => inRange(row.date, query)).map((row) => ({ date: row.date.toISOString().slice(0, 10), document: row.referenceType || 'JOURNAL', number: row.entryNumber, action: 'Posted', reference: row.description })),
    ...notes.filter((row) => inRange(row.date, query)).map((row) => ({ date: row.date.toISOString().slice(0, 10), document: 'PARTY_NOTE', number: row.noteNumber, action: row.kind, reference: row.reasonCode })),
    ...events.filter((row) => inRange(row.date, query)).map((row) => ({ date: row.date.toISOString().slice(0, 10), document: 'ASSET', number: row.type, action: row.type, reference: row.notes || '' }))
  ];
  return report('audit-trail', 'Posted document listing', cols([['date', 'Date'], ['document', 'Document'], ['number', 'Number'], ['action', 'Action'], ['reference', 'Reference']]), rows, filters);
}

async function landed(db, tenantId, query, filters) {
  const docs = await db.landedCost.findMany({ where: { tenantId }, include: { charges: true, allocations: true } });
  const rows = [];
  for (const doc of docs) {
    if (!inRange(doc.date, query)) continue;
    for (const line of doc.allocations) {
      rows.push({
        number: doc.number,
        date: doc.date.toISOString().slice(0, 10),
        grn: doc.grnId,
        basis: doc.basis,
        grnRate: num(doc.grnExchangeRate),
        product: line.productId,
        allocated: num(line.allocatedBase),
        inventory: num(line.inventoryAmount),
        cogs: num(line.cogsAmount),
        fx: num(line.fxAmount),
        charges: doc.charges.map((charge) => charge.kind).join(', ')
      });
    }
  }
  return report('landed-cost', 'Landed cost allocation', cols([
    ['number', 'Document'], ['date', 'Date'], ['basis', 'Basis'], ['grnRate', 'GRN rate'], ['allocated', 'Allocated at GRN rate'], ['inventory', 'To stock or CWIP'], ['cogs', 'To COGS'], ['fx', 'FX difference'], ['charges', 'Charges']
  ]), rows, filters);
}

module.exports = { catalog, buildReport };
