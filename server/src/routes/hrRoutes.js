const express = require('express');
const hrController = require('../controllers/hrController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();
router.use(requireTenant);

// Employees
router.get('/employees', hrController.getEmployees);
router.post('/employees', hrController.createEmployee);
router.put('/employees/:id', hrController.updateEmployee);
router.delete('/employees/:id', hrController.deleteEmployee);

// Additions Master
router.get('/additions', hrController.getAdditions);
router.post('/additions', hrController.createAddition);
router.put('/additions/:id', hrController.updateAddition);
router.delete('/additions/:id', hrController.deleteAddition);

// Deductions Registry
router.get('/deductions', hrController.getDeductions);
router.post('/deductions', hrController.createDeduction);
router.put('/deductions/:id', hrController.updateDeduction);
router.delete('/deductions/:id', hrController.deleteDeduction);

// Leave Types
router.get('/leave-types', hrController.getLeaveTypes);
router.post('/leave-types', hrController.createLeaveType);
router.put('/leave-types/:id', hrController.updateLeaveType);
router.delete('/leave-types/:id', hrController.deleteLeaveType);

// Leave Applications
router.get('/leave-applications', hrController.getLeaveApplications);
router.post('/leave-applications', hrController.createLeaveApplication);
router.put('/leave-applications/:id/status', hrController.updateLeaveStatus);

// Loans
router.get('/loans', hrController.getLoans);
router.post('/loans', hrController.createLoan);
router.put('/loans/:id/status', hrController.updateLoanStatus);

// Salary Runs
router.get('/salary-runs', hrController.getSalaryRuns);
router.post('/salary-runs', hrController.createSalaryRun);
router.get('/salary-runs/:id', hrController.getSalaryRunById);
router.get('/salary-runs/:runId/payslip/:employeeId', hrController.getPaySlip);

// Payroll Preview
router.get('/payroll-preview', hrController.getPayrollPreview);

// Company Holidays
router.get('/holidays', hrController.getHolidays);
router.post('/holidays', hrController.createHoliday);
router.put('/holidays/:id', hrController.updateHoliday);
router.delete('/holidays/:id', hrController.deleteHoliday);

module.exports = router;
