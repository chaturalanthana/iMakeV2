const prisma = require('../lib/prisma');
const { sendError } = require('../services/errors');
const { DocumentError } = require('../services/errors');
const { money, rateOf, dec } = require('../services/money');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { allocateCustomerReceipt, allocateSupplierPayment, syncSalesInvoiceStatus, syncSupplierInvoiceStatus, cancelStockAndJournal } = require('../services/documentPosting');
const { trialBalance } = require('../services/glService');
const { assertPeriodOpen } = require('../services/periodService');
const { writeAudit } = require('../services/auditService');
const { loadRule, levelsForAmount, submitForApproval } = require('../services/approvalService');
const { respondList } = require('../services/listQuery');
const { toXlsx } = require('../services/spreadsheet');

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
    await respondList(req, res, {
      model: prisma.journalEntry,
      where: { tenantId: req.tenantId },
      include: { lines: { include: { account: true } } },
      search: ['entryNumber', 'description', 'status'],
      sortFields: ['date', 'entryNumber', 'createdAt'],
      defaultSort: 'date',
      filename: 'journals.xlsx',
      exportHeaders: ['date', 'entryNumber', 'description', 'status'],
      toExport: (row) => ({
        date: row.date?.toISOString?.().slice(0, 10) || '',
        entryNumber: row.entryNumber,
        description: row.description || '',
        status: row.status || (row.isPosted ? 'POSTED' : 'DRAFT')
      })
    });
  } catch (error) {
    console.error('Fetch journal entries error:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
};

const createJournalEntry = async (req, res) => {
  try {
    const { date, description, lines } = req.body;
    const entryNumber = String(req.body.entryNumber || '').trim()
      || await generateDocumentNumber(req.tenantId, 'journalEntry', 'JE', 'entryNumber');
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

    const amount = totalDebit;
    const rule = await loadRule(prisma, req.tenantId, 'JOURNAL');
    const needed = levelsForAmount(rule, amount);
    const hold = Boolean(rule?.enabled && needed.length);
    await assertPeriodOpen(prisma, { tenantId: req.tenantId, date, userId: req.user.userId });

    const entry = await prisma.journalEntry.create({
      data: {
        tenantId: req.tenantId,
        entryNumber,
        date: new Date(date),
        description,
        isPosted: !hold,
        status: hold ? 'PENDING_APPROVAL' : 'POSTED',
        createdBy: req.user.userId,
        lines: {
          create: lines.map(line => ({
            accountId: line.accountId,
            debit: parseFloat(line.debit || 0),
            credit: parseFloat(line.credit || 0),
            description: line.description,
            costCenterId: line.costCenterId || null,
            profitCenterId: line.profitCenterId || null
          }))
        }
      },
      include: { lines: { include: { account: true } } }
    });
    if (rule?.enabled) {
      await submitForApproval(prisma, {
        tenantId: req.tenantId,
        documentType: 'JOURNAL',
        documentId: entry.id,
        documentNumber: entry.entryNumber,
        amount,
        userId: req.user.userId
      });
    }
    await writeAudit(prisma, {
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: hold ? 'CREATE' : 'POST',
      entity: 'JOURNAL',
      entityId: entry.id,
      after: entry
    });
    res.status(201).json(entry);
  } catch (error) {
    return sendError(res, error, 'Failed to create journal entry');
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

function allocationRows(body, invoiceKey) {
  const fromBody = Array.isArray(body.allocations) ? body.allocations : [];
  const rows = fromBody
    .map((row) => ({
      invoiceId: row.invoiceId || row[invoiceKey],
      supplierInvoiceId: row.supplierInvoiceId || row.invoiceId,
      amount: money(row.amount)
    }))
    .filter((row) => row.amount > 0 && (row.invoiceId || row.supplierInvoiceId));
  return rows;
}

const createPaymentReceipt = async (req, res) => {
  try {
    const { customerId, accountId, receiptNumber, amount, date, method, reference, bankName, chequeNumber, lines, invoiceId } = req.body;
    const allocations = allocationRows(req.body, 'invoiceId');
    if (!allocations.length && invoiceId) allocations.push({ invoiceId, amount: money(amount) });
    if (!allocations.length && lines) {
      for (const line of lines) {
        if (line.invoiceId) allocations.push({ invoiceId: line.invoiceId, amount: money(line.amount) });
      }
    }

    if (allocations.length) {
      const allocated = money(allocations.reduce((sum, row) => sum + row.amount, 0));
      if (Math.abs(allocated - money(amount)) > 0.001) {
        return res.status(400).json({
          error: 'Receipt amount must equal the allocated invoices.',
          fields: { amount: 'Receipt amount must equal the allocated invoices.' }
        });
      }
    } else if (lines && lines.length > 0) {
      let calculatedAmount = 0;
      for (const line of lines) calculatedAmount += parseFloat(line.amount || 0);
      if (Math.abs(calculatedAmount - parseFloat(amount)) > 0.001) {
        return res.status(400).json({ error: 'Receipt amount must equal the sum of receipt lines.' });
      }
    }

    const number = receiptNumber || await generateDocumentNumber(req.tenantId, 'paymentReceipt', 'REC', 'receiptNumber');
    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentReceipt.create({
        data: {
          tenantId: req.tenantId,
          customerId,
          accountId: accountId || null,
          receiptNumber: number,
          amount: parseFloat(amount),
          date: new Date(date),
          method,
          reference,
          bankName,
          chequeNumber,
          exchangeRate: rateOf(req.body.exchangeRate),
          createdBy: req.user.userId,
          ...(!allocations.length && lines && lines.length > 0 && {
            lines: {
              create: lines.map(line => ({
                accountId: line.accountId,
                invoiceId: line.invoiceId || null,
                amount: parseFloat(line.amount || 0),
                description: line.description
              }))
            }
          })
        }
      });
      if (allocations.length) {
        await allocateCustomerReceipt(tx, {
          tenantId: req.tenantId,
          receipt: created,
          allocations,
          createdBy: req.user.userId
        });
      }
      return tx.paymentReceipt.findUnique({
        where: { id: created.id },
        include: { customer: true, lines: { include: { account: true, invoice: true } } }
      });
    });

    res.status(201).json(receipt);
  } catch (error) {
    return sendError(res, error, 'Failed to create payment receipt');
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
    const { supplierId, voucherNumber, amount, date, method, reference, bankName, chequeNumber, lines, accountId } = req.body;
    const allocations = (Array.isArray(req.body.allocations) ? req.body.allocations : [])
      .map((row) => ({ supplierInvoiceId: row.supplierInvoiceId || row.invoiceId, amount: money(row.amount) }))
      .filter((row) => row.supplierInvoiceId && row.amount > 0);

    if (allocations.length) {
      const allocated = money(allocations.reduce((sum, row) => sum + row.amount, 0));
      if (Math.abs(allocated - money(amount)) > 0.001) {
        return res.status(400).json({
          error: 'Voucher amount must equal the allocated invoices.',
          fields: { amount: 'Voucher amount must equal the allocated invoices.' }
        });
      }
    } else if (lines && lines.length > 0) {
      let calculatedAmount = 0;
      for (const line of lines) calculatedAmount += parseFloat(line.amount || 0);
      if (Math.abs(calculatedAmount - parseFloat(amount)) > 0.001) {
        return res.status(400).json({ error: 'Voucher amount must equal the sum of expense lines.' });
      }
    }

    const number = voucherNumber || await generateDocumentNumber(req.tenantId, 'paymentVoucher', 'PV', 'voucherNumber');
    const rule = await loadRule(prisma, req.tenantId, 'SUPPLIER_PAYMENT');
    const needed = levelsForAmount(rule, amount);
    const hold = Boolean(rule?.enabled && needed.length);
    await assertPeriodOpen(prisma, { tenantId: req.tenantId, date, userId: req.user.userId });
    const voucher = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentVoucher.create({
        data: {
          tenantId: req.tenantId,
          supplierId,
          voucherNumber: number,
          amount: parseFloat(amount),
          date: new Date(date),
          method,
          reference,
          bankName,
          chequeNumber,
          accountId: accountId || null,
          status: hold ? 'PENDING_APPROVAL' : 'POSTED',
          exchangeRate: rateOf(req.body.exchangeRate),
          createdBy: req.user.userId,
          ...(!allocations.length && lines && lines.length > 0 && {
            lines: {
              create: lines.map(line => ({
                accountId: line.accountId,
                amount: parseFloat(line.amount || 0),
                description: line.description
              }))
            }
          })
        }
      });
      if (allocations.length && !hold) {
        await allocateSupplierPayment(tx, {
          tenantId: req.tenantId,
          voucher: created,
          allocations,
          createdBy: req.user.userId
        });
      }
      if (rule?.enabled) {
        await submitForApproval(tx, {
          tenantId: req.tenantId,
          documentType: 'SUPPLIER_PAYMENT',
          documentId: created.id,
          documentNumber: created.voucherNumber,
          amount,
          userId: req.user.userId,
          payload: { allocations }
        });
      }
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user.userId,
        action: hold ? 'CREATE' : 'POST',
        entity: 'SUPPLIER_PAYMENT',
        entityId: created.id,
        after: created
      });
      return tx.paymentVoucher.findUnique({
        where: { id: created.id },
        include: { supplier: true, lines: { include: { account: true } }, allocations: true }
      });
    });

    res.status(201).json(voucher);
  } catch (error) {
    return sendError(res, error, 'Failed to create payment voucher');
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

const getTrialBalance = async (req, res) => {
  try {
    const report = await trialBalance(prisma, req.tenantId);
    if (req.query.export === 'xlsx') {
      const headers = ['code', 'name', 'type', 'debit', 'credit'];
      const rows = report.accounts.map((row) => ({
        code: row.code,
        name: row.name,
        type: row.type,
        debit: String(row.debit),
        credit: String(row.credit)
      }));
      const buffer = toXlsx(headers, rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="trial-balance.xlsx"');
      return res.send(buffer);
    }
    res.json(report);
  } catch (error) {
    return sendError(res, error, 'Failed to build the trial balance');
  }
};

const reverseJournalEntry = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    const existing = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { lines: true }
    });
    if (!existing) return res.status(404).json({ error: 'Journal entry not found' });
    if (!existing.isPosted) return res.status(400).json({ error: 'Only a posted journal can be reversed.' });
    if (String(existing.description || '').startsWith('Reversal:')) {
      return res.status(400).json({ error: 'A reversal cannot be reversed from here.' });
    }
    const { postJournal } = require('../services/glService');
    const reversal = await prisma.$transaction(async (tx) => {
      const entry = await postJournal(tx, {
        tenantId: req.tenantId,
        date: new Date(),
        createdBy: req.user.userId,
        description: `Reversal: ${existing.description}`,
        referenceType: 'JOURNAL',
        referenceId: existing.id,
        lines: existing.lines.map((line) => ({
          accountId: line.accountId,
          debit: money(line.credit),
          credit: money(line.debit),
          description: reason
        }))
      });
      await tx.journalEntry.update({ where: { id: existing.id }, data: { status: 'REVERSED' } });
      await writeAudit(tx, {
        tenantId: req.tenantId,
        userId: req.user.userId,
        action: 'REVERSE',
        entity: 'JOURNAL',
        entityId: existing.id,
        before: existing,
        after: { status: 'REVERSED', reason }
      });
      return entry;
    });
    res.json({ success: true, reversal });
  } catch (error) {
    return sendError(res, error, 'Failed to reverse the journal');
  }
};

const cancelPaymentReceipt = async (req, res) => {
  try {
    const existing = await prisma.paymentReceipt.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { lines: true }
    });
    if (!existing) return res.status(404).json({ error: 'Receipt not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Receipt is already cancelled.' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    await prisma.$transaction(async (tx) => {
      for (const line of existing.lines) {
        if (!line.invoiceId) continue;
        const invoice = await tx.salesInvoice.findUnique({ where: { id: line.invoiceId } });
        if (!invoice) continue;
        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: { amountPaid: dec(Math.max(0, money(invoice.amountPaid) - money(line.amount))) }
        });
        await syncSalesInvoiceStatus(tx, invoice.id);
      }
      await cancelStockAndJournal(tx, {
        tenantId: req.tenantId,
        referenceType: 'PAYMENT_RECEIPT',
        referenceId: existing.id,
        date: new Date(),
        createdBy: req.user?.userId,
        description: existing.receiptNumber
      });
      await tx.paymentReceipt.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel receipt');
  }
};

const cancelPaymentVoucher = async (req, res) => {
  try {
    const existing = await prisma.paymentVoucher.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { allocations: true }
    });
    if (!existing) return res.status(404).json({ error: 'Voucher not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Voucher is already cancelled.' });
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required.', fields: { reason: 'A reason is required.' } });
    if (existing.status === 'PENDING_APPROVAL') {
      await prisma.paymentVoucher.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
      return res.json({ success: true, cancelled: true });
    }
    await prisma.$transaction(async (tx) => {
      for (const allocation of existing.allocations) {
        const invoice = await tx.supplierInvoice.findUnique({ where: { id: allocation.supplierInvoiceId } });
        if (!invoice) continue;
        await tx.supplierInvoice.update({
          where: { id: invoice.id },
          data: { amountPaid: dec(Math.max(0, money(invoice.amountPaid) - money(allocation.amount))) }
        });
        await syncSupplierInvoiceStatus(tx, invoice.id);
      }
      await cancelStockAndJournal(tx, {
        tenantId: req.tenantId,
        referenceType: 'PAYMENT_VOUCHER',
        referenceId: existing.id,
        date: new Date(),
        createdBy: req.user?.userId,
        description: existing.voucherNumber
      });
      await tx.paymentVoucher.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    });
    res.json({ success: true, cancelled: true });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel voucher');
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
  cancelPaymentReceipt,
  getPaymentVouchers,
  createPaymentVoucher,
  cancelPaymentVoucher,
  getTrialBalance,
  reverseJournalEntry
};
