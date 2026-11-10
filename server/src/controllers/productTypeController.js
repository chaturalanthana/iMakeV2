const prisma = require('../lib/prisma');

const getProductTypes = async (req, res) => {
  try {
    const productTypes = await prisma.productType.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(productTypes);
  } catch (error) {
    console.error('Fetch product types error:', error);
    res.status(500).json({ error: 'Failed to fetch product types' });
  }
};

const createProductType = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product type name is required.' });
    }

    const trimmedName = name.trim();

    // Prevent duplicates within the same tenant
    const existing = await prisma.productType.findFirst({
      where: {
        tenantId: req.tenantId,
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Product type name already exists.' });
    }

    const productType = await prisma.productType.create({
      data: {
        tenantId: req.tenantId,
        name: trimmedName,
        description: description || null
      }
    });

    res.status(201).json(productType);
  } catch (error) {
    console.error('Create product type error:', error);
    res.status(500).json({ error: 'Failed to create product type' });
  }
};

const updateProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product type name is required.' });
    }

    const trimmedName = name.trim();

    // Verify product type ownership
    const existing = await prisma.productType.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product type not found.' });
    }

    // Check duplicate name (excluding the current ID)
    const duplicate = await prisma.productType.findFirst({
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
      return res.status(400).json({ error: 'Another product type with this name already exists.' });
    }

    const updated = await prisma.productType.update({
      where: { id },
      data: { 
        name: trimmedName,
        description: description !== undefined ? description : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update product type error:', error);
    res.status(500).json({ error: 'Failed to update product type' });
  }
};

const deleteProductType = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify product type ownership
    const existing = await prisma.productType.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product type not found.' });
    }

    // Check if any products are using this product type
    const productCount = await prisma.product.count({
      where: { productTypeId: id, tenantId: req.tenantId }
    });

    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete product type as it is linked to one or more products.' });
    }

    await prisma.productType.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete product type error:', error);
    res.status(500).json({ error: 'Failed to delete product type' });
  }
};

module.exports = {
  getProductTypes,
  createProductType,
  updateProductType,
  deleteProductType
};
