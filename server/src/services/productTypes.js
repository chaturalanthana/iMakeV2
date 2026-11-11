const prisma = require('../lib/prisma');

const DEFAULT_PRODUCT_TYPES = [
  { name: 'Finished Good', kind: 'FINISHED_GOOD', description: 'Finished goods ready for sale' },
  { name: 'Semi-Finished Good', kind: 'SEMI_FINISHED', description: 'Semi-finished goods or sub-assemblies' },
  { name: 'Raw Material', kind: 'RAW_MATERIAL', description: 'Raw materials used in production' },
  { name: 'Packaging Material', kind: 'PACKAGING', description: 'Packaging used to ship finished goods' },
  { name: 'Consumable', kind: 'CONSUMABLE', description: 'Consumables used in production' },
  { name: 'Service', kind: 'SERVICE', description: 'Non-inventory service items' },
  { name: 'Non-stock', kind: 'NON_STOCK', description: 'Indirect and non-stock items' }
];

const ensureProductTypes = async (db, tenantId) => {
  const names = DEFAULT_PRODUCT_TYPES.map((type) => type.name);
  await db.productType.deleteMany({
    where: { tenantId, name: { notIn: names } }
  });
  for (const type of DEFAULT_PRODUCT_TYPES) {
    await db.productType.upsert({
      where: { tenantId_name: { tenantId, name: type.name } },
      update: { kind: type.kind, description: type.description },
      create: { tenantId, name: type.name, kind: type.kind, description: type.description }
    });
  }
  const rows = await db.productType.findMany({ where: { tenantId, name: { in: names } } });
  const order = new Map(DEFAULT_PRODUCT_TYPES.map((type, index) => [type.name, index]));
  return rows.sort((a, b) => order.get(a.name) - order.get(b.name));
};

const ensureAllProductTypes = async (db = prisma) => {
  const tenants = await db.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await ensureProductTypes(db, tenant.id);
  }
};

const resetProductTypes = async (db = prisma) => {
  await db.productType.deleteMany({});
  await ensureAllProductTypes(db);
};

module.exports = {
  DEFAULT_PRODUCT_TYPES,
  ensureProductTypes,
  ensureAllProductTypes,
  resetProductTypes
};
