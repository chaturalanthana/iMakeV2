const prisma = require('../lib/prisma');

// --- Accounts (General Ledger) ---
const getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { tenantId: req.tenantId },
      include: { parent: true },
      orderBy: { code: 'asc' }
    });
    res.json(accounts);
  } catch (error) {
    console.error('Fetch accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

const createAccount = async (req, res) => {
  try {
    const { code, name, type, parentId } = req.body;
    const account = await prisma.account.create({
      data: {
        tenantId: req.tenantId,
        code,
        name,
        type,
        parentId: parentId || null,
        createdBy: req.user.userId
      },
      include: { parent: true }
    });
    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

// --- Journal Entries ---
const getJournalEntries = async (req, res) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      where: { tenantId: req.tenantId },
      include: {
        lines: { include: { account: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    console.error('Fetch journal entries error:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
};

const createJournalEntry = async (req, res) => {
  try {
    const { entryNumber, date, description, lines } = req.body;
    // lines should be array of { accountId, debit, credit, description }
    
    // Check balanced
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }
    
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return res.status(400).json({ error: 'Journal entry is not balanced (Debits must equal Credits)' });
    }

    const entry = await prisma.journalEntry.create({
      data: {
        tenantId: req.tenantId,
        entryNumber,
        date: new Date(date),
        description,
        isPosted: true,
        createdBy: req.user.userId,
        lines: {
          create: lines.map(line => ({
            accountId: line.accountId,
            debit: parseFloat(line.debit || 0),
            credit: parseFloat(line.credit || 0),
            description: line.description
          }))
        }
      },
      include: { lines: { include: { account: true } } }
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error('Create journal entry error:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
};

// --- Payment Receipts ---
const getPaymentReceipts = async (req, res) => {
  try {
    const receipts = await prisma.paymentReceipt.findMany({
      where: { tenantId: req.tenantId },
      include: { customer: true, invoice: true },
      orderBy: { date: 'desc' }
    });
    res.json(receipts);
  } catch (error) {
    console.error('Fetch payment receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipts' });
  }
};

const createPaymentReceipt = async (req, res) => {
  try {
    const { customerId, accountId, receiptNumber, amount, date, method, reference, bankName, chequeNumber, lines } = req.body;
    
    // validate lines sum vs amount
    let calculatedAmount = 0;
    if (lines && lines.length > 0) {
      for (const line of lines) {
        calculatedAmount += parseFloat(line.amount || 0);
      }
      if (Math.abs(calculatedAmount - parseFloat(amount)) > 0.001) {
        return res.status(400).json({ error: 'Receipt amount must equal the sum of receipt lines.' });
      }
    }

    const receipt = await prisma.paymentReceipt.create({
      data: {
        tenantId: req.tenantId,
        customerId,
        accountId: accountId || null,
        receiptNumber,
        amount: parseFloat(amount),
        date: new Date(date),
        method,
        reference,
        bankName,
        chequeNumber,
        createdBy: req.user.userId,
        ...(lines && lines.length > 0 && {
          lines: {
            create: lines.map(line => ({
              accountId: line.accountId,
              invoiceId: line.invoiceId || null,
              amount: parseFloat(line.amount || 0),
              description: line.description
            }))
          }
        })
      },
      include: { 
        customer: true,
        lines: { include: { account: true, invoice: true } }
      }
    });

    res.status(201).json(receipt);
  } catch (error) {
    console.error('Create payment receipt error:', error);
    res.status(500).json({ error: 'Failed to create payment receipt' });
  }
};

// --- Payment Vouchers ---
const getPaymentVouchers = async (req, res) => {
  try {
    const vouchers = await prisma.paymentVoucher.findMany({
      where: { tenantId: req.tenantId },
      include: { supplier: true },
      orderBy: { date: 'desc' }
    });
    res.json(vouchers);
  } catch (error) {
    console.error('Fetch payment vouchers error:', error);
    res.status(500).json({ error: 'Failed to fetch payment vouchers' });
  }
};

const createPaymentVoucher = async (req, res) => {
  try {
    const { supplierId, voucherNumber, amount, date, method, reference, bankName, chequeNumber, lines } = req.body;
    
    // validate lines sum vs amount
    let calculatedAmount = 0;
    if (lines && lines.length > 0) {
      for (const line of lines) {
        calculatedAmount += parseFloat(line.amount || 0);
      }
      if (Math.abs(calculatedAmount - parseFloat(amount)) > 0.001) {
        return res.status(400).json({ error: 'Voucher amount must equal the sum of expense lines.' });
      }
    }

    const voucher = await prisma.paymentVoucher.create({
      data: {
        tenantId: req.tenantId,
        supplierId,
        voucherNumber,
        amount: parseFloat(amount),
        date: new Date(date),
        method,
        reference,
        bankName,
        chequeNumber,
        createdBy: req.user.userId,
        ...(lines && lines.length > 0 && {
          lines: {
            create: lines.map(line => ({
              accountId: line.accountId,
              amount: parseFloat(line.amount || 0),
              description: line.description
            }))
          }
        })
      },
      include: { 
        supplier: true,
        lines: { include: { account: true } }
      }
    });

    res.status(201).json(voucher);
  } catch (error) {
    console.error('Create payment voucher error:', error);
    res.status(500).json({ error: 'Failed to create payment voucher' });
  }
};

const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, type, parentId } = req.body;
    
    // Ensure account belongs to tenant
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Account not found' });

    // Validate parent hierarchy
    const newParentId = parentId || null;
    if (newParentId) {
      if (newParentId === id) {
        return res.status(400).json({ error: 'An account cannot be its own parent.' });
      }
      // Circular reference check
      let currentCheckId = newParentId;
      while (currentCheckId) {
        const checkAcc = await prisma.account.findUnique({ where: { id: currentCheckId } });
        if (!checkAcc) break;
        if (checkAcc.parentId === id) {
          return res.status(400).json({ error: 'Circular reference detected: Selected parent account is a sub-account of this account.' });
        }
        currentCheckId = checkAcc.parentId;
      }
    }

    const account = await prisma.account.update({
      where: { id },
      data: { 
        code, 
        name, 
        type,
        parentId: newParentId
      },
      include: { parent: true }
    });
    res.json(account);
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    // Ensure account belongs to tenant
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Account not found' });

    // Prisma relation OnDelete is Restrict for journal lines
    await prisma.account.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    if (error.code === 'P2003') { // Foreign key constraint failed
      return res.status(400).json({ error: 'Cannot delete account with existing journal entries.' });
    }
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

const generateAccountTemplate = async (req, res) => {
  try {
    const templateAccounts = [
      { code: '1000', name: 'Cash on Hand', type: 'ASSET' },
      { code: '1010', name: 'Checking Account', type: 'ASSET' },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1300', name: 'Inventory', type: 'ASSET' },
      { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2100', name: 'Sales Tax Payable', type: 'LIABILITY' },
      { code: '2500', name: 'Business Loan', type: 'LIABILITY' },
      { code: '3000', name: 'Owner Equity', type: 'EQUITY' },
      { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
      { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
      { code: '4100', name: 'Service Revenue', type: 'REVENUE' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
      { code: '6000', name: 'Rent Expense', type: 'EXPENSE' },
      { code: '6100', name: 'Utilities Expense', type: 'EXPENSE' },
      { code: '6200', name: 'Salaries & Wages', type: 'EXPENSE' },
      { code: '6300', name: 'Office Supplies', type: 'EXPENSE' },
      { code: '6400', name: 'Marketing Expense', type: 'EXPENSE' }
    ].map(acc => ({ ...acc, tenantId: req.tenantId, createdBy: req.user.userId }));

    // Fetch existing logic to prevent exact duplicates by code or name
    const existingAccounts = await prisma.account.findMany({ where: { tenantId: req.tenantId } });
    const existingCodes = new Set(existingAccounts.map(a => a.code).filter(c => c));
    const existingNames = new Set(existingAccounts.map(a => a.name.toLowerCase()));

    const filteredTemplate = templateAccounts.filter(
      acc => !existingCodes.has(acc.code) && !existingNames.has(acc.name.toLowerCase())
    );

    if (filteredTemplate.length > 0) {
      await prisma.account.createMany({ data: filteredTemplate });
    }
    
    res.json({ success: true, message: 'Template accounts generated successfully' });
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({ error: 'Failed to generate account template' });
  }
};

const getGeneralLedgerLines = async (req, res) => {
  try {
    const { accountId } = req.query;
    const whereClause = {
      account: { tenantId: req.tenantId }
    };
    if (accountId) {
      whereClause.accountId = accountId;
    }

    const lines = await prisma.journalLine.findMany({
      where: whereClause,
      include: {
        account: true,
        journalEntry: true
      },
      orderBy: {
        journalEntry: { date: 'asc' }
      }
    });
    res.json(lines);
  } catch (error) {
    console.error('Fetch general ledger lines error:', error);
    res.status(500).json({ error: 'Failed to fetch general ledger entries' });
  }
};

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  generateAccountTemplate,
  getGeneralLedgerLines,
  getJournalEntries,
  createJournalEntry,
  getPaymentReceipts,
  createPaymentReceipt,
  getPaymentVouchers,
  createPaymentVoucher
};
