const { randomUUID } = require('crypto');
const { parseSpreadsheet, toCsv, toXlsx } = require('./spreadsheet');
const { postReceiptDocument } = require('./documentPosting');
const { ensureGlMap, postJournal } = require('./glService');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { num, money, dec } = require('./money');

const TEMPLATES = {
  products: ['code', 'name', 'type', 'costPrice', 'sellingPrice', 'reorderLevel', 'safetyStock', 'bomApplicable', 'supplierCode'],
  customers: ['code', 'name', 'email', 'phone', 'address', 'creditLimit'],
  suppliers: ['code', 'name', 'email', 'phone', 'address', 'leadTime', 'taxGroup', 'withholdingTaxGroup'],
  boms: ['productCode', 'version', 'componentCode', 'quantity', 'scrapPercent'],
  workstations: ['code', 'name', 'hourlyRate', 'capacity', 'efficiency'],
  'opening-stock': ['productCode', 'warehouseCode', 'quantity', 'unitCost', 'lotNumber'],
  'opening-ar': ['customerCode', 'amount', 'date', 'reference'],
  'opening-ap': ['supplierCode', 'amount', 'date', 'reference']
};

const MODULES = {
  products: 'products',
  customers: 'sales',
  suppliers: 'procurement',
  boms: 'production',
  workstations: 'production',
  'opening-stock': 'warehouse',
  'opening-ar': 'finance',
  'opening-ap': 'finance'
};

function fieldError(row, field, message) {
  return { row, field, message };
}

function text(record, key) {
  return String(record[key] == null ? '' : record[key]).trim();
}

function optionalNumber(record, key, row, errors, { integer = false, required = false } = {}) {
  const raw = text(record, key);
  if (!raw) {
    if (required) errors.push(fieldError(row, key, `${key} is required.`));
    return required ? null : 0;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    errors.push(fieldError(row, key, `${key} must be a number that is zero or greater.`));
    return null;
  }
  return integer ? Math.round(value) : money(value);
}

function requiredText(record, key, row, errors) {
  const value = text(record, key);
  if (!value) errors.push(fieldError(row, key, `${key} is required.`));
  return value;
}

function boolValue(record, key) {
  const value = text(record, key).toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(value);
}

function parseDate(record, key, row, errors) {
  const value = text(record, key);
  if (!value) {
    errors.push(fieldError(row, key, `${key} is required.`));
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    errors.push(fieldError(row, key, `${key} must be a date in YYYY-MM-DD.`));
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function template(entity, format) {
  const headers = TEMPLATES[entity];
  if (!headers) return null;
  const sample = Object.fromEntries(headers.map((header) => [header, '']));
  if (format === 'xlsx') {
    return { body: toXlsx(headers, [sample]), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${entity}-template.xlsx` };
  }
  return { body: toCsv(headers, [sample]), type: 'text/csv; charset=utf-8', filename: `${entity}-template.csv` };
}

function readRows(file) {
  if (!file || !file.buffer) {
    const error = new Error('Choose a CSV or Excel file.');
    error.status = 400;
    throw error;
  }
  let records;
  try {
    records = parseSpreadsheet(file.buffer, file.originalname || '');
  } catch (error) {
    const failed = new Error(error.message || 'Could not read that spreadsheet.');
    failed.status = 400;
    throw failed;
  }
  if (!records.length) {
    const error = new Error('The file has no data rows.');
    error.status = 400;
    throw error;
  }
  if (records.length > 2000) {
    const error = new Error('Import 2000 rows or fewer at a time.');
    error.status = 400;
    throw error;
  }
  return records.map((record) => {
    const normalized = {};
    Object.keys(record).forEach((key) => {
      normalized[key.trim()] = record[key];
    });
    return normalized;
  });
}

async function importProducts(tx, tenantId, userId, records) {
  const errors = [];
  const seen = new Set();
  const rows = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const row = index + 2;
    const code = requiredText(record, 'code', row, errors);
    const name = requiredText(record, 'name', row, errors);
    const type = text(record, 'type') || 'PRODUCT';
    if (type && !['PRODUCT', 'SERVICE'].includes(type.toUpperCase())) {
      errors.push(fieldError(row, 'type', 'type must be PRODUCT or SERVICE.'));
    }
    const costPrice = optionalNumber(record, 'costPrice', row, errors);
    const sellingPrice = optionalNumber(record, 'sellingPrice', row, errors);
    const reorderLevel = optionalNumber(record, 'reorderLevel', row, errors, { integer: true });
    const safetyStock = optionalNumber(record, 'safetyStock', row, errors, { integer: true });
    const supplierCode = text(record, 'supplierCode');
    if (code) {
      const key = code.toLowerCase();
      if (seen.has(key)) errors.push(fieldError(row, 'code', `code ${code} is repeated in this file.`));
      seen.add(key);
    }
    rows.push({ row, code, name, type: type.toUpperCase(), costPrice, sellingPrice, reorderLevel, safetyStock, bomApplicable: boolValue(record, 'bomApplicable'), supplierCode });
  }
  if (errors.length) return { created: 0, errors };
  let created = 0;
  for (const row of rows) {
    const existing = await tx.product.findFirst({ where: { tenantId, code: { equals: row.code, mode: 'insensitive' } } });
    if (existing) {
      errors.push(fieldError(row.row, 'code', `Product ${row.code} already exists.`));
      continue;
    }
    let supplierId = null;
    if (row.supplierCode) {
      const supplier = await tx.supplier.findFirst({ where: { tenantId, code: { equals: row.supplierCode, mode: 'insensitive' } } });
      if (!supplier) errors.push(fieldError(row.row, 'supplierCode', `Supplier ${row.supplierCode} was not found.`));
      else supplierId = supplier.id;
    }
    if (errors.length) continue;
    await tx.product.create({
      data: {
        tenantId,
        code: row.code,
        name: row.name,
        type: row.type,
        costPrice: dec(row.costPrice || 0),
        sellingPrice: dec(row.sellingPrice || 0),
        standardCost: dec(row.costPrice || 0),
        reorderLevel: row.reorderLevel || 0,
        safetyStock: row.safetyStock || 0,
        bomApplicable: row.bomApplicable,
        supplierId,
        createdBy: userId || null
      }
    });
    created += 1;
  }
  return { created: errors.length ? 0 : created, errors };
}

async function importCustomers(tx, tenantId, userId, records) {
  const errors = [];
  const seen = new Set();
  const rows = records.map((record, index) => {
    const row = index + 2;
    const code = requiredText(record, 'code', row, errors);
    const name = requiredText(record, 'name', row, errors);
    const creditLimit = optionalNumber(record, 'creditLimit', row, errors);
    if (code) {
      if (seen.has(code.toLowerCase())) errors.push(fieldError(row, 'code', `code ${code} is repeated in this file.`));
      seen.add(code.toLowerCase());
    }
    return { row, code, name, email: text(record, 'email') || null, phone: text(record, 'phone') || null, address: text(record, 'address') || null, creditLimit };
  });
  if (errors.length) return { created: 0, errors };
  let created = 0;
  for (const row of rows) {
    const existing = await tx.customer.findFirst({ where: { tenantId, code: { equals: row.code, mode: 'insensitive' } } });
    if (existing) {
      errors.push(fieldError(row.row, 'code', `Customer ${row.code} already exists.`));
      continue;
    }
    await tx.customer.create({
      data: {
        tenantId, code: row.code, name: row.name, email: row.email, phone: row.phone, address: row.address,
        creditLimit: dec(row.creditLimit || 0), createdBy: userId || null
      }
    });
    created += 1;
  }
  return { created: errors.length ? 0 : created, errors };
}

async function importSuppliers(tx, tenantId, userId, records) {
  const errors = [];
  const seen = new Set();
  const rows = records.map((record, index) => {
    const row = index + 2;
    const code = requiredText(record, 'code', row, errors);
    const name = requiredText(record, 'name', row, errors);
    const leadTime = optionalNumber(record, 'leadTime', row, errors, { integer: true });
    if (code) {
      if (seen.has(code.toLowerCase())) errors.push(fieldError(row, 'code', `code ${code} is repeated in this file.`));
      seen.add(code.toLowerCase());
    }
    return {
      row, code, name,
      email: text(record, 'email') || null,
      phone: text(record, 'phone') || null,
      address: text(record, 'address') || null,
      leadTime,
      taxGroup: text(record, 'taxGroup') || null,
      withholdingTaxGroup: text(record, 'withholdingTaxGroup') || null
    };
  });
  if (errors.length) return { created: 0, errors };
  let created = 0;
  for (const row of rows) {
    const existing = await tx.supplier.findFirst({ where: { tenantId, code: { equals: row.code, mode: 'insensitive' } } });
    if (existing) errors.push(fieldError(row.row, 'code', `Supplier ${row.code} already exists.`));
    if (row.taxGroup) {
      const group = await tx.purchaseTaxGroup.findFirst({ where: { tenantId, name: row.taxGroup } });
      if (!group) errors.push(fieldError(row.row, 'taxGroup', `Tax group ${row.taxGroup} was not found.`));
    }
    if (row.withholdingTaxGroup) {
      const group = await tx.purchaseWithholdingTaxGroup.findFirst({ where: { tenantId, name: row.withholdingTaxGroup } });
      if (!group) errors.push(fieldError(row.row, 'withholdingTaxGroup', `Withholding tax group ${row.withholdingTaxGroup} was not found.`));
    }
    if (errors.length) continue;
    await tx.supplier.create({
      data: {
        tenantId, code: row.code, name: row.name, email: row.email, phone: row.phone, address: row.address,
        leadTime: row.leadTime || 0, taxGroup: row.taxGroup, withholdingTaxGroup: row.withholdingTaxGroup, createdBy: userId || null
      }
    });
    created += 1;
  }
  return { created: errors.length ? 0 : created, errors };
}

async function importBoms(tx, tenantId, userId, records) {
  const errors = [];
  const groups = new Map();
  records.forEach((record, index) => {
    const row = index + 2;
    const productCode = requiredText(record, 'productCode', row, errors);
    const componentCode = requiredText(record, 'componentCode', row, errors);
    const quantity = optionalNumber(record, 'quantity', row, errors, { required: true });
    const scrapPercent = optionalNumber(record, 'scrapPercent', row, errors);
    const version = text(record, 'version') || '1.0';
    if (productCode && componentCode && productCode.toLowerCase() === componentCode.toLowerCase()) {
      errors.push(fieldError(row, 'componentCode', 'A product cannot be a component of itself.'));
    }
    if (quantity != null && quantity <= 0) errors.push(fieldError(row, 'quantity', 'quantity must be greater than zero.'));
    const key = `${productCode.toLowerCase()}|${version.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { productCode, version, lines: [] });
    groups.get(key).lines.push({ row, componentCode, quantity, scrapPercent });
  });
  if (errors.length) return { created: 0, errors };
  let created = 0;
  for (const group of groups.values()) {
    const product = await tx.product.findFirst({ where: { tenantId, code: { equals: group.productCode, mode: 'insensitive' } } });
    if (!product) {
      group.lines.forEach((line) => errors.push(fieldError(line.row, 'productCode', `Product ${group.productCode} was not found.`)));
      continue;
    }
    const existing = await tx.bOM.findFirst({ where: { tenantId, productId: product.id, version: group.version } });
    if (existing) {
      group.lines.forEach((line) => errors.push(fieldError(line.row, 'version', `BOM version ${group.version} already exists for ${group.productCode}.`)));
      continue;
    }
    const items = [];
    for (const line of group.lines) {
      const component = await tx.product.findFirst({ where: { tenantId, code: { equals: line.componentCode, mode: 'insensitive' } } });
      if (!component) {
        errors.push(fieldError(line.row, 'componentCode', `Component ${line.componentCode} was not found.`));
        continue;
      }
      items.push({
        tenantId,
        productId: component.id,
        quantity: dec(line.quantity),
        scrapPercent: dec(line.scrapPercent || 0)
      });
    }
    if (errors.length || !items.length) continue;
    await tx.bOM.create({
      data: {
        tenantId,
        productId: product.id,
        code: group.version,
        name: `${product.code} BOM`,
        version: group.version,
        status: 'DRAFT',
        isDefault: false,
        createdBy: userId || null,
        items: { create: items }
      }
    });
    await tx.product.update({ where: { id: product.id }, data: { bomApplicable: true } });
    created += 1;
  }
  return { created: errors.length ? 0 : created, errors };
}

async function importWorkstations(tx, tenantId, userId, records) {
  const errors = [];
  const seen = new Set();
  const rows = records.map((record, index) => {
    const row = index + 2;
    const code = requiredText(record, 'code', row, errors);
    const name = requiredText(record, 'name', row, errors);
    const hourlyRate = optionalNumber(record, 'hourlyRate', row, errors);
    const capacity = optionalNumber(record, 'capacity', row, errors, { integer: true });
    const efficiency = optionalNumber(record, 'efficiency', row, errors);
    if (code) {
      if (seen.has(code.toLowerCase())) errors.push(fieldError(row, 'code', `code ${code} is repeated in this file.`));
      seen.add(code.toLowerCase());
    }
    return { row, code, name, hourlyRate, capacity: capacity || 1, efficiency: text(record, 'efficiency') ? efficiency : 1 };
  });
  if (errors.length) return { created: 0, errors };
  let created = 0;
  for (const row of rows) {
    const existing = await tx.workstation.findFirst({ where: { tenantId, code: { equals: row.code, mode: 'insensitive' } } });
    if (existing) {
      errors.push(fieldError(row.row, 'code', `Workstation ${row.code} already exists.`));
      continue;
    }
    await tx.workstation.create({
      data: {
        tenantId, code: row.code, name: row.name, hourlyRate: dec(row.hourlyRate || 0),
        capacity: row.capacity || 1, efficiency: dec(row.efficiency == null ? 1 : row.efficiency), createdBy: userId || null
      }
    });
    created += 1;
  }
  return { created: errors.length ? 0 : created, errors };
}

async function importOpeningStock(tx, tenantId, userId, records) {
  const errors = [];
  const rows = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const row = index + 2;
    const productCode = requiredText(record, 'productCode', row, errors);
    const warehouseCode = requiredText(record, 'warehouseCode', row, errors);
    const quantity = optionalNumber(record, 'quantity', row, errors, { required: true });
    const unitCost = optionalNumber(record, 'unitCost', row, errors, { required: true });
    if (quantity != null && quantity <= 0) errors.push(fieldError(row, 'quantity', 'quantity must be greater than zero.'));
    rows.push({ row, productCode, warehouseCode, quantity, unitCost, lotNumber: text(record, 'lotNumber') || null });
  }
  if (errors.length) return { created: 0, errors };
  const prepared = [];
  for (const row of rows) {
    const product = await tx.product.findFirst({ where: { tenantId, code: { equals: row.productCode, mode: 'insensitive' } } });
    const warehouse = await tx.warehouse.findFirst({ where: { tenantId, code: { equals: row.warehouseCode, mode: 'insensitive' } } });
    if (!product) errors.push(fieldError(row.row, 'productCode', `Product ${row.productCode} was not found.`));
    if (!warehouse) errors.push(fieldError(row.row, 'warehouseCode', `Warehouse ${row.warehouseCode} was not found.`));
    if (product && warehouse) prepared.push({ ...row, product, warehouse });
  }
  if (errors.length) return { created: 0, errors };
  const referenceId = randomUUID();
  const byWarehouse = new Map();
  prepared.forEach((row) => {
    if (!byWarehouse.has(row.warehouse.id)) byWarehouse.set(row.warehouse.id, []);
    byWarehouse.get(row.warehouse.id).push(row);
  });
  for (const [warehouseId, lines] of byWarehouse) {
    await postReceiptDocument(tx, {
      tenantId,
      warehouseId,
      items: lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        unitPrice: line.unitCost,
        lotNumber: line.lotNumber
      })),
      referenceType: 'OPENING',
      referenceId,
      date: new Date(),
      createdBy: userId,
      description: 'Opening stock',
      creditKey: 'OPENING_EQUITY'
    });
  }
  return { created: prepared.length, errors: [], referenceId };
}

async function importOpeningBalance(tx, tenantId, userId, records, side) {
  const errors = [];
  const codeKey = side === 'AR' ? 'customerCode' : 'supplierCode';
  const rows = records.map((record, index) => {
    const row = index + 2;
    const code = requiredText(record, codeKey, row, errors);
    const amount = optionalNumber(record, 'amount', row, errors, { required: true });
    const date = parseDate(record, 'date', row, errors);
    if (amount != null && amount <= 0) errors.push(fieldError(row, 'amount', 'amount must be greater than zero.'));
    return { row, code, amount, date, reference: text(record, 'reference') || null };
  });
  if (errors.length) return { created: 0, errors };
  const map = await ensureGlMap(tx, tenantId, userId);
  let created = 0;
  for (const row of rows) {
    if (side === 'AR') {
      const customer = await tx.customer.findFirst({ where: { tenantId, code: { equals: row.code, mode: 'insensitive' } } });
      if (!customer) {
        errors.push(fieldError(row.row, 'customerCode', `Customer ${row.code} was not found.`));
        continue;
      }
      const invoiceNumber = await generateDocumentNumber(tenantId, 'salesInvoice', 'OAR', 'invoiceNumber', tx);
      const invoice = await tx.salesInvoice.create({
        data: {
          tenantId,
          customerId: customer.id,
          invoiceNumber,
          date: row.date,
          status: 'UNPAID',
          subtotal: dec(row.amount),
          taxAmount: dec(0),
          total: dec(row.amount),
          amountPaid: dec(0),
          exchangeRate: dec(1),
          createdBy: userId || null
        }
      });
      await postJournal(tx, {
        tenantId,
        date: row.date,
        createdBy: userId,
        description: `Opening AR ${invoiceNumber}${row.reference ? ` ${row.reference}` : ''}`,
        referenceType: 'OPENING_AR',
        referenceId: invoice.id,
        lines: [
          { accountId: customer.accountsReceivableId || map.AR, debit: row.amount, credit: 0, description: invoiceNumber },
          { accountId: map.OPENING_EQUITY, debit: 0, credit: row.amount, description: invoiceNumber }
        ]
      });
    } else {
      const supplier = await tx.supplier.findFirst({ where: { tenantId, code: { equals: row.code, mode: 'insensitive' } } });
      if (!supplier) {
        errors.push(fieldError(row.row, 'supplierCode', `Supplier ${row.code} was not found.`));
        continue;
      }
      const invoiceNumber = await generateDocumentNumber(tenantId, 'supplierInvoice', 'OAP', 'invoiceNumber', tx);
      const invoice = await tx.supplierInvoice.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          invoiceNumber,
          supplierReference: row.reference,
          date: row.date,
          status: 'UNPAID',
          subtotal: dec(row.amount),
          taxAmount: dec(0),
          whtAmount: dec(0),
          total: dec(row.amount),
          amountPaid: dec(0),
          exchangeRate: dec(1),
          createdBy: userId || null
        }
      });
      await postJournal(tx, {
        tenantId,
        date: row.date,
        createdBy: userId,
        description: `Opening AP ${invoiceNumber}${row.reference ? ` ${row.reference}` : ''}`,
        referenceType: 'OPENING_AP',
        referenceId: invoice.id,
        lines: [
          { accountId: map.OPENING_EQUITY, debit: row.amount, credit: 0, description: invoiceNumber },
          { accountId: supplier.accountsPayableId || map.AP, debit: 0, credit: row.amount, description: invoiceNumber }
        ]
      });
    }
    created += 1;
  }
  return { created: errors.length ? 0 : created, errors };
}

const IMPORTERS = {
  products: importProducts,
  customers: importCustomers,
  suppliers: importSuppliers,
  boms: importBoms,
  workstations: importWorkstations,
  'opening-stock': importOpeningStock,
  'opening-ar': (tx, tenantId, userId, records) => importOpeningBalance(tx, tenantId, userId, records, 'AR'),
  'opening-ap': (tx, tenantId, userId, records) => importOpeningBalance(tx, tenantId, userId, records, 'AP')
};

async function importFile(db, tenantId, userId, entity, file) {
  const importer = IMPORTERS[entity];
  if (!importer) {
    const error = new Error('Unknown import.');
    error.status = 404;
    throw error;
  }
  const records = readRows(file);
  return db.$transaction(async (tx) => {
    const result = await importer(tx, tenantId, userId, records);
    if (result.errors.length) {
      const error = new Error('Some rows need to be corrected.');
      error.status = 400;
      error.errors = result.errors;
      throw error;
    }
    return result;
  }, { timeout: 30000 });
}

module.exports = {
  TEMPLATES,
  MODULES,
  template,
  importFile
};
