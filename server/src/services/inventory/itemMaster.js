const { DocumentError } = require('../errors');
const { num } = require('../money');

const PICK_RULES = ['FIFO', 'FEFO'];
const ITEM_STATUSES = ['APPROVED', 'UNAPPROVED', 'RESTRICTED'];
const SENSITIVE_BULK = new Set([
  'taxGroup', 'hsCode', 'safetyStock', 'reorderLevel', 'costingMethod', 'leadTimeDays', 'dailyDemand'
]);
const OPERATIONAL_BULK = new Set([
  'description', 'barcode', 'sku', 'variant', 'sizeLabel', 'weight', 'volume',
  'batchTracked', 'expiryTracked', 'pickRule'
]);

function clean(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text;
}

function standardDescription({ category, brand, variant, sizeLabel }) {
  const parts = [category, brand, variant, sizeLabel].map(clean);
  const filled = parts.filter(Boolean);
  // A single category or brand is not a description. Two or more parts, or a variant/size, are.
  if (filled.length < 2 && !clean(variant) && !clean(sizeLabel)) return '';
  return filled.join(' ');
}

function reorderPointOf(product) {
  const daily = num(product.dailyDemand);
  const lead = num(product.leadTimeDays);
  if (!(daily > 0) && !(lead > 0)) return null;
  const safety = Math.max(0, num(product.safetyStock));
  return Math.round((safety + daily * lead) * 10000) / 10000;
}

function assertPickAndStatus(body) {
  if (body.pickRule !== undefined && body.pickRule !== null && body.pickRule !== '' && !PICK_RULES.includes(body.pickRule)) {
    throw new DocumentError('Pick rule must be FIFO or FEFO.', { pickRule: 'Pick rule must be FIFO or FEFO.' });
  }
  if (body.itemStatus !== undefined && body.itemStatus !== null && body.itemStatus !== '' && !ITEM_STATUSES.includes(body.itemStatus)) {
    throw new DocumentError('Item status must be approved, unapproved, or restricted.', { itemStatus: 'Item status must be approved, unapproved, or restricted.' });
  }
}

async function namesFor(db, tenantId, body) {
  let category = body.categoryName || '';
  let brand = body.brandName || '';
  if (body.categoryId) {
    const row = await db.productCategory.findFirst({ where: { id: body.categoryId, tenantId } });
    if (row) category = row.name;
  }
  if (body.brandId) {
    const row = await db.productBrand.findFirst({ where: { id: body.brandId, tenantId } });
    if (row) brand = row.name;
  }
  return { category, brand };
}

async function assertUniqueIdentifiers(db, tenantId, body, exceptId) {
  const notSelf = exceptId ? { id: { not: exceptId } } : {};
  if (clean(body.sku)) {
    const sku = await db.product.findFirst({
      where: { tenantId, ...notSelf, sku: { equals: clean(body.sku), mode: 'insensitive' } }
    });
    if (sku) throw new DocumentError('An item already uses this SKU.', { sku: 'An item already uses this SKU.' });
  }
  if (clean(body.barcode)) {
    const barcode = await db.product.findFirst({
      where: { tenantId, ...notSelf, barcode: { equals: clean(body.barcode), mode: 'insensitive' } }
    });
    if (barcode) throw new DocumentError('An item already uses this barcode.', { barcode: 'An item already uses this barcode.' });
  }
}

async function assertUniqueDescription(db, tenantId, description, exceptId) {
  if (!description) return;
  const rows = await db.product.findMany({
    where: {
      tenantId,
      activeStatus: { not: 'INACTIVE' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      standardDescription: { not: null }
    },
    select: { id: true, standardDescription: true }
  });
  const key = description.toLowerCase();
  if (rows.some((row) => clean(row.standardDescription).toLowerCase() === key)) {
    throw new DocumentError('An active item already uses this standard description.', {
      name: 'An active item already uses this standard description.'
    });
  }
}

async function assertValuationLock(db, tenantId, existing, costingMethod) {
  if (!existing || costingMethod === undefined || costingMethod === null || costingMethod === '') return;
  if (costingMethod === existing.costingMethod) return;
  const [layers, movements] = await Promise.all([
    db.costLayer.count({ where: { tenantId, productId: existing.id } }),
    db.stockMovement.count({ where: { tenantId, productId: existing.id } })
  ]);
  if (layers > 0 || movements > 0 || existing.valuationLocked) {
    throw new DocumentError('Valuation method is locked after stock history.', {
      costingMethod: 'Valuation method is locked after stock history.'
    });
  }
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new DocumentError('Enter a zero or positive number.', { value: 'Enter a zero or positive number.' });
  }
  return numeric;
}

async function prepareItem(db, tenantId, body, existing) {
  assertPickAndStatus(body);
  await assertValuationLock(db, tenantId, existing, body.costingMethod);
  await assertUniqueIdentifiers(db, tenantId, body, existing?.id);
  const names = await namesFor(db, tenantId, body);
  const variant = body.variant !== undefined ? body.variant : existing?.variant;
  const sizeLabel = body.sizeLabel !== undefined ? body.sizeLabel : existing?.sizeLabel;
  const category = body.categoryId !== undefined || body.categoryName ? names.category : (existing ? undefined : names.category);
  const brand = body.brandId !== undefined || body.brandName ? names.brand : (existing ? undefined : names.brand);
  let description = null;
  const partsTouched = body.variant !== undefined || body.sizeLabel !== undefined || body.categoryId || body.brandId || body.categoryName || body.brandName;
  if (!existing || partsTouched) {
    description = standardDescription({
      category: category || '',
      brand: brand || '',
      variant,
      sizeLabel
    });
  }
  if (description) await assertUniqueDescription(db, tenantId, description, existing?.id);

  const fields = {};
  const copyText = ['sku', 'barcode', 'variant', 'sizeLabel'];
  copyText.forEach((key) => {
    if (body[key] !== undefined) fields[key] = clean(body[key]) || null;
  });
  if (body.weight !== undefined) fields.weight = optionalNumber(body.weight) ?? null;
  if (body.volume !== undefined) fields.volume = optionalNumber(body.volume) ?? null;
  if (body.leadTimeDays !== undefined) fields.leadTimeDays = Math.round(optionalNumber(body.leadTimeDays) || 0);
  if (body.dailyDemand !== undefined) fields.dailyDemand = optionalNumber(body.dailyDemand) || 0;
  if (body.batchTracked !== undefined) fields.batchTracked = body.batchTracked === true || body.batchTracked === 'true';
  if (body.expiryTracked !== undefined) fields.expiryTracked = body.expiryTracked === true || body.expiryTracked === 'true';
  if (body.nonStock !== undefined) fields.nonStock = body.nonStock === true || body.nonStock === 'true';
  if (body.pickRule) fields.pickRule = body.pickRule;
  if (body.itemStatus) fields.itemStatus = body.itemStatus;
  if (body.uomTemplateId !== undefined) fields.uomTemplateId = body.uomTemplateId || null;
  if (description) fields.standardDescription = description;

  const safety = body.safetyStock !== undefined ? Number(body.safetyStock) : num(existing?.safetyStock);
  const daily = fields.dailyDemand !== undefined ? fields.dailyDemand : num(existing?.dailyDemand);
  const lead = fields.leadTimeDays !== undefined ? fields.leadTimeDays : num(existing?.leadTimeDays);
  const computed = reorderPointOf({ safetyStock: safety, dailyDemand: daily, leadTimeDays: lead });
  if (computed !== null && body.reorderLevel === undefined) {
    fields.reorderLevel = Math.round(computed);
  }
  return { fields, reorderPoint: computed };
}

function itemUsable(product) {
  if (!product) return 'Item was not found.';
  if (product.activeStatus === 'INACTIVE') return 'Inactive items cannot be used.';
  if (product.itemStatus === 'UNAPPROVED') return 'Unapproved items cannot be used.';
  if (product.itemStatus === 'RESTRICTED') return 'Restricted items cannot be used.';
  return null;
}

async function purchaseLineQuantities(db, tenantId, item) {
  const product = await db.product.findFirst({
    where: { id: item.productId, tenantId },
    include: { purchaseUom: true, stockUom: true }
  });
  if (!product) {
    throw new DocumentError('Product is required.', { productId: 'Product is required.' });
  }
  const blocked = itemUsable(product);
  if (blocked) throw new DocumentError(blocked, { productId: blocked });
  const uomId = item.uomId || product.purchaseUomId || product.stockUomId || null;
  let factor = item.conversionFactor !== undefined && item.conversionFactor !== null && item.conversionFactor !== ''
    ? Number(item.conversionFactor)
    : null;
  if (!(factor > 0)) {
    const conversions = Array.isArray(product.uomConversions) ? product.uomConversions : [];
    let uomName = null;
    if (uomId) {
      const uom = await db.unitOfMeasure.findFirst({ where: { id: uomId, tenantId } });
      uomName = uom?.name || null;
    }
    const match = conversions.find((row) => {
      if (row.uomId && row.uomId === uomId) return true;
      const name = String(row.uomName || row.name || row.uom || row.uomCode || '').toLowerCase();
      return uomName && name === uomName.toLowerCase();
    });
    if (match) factor = Number(match.factor || match.factorToBase);
    else if (uomId && uomId === product.purchaseUomId) factor = Number(product.conversionFactor) || 1;
    else factor = 1;
  }
  if (!(factor > 0)) factor = 1;
  const quantity = Number(item.quantity) || 0;
  return {
    uomId,
    conversionFactor: Math.round(factor * 1000000) / 1000000,
    baseQuantity: Math.round(quantity * factor * 10000) / 10000
  };
}

module.exports = {
  SENSITIVE_BULK,
  OPERATIONAL_BULK,
  standardDescription,
  reorderPointOf,
  prepareItem,
  itemUsable,
  purchaseLineQuantities,
  assertValuationLock
};
