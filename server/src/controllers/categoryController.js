const prisma = require('../lib/prisma');

const getCategories = async (req, res) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const trimmedName = name.trim();

    if (parentId) {
      const parent = await prisma.productCategory.findFirst({
        where: { id: parentId, tenantId: req.tenantId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent category not found.' });
      }
    }

    const category = await prisma.productCategory.create({
      data: {
        tenantId: req.tenantId,
        name: trimmedName,
        parentId: parentId || null
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const trimmedName = name.trim();

    // Verify ownership
    const existing = await prisma.productCategory.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (parentId) {
      // 1. Verify parent category exists and belongs to this tenant
      const parent = await prisma.productCategory.findFirst({
        where: { id: parentId, tenantId: req.tenantId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent category not found.' });
      }

      // 2. Prevent circular reference
      let currentParentId = parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          return res.status(400).json({ 
            error: 'Circular reference detected: A category cannot be a subcategory of itself or its descendants.' 
          });
        }
        const parentCat = await prisma.productCategory.findUnique({
          where: { id: currentParentId },
          select: { parentId: true }
        });
        currentParentId = parentCat ? parentCat.parentId : null;
      }
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: {
        name: trimmedName,
        parentId: parentId || null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.productCategory.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // Cascade deletion of subcategories is automatically handled by the database schema onDelete: Cascade relation
    await prisma.productCategory.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
