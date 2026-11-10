const prisma = require('../lib/prisma');

const PRODUCT_COLUMNS = [
  'code', 'name', 'productType', 'category', 'brand', 'productGroup', 'supplier',
  'stockUom', 'purchaseUom', 'salesUom', 'costingMethod', 'standardCost', 'costPrice',
  'sellingPrice', 'reorderLevel', 'safetyStock', 'scrapPercent', 'taxGroup',
  'activeStatus', 'currency', 'bomApplicable'
];

const PREFERENCE_RULES = {
  'products-columns': (value) => {
    if (!Array.isArray(value) || value.length === 0 || value.length > PRODUCT_COLUMNS.length) {
      return 'Select at least one column';
    }
    if (!value.every((item) => PRODUCT_COLUMNS.includes(item))) {
      return 'Unknown column';
    }
    return [...new Set(value)];
  }
};

const getPreference = async (req, res) => {
  try {
    const { key } = req.params;
    if (!PREFERENCE_RULES[key]) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    const rows = await prisma.$queryRawUnsafe(
      'SELECT value FROM user_preferences WHERE user_id = $1 AND key = $2 AND tenant_id = $3 LIMIT 1',
      req.user.userId,
      key,
      req.tenantId
    );

    res.json({ key, value: rows[0] ? rows[0].value : null });
  } catch (error) {
    console.error('Get preference error:', error);
    res.status(500).json({ error: 'Failed to load preference' });
  }
};

const savePreference = async (req, res) => {
  try {
    const { key } = req.params;
    const rule = PREFERENCE_RULES[key];
    if (!rule) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    const value = rule(req.body?.value);
    if (typeof value === 'string') {
      return res.status(400).json({ error: value });
    }

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO user_preferences (id, tenant_id, user_id, key, value, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, NOW(), NOW())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()
       RETURNING value`,
      req.tenantId,
      req.user.userId,
      key,
      JSON.stringify(value)
    );

    res.json({ key, value: rows[0] ? rows[0].value : value });
  } catch (error) {
    console.error('Save preference error:', error);
    res.status(500).json({ error: 'Failed to save preference' });
  }
};

module.exports = { getPreference, savePreference };
