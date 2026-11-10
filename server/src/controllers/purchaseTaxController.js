const prisma = require('../lib/prisma');

const getPurchaseTaxGroups = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const taxGroups = await prisma.purchaseTaxGroup.findMany({
      where: { tenantId },
      include: {
        slabs: {
          orderBy: { calculationOrder: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(taxGroups);
  } catch (error) {
    console.error('Failed to get purchase tax groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPurchaseTaxGroupById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const taxGroup = await prisma.purchaseTaxGroup.findFirst({
      where: { id, tenantId },
      include: {
        slabs: {
          include: {
            account: {
              select: { id: true, name: true, code: true }
            }
          },
          orderBy: { calculationOrder: 'asc' }
        }
      }
    });

    if (!taxGroup) {
      return res.status(404).json({ error: 'Purchase tax group not found' });
    }

    res.json(taxGroup);
  } catch (error) {
    console.error('Failed to get purchase tax group by id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createPurchaseTaxGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, description, status, slabs } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Purchase tax group name is required' });
    }

    // Check unique name per tenant
    const existing = await prisma.purchaseTaxGroup.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Purchase tax group with this name already exists' });
    }

    const taxGroup = await prisma.$transaction(async (tx) => {
      const tg = await tx.purchaseTaxGroup.create({
        data: {
          tenantId,
          name,
          description,
          status: status || 'ACTIVE',
          createdBy: req.user.userId
        }
      });

      if (slabs && Array.isArray(slabs) && slabs.length > 0) {
        const slabData = slabs.map((s, idx) => ({
          tenantId,
          taxGroupId: tg.id,
          name: s.name,
          rate: parseFloat(s.rate) || 0,
          calculationType: s.calculationType || 'ADDITIVE',
          calculationOrder: s.calculationOrder !== undefined ? parseInt(s.calculationOrder) : idx + 1,
          accountId: s.accountId || null,
          createdBy: req.user.userId
        }));

        await tx.purchaseTaxSlab.createMany({
          data: slabData
        });
      }

      return tg;
    });

    res.status(201).json(taxGroup);
  } catch (error) {
    console.error('Failed to create purchase tax group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updatePurchaseTaxGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, description, status, slabs } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Purchase tax group name is required' });
    }

    const taxGroup = await prisma.purchaseTaxGroup.findFirst({
      where: { id, tenantId }
    });

    if (!taxGroup) {
      return res.status(404).json({ error: 'Purchase tax group not found' });
    }

    // Check unique name excluding self
    const existing = await prisma.purchaseTaxGroup.findFirst({
      where: { 
        tenantId, 
        name: { equals: name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Another purchase tax group with this name already exists' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseTaxGroup.update({
        where: { id },
        data: {
          name,
          description,
          status: status || 'ACTIVE'
        }
      });

      // Clear existing slabs in this group
      await tx.purchaseTaxSlab.deleteMany({
        where: { taxGroupId: id, tenantId }
      });

      if (slabs && Array.isArray(slabs) && slabs.length > 0) {
        const slabData = slabs.map((s, idx) => ({
          tenantId,
          taxGroupId: id,
          name: s.name,
          rate: parseFloat(s.rate) || 0,
          calculationType: s.calculationType || 'ADDITIVE',
          calculationOrder: s.calculationOrder !== undefined ? parseInt(s.calculationOrder) : idx + 1,
          accountId: s.accountId || null,
          createdBy: req.user.userId
        }));

        await tx.purchaseTaxSlab.createMany({
          data: slabData
        });
      }
    });

    res.json({ message: 'Purchase tax group updated successfully' });
  } catch (error) {
    console.error('Failed to update purchase tax group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deletePurchaseTaxGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const taxGroup = await prisma.purchaseTaxGroup.findFirst({
      where: { id, tenantId }
    });

    if (!taxGroup) {
      return res.status(404).json({ error: 'Purchase tax group not found' });
    }

    await prisma.purchaseTaxGroup.delete({
      where: { id }
    });

    res.json({ message: 'Purchase tax group deleted successfully' });
  } catch (error) {
    console.error('Failed to delete purchase tax group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPurchaseTaxGroups,
  getPurchaseTaxGroupById,
  createPurchaseTaxGroup,
  updatePurchaseTaxGroup,
  deletePurchaseTaxGroup
};
