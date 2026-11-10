const prisma = require('../lib/prisma');

const getCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { tenantId: req.tenantId },
      include: {
        accountsReceivable: true,
        revenueAccount: true,
        customerCategoryRel: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { 
      code, name, email, phone, address, creditLimit,
      customerType, customerCategory, mobileNumber, activeStatus,
      creditCustomer, creditPeriod, branches, salesRep, priceList,
      industry, customerSegment,
      accountsReceivableId, revenueAccountId, taxGroup,
      discountGroup, salesTerritory, allowCreditSales, customerCategoryId
    } = req.body;
    
    // Check validation
    if (!name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    // Check duplication (by code)
    if (code) {
      const existing = await prisma.customer.findFirst({
        where: { tenantId: req.tenantId, code }
      });
      if (existing) {
        return res.status(400).json({ error: 'Customer code already exists.' });
      }
    }

    // Validate credit limits
    let isCreditAllowed = creditCustomer === true || creditCustomer === 'true' || allowCreditSales === true || allowCreditSales === 'true';
    if (!isCreditAllowed && customerCategoryId) {
      const category = await prisma.customerCategory.findFirst({
        where: { id: customerCategoryId, tenantId: req.tenantId }
      });
      if (category && (category.allowCreditSales || parseFloat(category.creditLimit) > 0)) {
        isCreditAllowed = true;
      }
    }

    if (!isCreditAllowed) {
      if ((creditLimit && parseFloat(creditLimit) > 0) || (creditPeriod && parseInt(creditPeriod) > 0)) {
        return res.status(400).json({ error: 'Credit limit and credit period are only allowed when credit sales are enabled.' });
      }
    }

    // Validate accountsReceivableId
    if (accountsReceivableId) {
      const arAccount = await prisma.account.findFirst({
        where: { id: accountsReceivableId, tenantId: req.tenantId }
      });
      if (!arAccount) {
        return res.status(400).json({ error: 'Accounts Receivable account not found.' });
      }
      if (arAccount.type !== 'ASSET') {
        return res.status(400).json({ error: 'Accounts Receivable account must be an ASSET.' });
      }
      // Check if it's a leaf account
      const hasChildren = await prisma.account.findFirst({
        where: { parentId: accountsReceivableId, tenantId: req.tenantId }
      });
      if (hasChildren) {
        return res.status(400).json({ error: 'Accounts Receivable account must be a leaf account.' });
      }
    }

    // Validate revenueAccountId
    if (revenueAccountId) {
      const revAccount = await prisma.account.findFirst({
        where: { id: revenueAccountId, tenantId: req.tenantId }
      });
      if (!revAccount) {
        return res.status(400).json({ error: 'Revenue account not found.' });
      }
      if (revAccount.type !== 'REVENUE') {
        return res.status(400).json({ error: 'Revenue account must be a REVENUE account.' });
      }
      // Check if it's a leaf account
      const hasChildren = await prisma.account.findFirst({
        where: { parentId: revenueAccountId, tenantId: req.tenantId }
      });
      if (hasChildren) {
        return res.status(400).json({ error: 'Revenue account must be a leaf account.' });
      }
    }


    const customer = await prisma.customer.create({
      data: {
        tenantId: req.tenantId,
        code: code || `CUS-${Date.now().toString().slice(-4)}`,
        name,
        email,
        phone,
        address,
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0.0,
        customerType: customerType || null,
        customerCategory: customerCategory || null, // legacy string
        mobileNumber: mobileNumber || null,
        activeStatus: activeStatus || 'ACTIVE',
        creditCustomer: creditCustomer === true || creditCustomer === 'true',
        creditPeriod: creditPeriod ? parseInt(creditPeriod) : 0,
        branches: branches || [],
        salesRep: salesRep || null,
        priceList: priceList || null,
        industry: industry || null,
        customerSegment: customerSegment || null,
        accountsReceivableId: accountsReceivableId || null,
        revenueAccountId: revenueAccountId || null,
        taxGroup: taxGroup || null,
        discountGroup: discountGroup || null,
        salesTerritory: salesTerritory || null,
        allowCreditSales: allowCreditSales === true || allowCreditSales === 'true',
        customerCategoryId: customerCategoryId || null,
        createdBy: req.user.userId
      },
      include: {
        accountsReceivable: true,
        revenueAccount: true,
        customerCategoryRel: true
      }
    });
    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, name, email, phone, address, creditLimit,
      customerType, customerCategory, mobileNumber, activeStatus,
      creditCustomer, creditPeriod, branches, salesRep, priceList,
      industry, customerSegment,
      accountsReceivableId, revenueAccountId, taxGroup,
      discountGroup, salesTerritory, allowCreditSales, customerCategoryId
    } = req.body;
    
    // Ensure customer belongs to tenant
    const existing = await prisma.customer.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    if (name === '') {
      return res.status(400).json({ error: 'Customer name cannot be empty.' });
    }

    // Validate credit limits
    let isCreditAllowed = creditCustomer !== undefined 
      ? (creditCustomer === true || creditCustomer === 'true' || allowCreditSales === true || allowCreditSales === 'true')
      : (existing.creditCustomer || existing.allowCreditSales);
    
    const categoryIdToCheck = customerCategoryId !== undefined ? customerCategoryId : existing.customerCategoryId;
    if (!isCreditAllowed && categoryIdToCheck) {
      const category = await prisma.customerCategory.findFirst({
        where: { id: categoryIdToCheck, tenantId: req.tenantId }
      });
      if (category && (category.allowCreditSales || parseFloat(category.creditLimit) > 0)) {
        isCreditAllowed = true;
      }
    }
    
    const checkingLimit = creditLimit !== undefined ? parseFloat(creditLimit) : parseFloat(existing.creditLimit || 0);
    const checkingPeriod = creditPeriod !== undefined ? parseInt(creditPeriod) : parseInt(existing.creditPeriod || 0);

    if (!isCreditAllowed && (checkingLimit > 0 || checkingPeriod > 0)) {
      return res.status(400).json({ error: 'Credit limit and credit period are only allowed when credit sales are enabled.' });
    }

    // Validate accountsReceivableId
    if (accountsReceivableId) {
      const arAccount = await prisma.account.findFirst({
        where: { id: accountsReceivableId, tenantId: req.tenantId }
      });
      if (!arAccount) {
        return res.status(400).json({ error: 'Accounts Receivable account not found.' });
      }
      if (arAccount.type !== 'ASSET') {
        return res.status(400).json({ error: 'Accounts Receivable account must be an ASSET.' });
      }
      // Check if it's a leaf account
      const hasChildren = await prisma.account.findFirst({
        where: { parentId: accountsReceivableId, tenantId: req.tenantId }
      });
      if (hasChildren) {
        return res.status(400).json({ error: 'Accounts Receivable account must be a leaf account.' });
      }
    }

    // Validate revenueAccountId
    if (revenueAccountId) {
      const revAccount = await prisma.account.findFirst({
        where: { id: revenueAccountId, tenantId: req.tenantId }
      });
      if (!revAccount) {
        return res.status(400).json({ error: 'Revenue account not found.' });
      }
      if (revAccount.type !== 'REVENUE') {
        return res.status(400).json({ error: 'Revenue account must be a REVENUE account.' });
      }
      // Check if it's a leaf account
      const hasChildren = await prisma.account.findFirst({
        where: { parentId: revenueAccountId, tenantId: req.tenantId }
      });
      if (hasChildren) {
        return res.status(400).json({ error: 'Revenue account must be a leaf account.' });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { 
        code, 
        name, 
        email, 
        phone, 
        address,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        customerType: customerType !== undefined ? customerType : undefined,
        customerCategory: customerCategory !== undefined ? customerCategory : undefined,
        mobileNumber: mobileNumber !== undefined ? mobileNumber : undefined,
        activeStatus: activeStatus !== undefined ? activeStatus : undefined,
        creditCustomer: creditCustomer !== undefined ? (creditCustomer === true || creditCustomer === 'true') : undefined,
        creditPeriod: creditPeriod !== undefined ? parseInt(creditPeriod) : undefined,
        branches: branches !== undefined ? branches : undefined,
        salesRep: salesRep !== undefined ? salesRep : undefined,
        priceList: priceList !== undefined ? priceList : undefined,
        industry: industry !== undefined ? industry : undefined,
        customerSegment: customerSegment !== undefined ? customerSegment : undefined,
        accountsReceivableId: accountsReceivableId !== undefined ? (accountsReceivableId || null) : undefined,
        revenueAccountId: revenueAccountId !== undefined ? (revenueAccountId || null) : undefined,
        taxGroup: taxGroup !== undefined ? taxGroup : undefined,
        discountGroup: discountGroup !== undefined ? discountGroup : undefined,
        salesTerritory: salesTerritory !== undefined ? salesTerritory : undefined,
        allowCreditSales: allowCreditSales !== undefined ? (allowCreditSales === true || allowCreditSales === 'true') : undefined,
        customerCategoryId: customerCategoryId !== undefined ? (customerCategoryId || null) : undefined
      },
      include: {
        accountsReceivable: true,
        revenueAccount: true,
        customerCategoryRel: true
      }
    });
    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customer.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    await prisma.customer.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (error.code === 'P2003') { 
      return res.status(400).json({ error: 'Cannot delete customer associated with existing transactions.' });
    }
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
