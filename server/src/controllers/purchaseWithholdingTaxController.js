const prisma = require('../lib/prisma');

const getPurchaseWithholdingTaxGroups = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const taxGroups = await prisma.purchaseWithholdingTaxGroup.findMany({
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
    console.error('Failed to get purchase withholding tax groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPurchaseWithholdingTaxGroupById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const taxGroup = await prisma.purchaseWithholdingTaxGroup.findFirst({
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
      return res.status(404).json({ error: 'Purchase withholding tax group not found' });
    }

    res.json(taxGroup);
  } catch (error) {
    console.error('Failed to get purchase withholding tax group by id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createPurchaseWithholdingTaxGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, description, status, slabs } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Purchase withholding tax group name is required' });
    }

    // Check unique name per tenant
    const existing = await prisma.purchaseWithholdingTaxGroup.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Purchase withholding tax group with this name already exists' });
    }

    const taxGroup = await prisma.$transaction(async (tx) => {
      const tg = await tx.purchaseWithholdingTaxGroup.create({
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

        await tx.purchaseWithholdingTaxSlab.createMany({
          data: slabData
        });
      }

      return tg;
    });

    res.status(201).json(taxGroup);
  } catch (error) {
    console.error('Failed to create purchase withholding tax group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updatePurchaseWithholdingTaxGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, description, status, slabs } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Purchase withholding tax group name is required' });
    }

    const taxGroup = await prisma.purchaseWithholdingTaxGroup.findFirst({
      where: { id, tenantId }
    });

    if (!taxGroup) {
      return res.status(404).json({ error: 'Purchase withholding tax group not found' });
    }

    // Check unique name excluding self
    const existing = await prisma.purchaseWithholdingTaxGroup.findFirst({
      where: { 
        tenantId, 
        name: { equals: name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Another purchase withholding tax group with this name already exists' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseWithholdingTaxGroup.update({
        where: { id },
        data: {
          name,
          description,
          status: status || 'ACTIVE'
        }
      });

      // Clear existing slabs in this group
      await tx.purchaseWithholdingTaxSlab.deleteMany({
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

        await tx.purchaseWithholdingTaxSlab.createMany({
          data: slabData
        });
      }
    });

    res.json({ message: 'Purchase withholding tax group updated successfully' });
  } catch (error) {
    console.error('Failed to update purchase withholding tax group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deletePurchaseWithholdingTaxGroup = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const taxGroup = await prisma.purchaseWithholdingTaxGroup.findFirst({
      where: { id, tenantId }
    });

    if (!taxGroup) {
      return res.status(404).json({ error: 'Purchase withholding tax group not found' });
    }

    await prisma.purchaseWithholdingTaxGroup.delete({
      where: { id }
    });

    res.json({ message: 'Purchase withholding tax group deleted successfully' });
  } catch (error) {
    console.error('Failed to delete purchase withholding tax group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPurchaseWithholdingTaxGroups,
  getPurchaseWithholdingTaxGroupById,
  createPurchaseWithholdingTaxGroup,
  updatePurchaseWithholdingTaxGroup,
  deletePurchaseWithholdingTaxGroup
};
