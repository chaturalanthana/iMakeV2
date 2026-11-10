const prisma = require('../lib/prisma');

const getUoms = async (req, res) => {
  try {
    const uoms = await prisma.unitOfMeasure.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(uoms);
  } catch (error) {
    console.error('Fetch UOMs error:', error);
    res.status(500).json({ error: 'Failed to fetch UOMs' });
  }
};

const createUom = async (req, res) => {
  try {
    const { name } = req.body;
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

    res.status(201).json(uom);
  } catch (error) {
    console.error('Create UOM error:', error);
    res.status(500).json({ error: 'Failed to create UOM' });
  }
};

const updateUom = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

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

    res.json(updated);
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
  deleteUom
};
