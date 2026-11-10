const prisma = require('../lib/prisma');

const getPaymentTerms = async (req, res) => {
  try {
    const terms = await prisma.paymentTerm.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { days: 'asc' }
    });
    res.json(terms);
  } catch (error) {
    console.error('Fetch payment terms error:', error);
    res.status(500).json({ error: 'Failed to fetch payment terms' });
  }
};

const createPaymentTerm = async (req, res) => {
  try {
    const { code, name, days } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Payment term code is required.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Payment term name is required.' });
    }

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const parsedDays = parseInt(days) || 0;

    // Prevent duplicate codes within the same tenant
    const existing = await prisma.paymentTerm.findFirst({
      where: {
        tenantId: req.tenantId,
        code: trimmedCode
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Payment term code already exists.' });
    }

    const term = await prisma.paymentTerm.create({
      data: {
        tenantId: req.tenantId,
        code: trimmedCode,
        name: trimmedName,
        days: parsedDays,
        createdBy: req.user?.userId
      }
    });

    res.status(201).json(term);
  } catch (error) {
    console.error('Create payment term error:', error);
    res.status(500).json({ error: 'Failed to create payment term' });
  }
};

const updatePaymentTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, days } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Payment term code is required.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Payment term name is required.' });
    }

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const parsedDays = parseInt(days) || 0;

    // Verify ownership
    const existing = await prisma.paymentTerm.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment term not found.' });
    }

    // Check duplicate code (excluding current ID)
    const duplicate = await prisma.paymentTerm.findFirst({
      where: {
        tenantId: req.tenantId,
        code: trimmedCode,
        NOT: { id }
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: 'Another payment term with this code already exists.' });
    }

    const updated = await prisma.paymentTerm.update({
      where: { id },
      data: { 
        code: trimmedCode,
        name: trimmedName,
        days: parsedDays
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update payment term error:', error);
    res.status(500).json({ error: 'Failed to update payment term' });
  }
};

const deletePaymentTerm = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.paymentTerm.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment term not found.' });
    }

    await prisma.paymentTerm.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete payment term error:', error);
    res.status(500).json({ error: 'Failed to delete payment term' });
  }
};

module.exports = {
  getPaymentTerms,
  createPaymentTerm,
  updatePaymentTerm,
  deletePaymentTerm
};
