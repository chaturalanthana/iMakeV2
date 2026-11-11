const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const { jwtSecret } = require('../src/config');
const { toCsv, toXlsx, parseSpreadsheet } = require('../src/services/spreadsheet');
const { code39Svg } = require('../src/services/labels');

jest.setTimeout(30000);

describe('operations, imports, and Sri Lanka compliance', () => {
  let tenant;
  let token;
  let warehouse;
  let supplier;
  let customer;
  let bought;
  let made;

  const auth = (value = token) => ({ Authorization: `Bearer ${value}` });
  const today = '2026-11-10';

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Operations', slug: `ops-${Date.now()}`, currency: 'LKR' }
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `ops-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id }
    });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'MAIN', name: 'Main' } });
    supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, code: 'SUP-1', name: 'Mill', leadTime: 1 } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS-1', name: 'Buyer', creditLimit: 100 } });
    bought = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'RM-1', name: 'Timber', costPrice: 4, standardCost: 4, supplierId: supplier.id }
    });
    made = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'FG-1', name: 'Chair', costPrice: 20, standardCost: 20, bomApplicable: true, sellingPrice: 80 }
    });
    await prisma.bOM.create({
      data: {
        tenantId: tenant.id,
        productId: made.id,
        code: '1',
        name: 'Chair BOM',
        version: '1',
        status: 'ACTIVE',
        isDefault: true,
        items: { create: [{ tenantId: tenant.id, productId: bought.id, quantity: 1, scrapPercent: 0 }] }
      }
    });
    await prisma.purchaseWithholdingTaxGroup.create({
      data: {
        tenantId: tenant.id,
        name: 'WHT',
        slabs: { create: [{ tenantId: tenant.id, name: 'WHT', rate: 10, calculationOrder: 1 }] }
      }
    });
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
    await prisma.replenishmentLine.deleteMany({ where });
    await prisma.replenishmentRun.deleteMany({ where });
    await prisma.itemWarehousePolicy.deleteMany({ where });
    await prisma.operationsSetting.deleteMany({ where });
    await prisma.statutorySetting.deleteMany({ where });
    await prisma.whtCertificate.deleteMany({ where });
    const runs = await prisma.salaryRun.findMany({ where, select: { id: true } });
    if (runs.length) {
      const lines = await prisma.salaryRunLine.findMany({ where: { runId: { in: runs.map((run) => run.id) } }, select: { id: true } });
      const lineIds = lines.map((line) => line.id);
      if (lineIds.length) {
        await prisma.salaryRunAddition.deleteMany({ where: { lineId: { in: lineIds } } });
        await prisma.salaryRunDeduction.deleteMany({ where: { lineId: { in: lineIds } } });
        await prisma.salaryRunLine.deleteMany({ where: { id: { in: lineIds } } });
      }
      await prisma.salaryRun.deleteMany({ where });
    }
    await prisma.employee.deleteMany({ where });
    await prisma.journalLine.deleteMany({ where: { journalEntry: where } });
    await prisma.journalEntry.deleteMany({ where });
    await prisma.glAccountMap.deleteMany({ where });
    await prisma.workOrderIssue.deleteMany({ where });
    await prisma.workOrderConfirmation.deleteMany({ where });
    await prisma.materialReservation.deleteMany({ where });
    await prisma.operationTimeLog.deleteMany({ where });
    await prisma.workOrderOperation.deleteMany({ where });
    await prisma.workOrderComponent.deleteMany({ where });
    await prisma.workOrder.deleteMany({ where });
    await prisma.routingOperation.deleteMany({ where });
    await prisma.routing.deleteMany({ where });
    await prisma.bOMItem.deleteMany({ where });
    await prisma.bOM.deleteMany({ where });
    await prisma.productionOrder.deleteMany({ where });
    await prisma.costLayer.deleteMany({ where });
    await prisma.stockMovement.deleteMany({ where });
    await prisma.supplierPaymentAllocation.deleteMany({ where });
    await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoice: where } });
    await prisma.supplierInvoice.deleteMany({ where });
    await prisma.paymentVoucher.deleteMany({ where });
    await prisma.salesInvoiceItem.deleteMany({ where: { invoice: where } });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.salesOrderItem.deleteMany({ where: { order: where } });
    await prisma.salesOrder.deleteMany({ where });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } });
    await prisma.purchaseOrder.deleteMany({ where });
    await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } });
    await prisma.purchaseRequisition.deleteMany({ where });
    await prisma.purchaseWithholdingTaxSlab.deleteMany({ where });
    await prisma.purchaseWithholdingTaxGroup.deleteMany({ where });
    await prisma.account.deleteMany({ where });
    await prisma.product.deleteMany({ where });
    await prisma.workstation.deleteMany({ where });
    await prisma.customer.deleteMany({ where });
    await prisma.supplier.deleteMany({ where });
    await prisma.warehouse.deleteMany({ where });
    await prisma.user.deleteMany({ where });
    await prisma.role.deleteMany({ where });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  test('drafts purchase requisitions for bought items and skips made items', async () => {
    await prisma.productionOrder.create({
      data: { tenantId: tenant.id, orderNumber: 'MFG-1', productId: made.id, quantity: 12, status: 'RELEASED' }
    });
    const boughtPolicy = await request(app).post('/api/replenishment/policies').set(auth()).send({
      productId: bought.id, warehouseId: warehouse.id, reorderPoint: 5, minQty: 5, maxQty: 10
    });
    expect(boughtPolicy.status).toBe(201);
    const madePolicy = await request(app).post('/api/replenishment/policies').set(auth()).send({
      productId: made.id, warehouseId: warehouse.id, reorderPoint: 1, minQty: 1, maxQty: 4
    });
    expect(madePolicy.status).toBe(400);
    await prisma.itemWarehousePolicy.create({
      data: { tenantId: tenant.id, productId: made.id, warehouseId: warehouse.id, reorderPoint: 1, minQty: 1, maxQty: 4 }
    });
    const listed = await request(app).get('/api/replenishment/policies').set(auth());
    expect(listed.body.map((row) => row.productId)).toEqual([bought.id]);

    const first = await request(app).post('/api/replenishment/run').set(auth()).send({});
    expect(first.status).toBe(201);
    const buy = first.body.lines.find((line) => line.productId === bought.id);
    expect(buy).toMatchObject({ kind: 'BUY', quantity: 12, reason: 'BOTH', workOrderId: null });
    expect(first.body.lines.some((line) => line.productId === made.id)).toBe(false);
    expect(first.body.message).toMatch(/purchase line/);
    expect(first.body.message).not.toMatch(/work order/i);
    const pending = await request(app).get('/api/alerts').set(auth());
    const approval = pending.body.alerts.find((alert) => alert.documentNumber === first.body.runNumber);
    expect(approval.detail).toBe('1 draft purchase line.');
    expect(approval.detail).not.toMatch(/work order/i);
    const madeLow = pending.body.alerts.find((alert) => alert.type === 'LOW_STOCK' && alert.documentNumber === 'FG-1');
    expect(madeLow.href).toBe('/production/mrp');
    expect(madeLow.detail).toMatch(/planned in MRP/);
    const boughtLow = pending.body.alerts.find((alert) => alert.type === 'LOW_STOCK' && alert.documentNumber === 'RM-1');
    expect(boughtLow.href).toBe('/production/replenishment');

    const second = await request(app).post('/api/replenishment/run').set(auth()).send({});
    expect(second.status).toBe(201);
    expect(second.body.runNumber).toBe(first.body.runNumber);
    expect(await prisma.purchaseRequisition.count({ where: { tenantId: tenant.id, sourceType: 'REPLENISHMENT' } })).toBe(1);
    expect(await prisma.workOrder.count({ where: { tenantId: tenant.id, sourceType: 'REPLENISHMENT' } })).toBe(0);

    const approved = await request(app).post('/api/replenishment/approve').set(auth()).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.purchaseRequisitions).toBe(1);
    expect(approved.body.workOrders).toBeUndefined();
    expect(approved.body.message).toBe('Approved 1 requisition');
    const requisition = await prisma.purchaseRequisition.findFirst({ where: { tenantId: tenant.id, sourceType: 'REPLENISHMENT' } });
    expect(requisition.status).toBe('APPROVED');
    expect(await prisma.workOrder.count({ where: { tenantId: tenant.id, sourceType: 'REPLENISHMENT' } })).toBe(0);

    const schedule = await request(app).put('/api/replenishment/settings').set(auth()).send({ replenishDaily: true });
    expect(schedule.body.replenishDaily).toBe(true);
    const tick = await request(app).post('/api/replenishment/schedule-tick').set(auth()).send({});
    expect(tick.body.ran.length).toBe(1);
    const again = await request(app).post('/api/replenishment/schedule-tick').set(auth()).send({});
    expect(again.body.ran).toEqual([]);
  });

  test('computes the inbox from stock, credit, overdue documents, and load', async () => {
    await prisma.purchaseOrder.create({
      data: {
        tenantId: tenant.id, supplierId: supplier.id, poNumber: 'PO-OLD', date: new Date('2020-01-01'), status: 'PENDING', total: 10,
        items: { create: [{ productId: bought.id, quantity: 1, unitPrice: 4, total: 4 }] }
      }
    });
    await prisma.salesOrder.create({
      data: {
        tenantId: tenant.id, customerId: customer.id, orderNumber: 'SO-OLD', date: new Date('2020-01-01'), status: 'PENDING', total: 80,
        items: { create: [{ productId: made.id, quantity: 1, unitPrice: 80, total: 80 }] }
      }
    });
    await prisma.salesInvoice.create({
      data: {
        tenantId: tenant.id, customerId: customer.id, invoiceNumber: 'INV-CREDIT', date: new Date(today),
        status: 'UNPAID', subtotal: 500, total: 500, amountPaid: 0
      }
    });
    const released = await request(app).post('/api/work-orders').set(auth()).send({
      productId: made.id, quantity: 3, warehouseId: warehouse.id
    });
    expect(released.status).toBe(201);
    const go = await request(app).post(`/api/work-orders/${released.body.id}/release`).set(auth()).send({});
    expect(go.status).toBe(200);
    await prisma.workOrder.update({
      where: { id: released.body.id },
      data: { endDate: new Date('2020-01-02') }
    });
    const heavy = await request(app).post('/api/work-orders').set(auth()).send({
      productId: made.id, quantity: 20, warehouseId: warehouse.id, startDate: today, endDate: today
    });
    expect(heavy.status).toBe(201);
    await prisma.workOrderOperation.updateMany({
      where: { workOrderId: heavy.body.id },
      data: { runMinutesPerUnit: 60 }
    });

    const inbox = await request(app).get('/api/alerts').set(auth());
    expect(inbox.status).toBe(200);
    expect(inbox.body.count).toBe(inbox.body.alerts.length);
    const types = inbox.body.alerts.map((alert) => alert.type);
    expect(types).toEqual(expect.arrayContaining([
      'LOW_STOCK',
      'MATERIAL_SHORTAGE',
      'OVERDUE_PURCHASE_ORDER',
      'OVERDUE_SALES_ORDER',
      'OVERDUE_WORK_ORDER',
      'CREDIT_LIMIT',
      'WORKSTATION_OVERLOAD'
    ]));
  });

  test('rejects a bad import row and posts opening stock, receivables, and payables', async () => {
    const bad = toCsv(['code', 'name'], [{ code: 'BAD-1', name: '' }, { code: 'GOOD-1', name: 'Widget' }]);
    const rejected = await request(app).post('/api/imports/products').set(auth()).attach('file', Buffer.from(bad), 'products.csv');
    expect(rejected.status).toBe(400);
    expect(rejected.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, field: 'name' })
    ]));
    expect(await prisma.product.count({ where: { tenantId: tenant.id, code: 'GOOD-1' } })).toBe(0);

    const csv = toCsv(['code', 'name', 'costPrice'], [{ code: 'IMP-1', name: 'Imported', costPrice: 6 }]);
    const products = await request(app).post('/api/imports/products').set(auth()).attach('file', Buffer.from(csv), 'products.csv');
    expect(products.status).toBe(201);
    expect(products.body.created).toBe(1);

    const customers = await request(app).post('/api/imports/customers').set(auth()).attach('file', Buffer.from(
      toCsv(['code', 'name', 'creditLimit'], [{ code: 'IMP-C', name: 'Imported Buyer', creditLimit: 50 }])
    ), 'customers.csv');
    expect(customers.status).toBe(201);
    const suppliers = await request(app).post('/api/imports/suppliers').set(auth()).attach('file', Buffer.from(
      toCsv(['code', 'name', 'leadTime'], [{ code: 'IMP-S', name: 'Imported Mill', leadTime: 3 }])
    ), 'suppliers.csv');
    expect(suppliers.status).toBe(201);

    const sheet = toXlsx(
      ['productCode', 'warehouseCode', 'quantity', 'unitCost', 'lotNumber'],
      [{ productCode: 'IMP-1', warehouseCode: 'MAIN', quantity: 10, unitCost: 6, lotNumber: 'LOT-1' }]
    );
    const stock = await request(app).post('/api/imports/opening-stock').set(auth()).attach('file', sheet, 'opening-stock.xlsx');
    expect(stock.status).toBe(201);
    const layer = await prisma.costLayer.findFirst({ where: { tenantId: tenant.id, sourceType: 'OPENING', lotNumber: 'LOT-1' } });
    expect(layer).toBeTruthy();
    expect(Number(layer.quantityRemaining)).toBe(10);
    expect(Number(layer.unitCost)).toBe(6);
    const journals = await prisma.journalEntry.findMany({
      where: { tenantId: tenant.id, referenceType: 'OPENING' },
      include: { lines: true }
    });
    const debit = journals.reduce((sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + Number(line.debit), 0), 0);
    const credit = journals.reduce((sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + Number(line.credit), 0), 0);
    expect(debit).toBe(60);
    expect(credit).toBe(60);

    const ar = await request(app).post('/api/imports/opening-ar').set(auth()).attach('file', Buffer.from(
      toCsv(['customerCode', 'amount', 'date', 'reference'], [{ customerCode: 'IMP-C', amount: 25, date: today, reference: 'OB' }])
    ), 'opening-ar.csv');
    expect(ar.status).toBe(201);
    const ap = await request(app).post('/api/imports/opening-ap').set(auth()).attach('file', Buffer.from(
      toCsv(['supplierCode', 'amount', 'date', 'reference'], [{ supplierCode: 'IMP-S', amount: 40, date: today, reference: 'OB' }])
    ), 'opening-ap.csv');
    expect(ap.status).toBe(201);
    expect(await prisma.salesInvoice.findFirst({ where: { tenantId: tenant.id, total: 25 } })).toBeTruthy();
    expect(await prisma.supplierInvoice.findFirst({ where: { tenantId: tenant.id, total: 40 } })).toBeTruthy();

    const bom = await request(app).post('/api/imports/boms').set(auth()).attach('file', Buffer.from(
      toCsv(['productCode', 'version', 'componentCode', 'quantity', 'scrapPercent'], [
        { productCode: 'IMP-1', version: '1', componentCode: 'RM-1', quantity: 2, scrapPercent: 0 }
      ])
    ), 'boms.csv');
    expect(bom.status).toBe(201);
    const station = await request(app).post('/api/imports/workstations').set(auth()).attach('file', Buffer.from(
      toCsv(['code', 'name', 'hourlyRate', 'capacity', 'efficiency'], [{ code: 'SAW', name: 'Saw', hourlyRate: 30, capacity: 1, efficiency: 1 }])
    ), 'stations.csv');
    expect(station.status).toBe(201);

    const template = await request(app).get('/api/imports/products/template').set(auth());
    expect(template.status).toBe(200);
    expect(template.text).toContain('code,name');
  });

  test('prints a label and resolves a scan to the item, lot, or work order', async () => {
    expect(code39Svg('RM-1')).toContain('<rect');
    const rendered = await request(app).post('/api/labels/render').set(auth()).send({ type: 'item', codes: ['RM-1'] });
    expect(rendered.status).toBe(200);
    expect(rendered.body.labels[0].qrSvg).toContain('<svg');
    expect(rendered.body.labels[0].payload).toBe('RM-1');
    const item = await request(app).get('/api/labels/resolve').set(auth()).query({ code: 'RM-1' });
    expect(item.body.kind).toBe('item');
    expect(item.body.product.code).toBe('RM-1');
    const lot = await request(app).get('/api/labels/resolve').set(auth()).query({ code: 'LOT-1' });
    expect(lot.body).toMatchObject({ kind: 'lot', lotNumber: 'LOT-1' });
    const order = await prisma.workOrder.findFirst({ where: { tenantId: tenant.id } });
    const scanned = await request(app).get('/api/labels/resolve').set(auth()).query({ code: order.orderNumber });
    expect(scanned.body.kind).toBe('workOrder');
    const roundTrip = parseSpreadsheet(toXlsx(['code', 'name'], [{ code: 'A', name: 'Alpha' }]), 'items.xlsx');
    expect(roundTrip).toEqual([{ code: 'A', name: 'Alpha' }]);
  });

  test('withholds WHT on payment, summarises VAT and SSCL, and posts EPF and ETF', async () => {
    await prisma.supplier.update({ where: { id: supplier.id }, data: { withholdingTaxGroup: 'WHT' } });
    const bill = await prisma.supplierInvoice.create({
      data: {
        tenantId: tenant.id, supplierId: supplier.id, invoiceNumber: 'BILL-WHT', date: new Date(today),
        status: 'UNPAID', subtotal: 1000, taxAmount: 0, whtAmount: 0, total: 1000, amountPaid: 0, exchangeRate: 1
      }
    });
    const payment = await request(app).post('/api/finance/payment-vouchers').set(auth()).send({
      supplierId: supplier.id, date: today, method: 'BANK_TRANSFER', amount: 1000, exchangeRate: 1,
      allocations: [{ supplierInvoiceId: bill.id, amount: 1000 }]
    });
    expect(payment.status).toBe(201);
    expect(Number(payment.body.whtAmount)).toBe(100);
    const certificate = await request(app).get(`/api/finance/payment-vouchers/${payment.body.id}/wht-certificate`).set(auth());
    expect(certificate.status).toBe(200);
    expect(certificate.body).toMatchObject({ paymentWht: 100, netPaid: 900, whtRate: 10 });
    const posted = await prisma.journalLine.findMany({
      where: { journalEntry: { tenantId: tenant.id, referenceType: 'PAYMENT_VOUCHER', referenceId: payment.body.id } },
      include: { account: true }
    });
    const wht = posted.find((line) => line.account.code === '2110');
    const bank = posted.find((line) => line.account.code === '1010' && Number(line.credit) > 0);
    expect(Number(wht.credit)).toBe(100);
    expect(Number(bank.credit)).toBe(900);

    const already = await prisma.supplierInvoice.create({
      data: {
        tenantId: tenant.id, supplierId: supplier.id, invoiceNumber: 'BILL-NET', date: new Date(today),
        status: 'UNPAID', subtotal: 1000, taxAmount: 0, whtAmount: 100, total: 900, amountPaid: 0, exchangeRate: 1
      }
    });
    const second = await request(app).post('/api/finance/payment-vouchers').set(auth()).send({
      supplierId: supplier.id, date: today, method: 'BANK_TRANSFER', amount: 900, exchangeRate: 1,
      allocations: [{ supplierInvoiceId: already.id, amount: 900 }]
    });
    expect(second.status).toBe(201);
    const secondLines = await prisma.journalLine.findMany({
      where: { journalEntry: { referenceId: second.body.id, referenceType: 'PAYMENT_VOUCHER' } },
      include: { account: true }
    });
    const secondBank = secondLines.find((line) => line.account.code === '1010' && Number(line.credit) > 0);
    expect(Number(secondBank.credit)).toBe(900);
    const secondCertificate = await request(app).get(`/api/finance/payment-vouchers/${second.body.id}/wht-certificate`).set(auth());
    expect(secondCertificate.body.invoiceWht).toBe(100);
    expect(secondCertificate.body.paymentWht).toBe(0);

    const accounts = await request(app).get('/api/finance/accounts').set(auth());
    const idOf = (code) => accounts.body.find((account) => account.code === code).id;
    const entry = await request(app).post('/api/finance/journal-entries').set(auth()).send({
      entryNumber: 'JE-TAX-1',
      date: today,
      description: 'Tax sample',
      lines: [
        { accountId: idOf('1200'), debit: 120.5, credit: 0 },
        { accountId: idOf('4000'), debit: 0, credit: 100 },
        { accountId: idOf('2100'), debit: 0, credit: 18 },
        { accountId: idOf('2120'), debit: 0, credit: 2.5 }
      ]
    });
    expect(entry.status).toBe(201);
    const tax = await request(app).get('/api/finance/tax-return').set(auth()).query({ from: today, to: today });
    expect(tax.status).toBe(200);
    expect(tax.body.outputVat).toBe(18);
    expect(tax.body.ssclPayable).toBe(2.5);
    expect(tax.body.netVat).toBe(18);

    const employee = await request(app).post('/api/hr/employees').set(auth()).send({
      empCode: 'E-1', firstName: 'Nimal', lastName: 'Perera', dateOfJoining: '2024-01-01', basicSalary: 100000
    });
    expect(employee.status).toBe(201);
    const preview = await request(app).get('/api/hr/payroll-preview').set(auth()).query({ month: 11, year: 2026 });
    const row = preview.body.find((person) => person.empCode === 'E-1');
    expect(row.epfEmployee).toBe(8000);
    expect(row.epfEmployer).toBe(12000);
    expect(row.etfEmployer).toBe(3000);
    const payroll = await request(app).post('/api/hr/salary-runs').set(auth()).send({
      month: 11, year: 2026, runNumber: 'SAL-202611', employeeData: [{
        employeeId: employee.body.id, additions: row.additions, deductions: row.deductions
      }]
    });
    expect(payroll.status).toBe(201);
    expect(Number(payroll.body.lines[0].netPay)).toBe(92000);
    const report = await request(app).get('/api/hr/statutory-report').set(auth()).query({ month: 11, year: 2026 });
    expect(report.body.totals).toMatchObject({ epfEmployee: 8000, epfEmployer: 12000, etfEmployer: 3000, epfTotal: 20000 });
    const payrollLines = await prisma.journalLine.findMany({
      where: { journalEntry: { tenantId: tenant.id, referenceType: 'SALARY_RUN' } },
      include: { account: true }
    });
    const epf = payrollLines.find((line) => line.account.code === '2130');
    const etf = payrollLines.find((line) => line.account.code === '2140');
    expect(Number(epf.credit)).toBe(20000);
    expect(Number(etf.credit)).toBe(3000);
    const payrollDebit = payrollLines.reduce((sum, line) => sum + Number(line.debit), 0);
    const payrollCredit = payrollLines.reduce((sum, line) => sum + Number(line.credit), 0);
    expect(payrollDebit).toBe(payrollCredit);

    const salesRole = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Sales only', permissions: { sales: ['read', 'write'] } }
    });
    const salesUser = await prisma.user.create({
      data: { tenantId: tenant.id, email: `sales-${Date.now()}@test.com`, passwordHash: 'x', roleId: salesRole.id }
    });
    const salesToken = jwt.sign({ userId: salesUser.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    const forbidden = await request(app).post('/api/imports/products').set(auth(salesToken)).attach('file', Buffer.from('code,name\nX,Y\n'), 'products.csv');
    expect(forbidden.status).toBe(403);
  });
});
