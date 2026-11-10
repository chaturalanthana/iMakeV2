const prisma = require('../lib/prisma');

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { 
      name, 
      code, 
      email, 
      phone, 
      address,
      activeStatus,
      supplierCategory,
      leadTime,
      currency,
      creditSupplier,
      creditPeriod,
      paymentTerms,
      supplierGroup,
      branches,
      bankDetails,
      accountsPayableId,
      advancePaymentAccountId,
      withholdingTaxGroup,
      taxGroup
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Auto-generate supplier code if not provided
    const supplierCode = code || `SUP-${Date.now().toString().slice(-5)}`;

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: req.tenantId,
        name,
        code: supplierCode,
        email,
        phone,
        address,
        activeStatus: activeStatus || 'ACTIVE',
        supplierCategory,
        leadTime: leadTime ? parseInt(leadTime) : 0,
        currency: currency || 'USD',
        creditSupplier: !!creditSupplier,
        creditPeriod: creditPeriod ? parseInt(creditPeriod) : 0,
        paymentTerms,
        supplierGroup,
        branches: branches ? branches : [],
        bankDetails: bankDetails ? bankDetails : [],
        accountsPayableId,
        advancePaymentAccountId,
        withholdingTaxGroup,
        taxGroup,
        createdBy: req.user?.userId
      }
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Create supplier error:', error.message);
    res.status(500).json({ error: 'Failed to create supplier', details: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      code, 
      email, 
      phone, 
      address,
      activeStatus,
      supplierCategory,
      leadTime,
      currency,
      creditSupplier,
      creditPeriod,
      paymentTerms,
      supplierGroup,
      branches,
      bankDetails,
      accountsPayableId,
      advancePaymentAccountId,
      withholdingTaxGroup,
      taxGroup
    } = req.body;
    
    const supplier = await prisma.supplier.update({
      where: { id, tenantId: req.tenantId },
      data: { 
        name, 
        code, 
        email, 
        phone, 
        address,
        activeStatus,
        supplierCategory,
        leadTime: leadTime !== undefined ? parseInt(leadTime) : undefined,
        currency,
        creditSupplier: creditSupplier !== undefined ? !!creditSupplier : undefined,
        creditPeriod: creditPeriod !== undefined ? parseInt(creditPeriod) : undefined,
        paymentTerms,
        supplierGroup,
        branches: branches ? branches : undefined,
        bankDetails: bankDetails ? bankDetails : undefined,
        accountsPayableId,
        advancePaymentAccountId,
        withholdingTaxGroup,
        taxGroup
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Update supplier error:', error.message);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.supplier.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
