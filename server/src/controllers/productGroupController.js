const prisma = require('../lib/prisma');

const getProductGroups = async (req, res) => {
  try {
    const productGroups = await prisma.productGroup.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(productGroups);
  } catch (error) {
    console.error('Fetch product groups error:', error);
    res.status(500).json({ error: 'Failed to fetch product groups' });
  }
};

const createProductGroup = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product Group name is required.' });
    }

    const trimmedName = name.trim();

    if (parentId) {
      const parent = await prisma.productGroup.findFirst({
        where: { id: parentId, tenantId: req.tenantId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent group not found.' });
      }
    }

    const productGroup = await prisma.productGroup.create({
      data: {
        tenantId: req.tenantId,
        name: trimmedName,
        parentId: parentId || null
      }
    });

    res.status(201).json(productGroup);
  } catch (error) {
    console.error('Create product group error:', error);
    res.status(500).json({ error: 'Failed to create product group' });
  }
};

const updateProductGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product Group name is required.' });
    }

    const trimmedName = name.trim();

    // Verify ownership
    const existing = await prisma.productGroup.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product Group not found.' });
    }

    if (parentId) {
      // 1. Verify parent group exists and belongs to this tenant
      const parent = await prisma.productGroup.findFirst({
        where: { id: parentId, tenantId: req.tenantId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent group not found.' });
      }

      // 2. Prevent circular reference
      let currentParentId = parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          return res.status(400).json({ 
            error: 'Circular reference detected: A group cannot be a subgroup of itself or its descendants.' 
          });
        }
        const parentGrp = await prisma.productGroup.findUnique({
          where: { id: currentParentId },
          select: { parentId: true }
        });
        currentParentId = parentGrp ? parentGrp.parentId : null;
      }
    }

    const updated = await prisma.productGroup.update({
      where: { id },
      data: {
        name: trimmedName,
        parentId: parentId || null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update product group error:', error);
    res.status(500).json({ error: 'Failed to update product group' });
  }
};

const deleteProductGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.productGroup.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product Group not found.' });
    }

    await prisma.productGroup.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Product Group deleted successfully.' });
  } catch (error) {
    console.error('Delete product group error:', error);
    res.status(500).json({ error: 'Failed to delete product group' });
  }
};

module.exports = {
  getProductGroups,
  createProductGroup,
  updateProductGroup,
  deleteProductGroup
};
