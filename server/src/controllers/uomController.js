const prisma = require('../lib/prisma');

const detectUomType = (name = '') => {
  const n = String(name || '').trim().toLowerCase();
  
  // Mass / Weight
  if (/^(kg|kgs|kilogram|kilograms|g|gm|gms|gram|grams|mg|milligram|milligrams|ton|tons|tonne|tonnes|lb|lbs|pound|pounds|oz|ounce|ounces|quintal)$/i.test(n)) {
    return 'MASS';
  }
  // Length / Distance
  if (/^(m|meter|meters|metre|metres|cm|centimeter|centimeters|mm|millimeter|millimeters|km|kilometer|kilometers|in|inch|inches|ft|foot|feet|yd|yard|yards)$/i.test(n)) {
    return 'LENGTH';
  }
  // Area
  if (/^(sqm|sq\.m|m2|sqft|sq\.ft|ft2|sqin|sq\.in|in2|sqyd|sq\.yd|sqkm|sq\.km|acre|acres|ha|hectare|hectares)$/i.test(n)) {
    return 'AREA';
  }
  // Volume / Liquid
  if (/^(l|ltr|ltrs|liter|liters|litre|litres|ml|mls|milliliter|milliliters|cl|dl|m3|cbm|gal|gals|gallon|gallons|bbl|barrel|barrels|pt|pint|qt|quart)$/i.test(n)) {
    return 'VOLUME';
  }
  // Time
  if (/^(hr|hrs|hour|hours|min|mins|minute|minutes|sec|secs|second|seconds|day|days|wk|wks|week|weeks|mo|mos|month|months|yr|yrs|year|years)$/i.test(n)) {
    return 'TIME';
  }
  // Default to Count (discrete units)
  return 'COUNT';
};

const getTypeMap = async (tenantId) => {
  try {
    const pref = await prisma.userPreference.findFirst({
      where: { tenantId, key: 'uom_types' }
    });
    return (pref && typeof pref.value === 'object' && pref.value !== null) ? pref.value : {};
  } catch {
    return {};
  }
};

const saveTypeMap = async (tenantId, userId, typeMap) => {
  try {
    const pref = await prisma.userPreference.findFirst({
      where: { tenantId, key: 'uom_types' }
    });

    if (pref) {
      await prisma.userPreference.update({
        where: { id: pref.id },
        data: { value: typeMap }
      });
    } else {
      await prisma.userPreference.create({
        data: {
          tenantId,
          userId: userId || 'system',
          key: 'uom_types',
          value: typeMap
        }
      });
    }
  } catch (err) {
    console.warn('Failed to save UOM type preference:', err.message);
  }
};

const getUoms = async (req, res) => {
  try {
    const uoms = await prisma.unitOfMeasure.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });

    const typeMap = await getTypeMap(req.tenantId);

    const enriched = uoms.map(u => ({
      ...u,
      type: typeMap[u.id] || detectUomType(u.name)
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Fetch UOMs error:', error);
    res.status(500).json({ error: 'Failed to fetch UOMs' });
  }
};

const createUom = async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'UOM name is required.' });
    }

    const trimmedName = name.trim();

    // Prevent duplicates within the same tenant
    const existing = await prisma.unitOfMeasure.findFirst({
      where: {
        tenantId: req.tenantId,
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'UOM name already exists.' });
    }

    const uom = await prisma.unitOfMeasure.create({
      data: {
        tenantId: req.tenantId,
        name: trimmedName
      }
    });

    const assignedType = type || detectUomType(trimmedName);
    const typeMap = await getTypeMap(req.tenantId);
    typeMap[uom.id] = assignedType;
    await saveTypeMap(req.tenantId, req.user?.userId, typeMap);

    res.status(201).json({ ...uom, type: assignedType });
  } catch (error) {
    console.error('Create UOM error:', error);
    res.status(500).json({ error: 'Failed to create UOM' });
  }
};

const updateUom = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'UOM name is required.' });
    }

    const trimmedName = name.trim();

    // Verify ownership
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'UOM not found.' });
    }

    // Check duplicate name (excluding current ID)
    const duplicate = await prisma.unitOfMeasure.findFirst({
      where: {
        tenantId: req.tenantId,
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        },
        NOT: { id }
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: 'Another UOM with this name already exists.' });
    }

    const updated = await prisma.unitOfMeasure.update({
      where: { id },
      data: { 
        name: trimmedName
      }
    });

    const assignedType = type || detectUomType(trimmedName);
    const typeMap = await getTypeMap(req.tenantId);
    typeMap[id] = assignedType;
    await saveTypeMap(req.tenantId, req.user?.userId, typeMap);

    res.json({ ...updated, type: assignedType });
  } catch (error) {
    console.error('Update UOM error:', error);
    res.status(500).json({ error: 'Failed to update UOM' });
  }
};

const deleteUom = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'UOM not found.' });
    }

    // Check if any products are using this UOM (either stock, purchase, sales, or legacy uomId)
    const productCount = await prisma.product.count({
      where: {
        tenantId: req.tenantId,
        OR: [
          { stockUomId: id },
          { purchaseUomId: id },
          { salesUomId: id },
          { uomId: id }
        ]
      }
    });

    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete UOM as it is linked to one or more products.' });
    }

    await prisma.unitOfMeasure.delete({
      where: { id }
    });

    const typeMap = await getTypeMap(req.tenantId);
    if (typeMap[id]) {
      delete typeMap[id];
      await saveTypeMap(req.tenantId, req.user?.userId, typeMap);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete UOM error:', error);
    res.status(500).json({ error: 'Failed to delete UOM' });
  }
};

module.exports = {
  getUoms,
  createUom,
  updateUom,
  deleteUom,
  detectUomType
};
