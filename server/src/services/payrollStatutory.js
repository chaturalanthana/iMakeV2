const { ensureGlMap, postJournal } = require('./glService');
const { num, money } = require('./money');

const DEFAULT_RATES = {
  epfEmployeePercent: 8,
  epfEmployerPercent: 12,
  etfEmployerPercent: 3
};

function isEpfDeduction(row) {
  if (!row) return false;
  if (row.type === 'EPF_EMPLOYEE') return true;
  return /^epf\b/i.test(String(row.name || '').trim());
}

async function getRates(db, tenantId) {
  const existing = await db.statutorySetting.findUnique({ where: { tenantId } });
  if (existing) {
    return {
      epfEmployeePercent: num(existing.epfEmployeePercent),
      epfEmployerPercent: num(existing.epfEmployerPercent),
      etfEmployerPercent: num(existing.etfEmployerPercent)
    };
  }
  return { ...DEFAULT_RATES };
}

function percent(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const numeric = num(value);
  if (numeric < 0 || numeric > 100) {
    const error = new Error('Statutory rates must be between 0 and 100.');
    error.status = 400;
    throw error;
  }
  return numeric;
}

async function saveRates(db, tenantId, body) {
  const current = await getRates(db, tenantId);
  const next = {
    epfEmployeePercent: percent(body.epfEmployeePercent, current.epfEmployeePercent),
    epfEmployerPercent: percent(body.epfEmployerPercent, current.epfEmployerPercent),
    etfEmployerPercent: percent(body.etfEmployerPercent, current.etfEmployerPercent)
  };
  return db.statutorySetting.upsert({
    where: { tenantId },
    update: next,
    create: { tenantId, ...next }
  });
}

function applyStatutory(additions, deductions, rates) {
  const gross = money((additions || []).reduce((sum, row) => sum + num(row.amount), 0));
  const epfEmployee = money(gross * num(rates.epfEmployeePercent) / 100);
  const epfEmployer = money(gross * num(rates.epfEmployerPercent) / 100);
  const etfEmployer = money(gross * num(rates.etfEmployerPercent) / 100);
  const kept = (deductions || []).filter((row) => !isEpfDeduction(row));
  if (epfEmployee > 0) {
    kept.push({
      deductionId: null,
      name: 'EPF Employee',
      amount: epfEmployee,
      type: 'EPF_EMPLOYEE'
    });
  }
  const totalDeductions = money(kept.reduce((sum, row) => sum + num(row.amount), 0));
  return {
    gross,
    epfEmployee,
    epfEmployer,
    etfEmployer,
    deductions: kept,
    totalDeductions,
    netPay: money(gross - totalDeductions)
  };
}

async function postPayrollJournal(tx, { tenantId, run, createdBy }) {
  const lines = run.lines || [];
  const gross = money(lines.reduce((sum, line) => sum + num(line.grossEarnings), 0));
  const epfEmployee = money(lines.reduce((sum, line) => sum + num(line.epfEmployee), 0));
  const epfEmployer = money(lines.reduce((sum, line) => sum + num(line.epfEmployer), 0));
  const etfEmployer = money(lines.reduce((sum, line) => sum + num(line.etfEmployer), 0));
  const net = money(lines.reduce((sum, line) => sum + num(line.netPay), 0));
  const other = money(lines.reduce((sum, line) => sum + Math.max(0, num(line.totalDeductions) - num(line.epfEmployee)), 0));
  if (gross <= 0 && epfEmployer <= 0 && etfEmployer <= 0) return null;
  const map = await ensureGlMap(tx, tenantId, createdBy);
  const date = new Date(Date.UTC(run.year, run.month - 1, 1));
  return postJournal(tx, {
    tenantId,
    date,
    createdBy,
    description: `Payroll ${run.runNumber}`,
    referenceType: 'SALARY_RUN',
    referenceId: run.id,
    lines: [
      { accountId: map.SALARY_EXPENSE, debit: gross, credit: 0, description: 'Gross earnings' },
      { accountId: map.EMPLOYER_EPF, debit: epfEmployer, credit: 0, description: 'Employer EPF' },
      { accountId: map.EMPLOYER_ETF, debit: etfEmployer, credit: 0, description: 'Employer ETF' },
      { accountId: map.EPF_PAYABLE, debit: 0, credit: money(epfEmployee + epfEmployer), description: 'EPF payable' },
      { accountId: map.ETF_PAYABLE, debit: 0, credit: etfEmployer, description: 'ETF payable' },
      { accountId: map.PAYROLL_DEDUCTIONS, debit: 0, credit: other, description: 'Other payroll deductions' },
      { accountId: map.SALARIES_PAYABLE, debit: 0, credit: net, description: 'Net salaries payable' }
    ]
  });
}

function presentRates(row) {
  return {
    epfEmployeePercent: num(row.epfEmployeePercent),
    epfEmployerPercent: num(row.epfEmployerPercent),
    etfEmployerPercent: num(row.etfEmployerPercent)
  };
}

module.exports = {
  DEFAULT_RATES,
  getRates,
  saveRates,
  applyStatutory,
  postPayrollJournal,
  presentRates
};
