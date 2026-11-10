const prisma = require('../lib/prisma');

const getBrands = async (req, res) => {
  try {
    const brands = await prisma.productBrand.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(brands);
  } catch (error) {
    console.error('Fetch brands error:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
};

const createBrand = async (req, res) => {
  try {
    const { name, imageUrl, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required.' });
    }

    const trimmedName = name.trim();

    if (parentId) {
      const parent = await prisma.productBrand.findFirst({
        where: { id: parentId, tenantId: req.tenantId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent brand not found.' });
      }
    }

    // Check unique under the same parent
    const existing = await prisma.productBrand.findFirst({
      where: {
        tenantId: req.tenantId,
        parentId: parentId || null,
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Brand name already exists under this parent level.' });
    }

    const brand = await prisma.productBrand.create({
      data: {
        tenantId: req.tenantId,
        name: trimmedName,
        imageUrl: imageUrl || null,
        parentId: parentId || null
      }
    });

    res.status(201).json(brand);
  } catch (error) {
    console.error('Create brand error:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
};

const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imageUrl, parentId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required.' });
    }

    const trimmedName = name.trim();

    // Verify brand ownership
    const existing = await prisma.productBrand.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Brand not found.' });
    }

    if (parentId) {
      // 1. Verify parent brand exists and belongs to this tenant
      const parent = await prisma.productBrand.findFirst({
        where: { id: parentId, tenantId: req.tenantId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent brand not found.' });
      }

      // 2. Prevent circular reference
      let currentParentId = parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          return res.status(400).json({ 
            error: 'Circular reference detected: A brand cannot be a sub-brand of itself or its descendants.' 
          });
        }
        const parentBrand = await prisma.productBrand.findUnique({
          where: { id: currentParentId },
          select: { parentId: true }
        });
        currentParentId = parentBrand ? parentBrand.parentId : null;
      }
    }

    // Check duplicate brand name (excluding the current brand ID) under same parent level
    const duplicate = await prisma.productBrand.findFirst({
      where: {
        tenantId: req.tenantId,
        parentId: parentId || null,
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        },
        NOT: { id }
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: 'Another brand with this name already exists under this parent level.' });
    }

    const updated = await prisma.productBrand.update({
      where: { id },
      data: { 
        name: trimmedName,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        parentId: parentId || null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update brand error:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify brand ownership
    const existing = await prisma.productBrand.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Brand not found.' });
    }

    await prisma.productBrand.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Brand deleted successfully.' });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
};

module.exports = {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand
};
