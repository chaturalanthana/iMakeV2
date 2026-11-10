const express = require('express');
const hrController = require('../controllers/hrController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requireTenant);

// Employees
router.get('/employees', hrController.getEmployees);
router.post('/employees', validateBody(schemas.employee), hrController.createEmployee);
router.put('/employees/:id', validateBody(schemas.employeeUpdate), hrController.updateEmployee);
router.delete('/employees/:id', hrController.deleteEmployee);

// Additions Master
router.get('/additions', hrController.getAdditions);
router.post('/additions', validateBody(schemas.hrNamed), hrController.createAddition);
router.put('/additions/:id', validateBody(schemas.hrNamed), hrController.updateAddition);
router.delete('/additions/:id', hrController.deleteAddition);

// Deductions Registry
router.get('/deductions', hrController.getDeductions);
router.post('/deductions', validateBody(schemas.hrNamed), hrController.createDeduction);
router.put('/deductions/:id', validateBody(schemas.hrNamed), hrController.updateDeduction);
router.delete('/deductions/:id', hrController.deleteDeduction);

// Leave Types
router.get('/leave-types', hrController.getLeaveTypes);
router.post('/leave-types', validateBody(schemas.hrNamed), hrController.createLeaveType);
router.put('/leave-types/:id', validateBody(schemas.hrNamed), hrController.updateLeaveType);
router.delete('/leave-types/:id', hrController.deleteLeaveType);

// Leave Applications
router.get('/leave-applications', hrController.getLeaveApplications);
router.post('/leave-applications', validateBody(schemas.leaveApplication), hrController.createLeaveApplication);
router.put('/leave-applications/:id/status', validateBody(schemas.statusBody), hrController.updateLeaveStatus);

// Loans
router.get('/loans', hrController.getLoans);
router.post('/loans', validateBody(schemas.loan), hrController.createLoan);
router.put('/loans/:id/status', validateBody(schemas.statusBody), hrController.updateLoanStatus);

// Salary Runs
router.get('/salary-runs', hrController.getSalaryRuns);
router.post('/salary-runs', validateBody(schemas.salaryRun), hrController.createSalaryRun);
router.get('/salary-runs/:id', hrController.getSalaryRunById);
router.get('/salary-runs/:runId/payslip/:employeeId', hrController.getPaySlip);

// Payroll Preview
router.get('/payroll-preview', hrController.getPayrollPreview);

// Company Holidays
router.get('/holidays', hrController.getHolidays);
router.post('/holidays', validateBody(schemas.holiday), hrController.createHoliday);
router.put('/holidays/:id', validateBody(schemas.holiday), hrController.updateHoliday);
router.delete('/holidays/:id', hrController.deleteHoliday);

module.exports = router;
