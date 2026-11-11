const { DocumentError } = require('../errors');
const { num } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { getSettings, bankColumnsOf, saveSettings } = require('./settings');
const { DEFAULT_BANK_COLUMNS } = require('./defaults');

function cell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function renderCsv(columns, rows) {
  const header = columns.map((column) => cell(column.header || column.key)).join(',');
  const body = rows.map((row) => columns.map((column) => cell(row[column.key])).join(','));
  return [header, ...body].join('\n');
}

async function templateFor(db, tenantId) {
  const settings = await getSettings(db, tenantId);
  const columns = bankColumnsOf(settings);
  const existing = await db.bankFileTemplate.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.bankFileTemplate.create({
    data: { tenantId, name: 'Collection file', columns }
  });
}

async function saveTemplate(db, tenantId, input) {
  const columns = input.columns?.length ? input.columns : DEFAULT_BANK_COLUMNS;
  for (const column of columns) {
    if (!column.key || !column.header) {
      throw new DocumentError('Each column needs a key and a header.', { columns: 'Each column needs a key and a header.' });
    }
  }
  await saveSettings(db, tenantId, { bankColumns: columns });
  const current = await templateFor(db, tenantId);
  return db.bankFileTemplate.update({
    where: { id: current.id },
    data: { name: input.name || current.name, columns }
  });
}

async function exportCollections(db, input) {
  const template = await templateFor(db, input.tenantId);
  const columns = Array.isArray(template.columns) && template.columns.length ? template.columns : DEFAULT_BANK_COLUMNS;
  const where = { tenantId: input.tenantId, status: { not: 'CANCELLED' } };
  if (input.from || input.to) {
    where.date = {};
    if (input.from) where.date.gte = new Date(input.from);
    if (input.to) where.date.lte = new Date(input.to);
  }
  const receipts = await db.paymentReceipt.findMany({
    where,
    include: { customer: true, lines: { include: { invoice: true } } },
    orderBy: { date: 'asc' }
  });
  const rows = receipts.map((receipt) => ({
    date: new Date(receipt.date).toISOString().slice(0, 10),
    reference: receipt.reference || receipt.receiptNumber,
    customer: receipt.customer?.name || '',
    customerCode: receipt.customer?.code || '',
    amount: num(receipt.amount).toFixed(2),
    method: receipt.method,
    invoice: (receipt.lines || []).map((line) => line.invoice?.invoiceNumber).filter(Boolean).join(' ') || receipt.receiptNumber
  }));
  const body = renderCsv(columns, rows);
  const number = await generateDocumentNumber(input.tenantId, 'bankFileExport', 'BF', 'number', db);
  const saved = await db.bankFileExport.create({
    data: {
      tenantId: input.tenantId,
      number,
      body,
      rowCount: rows.length,
      templateId: template.id,
      createdBy: input.userId || null
    }
  });
  return { ...saved, columns };
}

module.exports = { renderCsv, templateFor, saveTemplate, exportCollections };
