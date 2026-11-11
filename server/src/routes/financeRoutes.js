const express = require('express');
const financeController = require('../controllers/financeController');
const complianceController = require('../controllers/complianceController');
const currencyRoutes = require('./currencyRoutes');
const taxGroupRoutes = require('./taxGroupRoutes');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

// Currencies CRUD
router.use('/currencies', currencyRoutes);

// Tax Groups CRUD
router.use('/tax-groups', taxGroupRoutes);

// Accounts (General Ledger)
router.get('/accounts', financeController.getAccounts);
router.post('/accounts/template', financeController.generateAccountTemplate);
router.post('/accounts', validateBody(schemas.account), financeController.createAccount);
router.put('/accounts/:id', validateBody(schemas.accountUpdate), financeController.updateAccount);
router.delete('/accounts/:id', financeController.deleteAccount);

// General Ledger Transaction Lines
router.get('/ledger', financeController.getGeneralLedgerLines);
router.get('/trial-balance', financeController.getTrialBalance);
router.get('/tax-return', complianceController.taxReturn);

// Journal Entries
router.get('/journal-entries', financeController.getJournalEntries);
router.post('/journal-entries', validateBody(schemas.journalEntry), financeController.createJournalEntry);
router.post('/journal-entries/:id/reverse', financeController.reverseJournalEntry);

// Payment Receipts
router.get('/payment-receipts', financeController.getPaymentReceipts);
router.post('/payment-receipts', validateBody(schemas.customerReceipt), financeController.createPaymentReceipt);
router.post('/payment-receipts/:id/cancel', financeController.cancelPaymentReceipt);

// Payment Vouchers
router.get('/payment-vouchers', financeController.getPaymentVouchers);
router.get('/payment-vouchers/:id/wht-certificate', complianceController.whtCertificate);
router.post('/payment-vouchers', validateBody(schemas.supplierPayment), financeController.createPaymentVoucher);
router.post('/payment-vouchers/:id/cancel', financeController.cancelPaymentVoucher);

// Bank Reconciliation
const bankReconcileRoutes = require('./bankReconcileRoutes');
router.use('/reconciliation', bankReconcileRoutes);

module.exports = router;
