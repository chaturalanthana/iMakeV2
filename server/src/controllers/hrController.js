const prisma = require('../lib/prisma');

// ============================================================
// EMPLOYEES
// ============================================================
const getEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { empCode: 'asc' }
    });
    res.json(employees);
  } catch (err) {
    console.error('getEmployees error:', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const { empCode, firstName, lastName, email, phone, department, designation, dateOfJoining, basicSalary, status } = req.body;
    const emp = await prisma.employee.create({
      data: {
        tenantId: req.tenantId,
        empCode,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        department: department || null,
        designation: designation || null,
        dateOfJoining: new Date(dateOfJoining),
        basicSalary: parseFloat(basicSalary || 0),
        status: status || 'ACTIVE',
        createdBy: req.user.userId
      }
    });
    res.status(201).json(emp);
  } catch (err) {
    console.error('createEmployee error:', err);
    if (err.code === 'P2002') return res.status(400).json({ error: 'Employee code already exists.' });
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    const { empCode, firstName, lastName, email, phone, department, designation, dateOfJoining, basicSalary, status } = req.body;
    const emp = await prisma.employee.update({
      where: { id },
      data: { empCode, firstName, lastName, email, phone, department, designation, dateOfJoining: new Date(dateOfJoining), basicSalary: parseFloat(basicSalary || 0), status }
    });
    res.json(emp);
  } catch (err) {
    console.error('updateEmployee error:', err);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    await prisma.employee.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteEmployee error:', err);
    if (err.code === 'P2003') return res.status(400).json({ error: 'Cannot delete employee with linked records.' });
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// ============================================================
// ADDITIONS MASTER
// ============================================================
const getAdditions = async (req, res) => {
  try {
    const additions = await prisma.hrAddition.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(additions);
  } catch (err) {
    console.error('getAdditions error:', err);
    res.status(500).json({ error: 'Failed to fetch additions' });
  }
};

const createAddition = async (req, res) => {
  try {
    const { name, type, defaultAmount } = req.body;
    const addition = await prisma.hrAddition.create({
      data: {
        tenantId: req.tenantId,
        name,
        type: type || 'FIXED',
        defaultAmount: parseFloat(defaultAmount || 0),
        createdBy: req.user.userId
      }
    });
    res.status(201).json(addition);
  } catch (err) {
    console.error('createAddition error:', err);
    res.status(500).json({ error: 'Failed to create addition' });
  }
};

const updateAddition = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.hrAddition.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Addition not found' });
    const { name, type, defaultAmount } = req.body;
    const addition = await prisma.hrAddition.update({ where: { id }, data: { name, type, defaultAmount: parseFloat(defaultAmount || 0) } });
    res.json(addition);
  } catch (err) {
    console.error('updateAddition error:', err);
    res.status(500).json({ error: 'Failed to update addition' });
  }
};

const deleteAddition = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.hrAddition.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Addition not found' });
    await prisma.hrAddition.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAddition error:', err);
    res.status(500).json({ error: 'Failed to delete addition' });
  }
};

// ============================================================
// DEDUCTIONS REGISTRY
// ============================================================
const getDeductions = async (req, res) => {
  try {
    const deductions = await prisma.hrDeduction.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(deductions);
  } catch (err) {
    console.error('getDeductions error:', err);
    res.status(500).json({ error: 'Failed to fetch deductions' });
  }
};

const createDeduction = async (req, res) => {
  try {
    const { name, type, defaultAmount, isStatutory } = req.body;
    const deduction = await prisma.hrDeduction.create({
      data: {
        tenantId: req.tenantId,
        name,
        type: type || 'VOLUNTARY',
        defaultAmount: parseFloat(defaultAmount || 0),
        isStatutory: !!isStatutory,
        createdBy: req.user.userId
      }
    });
    res.status(201).json(deduction);
  } catch (err) {
    console.error('createDeduction error:', err);
    res.status(500).json({ error: 'Failed to create deduction' });
  }
};

const updateDeduction = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.hrDeduction.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Deduction not found' });
    const { name, type, defaultAmount, isStatutory } = req.body;
    const deduction = await prisma.hrDeduction.update({ where: { id }, data: { name, type, defaultAmount: parseFloat(defaultAmount || 0), isStatutory: !!isStatutory } });
    res.json(deduction);
  } catch (err) {
    console.error('updateDeduction error:', err);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
};

const deleteDeduction = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.hrDeduction.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Deduction not found' });
    await prisma.hrDeduction.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteDeduction error:', err);
    res.status(500).json({ error: 'Failed to delete deduction' });
  }
};

// ============================================================
// LEAVE TYPES
// ============================================================
const getLeaveTypes = async (req, res) => {
  try {
    const types = await prisma.leaveType.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(types);
  } catch (err) {
    console.error('getLeaveTypes error:', err);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
};

const createLeaveType = async (req, res) => {
  try {
    const { name, daysAllowed } = req.body;
    const leaveType = await prisma.leaveType.create({
      data: { tenantId: req.tenantId, name, daysAllowed: parseInt(daysAllowed || 0), createdBy: req.user.userId }
    });
    res.status(201).json(leaveType);
  } catch (err) {
    console.error('createLeaveType error:', err);
    res.status(500).json({ error: 'Failed to create leave type' });
  }
};

const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.leaveType.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Leave type not found' });
    const { name, daysAllowed } = req.body;
    const leaveType = await prisma.leaveType.update({ where: { id }, data: { name, daysAllowed: parseInt(daysAllowed || 0) } });
    res.json(leaveType);
  } catch (err) {
    console.error('updateLeaveType error:', err);
    res.status(500).json({ error: 'Failed to update leave type' });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.leaveType.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Leave type not found' });
    await prisma.leaveType.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteLeaveType error:', err);
    res.status(500).json({ error: 'Failed to delete leave type' });
  }
};

// ============================================================
// LEAVE APPLICATIONS
// ============================================================
const getLeaveApplications = async (req, res) => {
  try {
    const apps = await prisma.leaveApplication.findMany({
      where: { tenantId: req.tenantId },
      include: { employee: true, leaveType: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(apps);
  } catch (err) {
    console.error('getLeaveApplications error:', err);
    res.status(500).json({ error: 'Failed to fetch leave applications' });
  }
};

const createLeaveApplication = async (req, res) => {
  try {
    const { employeeId, leaveTypeId, fromDate, toDate, days, reason } = req.body;
    const app = await prisma.leaveApplication.create({
      data: {
        tenantId: req.tenantId,
        employeeId,
        leaveTypeId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        days: parseFloat(days || 1),
        reason: reason || null,
        status: 'PENDING',
        createdBy: req.user.userId
      },
      include: { employee: true, leaveType: true }
    });
    res.status(201).json(app);
  } catch (err) {
    console.error('createLeaveApplication error:', err);
    res.status(500).json({ error: 'Failed to create leave application' });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const existing = await prisma.leaveApplication.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Leave application not found' });
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: { status, remarks: remarks || null },
      include: { employee: true, leaveType: true }
    });
    res.json(updated);
  } catch (err) {
    console.error('updateLeaveStatus error:', err);
    res.status(500).json({ error: 'Failed to update leave status' });
  }
};

// ============================================================
// LOANS
// ============================================================
const getLoans = async (req, res) => {
  try {
    const loans = await prisma.employeeLoan.findMany({
      where: { tenantId: req.tenantId },
      include: { employee: true, installments: { orderBy: [{ year: 'asc' }, { month: 'asc' }] } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(loans);
  } catch (err) {
    console.error('getLoans error:', err);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
};

const createLoan = async (req, res) => {
  try {
    const { employeeId, loanNumber, amount, tenureMonths, startDate, notes } = req.body;
    const amt = parseFloat(amount || 0);
    const tenure = parseInt(tenureMonths || 1);
    const emiAmount = parseFloat((amt / tenure).toFixed(2));

    // Generate installments
    const installments = [];
    const start = new Date(startDate);
    let m = start.getMonth() + 1;
    let y = start.getFullYear();
    for (let i = 0; i < tenure; i++) {
      installments.push({ month: m, year: y, amount: emiAmount, status: 'PENDING' });
      m++;
      if (m > 12) { m = 1; y++; }
    }

    const loan = await prisma.employeeLoan.create({
      data: {
        tenantId: req.tenantId,
        employeeId,
        loanNumber,
        amount: amt,
        outstanding: amt,
        tenureMonths: tenure,
        emiAmount,
        startDate: new Date(startDate),
        status: 'ACTIVE',
        notes: notes || null,
        createdBy: req.user.userId,
        installments: { create: installments }
      },
      include: { employee: true, installments: true }
    });
    res.status(201).json(loan);
  } catch (err) {
    console.error('createLoan error:', err);
    res.status(500).json({ error: 'Failed to create loan' });
  }
};

const updateLoanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const existing = await prisma.employeeLoan.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Loan not found' });
    const loan = await prisma.employeeLoan.update({ where: { id }, data: { status } });
    res.json(loan);
  } catch (err) {
    console.error('updateLoanStatus error:', err);
    res.status(500).json({ error: 'Failed to update loan' });
  }
};

// ============================================================
// SALARY RUNS
// ============================================================
const getSalaryRuns = async (req, res) => {
  try {
    const runs = await prisma.salaryRun.findMany({
      where: { tenantId: req.tenantId },
      include: { lines: { include: { employee: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
    res.json(runs);
  } catch (err) {
    console.error('getSalaryRuns error:', err);
    res.status(500).json({ error: 'Failed to fetch salary runs' });
  }
};

const createSalaryRun = async (req, res) => {
  try {
    const { month, year, runNumber, employeeData } = req.body;
    // employeeData: Array<{ employeeId, additions: [{additionId, name, amount}], deductions: [{deductionId, name, amount}] }>

    if (!employeeData || employeeData.length === 0) {
      return res.status(400).json({ error: 'No employee data provided for the salary run.' });
    }

    // Build line data
    const linesData = employeeData.map(emp => {
      const gross = emp.additions.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      const totalDeductions = emp.deductions.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
      const net = gross - totalDeductions;
      return {
        employeeId: emp.employeeId,
        grossEarnings: gross,
        totalDeductions,
        netPay: net,
        additions: { create: emp.additions.map(a => ({ additionId: a.additionId || null, name: a.name, amount: parseFloat(a.amount || 0) })) },
        deductions: { create: emp.deductions.map(d => ({ deductionId: d.deductionId || null, name: d.name, amount: parseFloat(d.amount || 0), type: d.type || 'DEDUCTION' })) }
      };
    });

    const run = await prisma.salaryRun.create({
      data: {
        tenantId: req.tenantId,
        runNumber,
        month: parseInt(month),
        year: parseInt(year),
        status: 'PROCESSED',
        createdBy: req.user.userId,
        lines: {
          create: linesData.map(l => ({
            employeeId: l.employeeId,
            grossEarnings: l.grossEarnings,
            totalDeductions: l.totalDeductions,
            netPay: l.netPay,
            additions: l.additions,
            deductions: l.deductions
          }))
        }
      },
      include: {
        lines: {
          include: {
            employee: true,
            additions: true,
            deductions: true
          }
        }
      }
    });

    // Update loan outstanding for EMI payments
    for (const empData of employeeData) {
      for (const ded of empData.deductions) {
        if (ded.type === 'LOAN_EMI' && ded.loanId) {
          const loan = await prisma.employeeLoan.findUnique({ where: { id: ded.loanId } });
          if (loan) {
            const newOutstanding = Math.max(0, parseFloat(loan.outstanding) - parseFloat(ded.amount || 0));
            const newStatus = newOutstanding <= 0 ? 'CLOSED' : 'ACTIVE';
            await prisma.employeeLoan.update({ where: { id: ded.loanId }, data: { outstanding: newOutstanding, status: newStatus } });
            // Mark installment paid
            const installment = await prisma.loanInstallment.findFirst({
              where: { loanId: ded.loanId, month: parseInt(month), year: parseInt(year) }
            });
            if (installment) {
              await prisma.loanInstallment.update({ where: { id: installment.id }, data: { status: 'PAID', paidDate: new Date() } });
            }
          }
        }
      }
    }

    res.status(201).json(run);
  } catch (err) {
    console.error('createSalaryRun error:', err);
    res.status(500).json({ error: 'Failed to create salary run' });
  }
};

const getSalaryRunById = async (req, res) => {
  try {
    const { id } = req.params;
    const run = await prisma.salaryRun.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        lines: {
          include: {
            employee: true,
            additions: { include: { addition: true } },
            deductions: { include: { deduction: true } }
          }
        }
      }
    });
    if (!run) return res.status(404).json({ error: 'Salary run not found' });
    res.json(run);
  } catch (err) {
    console.error('getSalaryRunById error:', err);
    res.status(500).json({ error: 'Failed to fetch salary run' });
  }
};

const getPaySlip = async (req, res) => {
  try {
    const { runId, employeeId } = req.params;
    const line = await prisma.salaryRunLine.findFirst({
      where: {
        runId,
        employeeId,
        run: { tenantId: req.tenantId }
      },
      include: {
        run: true,
        employee: true,
        additions: { include: { addition: true } },
        deductions: { include: { deduction: true } }
      }
    });
    if (!line) return res.status(404).json({ error: 'Pay slip not found' });
    res.json(line);
  } catch (err) {
    console.error('getPaySlip error:', err);
    res.status(500).json({ error: 'Failed to fetch pay slip' });
  }
};

// Helper: Get payroll preview data (employees with default additions/deductions + active loan EMIs)
const getPayrollPreview = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month);
    const y = parseInt(year);

    const [employees, additions, deductions] = await Promise.all([
      prisma.employee.findMany({ where: { tenantId: req.tenantId, status: 'ACTIVE' }, orderBy: { empCode: 'asc' } }),
      prisma.hrAddition.findMany({ where: { tenantId: req.tenantId } }),
      prisma.hrDeduction.findMany({ where: { tenantId: req.tenantId } })
    ]);

    const preview = await Promise.all(employees.map(async (emp) => {
      // Build additions: fixed ones use defaultAmount; basic salary as first addition
      const empAdditions = [
        { additionId: null, name: 'Basic Salary', amount: parseFloat(emp.basicSalary) }
      ];
      for (const a of additions.filter(x => x.type === 'FIXED')) {
        empAdditions.push({ additionId: a.id, name: a.name, amount: parseFloat(a.defaultAmount) });
      }

      // Build deductions
      const empDeductions = [];
      for (const d of deductions) {
        empDeductions.push({ deductionId: d.id, name: d.name, amount: parseFloat(d.defaultAmount), type: 'DEDUCTION' });
      }

      // Active loans with installment for this month
      const activeLoans = await prisma.employeeLoan.findMany({
        where: { employeeId: emp.id, status: 'ACTIVE' },
        include: {
          installments: {
            where: { month: m, year: y, status: 'PENDING' }
          }
        }
      });
      for (const loan of activeLoans) {
        for (const inst of loan.installments) {
          empDeductions.push({ deductionId: null, loanId: loan.id, name: `Loan EMI (${loan.loanNumber})`, amount: parseFloat(inst.amount), type: 'LOAN_EMI' });
        }
      }

      return {
        employeeId: emp.id,
        empCode: emp.empCode,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.department || '',
        designation: emp.designation || '',
        additions: empAdditions,
        deductions: empDeductions
      };
    }));

    res.json(preview);
  } catch (err) {
    console.error('getPayrollPreview error:', err);
    res.status(500).json({ error: 'Failed to generate payroll preview' });
  }
};

module.exports = {
  // Employees
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  // Additions
  getAdditions, createAddition, updateAddition, deleteAddition,
  // Deductions
  getDeductions, createDeduction, updateDeduction, deleteDeduction,
  // Leave Types
  getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
  // Leave Applications
  getLeaveApplications, createLeaveApplication, updateLeaveStatus,
  // Loans
  getLoans, createLoan, updateLoanStatus,
  // Salary
  getSalaryRuns, createSalaryRun, getSalaryRunById, getPaySlip, getPayrollPreview
};

// ============================================================
// COMPANY HOLIDAYS
// ============================================================
const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    const where = { tenantId: req.tenantId };
    if (year) {
      const y = parseInt(year);
      where.date = { gte: new Date(`${y}-01-01`), lte: new Date(`${y}-12-31`) };
    }
    const holidays = await prisma.companyHoliday.findMany({
      where,
      orderBy: { date: 'asc' }
    });
    res.json(holidays);
  } catch (err) {
    console.error('getHolidays error:', err);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
};

const createHoliday = async (req, res) => {
  try {
    const { date, name, description, type } = req.body;
    if (!date || !name) return res.status(400).json({ error: 'Date and name are required' });
    const holiday = await prisma.companyHoliday.create({
      data: {
        tenantId: req.tenantId,
        date: new Date(date),
        name,
        description: description || null,
        type: type || 'PUBLIC',
        createdBy: req.user.userId
      }
    });
    res.status(201).json(holiday);
  } catch (err) {
    console.error('createHoliday error:', err);
    res.status(500).json({ error: 'Failed to create holiday' });
  }
};

const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.companyHoliday.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Holiday not found' });
    const { date, name, description, type } = req.body;
    const holiday = await prisma.companyHoliday.update({
      where: { id },
      data: { date: new Date(date), name, description: description || null, type: type || 'PUBLIC' }
    });
    res.json(holiday);
  } catch (err) {
    console.error('updateHoliday error:', err);
    res.status(500).json({ error: 'Failed to update holiday' });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.companyHoliday.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Holiday not found' });
    await prisma.companyHoliday.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteHoliday error:', err);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
};

module.exports = {
  // Employees
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  // Additions
  getAdditions, createAddition, updateAddition, deleteAddition,
  // Deductions
  getDeductions, createDeduction, updateDeduction, deleteDeduction,
  // Leave Types
  getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
  // Leave Applications
  getLeaveApplications, createLeaveApplication, updateLeaveStatus,
  // Loans
  getLoans, createLoan, updateLoanStatus,
  // Salary
  getSalaryRuns, createSalaryRun, getSalaryRunById, getPaySlip, getPayrollPreview,
  // Holidays
  getHolidays, createHoliday, updateHoliday, deleteHoliday
};

