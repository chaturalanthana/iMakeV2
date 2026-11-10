const prisma = require('../lib/prisma');

const getCurrencies = async (req, res) => {
  try {
    const currencies = await prisma.currency.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { code: 'asc' }
    });
    res.json(currencies);
  } catch (error) {
    console.error('Fetch currencies error:', error);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
};

const createCurrency = async (req, res) => {
  try {
    const { code, symbol, name, exchangeRate, isBase } = req.body;

    if (!code || !code.trim() || !name || !name.trim()) {
      return res.status(400).json({ error: 'Code and Name are required.' });
    }

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const parsedExchangeRate = parseFloat(exchangeRate) || 1.0;
    const isBaseBoolean = isBase === true || isBase === 'true';

    // Prevent duplicate codes within the same tenant
    const existing = await prisma.currency.findFirst({
      where: {
        tenantId: req.tenantId,
        code: trimmedCode
      }
    });

    if (existing) {
      return res.status(400).json({ error: `Currency code "${trimmedCode}" already exists.` });
    }

    // If this is set as base, unset any previous base currency
    if (isBaseBoolean) {
      await prisma.currency.updateMany({
        where: { tenantId: req.tenantId, isBase: true },
        data: { isBase: false }
      });
    }

    const currency = await prisma.currency.create({
      data: {
        tenantId: req.tenantId,
        code: trimmedCode,
        symbol: symbol ? symbol.trim() : null,
        name: trimmedName,
        exchangeRate: parsedExchangeRate,
        isBase: isBaseBoolean
      }
    });

    res.status(201).json(currency);
  } catch (error) {
    console.error('Create currency error:', error);
    res.status(500).json({ error: 'Failed to create currency' });
  }
};

const updateCurrency = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, symbol, name, exchangeRate, isBase } = req.body;

    if (!code || !code.trim() || !name || !name.trim()) {
      return res.status(400).json({ error: 'Code and Name are required.' });
    }

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const parsedExchangeRate = parseFloat(exchangeRate) || 1.0;
    const isBaseBoolean = isBase === true || isBase === 'true';

    // Verify ownership
    const existing = await prisma.currency.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Currency not found.' });
    }

    // Check duplicate code (excluding current ID)
    const duplicate = await prisma.currency.findFirst({
      where: {
        tenantId: req.tenantId,
        code: trimmedCode,
        NOT: { id }
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: `Another currency with code "${trimmedCode}" already exists.` });
    }

    // If this is set as base, unset any previous base currency
    if (isBaseBoolean) {
      await prisma.currency.updateMany({
        where: { tenantId: req.tenantId, isBase: true, NOT: { id } },
        data: { isBase: false }
      });
    }

    const updated = await prisma.currency.update({
      where: { id },
      data: {
        code: trimmedCode,
        symbol: symbol ? symbol.trim() : null,
        name: trimmedName,
        exchangeRate: parsedExchangeRate,
        isBase: isBaseBoolean
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({ error: 'Failed to update currency' });
  }
};

const deleteCurrency = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.currency.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Currency not found.' });
    }

    // Check if linked to products
    const productCount = await prisma.product.count({
      where: { tenantId: req.tenantId, currencyId: id }
    });

    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete currency because it is linked to one or more products.' });
    }

    // Check if linked to POs
    const poCount = await prisma.purchaseOrder.count({
      where: { tenantId: req.tenantId, currencyId: id }
    });

    if (poCount > 0) {
      return res.status(400).json({ error: 'Cannot delete currency because it is linked to one or more purchase orders.' });
    }

    // Check if linked to GRNs
    const grnCount = await prisma.gRN.count({
      where: { tenantId: req.tenantId, currencyId: id }
    });

    if (grnCount > 0) {
      return res.status(400).json({ error: 'Cannot delete currency because it is linked to one or more GRNs.' });
    }

    // Check if linked to sales orders/invoices/quotations
    const salesQuotationCount = await prisma.salesQuotation.count({
      where: { tenantId: req.tenantId, currencyId: id }
    });
    const salesOrderCount = await prisma.salesOrder.count({
      where: { tenantId: req.tenantId, currencyId: id }
    });
    const salesInvoiceCount = await prisma.salesInvoice.count({
      where: { tenantId: req.tenantId, currencyId: id }
    });

    if (salesQuotationCount > 0 || salesOrderCount > 0 || salesInvoiceCount > 0) {
      return res.status(400).json({ error: 'Cannot delete currency because it is linked to one or more sales transactions.' });
    }

    await prisma.currency.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete currency error:', error);
    res.status(500).json({ error: 'Failed to delete currency' });
  }
};

module.exports = {
  getCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency
};
