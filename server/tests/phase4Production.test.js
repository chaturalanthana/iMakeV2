const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { trialBalance } = require('../src/services/glService');

jest.setTimeout(30000);

let tenant;
let token;
let warehouse;
let virtual;
let supplier;
let customer;
let fg;
let mts;
let rm;
let alt;
let machine;
let bomItemId;

const auth = () => ({ Authorization: `Bearer ${token}`, 'x-tenant-id': tenant.id });

async function lay(productId, warehouseId, quantity, unitCost, lotNumber) {
  await prisma.stockMovement.create({
    data: {
      tenantId: tenant.id, productId, warehouseId, type: 'GR', quantity,
      unitCost, value: quantity * unitCost, referenceType: 'OPENING', lotNumber
    }
  });
  await prisma.costLayer.create({
    data: {
      tenantId: tenant.id, productId, warehouseId, quantityReceived: quantity,
      quantityRemaining: quantity, unitCost, sourceType: 'GR', lotNumber
    }
  });
}

beforeAll(async () => {
  tenant = await prisma.tenant.create({ data: { name: 'Phase 4', slug: `p4-${Date.now()}` } });
  const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin' } });
  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email: `p4_${Date.now()}@test.com`, passwordHash: 'hash', roleId: role.id }
  });
  token = jwt.sign({ userId: user.id, email: user.email, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
  warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'MAIN', name: 'Stores' } });
  supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, code: 'SUB', name: 'Packer' } });
  virtual = await prisma.warehouse.create({
    data: { tenantId: tenant.id, code: 'SUB-1', name: 'Factory floor', locationRole: 'VIRTUAL', supplierId: supplier.id }
  });
  customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'C1', name: 'Hotel' } });
  rm = await prisma.product.create({
    data: { tenantId: tenant.id, code: 'RM', name: 'Bean', costPrice: 5, standardCost: 5, type: 'PRODUCT' }
  });
  alt = await prisma.product.create({
    data: { tenantId: tenant.id, code: 'ALT', name: 'Bean alternate', costPrice: 8, standardCost: 8, type: 'PRODUCT' }
  });
  fg = await prisma.product.create({
    data: { tenantId: tenant.id, code: 'FG', name: 'Soya pack', bomApplicable: true, planningPolicy: 'MAKE_TO_ORDER', type: 'PRODUCT', costPrice: 20, standardCost: 20 }
  });
  mts = await prisma.product.create({
    data: {
      tenantId: tenant.id, code: 'MTS', name: 'Pasta pack', bomApplicable: true, planningPolicy: 'MAKE_TO_STOCK',
      type: 'PRODUCT', safetyStock: 4, stockTarget: 8, lotPolicy: 'FIXED', fixedLotQty: 5, manufacturingLeadDays: 2,
      costPrice: 20, standardCost: 20
    }
  });
  const group = await prisma.productGroup.create({
    data: { tenantId: tenant.id, name: 'Soya', standardYieldPercent: 97, standardScrapPercent: 2, abnormalLossThreshold: 2 }
  });
  await prisma.product.update({ where: { id: fg.id }, data: { productGroupId: group.id } });
  const bom = await prisma.bOM.create({
    data: {
      tenantId: tenant.id, productId: fg.id, code: '1', name: 'Soya', version: '1', status: 'ACTIVE', isDefault: true,
      items: { create: [{ tenantId: tenant.id, productId: rm.id, quantity: 1, scrapPercent: 0 }] },
      routingSteps: [{ sequence: 10, operation: 'Mixing', milestoneWeight: 40 }, { sequence: 20, operation: 'Packaging', milestoneWeight: 60 }]
    }
  });
  await prisma.bOM.create({
    data: {
      tenantId: tenant.id, productId: mts.id, code: '1', name: 'Pasta', version: '1', status: 'ACTIVE', isDefault: true,
      items: { create: [{ tenantId: tenant.id, productId: rm.id, quantity: 1 }] }
    }
  });
  const item = await prisma.bOMItem.findFirst({ where: { bomId: bom.id, productId: rm.id } });
  bomItemId = item.id;
  await request(app).post('/api/production/alternates').set(auth()).send({ bomItemId, productId: alt.id, ratio: 1 });
  const station = await prisma.workstation.create({
    data: { tenantId: tenant.id, code: 'MIX', name: 'Mixing', hourlyRate: 0, capacity: 1, efficiency: 1 }
  });
  machine = await prisma.machine.create({ data: { tenantId: tenant.id, code: 'SOYA-2', name: 'Soya Machine 2', workstationId: station.id } });
  await lay(rm.id, warehouse.id, 20, 5, 'RM-1');
  await lay(alt.id, warehouse.id, 10, 8, 'ALT-1');
});

afterAll(async () => {
  const where = { tenantId: tenant.id };
  await prisma.batchGenealogy.deleteMany({ where });
  await prisma.machineCapture.deleteMany({ where });
  await prisma.abnormalLoss.deleteMany({ where });
  await prisma.contractIssue.deleteMany({ where });
  await prisma.contractOrder.deleteMany({ where });
  await prisma.payrollImport.deleteMany({ where });
  await prisma.overheadReconciliation.deleteMany({ where });
  await prisma.plannedProductionOrder.deleteMany({ where });
  await prisma.mpsBucket.deleteMany({ where });
  await prisma.mpsRun.deleteMany({ where });
  await prisma.demandForecast.deleteMany({ where });
  await prisma.bomAlternate.deleteMany({ where });
  await prisma.workOrderIssue.deleteMany({ where });
  await prisma.workOrderConfirmation.deleteMany({ where });
  await prisma.materialReservation.deleteMany({ where });
  await prisma.operationTimeLog.deleteMany({ where });
  await prisma.workOrderOperation.deleteMany({ where });
  await prisma.workOrderComponent.deleteMany({ where });
  await prisma.workOrder.deleteMany({ where });
  await prisma.journalLine.deleteMany({ where: { journalEntry: where } });
  await prisma.journalEntry.deleteMany({ where });
  await prisma.glAccountMap.deleteMany({ where });
  await prisma.costLayer.deleteMany({ where });
  await prisma.stockMovement.deleteMany({ where });
  await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoice: where } });
  await prisma.supplierInvoice.deleteMany({ where });
  await prisma.routingOperation.deleteMany({ where });
  await prisma.routing.deleteMany({ where });
  await prisma.bOMItem.deleteMany({ where });
  await prisma.bOM.deleteMany({ where });
  await prisma.salesOrderItem.deleteMany({ where: { order: where } });
  await prisma.salesOrder.deleteMany({ where });
  await prisma.account.deleteMany({ where });
  await prisma.product.deleteMany({ where });
  await prisma.productGroup.deleteMany({ where });
  await prisma.machine.deleteMany({ where });
  await prisma.workstation.deleteMany({ where });
  await prisma.productionSetting.deleteMany({ where });
  await prisma.warehouse.deleteMany({ where });
  await prisma.supplier.deleteMany({ where });
  await prisma.customer.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.role.deleteMany({ where });
  await prisma.tenant.delete({ where: { id: tenant.id } });
});

describe('Phase 4 production and planning', () => {
  test('defaults are listed and a weekly MPS proposes a make-to-stock order', async () => {
    const defaults = await request(app).get('/api/production/defaults').set(auth());
    expect(defaults.status).toBe(200);
    expect(defaults.body.decisions.map((row) => row.id)).toEqual(expect.arrayContaining(['PD-02-horizon', 'D-07-loss', 'PD-05-grace']));
    expect(defaults.body.settings.closeGraceDays).toBe(3);

    const forecast = await request(app).put('/api/production/forecasts').set(auth()).send({
      productId: mts.id, quantity: 3, weekStart: new Date().toISOString()
    });
    expect(forecast.status).toBe(200);

    const mps = await request(app).post('/api/production/mps/run').set(auth()).send({ horizonWeeks: 4 });
    expect(mps.status).toBe(200);
    const planned = mps.body.plannedOrders.find((row) => row.productId === mts.id);
    expect(planned).toBeTruthy();
    expect(parseFloat(planned.quantity)).toBe(15);
    const due = new Date(planned.dueDate);
    const start = new Date(planned.startDate);
    expect(Math.round((due - start) / 86400000)).toBe(2);

    const firm = await request(app).post(`/api/production/planned-orders/${planned.id}/firm`).set(auth()).send({});
    expect(firm.status).toBe(200);
    expect(firm.body.workOrder.orderNumber).toContain('WO/');
    expect(firm.body.status).toBe('CONVERTED');
  });

  test('make to order gets a draft per sales line and make to stock does not', async () => {
    const sales = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id,
      date: new Date().toISOString(),
      status: 'PENDING',
      items: [
        { productId: fg.id, quantity: 2, unitPrice: 10, total: 20 },
        { productId: mts.id, quantity: 6, unitPrice: 10, total: 60 }
      ]
    });
    expect(sales.status).toBe(201);
    const drafts = await prisma.workOrder.findMany({ where: { tenantId: tenant.id, sourceType: 'SALES_ORDER' } });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].productId).toBe(fg.id);
    expect(parseFloat(drafts[0].quantity)).toBe(2);
  });

  test('substitution is costed at the alternate and kept out of the scrap variance', async () => {
    const created = await request(app).post('/api/work-orders').set(auth()).send({
      productId: fg.id, quantity: 2, warehouseId: warehouse.id, issueMode: 'MANUAL'
    });
    const id = created.body.id;
    await request(app).post(`/api/work-orders/${id}/release`).set(auth());
    const issued = await request(app).post(`/api/work-orders/${id}/issues`).set(auth()).send({
      productId: rm.id, quantity: 2, substituteProductId: alt.id, lotNumber: 'ALT-1'
    });
    expect(issued.status).toBe(201);
    const row = issued.body.issues.find((issue) => issue.lotNumber === 'ALT-1');
    expect(parseFloat(row.substitutionDelta)).toBe(6);
    expect(row.issuedProductId).toBe(alt.id);
    const books = await trialBalance(prisma, tenant.id);
    expect(books.balanced).toBe(true);
  });

  test('machine capture, milestone WIP, abnormal loss and genealogy hit the ledger', async () => {
    const created = await request(app).post('/api/work-orders').set(auth()).send({
      productId: fg.id, quantity: 2, warehouseId: warehouse.id, issueMode: 'MANUAL'
    });
    const id = created.body.id;
    const weights = created.body.operations.map((row) => parseFloat(row.milestoneWeight));
    expect(weights).toEqual([40, 60]);
    await request(app).post(`/api/work-orders/${id}/release`).set(auth());
    await request(app).post(`/api/work-orders/${id}/issues`).set(auth()).send({ productId: rm.id, quantity: 2, lotNumber: 'RM-1' });
    const reasons = await request(app).get('/api/work-orders/reason-codes').set(auth());
    const scrap = reasons.body.find((row) => row.category === 'SCRAP');
    const first = created.body.operations[0];
    const second = created.body.operations[1];
    const capture = await request(app).post('/api/production/captures').set(auth()).send({
      workOrderId: id, operationId: first.id, machineId: machine.id,
      inputQty: 10, outputQty: 8, wastageQty: 1, downtimeMinutes: 15, downtimeReason: 'Power failure',
      scrapQty: 1, reworkQty: 0, coproductQty: 0, byproductQty: 0, lotNumber: 'FG-CAP'
    });
    expect(capture.status).toBe(200);
    expect(parseFloat(capture.body.yieldPercent)).toBe(80);
    expect(parseFloat(capture.body.theoreticalYieldPercent)).toBe(97);

    await request(app).post(`/api/work-orders/${id}/confirmations`).set(auth()).send({
      operationId: first.id, yieldQty: 2, scrapQty: 0, labourMinutes: 30, machineMinutes: 0
    });
    const confirmed = await request(app).post(`/api/work-orders/${id}/confirmations`).set(auth()).send({
      operationId: second.id, yieldQty: 0, scrapQty: 2, scrapReasonId: scrap.id, labourMinutes: 0, machineMinutes: 0, lotNumber: 'FG-LOT'
    });
    expect(confirmed.status).toBe(201);
    const loss = await prisma.abnormalLoss.findFirst({ where: { workOrderId: id } });
    expect(loss.status).toBe('PENDING');
    const approved = await request(app).post(`/api/production/losses/${loss.id}/approve`).set(auth()).send({
      reason: 'Power failure above the soya line tolerance'
    });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('POSTED');
    const books = await trialBalance(prisma, tenant.id);
    expect(books.balanced).toBe(true);
    const lossAccount = books.accounts.find((row) => row.code === '5540');
    expect(lossAccount.debit).toBeGreaterThan(0);

    const wip = await request(app).get('/api/production/reports/wip').set(auth());
    expect(wip.status).toBe(200);
    expect(wip.body.columns.map((column) => column.label)).toEqual(expect.arrayContaining(['Stage of Completion', 'Total WIP Value']));
    const genealogy = await request(app).get('/api/production/reports/genealogy').set(auth());
    expect(genealogy.body.rows.some((row) => row.fgLot === 'FG-LOT' && row.rmLot === 'RM-1')).toBe(true);

    const sheet = await request(app).get('/api/production/reports/variance').set(auth()).query({ format: 'xlsx' }).responseType('blob');
    expect(sheet.status).toBe(200);
    expect(sheet.headers['content-type']).toContain('spreadsheet');
    const bytes = Buffer.isBuffer(sheet.body) ? sheet.body : Buffer.from(sheet.body);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const printable = await request(app).get('/api/production/reports/yield').set(auth()).query({ format: 'html' });
    expect(printable.text).toContain('Soya Machine 2');
  });

  test('full confirmation becomes TECO and the daily job closes it after the grace period', async () => {
    const created = await request(app).post('/api/work-orders').set(auth()).send({
      productId: fg.id, quantity: 1, warehouseId: warehouse.id, issueMode: 'MANUAL'
    });
    const id = created.body.id;
    await request(app).post(`/api/work-orders/${id}/release`).set(auth());
    await request(app).post(`/api/work-orders/${id}/issues`).set(auth()).send({ productId: rm.id, quantity: 1, lotNumber: 'RM-1' });
    const operation = created.body.operations[created.body.operations.length - 1];
    if (created.body.operations.length > 1) {
      await request(app).post(`/api/work-orders/${id}/confirmations`).set(auth()).send({
        operationId: created.body.operations[0].id, yieldQty: 1, scrapQty: 0
      });
    }
    const confirmed = await request(app).post(`/api/work-orders/${id}/confirmations`).set(auth()).send({
      operationId: operation.id, yieldQty: 1, scrapQty: 0, lotNumber: 'FG-FULL'
    });
    expect(confirmed.body.status).toBe('TECO');
    expect(confirmed.body.closeDueAt).toBeTruthy();
    await prisma.workOrder.update({ where: { id }, data: { closeDueAt: new Date('2020-01-01') } });
    const tick = await request(app).post('/api/replenishment/schedule-tick').set(auth()).send({});
    expect(tick.body.closed.some((row) => row.id === id && !row.error)).toBe(true);
    const closed = await prisma.workOrder.findUnique({ where: { id } });
    expect(closed.status).toBe('CLOSED');
    const books = await trialBalance(prisma, tenant.id);
    expect(books.balanced).toBe(true);
  });

  test('short close posts the order now and close now refuses an open shortage', async () => {
    const created = await request(app).post('/api/work-orders').set(auth()).send({
      productId: fg.id, quantity: 3, warehouseId: warehouse.id, issueMode: 'MANUAL'
    });
    const id = created.body.id;
    await request(app).post(`/api/work-orders/${id}/release`).set(auth());
    await request(app).post(`/api/work-orders/${id}/issues`).set(auth()).send({ productId: rm.id, quantity: 1, lotNumber: 'RM-1' });
    const last = created.body.operations[created.body.operations.length - 1];
    if (created.body.operations.length > 1) {
      await request(app).post(`/api/work-orders/${id}/confirmations`).set(auth()).send({
        operationId: created.body.operations[0].id, yieldQty: 1, scrapQty: 0
      });
    }
    await request(app).post(`/api/work-orders/${id}/confirmations`).set(auth()).send({
      operationId: last.id, yieldQty: 1, scrapQty: 0
    });
    const refused = await request(app).post(`/api/work-orders/${id}/close-now`).set(auth()).send({});
    expect(refused.status).toBe(400);
    const closed = await request(app).post(`/api/work-orders/${id}/short-close`).set(auth()).send({});
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.shortClosed).toBe(true);
    const books = await trialBalance(prisma, tenant.id);
    expect(books.balanced).toBe(true);
  });

  test('payroll import and overhead reconciliation stay in balance', async () => {
    const payroll = await request(app).post('/api/production/payroll-imports').set(auth()).send({
      date: new Date().toISOString(),
      description: 'November payroll',
      lines: [
        { accountKey: 'SALARY_EXPENSE', debit: 100, credit: 0 },
        { accountKey: 'SALARIES_PAYABLE', debit: 0, credit: 100 }
      ]
    });
    expect(payroll.status).toBe(200);
    const overhead = await request(app).post('/api/production/overhead-reconcile').set(auth()).send({
      from: new Date('2020-01-01').toISOString(),
      to: new Date().toISOString()
    });
    expect(overhead.status).toBe(200);
    expect(parseFloat(overhead.body.actualPayroll)).toBe(100);
    const books = await trialBalance(prisma, tenant.id);
    expect(books.balanced).toBe(true);
  });

  test('contract manufacturing issues to a virtual warehouse, receives FG, and charges AP', async () => {
    const created = await request(app).post('/api/production/contracts').set(auth()).send({
      supplierId: supplier.id,
      virtualWarehouseId: virtual.id,
      fgWarehouseId: warehouse.id,
      productId: fg.id,
      quantity: 2,
      serviceCharge: 50
    });
    expect(created.status).toBe(200);
    const id = created.body.id;
    const issued = await request(app).post(`/api/production/contracts/${id}/issue`).set(auth()).send({
      warehouseId: warehouse.id, productId: rm.id, quantity: 2, lotNumber: 'RM-1'
    });
    expect(issued.status).toBe(200);
    const received = await request(app).post(`/api/production/contracts/${id}/receive`).set(auth()).send({
      quantity: 2, lotNumber: 'FG-CM'
    });
    expect(received.status).toBe(200);
    const charged = await request(app).post(`/api/production/contracts/${id}/charge`).set(auth()).send({});
    expect(charged.status).toBe(200);
    expect(charged.body.status).toBe('INVOICED');
    const invoice = await prisma.supplierInvoice.findFirst({ where: { tenantId: tenant.id, supplierReference: created.body.orderNumber } });
    expect(parseFloat(invoice.total)).toBe(50);
    const books = await trialBalance(prisma, tenant.id);
    expect(books.balanced).toBe(true);
    const ap = books.accounts.find((row) => row.code === '2000');
    expect(ap.credit).toBeGreaterThanOrEqual(50);
    const trace = await prisma.batchGenealogy.findFirst({ where: { tenantId: tenant.id, fgLotNumber: 'FG-CM' } });
    expect(trace.rmLotNumber).toBe('RM-1');
    expect(trace.fgBatchId).toBeTruthy();
    expect(trace.rmBatchId).toBeTruthy();
    const batches = await prisma.stockBatch.findMany({ where: { id: { in: [trace.fgBatchId, trace.rmBatchId] } } });
    expect(batches).toHaveLength(2);

    const cancelled = await request(app).post(`/api/production/contracts/${id}/cancel`).set(auth()).send({
      reason: 'Subcontractor could not finish the run'
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: tenant.id, entity: 'CONTRACT_ORDER', entityId: id, action: 'REVERSE' }
    });
    expect(audit).toBeTruthy();
    const booksAfter = await trialBalance(prisma, tenant.id);
    expect(booksAfter.balanced).toBe(true);
  });

  test('production journals carry the cost center', async () => {
    const center = await prisma.orgCenter.create({
      data: { tenantId: tenant.id, code: 'SOYA', name: 'Soya Manufacturing', kind: 'COST' }
    });
    const created = await request(app).post('/api/work-orders').set(auth()).send({
      productId: fg.id, quantity: 1, warehouseId: warehouse.id, issueMode: 'MANUAL', costCenterId: center.id
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    await request(app).post(`/api/work-orders/${id}/release`).set(auth());
    const issued = await request(app).post(`/api/work-orders/${id}/issues`).set(auth()).send({
      productId: rm.id, quantity: 1, lotNumber: 'RM-1'
    });
    expect(issued.status).toBe(201);
    const line = await prisma.journalLine.findFirst({
      where: { costCenterId: center.id, journalEntry: { tenantId: tenant.id, referenceId: id } }
    });
    expect(line).toBeTruthy();
  });
});
