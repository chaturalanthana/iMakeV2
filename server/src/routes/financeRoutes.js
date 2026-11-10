const express = require('express');
const financeController = require('../controllers/financeController');
const currencyRoutes = require('./currencyRoutes');
const taxGroupRoutes = require('./taxGroupRoutes');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

// Currencies CRUD
router.use('/currencies', currencyRoutes);

// Tax Groups CRUD
router.use('/tax-groups', taxGroupRoutes);

// Accounts (General Ledger)
router.get('/accounts', financeController.getAccounts);
router.post('/accounts/template', financeController.generateAccountTemplate);
router.post('/accounts', financeController.createAccount);
router.put('/accounts/:id', financeController.updateAccount);
router.delete('/accounts/:id', financeController.deleteAccount);

// General Ledger Transaction Lines
router.get('/ledger', financeController.getGeneralLedgerLines);

// Journal Entries
router.get('/journal-entries', financeController.getJournalEntries);
router.post('/journal-entries', financeController.createJournalEntry);

// Payment Receipts
router.get('/payment-receipts', financeController.getPaymentReceipts);
router.post('/payment-receipts', financeController.createPaymentReceipt);

// Payment Vouchers
router.get('/payment-vouchers', financeController.getPaymentVouchers);
router.post('/payment-vouchers', financeController.createPaymentVoucher);

// Bank Reconciliation
const bankReconcileRoutes = require('./bankReconcileRoutes');
router.use('/reconciliation', bankReconcileRoutes);

module.exports = router;
