const { DocumentError } = require('../errors');

const WAREHOUSE_TYPES = ['GENERAL', 'RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS', 'DISTRIBUTION', 'VIRTUAL_FACTORY'];
const BIN_TYPES = ['STORAGE', 'QUARANTINE', 'DAMAGED', 'SCRAP'];

// Configurable defaults until NCC confirms the final codes (D-03).
const DEFAULT_LOCATIONS = [
  {
    branch: { code: 'PELI', name: 'Peliyagoda' },
    warehouses: [
      { code: 'WH-PEL-RM', name: 'Peliyagoda Raw Material', warehouseType: 'RAW_MATERIAL', tracksPallets: true },
      { code: 'WH-PEL-PK', name: 'Peliyagoda Packaging', warehouseType: 'PACKAGING', tracksPallets: true },
      { code: 'WH-PEL-FG', name: 'Peliyagoda Finished Goods', warehouseType: 'FINISHED_GOODS', tracksPallets: true },
      { code: 'WH-PEL-CM', name: 'Peliyagoda Contract Manufacturing', warehouseType: 'VIRTUAL_FACTORY', isVirtual: true, tracksPallets: false }
    ]
  },
  {
    branch: { code: 'ELAK', name: 'Elakanda' },
    warehouses: [
      { code: 'WH-ELK-DW', name: 'Elakanda Distribution Warehouse', warehouseType: 'DISTRIBUTION', tracksPallets: true }
    ]
  }
];

const DEFAULT_BINS = [
  { code: 'BIN-A1', name: 'Bulk storage', binType: 'STORAGE' },
  { code: 'QA-HOLD', name: 'Quarantine', binType: 'QUARANTINE' },
  { code: 'DMG-01', name: 'Damaged', binType: 'DAMAGED' },
  { code: 'SCRAP', name: 'Scrap', binType: 'SCRAP' }
];

const UOM_TEMPLATES = [
  {
    code: 'MASS',
    name: 'Weight',
    baseCode: 'g',
    lines: [
      { uomCode: 'g', factorToBase: 1 },
      { uomCode: 'kg', factorToBase: 1000 }
    ]
  },
  {
    code: 'VOLUME',
    name: 'Volume',
    baseCode: 'ml',
    lines: [
      { uomCode: 'ml', factorToBase: 1 },
      { uomCode: 'L', factorToBase: 1000 }
    ]
  },
  {
    code: 'COUNT',
    name: 'Count',
    baseCode: 'NOS',
    lines: [
      { uomCode: 'NOS', factorToBase: 1 },
      { uomCode: 'Each', factorToBase: 1 },
      { uomCode: 'Box', factorToBase: 6 },
      { uomCode: 'Carton', factorToBase: 12 },
      { uomCode: 'Pallet', factorToBase: 48 }
    ]
  }
];

function assertWarehouseType(value) {
  if (value && !WAREHOUSE_TYPES.includes(value)) {
    throw new DocumentError('Unknown warehouse type.', { warehouseType: 'Unknown warehouse type.' });
  }
}

function assertBinType(value) {
  if (value && !BIN_TYPES.includes(value)) {
    throw new DocumentError('Unknown bin type.', { binType: 'Unknown bin type.' });
  }
}

async function ensureDefaultLocations(db, tenantId, userId) {
  const created = [];
  for (const group of DEFAULT_LOCATIONS) {
    let branch = await db.branch.findFirst({ where: { tenantId, code: group.branch.code } });
    if (!branch) {
      branch = await db.branch.create({
        data: { tenantId, code: group.branch.code, name: group.branch.name }
      });
    }
    for (const row of group.warehouses) {
      let warehouse = await db.warehouse.findFirst({ where: { tenantId, code: row.code } });
      if (!warehouse) {
        warehouse = await db.warehouse.create({
          data: {
            tenantId,
            code: row.code,
            name: row.name,
            branchId: branch.id,
            warehouseType: row.warehouseType,
            isVirtual: !!row.isVirtual,
            tracksPallets: !!row.tracksPallets,
            createdBy: userId || null
          }
        });
        created.push(warehouse.code);
      }
      for (const bin of DEFAULT_BINS) {
        const existing = await db.bin.findFirst({ where: { tenantId, warehouseId: warehouse.id, code: bin.code } });
        if (!existing) {
          await db.bin.create({ data: { tenantId, warehouseId: warehouse.id, ...bin } });
        }
      }
    }
  }
  return created;
}

async function ensureUomTemplates(db, tenantId) {
  for (const template of UOM_TEMPLATES) {
    let row = await db.uomTemplate.findFirst({ where: { tenantId, code: template.code } });
    if (!row) {
      row = await db.uomTemplate.create({
        data: {
          tenantId,
          code: template.code,
          name: template.name,
          baseCode: template.baseCode,
          lines: { create: template.lines.map((line) => ({ tenantId, ...line })) }
        }
      });
    }
  }
  return db.uomTemplate.findMany({ where: { tenantId }, include: { lines: true }, orderBy: { code: 'asc' } });
}

async function applyUomTemplate(db, tenantId, templateId, productId) {
  const template = await db.uomTemplate.findFirst({
    where: { id: templateId, tenantId },
    include: { lines: true }
  });
  if (!template) throw new DocumentError('UOM template was not found.', { templateId: 'UOM template was not found.' });
  const product = await db.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new DocumentError('Item was not found.', { productId: 'Item was not found.' });
  const uoms = {};
  for (const line of template.lines) {
    let uom = await db.unitOfMeasure.findFirst({ where: { tenantId, name: line.uomCode } });
    if (!uom) uom = await db.unitOfMeasure.create({ data: { tenantId, name: line.uomCode } });
    uoms[line.uomCode] = uom;
  }
  const base = uoms[template.baseCode];
  const conversions = template.lines
    .filter((line) => line.uomCode !== template.baseCode)
    .map((line) => ({
      uomId: uoms[line.uomCode].id,
      uomName: line.uomCode,
      uomCode: line.uomCode,
      factor: Number(line.factorToBase)
    }));
  const purchase = conversions[0];
  return db.product.update({
    where: { id: product.id },
    data: {
      uomTemplateId: template.id,
      stockUomId: base?.id || product.stockUomId,
      uomId: base?.id || product.uomId,
      purchaseUomId: purchase ? purchase.uomId : (base?.id || product.purchaseUomId),
      conversionFactor: purchase ? purchase.factor : 1,
      uomConversions: conversions
    }
  });
}

module.exports = {
  WAREHOUSE_TYPES,
  BIN_TYPES,
  DEFAULT_LOCATIONS,
  DEFAULT_BINS,
  UOM_TEMPLATES,
  assertWarehouseType,
  assertBinType,
  ensureDefaultLocations,
  ensureUomTemplates,
  applyUomTemplate
};
