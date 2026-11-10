const prisma = require('../lib/prisma');

const getDiscountGroups = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const discountGroups = await prisma.discountGroup.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { discounts: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(discountGroups);
  } catch (error) {
    console.error('Failed to get discount groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDiscountGroupById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const discountGroup = await prisma.discountGroup.findFirst({
      where: { id, tenantId }
    });

    if (!discountGroup) {
      return res.status(404).json({ error: 'Discount group not found' });
    }

    // Fetch all active products
    const products = await prisma.product.findMany({
      where: { 
        tenantId,
        activeStatus: 'ACTIVE'
      },
      orderBy: { code: 'asc' }
    });

    // Fetch existing discount mappings in this discount group
    const discounts = await prisma.discountGroupProduct.findMany({
      where: { discountGroupId: id, tenantId }
    });

    const discountMap = new Map(discounts.map(d => [d.productId, { type: d.discountType, value: d.discountValue.toString() }]));

    // Combine products with their discounts
    const productDiscounts = products.map(prod => ({
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      standardPrice: prod.sellingPrice.toString(),
      discountType: discountMap.has(prod.id) ? discountMap.get(prod.id).type : 'PERCENTAGE',
      discountValue: discountMap.has(prod.id) ? discountMap.get(prod.id).value : '0.00'
    }));

    res.json({
      ...discountGroup,
      products: productDiscounts
    });
  } catch (error) {
    console.error('Failed to get discount group by id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createDiscountGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, status, discounts } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Discount group name is required' });
    }

    // Check unique name per tenant
    const existing = await prisma.discountGroup.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Discount group with this name already exists' });
    }

    const discountGroup = await prisma.$transaction(async (tx) => {
      const dg = await tx.discountGroup.create({
        data: {
          tenantId,
          name,
          status: status || 'ACTIVE',
          createdBy: req.user.userId
        }
      });

      if (discounts && Array.isArray(discounts) && discounts.length > 0) {
        // filter discounts with positive discountValue
        const discountData = discounts
          .filter(d => d.discountValue !== null && d.discountValue !== undefined && parseFloat(d.discountValue) > 0)
          .map(d => ({
            tenantId,
            discountGroupId: dg.id,
            productId: d.productId,
            discountType: d.discountType || 'PERCENTAGE',
            discountValue: parseFloat(d.discountValue),
            createdBy: req.user.userId
          }));

        if (discountData.length > 0) {
          await tx.discountGroupProduct.createMany({
            data: discountData
          });
        }
      }

      return dg;
    });

    res.status(201).json(discountGroup);
  } catch (error) {
    console.error('Failed to create discount group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDiscountGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, status, discounts } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Discount group name is required' });
    }

    const discountGroup = await prisma.discountGroup.findFirst({
      where: { id, tenantId }
    });

    if (!discountGroup) {
      return res.status(404).json({ error: 'Discount group not found' });
    }

    // Check unique name (excluding self)
    const existing = await prisma.discountGroup.findFirst({
      where: { 
        tenantId, 
        name: { equals: name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Another discount group with this name already exists' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.discountGroup.update({
        where: { id },
        data: {
          name,
          status
        }
      });

      // Clear existing discounts in this group
      await tx.discountGroupProduct.deleteMany({
        where: { discountGroupId: id, tenantId }
      });

      if (discounts && Array.isArray(discounts) && discounts.length > 0) {
        const discountData = discounts
          .filter(d => d.discountValue !== null && d.discountValue !== undefined && parseFloat(d.discountValue) > 0)
          .map(d => ({
            tenantId,
            discountGroupId: id,
            productId: d.productId,
            discountType: d.discountType || 'PERCENTAGE',
            discountValue: parseFloat(d.discountValue),
            createdBy: req.user.userId
          }));

        if (discountData.length > 0) {
          await tx.discountGroupProduct.createMany({
            data: discountData
          });
        }
      }
    });

    res.json({ message: 'Discount group updated successfully' });
  } catch (error) {
    console.error('Failed to update discount group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteDiscountGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const discountGroup = await prisma.discountGroup.findFirst({
      where: { id, tenantId }
    });

    if (!discountGroup) {
      return res.status(404).json({ error: 'Discount group not found' });
    }

    await prisma.discountGroup.delete({
      where: { id }
    });

    res.json({ message: 'Discount group deleted successfully' });
  } catch (error) {
    console.error('Failed to delete discount group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDiscountGroups,
  getDiscountGroupById,
  createDiscountGroup,
  updateDiscountGroup,
  deleteDiscountGroup
};
