const { num, money } = require('./money');

function bucketFor(name) {
  const label = String(name || '').toUpperCase();
  if (label.includes('SSCL')) return 'SSCL';
  if (label.includes('WHT') || label.includes('WITHHOLD')) return 'WHT';
  return 'VAT';
}

async function slabsFor(db, tenantId, kind, groupName) {
  if (!groupName || !String(groupName).trim()) return [];
  const name = String(groupName).trim();
  if (kind === 'sales') {
    const group = await db.taxGroup.findFirst({
      where: { tenantId, name, status: 'ACTIVE' },
      include: { slabs: { orderBy: { calculationOrder: 'asc' } } }
    });
    return group?.slabs || [];
  }
  if (kind === 'purchase') {
    const group = await db.purchaseTaxGroup.findFirst({
      where: { tenantId, name, status: 'ACTIVE' },
      include: { slabs: { orderBy: { calculationOrder: 'asc' } } }
    });
    return group?.slabs || [];
  }
  const group = await db.purchaseWithholdingTaxGroup.findFirst({
    where: { tenantId, name, status: 'ACTIVE' },
    include: { slabs: { orderBy: { calculationOrder: 'asc' } } }
  });
  return group?.slabs || [];
}

function applySlabs(base, slabs) {
  const parts = [];
  let compoundBase = money(base);
  for (const slab of slabs || []) {
    const rate = num(slab.rate);
    const amount = slab.calculationType === 'COMPOUND'
      ? money(compoundBase * rate / 100)
      : money(money(base) * rate / 100);
    if (slab.calculationType === 'COMPOUND') compoundBase = money(compoundBase + amount);
    parts.push({
      name: slab.name,
      rate,
      amount,
      bucket: bucketFor(slab.name),
      accountId: slab.accountId || null
    });
  }
  return parts;
}

function sumBucket(parts, bucket) {
  return money(parts.filter((part) => part.bucket === bucket).reduce((sum, part) => sum + part.amount, 0));
}

module.exports = { bucketFor, slabsFor, applySlabs, sumBucket };
