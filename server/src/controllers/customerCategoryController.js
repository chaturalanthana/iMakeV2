const prisma = require('../lib/prisma');

const getCustomerCategories = async (req, res) => {
  try {
    const categories = await prisma.customerCategory.findMany({
      where: { tenantId: req.tenantId },
      include: {
        accountsReceivable: true,
        revenueAccount: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Fetch customer categories error:', error);
    res.status(500).json({ error: 'Failed to fetch customer categories' });
  }
};

const createCustomerCategory = async (req, res) => {
  try {
    const { 
      code, name, description, status,
      accountsReceivableId, revenueAccountId, taxGroup,
      creditLimit, creditPeriod, allowCreditSales,
      priceList, discountGroup, salesTerritory, salesRep
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required.' });
    }

    // Check code duplication
    const existing = await prisma.customerCategory.findFirst({
      where: { tenantId: req.tenantId, code }
    });
    if (existing) {
      return res.status(400).json({ error: 'Customer category code already exists.' });
    }

    const category = await prisma.customerCategory.create({
      data: {
        tenantId: req.tenantId,
        code,
        name,
        description: description || null,
        status: status || 'ACTIVE',
        accountsReceivableId: accountsReceivableId || null,
        revenueAccountId: revenueAccountId || null,
        taxGroup: taxGroup || null,
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0.0,
        creditPeriod: creditPeriod ? parseInt(creditPeriod) : 0,
        allowCreditSales: allowCreditSales === true || allowCreditSales === 'true',
        priceList: priceList || null,
        discountGroup: discountGroup || null,
        salesTerritory: salesTerritory || null,
        salesRep: salesRep || null,
        createdBy: req.user.userId
      },
      include: {
        accountsReceivable: true,
        revenueAccount: true
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create customer category error:', error);
    res.status(500).json({ error: 'Failed to create customer category' });
  }
};

const updateCustomerCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, name, description, status,
      accountsReceivableId, revenueAccountId, taxGroup,
      creditLimit, creditPeriod, allowCreditSales,
      priceList, discountGroup, salesTerritory, salesRep
    } = req.body;

    const existing = await prisma.customerCategory.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Customer category not found' });
    }

    // Check code duplication if code changes
    if (code && code !== existing.code) {
      const duplicate = await prisma.customerCategory.findFirst({
        where: { tenantId: req.tenantId, code }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Customer category code already exists.' });
      }
    }

    const category = await prisma.customerCategory.update({
      where: { id },
      data: {
        code: code !== undefined ? code : undefined,
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        accountsReceivableId: accountsReceivableId !== undefined ? (accountsReceivableId || null) : undefined,
        revenueAccountId: revenueAccountId !== undefined ? (revenueAccountId || null) : undefined,
        taxGroup: taxGroup !== undefined ? taxGroup : undefined,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        creditPeriod: creditPeriod !== undefined ? parseInt(creditPeriod) : undefined,
        allowCreditSales: allowCreditSales !== undefined ? (allowCreditSales === true || allowCreditSales === 'true') : undefined,
        priceList: priceList !== undefined ? priceList : undefined,
        discountGroup: discountGroup !== undefined ? discountGroup : undefined,
        salesTerritory: salesTerritory !== undefined ? salesTerritory : undefined,
        salesRep: salesRep !== undefined ? salesRep : undefined
      },
      include: {
        accountsReceivable: true,
        revenueAccount: true
      }
    });

    res.json(category);
  } catch (error) {
    console.error('Update customer category error:', error);
    res.status(500).json({ error: 'Failed to update customer category' });
  }
};

const deleteCustomerCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customerCategory.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Customer category not found' });
    }

    await prisma.customerCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer category error:', error);
    res.status(500).json({ error: 'Failed to delete customer category' });
  }
};

module.exports = {
  getCustomerCategories,
  createCustomerCategory,
  updateCustomerCategory,
  deleteCustomerCategory
};
