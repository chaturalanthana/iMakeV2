const prisma = require('../lib/prisma');
const { ensureGlMap } = require('../services/glService');
const { num, money } = require('../services/money');
const { getRates, saveRates, presentRates } = require('../services/payrollStatutory');

function period(query) {
  const today = new Date();
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

const taxReturn = async (req, res) => {
  try {
    const { from, to } = period(req.query);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Use dates in YYYY-MM-DD.', fields: { from: 'Use dates in YYYY-MM-DD.' } });
    }
    const map = await ensureGlMap(prisma, req.tenantId, req.user.userId);
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: { in: [map.VAT_OUTPUT, map.VAT_INPUT, map.SSCL].filter(Boolean) },
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { gte: from, lte: to },
          description: { not: { startsWith: 'Reversal:' } }
        }
      },
      include: { journalEntry: true, account: true }
    });
    let outputVat = 0;
    let inputVat = 0;
    let ssclPayable = 0;
    const documents = lines.map((line) => {
      const debit = num(line.debit);
      const credit = num(line.credit);
      if (line.accountId === map.VAT_OUTPUT) outputVat = money(outputVat + credit - debit);
      if (line.accountId === map.VAT_INPUT) inputVat = money(inputVat + debit - credit);
      if (line.accountId === map.SSCL) ssclPayable = money(ssclPayable + credit - debit);
      return {
        date: line.journalEntry.date,
        document: line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description,
        account: line.account.name,
        debit,
        credit
      };
    });
    res.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      outputVat,
      inputVat,
      netVat: money(outputVat - inputVat),
      ssclPayable,
      documents
    });
  } catch (error) {
    console.error('Tax return failed', error);
    res.status(500).json({ error: 'Failed to build the tax return' });
  }
};

const whtCertificate = async (req, res) => {
  try {
    const certificate = await prisma.whtCertificate.findFirst({
      where: { tenantId: req.tenantId, voucherId: req.params.id },
      include: { supplier: true, voucher: true, tenant: true }
    });
    if (!certificate) return res.status(404).json({ error: 'This payment has no WHT certificate.' });
    res.json({
      certificateNumber: certificate.certificateNumber,
      date: certificate.date,
      voucherNumber: certificate.voucher.voucherNumber,
      supplier: { code: certificate.supplier.code, name: certificate.supplier.name, address: certificate.supplier.address },
      company: certificate.tenant.name,
      grossAmount: num(certificate.grossAmount),
      whtRate: num(certificate.whtRate),
      whtAmount: num(certificate.whtAmount),
      paymentWht: num(certificate.paymentWht),
      invoiceWht: num(certificate.invoiceWht),
      netPaid: num(certificate.netPaid)
    });
  } catch (error) {
    console.error('WHT certificate failed', error);
    res.status(500).json({ error: 'Failed to load the WHT certificate' });
  }
};

const statutoryRates = async (req, res) => {
  try {
    res.json(await getRates(prisma, req.tenantId));
  } catch (error) {
    console.error('Statutory rates failed', error);
    res.status(500).json({ error: 'Failed to load statutory rates' });
  }
};

const saveStatutoryRates = async (req, res) => {
  try {
    const saved = await saveRates(prisma, req.tenantId, req.body || {});
    res.json(presentRates(saved));
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Saving statutory rates failed', error);
    res.status(status).json({ error: status >= 500 ? 'Failed to save statutory rates' : error.message });
  }
};

const statutoryReport = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month and year are required.', fields: { month: 'Month and year are required.' } });
    }
    const rates = await getRates(prisma, req.tenantId);
    const runs = await prisma.salaryRun.findMany({
      where: { tenantId: req.tenantId, month, year },
      include: { lines: { include: { employee: true } } }
    });
    const employees = [];
    runs.forEach((run) => {
      run.lines.forEach((line) => {
        employees.push({
          runNumber: run.runNumber,
          empCode: line.employee.empCode,
          name: `${line.employee.firstName} ${line.employee.lastName}`,
          gross: num(line.grossEarnings),
          epfEmployee: num(line.epfEmployee),
          epfEmployer: num(line.epfEmployer),
          etfEmployer: num(line.etfEmployer),
          netPay: num(line.netPay)
        });
      });
    });
    const totals = employees.reduce((sum, row) => ({
      gross: money(sum.gross + row.gross),
      epfEmployee: money(sum.epfEmployee + row.epfEmployee),
      epfEmployer: money(sum.epfEmployer + row.epfEmployer),
      etfEmployer: money(sum.etfEmployer + row.etfEmployer),
      epfTotal: money(sum.epfTotal + row.epfEmployee + row.epfEmployer),
      netPay: money(sum.netPay + row.netPay)
    }), { gross: 0, epfEmployee: 0, epfEmployer: 0, etfEmployer: 0, epfTotal: 0, netPay: 0 });
    res.json({ month, year, rates, employees, totals });
  } catch (error) {
    console.error('Statutory report failed', error);
    res.status(500).json({ error: 'Failed to build the EPF/ETF report' });
  }
};

module.exports = {
  taxReturn,
  whtCertificate,
  statutoryRates,
  saveStatutoryRates,
  statutoryReport
};
