const prisma = require('../lib/prisma');

const getPriceLists = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const priceLists = await prisma.priceList.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { prices: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(priceLists);
  } catch (error) {
    console.error('Failed to get price lists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPriceListById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const priceList = await prisma.priceList.findFirst({
      where: { id, tenantId }
    });

    if (!priceList) {
      return res.status(404).json({ error: 'Price list not found' });
    }

    // Fetch all active products
    const products = await prisma.product.findMany({
      where: { 
        tenantId,
        activeStatus: 'ACTIVE'
      },
      orderBy: { code: 'asc' }
    });

    // Fetch existing prices in this price list
    const prices = await prisma.priceListPrice.findMany({
      where: { priceListId: id, tenantId }
    });

    const priceMap = new Map(prices.map(p => [p.productId, p.price.toString()]));

    // Combine products with their prices
    const productPrices = products.map(prod => ({
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      standardPrice: prod.sellingPrice.toString(),
      customPrice: priceMap.has(prod.id) ? priceMap.get(prod.id) : null
    }));

    res.json({
      ...priceList,
      products: productPrices
    });
  } catch (error) {
    console.error('Failed to get price list by id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createPriceList = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, currency, isBuying, isSelling, status, prices } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Price list name is required' });
    }

    // Check unique name per tenant
    const existing = await prisma.priceList.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Price list with this name already exists' });
    }

    const priceList = await prisma.$transaction(async (tx) => {
      const pl = await tx.priceList.create({
        data: {
          tenantId,
          name,
          currency: currency || 'USD',
          isBuying: isBuying !== undefined ? isBuying : false,
          isSelling: isSelling !== undefined ? isSelling : true,
          status: status || 'ACTIVE',
          createdBy: req.user.userId
        }
      });

      if (prices && Array.isArray(prices) && prices.length > 0) {
        const priceData = prices
          .filter(p => p.customPrice !== null && p.customPrice !== undefined && p.customPrice !== '')
          .map(p => ({
            tenantId,
            priceListId: pl.id,
            productId: p.productId,
            price: parseFloat(p.customPrice),
            createdBy: req.user.userId
          }));

        if (priceData.length > 0) {
          await tx.priceListPrice.createMany({
            data: priceData
          });
        }
      }

      return pl;
    });

    res.status(201).json(priceList);
  } catch (error) {
    console.error('Failed to create price list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updatePriceList = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, currency, isBuying, isSelling, status, prices } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Price list name is required' });
    }

    const priceList = await prisma.priceList.findFirst({
      where: { id, tenantId }
    });

    if (!priceList) {
      return res.status(404).json({ error: 'Price list not found' });
    }

    // Check unique name (excluding self)
    const existing = await prisma.priceList.findFirst({
      where: { 
        tenantId, 
        name: { equals: name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Another price list with this name already exists' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.priceList.update({
        where: { id },
        data: {
          name,
          currency,
          isBuying,
          isSelling,
          status
        }
      });

      // Clear existing prices in list
      await tx.priceListPrice.deleteMany({
        where: { priceListId: id, tenantId }
      });

      if (prices && Array.isArray(prices) && prices.length > 0) {
        const priceData = prices
          .filter(p => p.customPrice !== null && p.customPrice !== undefined && p.customPrice !== '')
          .map(p => ({
            tenantId,
            priceListId: id,
            productId: p.productId,
            price: parseFloat(p.customPrice),
            createdBy: req.user.userId
          }));

        if (priceData.length > 0) {
          await tx.priceListPrice.createMany({
            data: priceData
          });
        }
      }
    });

    res.json({ message: 'Price list updated successfully' });
  } catch (error) {
    console.error('Failed to update price list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deletePriceList = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const priceList = await prisma.priceList.findFirst({
      where: { id, tenantId }
    });

    if (!priceList) {
      return res.status(404).json({ error: 'Price list not found' });
    }

    await prisma.priceList.delete({
      where: { id }
    });

    res.json({ message: 'Price list deleted successfully' });
  } catch (error) {
    console.error('Failed to delete price list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPriceLists,
  getPriceListById,
  createPriceList,
  updatePriceList,
  deletePriceList
};
