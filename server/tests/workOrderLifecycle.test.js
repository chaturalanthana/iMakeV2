const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

jest.setTimeout(30000);

let tenant;
let token;
let warehouse;
let workstation;
let fg;
let rm;
let customer;

const auth = () => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenant.id
});

beforeAll(async () => {
  tenant = await prisma.tenant.create({
    data: { name: 'Work Order Lifecycle', slug: `wo-life-${Date.now()}` }
  });
  const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin' } });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `wo_${Date.now()}@test.com`,
      passwordHash: 'hash',
      roleId: role.id
    }
  });
  token = jwt.sign({ userId: user.id, email: user.email, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
  warehouse = await prisma.warehouse.create({
    data: { tenantId: tenant.id, code: 'WH-1', name: 'Main' }
  });
  workstation = await prisma.workstation.create({
    data: { tenantId: tenant.id, code: 'CUT', name: 'Cutting', hourlyRate: 60, capacity: 1, efficiency: 1 }
  });
  fg = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      code: 'FG-1',
      name: 'Finished Chair',
      standardCost: 20,
      costPrice: 20,
      bomApplicable: true
    }
  });
  rm = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      code: 'RM-1',
      name: 'Timber',
      standardCost: 4,
      costPrice: 4,
      bomApplicable: false
    }
  });
  customer = await prisma.customer.create({
    data: { tenantId: tenant.id, code: 'CUS-1', name: 'Buyer' }
  });
  await prisma.stockMovement.create({
    data: {
      tenantId: tenant.id,
      productId: rm.id,
      warehouseId: warehouse.id,
      type: 'GR',
      quantity: 10,
      referenceType: 'ADJ',
      referenceId: 'OPEN'
    }
  });
  await prisma.costLayer.create({
    data: {
      tenantId: tenant.id,
      productId: rm.id,
      warehouseId: warehouse.id,
      quantityReceived: 10,
      quantityRemaining: 10,
      unitCost: 4,
      sourceType: 'GR',
      sourceId: 'OPEN'
    }
  });
});

afterAll(async () => {
  const where = { tenantId: tenant.id };
  await prisma.workOrderIssue.deleteMany({ where });
  await prisma.workOrderConfirmation.deleteMany({ where });
  await prisma.materialReservation.deleteMany({ where });
  await prisma.operationTimeLog.deleteMany({ where });
  await prisma.workOrderOperation.deleteMany({ where });
  await prisma.workOrderComponent.deleteMany({ where });
  await prisma.workOrder.deleteMany({ where });
  await prisma.costLayer.deleteMany({ where });
  await prisma.stockMovement.deleteMany({ where });
  await prisma.productionJob.deleteMany({ where });
  await prisma.productionOrder.deleteMany({ where });
  await prisma.salesOrderItem.deleteMany({ where: { order: { tenantId: tenant.id } } });
  await prisma.salesOrder.deleteMany({ where });
  await prisma.routingOperation.deleteMany({ where });
  await prisma.routing.deleteMany({ where });
  await prisma.bOMItem.deleteMany({ where });
  await prisma.bOM.deleteMany({ where });
  await prisma.reasonCode.deleteMany({ where });
  await prisma.productionSetting.deleteMany({ where });
  await prisma.product.deleteMany({ where });
  await prisma.workstation.deleteMany({ where });
  await prisma.warehouse.deleteMany({ where });
  await prisma.customer.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.role.deleteMany({ where });
  await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId: tenant.id } } });
  await prisma.journalEntry.deleteMany({ where });
  await prisma.glAccountMap.deleteMany({ where });
  await prisma.account.deleteMany({ where });
  await prisma.tenant.delete({ where: { id: tenant.id } });
});

describe('Work order lifecycle', () => {
  let bomId;
  let main;
  let huge;

  test('settings, BOM routing, and draft work orders', async () => {
    const settings = await request(app)
      .put('/api/work-orders/settings')
      .set(auth())
      .send({ materialCheck: 'WARN', issueMode: 'BACKFLUSH', overheadPercent: 0, labourRatePerHour: 30, hoursPerDay: 8 });
    expect(settings.status).toBe(200);
    expect(settings.body.labourRatePerHour).toBeDefined();

    const bom = await request(app)
      .post('/api/boms')
      .set(auth())
      .send({
        productId: fg.id,
        name: 'Chair BOM',
        version: '1',
        status: 'ACTIVE',
        items: [{ productId: rm.id, quantity: 1, scrapPercent: 0, type: 'Raw Material' }],
        routingSteps: [{
          stepNumber: 1,
          sequence: 10,
          operation: 'Assemble',
          workCenter: 'CUT',
          setupMin: 0,
          runMin: 15,
          noOfWorkers: 1
        }]
      });
    expect(bom.status).toBe(201);
    bomId = bom.body.id;

    const routing = await prisma.routing.findUnique({
      where: { bomId },
      include: { operations: true }
    });
    expect(routing.version).toBe(bom.body.version);
    expect(routing.operations).toHaveLength(1);
    expect(routing.operations[0].workstationId).toBe(workstation.id);
    expect(parseFloat(routing.operations[0].runMinutesPerUnit)).toBe(15);

    const created = await request(app)
      .post('/api/work-orders')
      .set(auth())
      .send({ productId: fg.id, bomId, quantity: 4, warehouseId: warehouse.id });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('CREATED');
    expect(created.body.orderNumber).toContain('WO/');
    expect(created.body.components).toHaveLength(1);
    expect(parseFloat(created.body.components[0].requiredQty)).toBe(4);
    expect(created.body.operations).toHaveLength(1);
    expect(parseFloat(created.body.plannedMaterialCost)).toBe(16);
    expect(parseFloat(created.body.plannedLabourCost)).toBe(30);
    expect(parseFloat(created.body.plannedMachineCost)).toBe(60);
    main = created.body;

    const quote = await request(app)
      .get('/api/costing/rollup')
      .set(auth())
      .query({ productId: fg.id, quantity: 4 });
    expect(quote.status).toBe(200);
    expect(quote.body.total).toBe(106);
    expect(quote.body.unitCost).toBe(26.5);

    huge = (await request(app)
      .post('/api/work-orders')
      .set(auth())
      .send({ productId: fg.id, bomId, quantity: 100, warehouseId: warehouse.id })).body;
  });

  test('release blocks when configured, otherwise warns and reserves', async () => {
    await request(app).put('/api/work-orders/settings').set(auth()).send({ materialCheck: 'BLOCK' });
    const blocked = await request(app).post(`/api/work-orders/${huge.id}/release`).set(auth());
    expect(blocked.status).toBe(409);
    expect(blocked.body.shortages.length).toBeGreaterThan(0);
    expect(blocked.body.shortages[0].short).toBe(90);

    await request(app).put('/api/work-orders/settings').set(auth()).send({ materialCheck: 'WARN' });
    const warned = await request(app).post(`/api/work-orders/${huge.id}/release`).set(auth());
    expect(warned.status).toBe(200);
    expect(warned.body.status).toBe('RELEASED');
    expect(warned.body.warnings.length).toBeGreaterThan(0);
    expect(parseFloat(warned.body.components[0].reservedQty)).toBe(10);

    const cancelled = await request(app).post(`/api/work-orders/${huge.id}/cancel`).set(auth());
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const released = await request(app).post(`/api/work-orders/${main.id}/release`).set(auth());
    expect(released.status).toBe(200);
    expect(released.body.status).toBe('RELEASED');
    expect(released.body.warnings).toEqual([]);
    expect(parseFloat(released.body.components[0].reservedQty)).toBe(4);
  });

  test('capacity shows the released operation load', async () => {
    const res = await request(app).get('/api/work-orders/capacity').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('INFINITE');
    const row = res.body.workstations.find((station) => station.code === 'CUT');
    expect(row).toBeTruthy();
    expect(row.loadHours).toBeCloseTo(1, 2);
  });

  test('start, confirm with backflush and scrap, receipt, TECO, close', async () => {
    const operationId = main.operations[0].id;
    const started = await request(app)
      .post(`/api/work-orders/${main.id}/operations/${operationId}/start`)
      .set(auth())
      .send({ operatorName: 'Nimal' });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe('IN_PROGRESS');
    expect(started.body.operations[0].status).toBe('RUNNING');

    const reasons = await request(app).get('/api/work-orders/reason-codes').set(auth());
    const scrapReason = reasons.body.find((reason) => reason.code === 'SCRAP-DMG');
    expect(scrapReason).toBeTruthy();

    const confirmed = await request(app)
      .post(`/api/work-orders/${main.id}/confirmations`)
      .set(auth())
      .send({
        operationId,
        yieldQty: 3,
        scrapQty: 1,
        reworkQty: 0,
        scrapReasonId: scrapReason.id,
        labourMinutes: 60,
        machineMinutes: 60,
        lotNumber: 'LOT-FG',
        serialNumbers: 'SN-1,SN-2,SN-3',
        operatorName: 'Nimal'
      });
    expect(confirmed.status).toBe(201);
    expect(parseFloat(confirmed.body.quantityCompleted)).toBe(3);
    expect(parseFloat(confirmed.body.quantityScrapped)).toBe(1);
    expect(parseFloat(confirmed.body.quantityReceipted)).toBe(3);

    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: tenant.id, referenceId: main.id }
    });
    const issued = movements.find((row) => row.type === 'GI');
    const receipt = movements.find((row) => row.type === 'GR');
    expect(parseFloat(issued.quantity)).toBe(4);
    expect(parseFloat(receipt.quantity)).toBe(3);
    expect(receipt.lotNumber).toBe('LOT-FG');
    expect(receipt.serialNumber).toContain('SN-1');

    const rmLayer = await prisma.costLayer.findFirst({
      where: { tenantId: tenant.id, productId: rm.id, sourceType: 'GR' }
    });
    expect(parseFloat(rmLayer.quantityRemaining)).toBe(6);
    const fgLayer = await prisma.costLayer.findFirst({
      where: { tenantId: tenant.id, productId: fg.id, sourceType: 'WORK_ORDER' }
    });
    expect(parseFloat(fgLayer.quantityReceived)).toBe(3);
    expect(parseFloat(fgLayer.unitCost)).toBe(34);

    const cost = await request(app).get(`/api/work-orders/${main.id}/cost`).set(auth());
    expect(cost.status).toBe(200);
    expect(cost.body.variance.buckets.material.variance).toBe(-4);
    expect(cost.body.variance.buckets.scrap.variance).toBe(4);
    expect(cost.body.variance.buckets.labour.variance).toBe(0);
    expect(cost.body.variance.buckets.overhead.variance).toBe(0);

    const teco = await request(app).post(`/api/work-orders/${main.id}/teco`).set(auth());
    expect(teco.status).toBe(200);
    expect(teco.body.status).toBe('TECO');
    const closed = await request(app).post(`/api/work-orders/${main.id}/close`).set(auth());
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('CLOSED');

    const variances = await request(app).get('/api/costing/variances').set(auth());
    const product = variances.body.products.find((row) => row.productId === fg.id);
    expect(product.variance.buckets.material.variance).toBe(-4);
    expect(product.variance.buckets.scrap.variance).toBe(4);
  });

  test('manual issue does not backflush again on confirmation', async () => {
    const created = await request(app)
      .post('/api/work-orders')
      .set(auth())
      .send({ productId: fg.id, bomId, quantity: 1, warehouseId: warehouse.id, issueMode: 'MANUAL' });
    expect(created.status).toBe(201);
    const released = await request(app).post(`/api/work-orders/${created.body.id}/release`).set(auth());
    expect(released.status).toBe(200);
    const issued = await request(app)
      .post(`/api/work-orders/${created.body.id}/issues`)
      .set(auth())
      .send({ productId: rm.id, quantity: 1, lotNumber: 'LOT-M', serialNumber: 'SER-M' });
    expect(issued.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/work-orders/${created.body.id}/confirmations`)
      .set(auth())
      .send({ operationId: created.body.operations[0].id, yieldQty: 1, labourMinutes: 0, machineMinutes: 0 });
    expect(confirmed.status).toBe(201);
    const issues = await prisma.stockMovement.count({
      where: { tenantId: tenant.id, referenceId: created.body.id, type: 'GI' }
    });
    expect(issues).toBe(1);
    const lot = await prisma.workOrderIssue.findFirst({
      where: { workOrderId: created.body.id, lotNumber: 'LOT-M' }
    });
    expect(lot.serialNumber).toBe('SER-M');
  });

  test('sales orders and MRP create draft work orders', async () => {
    const sales = await request(app)
      .post('/api/sales/orders')
      .set(auth())
      .send({
        customerId: customer.id,
        date: new Date().toISOString(),
        status: 'PENDING',
        items: [{ productId: fg.id, quantity: 2, unitPrice: 50, total: 100 }]
      });
    expect(sales.status).toBe(201);
    const drafts = await prisma.workOrder.findMany({
      where: { tenantId: tenant.id, sourceType: 'SALES_ORDER' }
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe('CREATED');
    expect(parseFloat(drafts[0].quantity)).toBe(2);

    const revised = await request(app)
      .put(`/api/sales/orders/${sales.body.id}`)
      .set(auth())
      .send({
        customerId: customer.id,
        date: new Date().toISOString(),
        status: 'PENDING',
        items: [{ productId: fg.id, quantity: 5, unitPrice: 50, total: 250 }]
      });
    expect(revised.status).toBe(200);
    const updatedDraft = await prisma.workOrder.findFirst({
      where: { tenantId: tenant.id, salesOrderId: sales.body.id, status: 'CREATED' }
    });
    expect(parseFloat(updatedDraft.quantity)).toBe(5);

    const cleared = await request(app)
      .put(`/api/sales/orders/${sales.body.id}`)
      .set(auth())
      .send({
        customerId: customer.id,
        date: new Date().toISOString(),
        status: 'PENDING',
        items: []
      });
    expect(cleared.status).toBe(200);
    const cancelled = await prisma.workOrder.findFirst({ where: { id: updatedDraft.id } });
    expect(cancelled.status).toBe('CANCELLED');

    const mrp = await request(app)
      .post('/api/mrp/convert-production')
      .set(auth())
      .send({ productId: fg.id, quantity: 2 });
    expect(mrp.status).toBe(201);
    const mrpOrders = await prisma.workOrder.findMany({
      where: { tenantId: tenant.id, sourceType: 'MRP' }
    });
    expect(mrpOrders).toHaveLength(1);
    expect(mrpOrders[0].status).toBe('CREATED');
    expect(parseFloat(mrpOrders[0].quantity)).toBe(2);
  });

  test('legacy production jobs are copied onto the work order', async () => {
    const job = await request(app)
      .post('/api/production-jobs')
      .set(auth())
      .send({ productId: fg.id, quantity: 6, status: 'QUEUED' });
    expect(job.status).toBe(201);
    const linked = await prisma.workOrder.findFirst({ where: { legacyJobId: job.body.id } });
    expect(linked).toBeTruthy();
    expect(linked.orderNumber).toBe(job.body.jobNumber);
    expect(linked.status).toBe('CREATED');
    expect(parseFloat(linked.quantity)).toBe(6);

    const list = await request(app).get('/api/work-orders').set(auth());
    expect(list.status).toBe(200);
    expect(list.body.some((row) => row.orderNumber === job.body.jobNumber)).toBe(true);
  });
});
