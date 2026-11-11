const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { postReceiptDocument } = require('../src/services/documentPosting');
const { onHand } = require('../src/services/stockService');
const { hashKey } = require('../src/middlewares/sfaAuth');

describe('phase 3 sales, dispatch and SFA', () => {
  let tenant;
  let token;
  let warehouse;
  let van;
  let factory;
  let customer;
  let other;
  let group;
  let product;
  const today = '2026-11-11';
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: 'Phase 3', slug: `p3-${Date.now()}`, currency: 'LKR' } });
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true } });
    const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `p3-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id } });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'ELK', name: 'Elakanda' } });
    van = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'VAN', name: 'Van stock' } });
    factory = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'FAC', name: 'Factory counter' } });
    group = await prisma.customerCategory.create({ data: { tenantId: tenant.id, code: 'GT', name: 'General trade' } });
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id, code: 'CUS-1', name: 'Shop', taxGroup: 'VAT', creditLimit: 100000,
        creditPeriod: 30, allowCreditSales: true, customerCategoryId: group.id, channel: 'GENERAL_TRADE'
      }
    });
    other = await prisma.customer.create({
      data: { tenantId: tenant.id, code: 'CUS-2', name: 'Modern', channel: 'MODERN_TRADE', allowCreditSales: true, creditLimit: 100000 }
    });
    product = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'SOYA', name: 'Soya pack', costPrice: 10, sellingPrice: 40, currency: 'LKR' }
    });
    const salesVat = await prisma.taxGroup.create({ data: { tenantId: tenant.id, name: 'VAT', description: 'VAT 18%' } });
    await prisma.taxSlab.create({ data: { tenantId: tenant.id, taxGroupId: salesVat.id, name: 'VAT', rate: 18, calculationOrder: 1 } });
    await prisma.$transaction((tx) => postReceiptDocument(tx, {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      referenceType: 'OPENING',
      referenceId: tenant.id,
      date: today,
      description: 'Opening',
      creditKey: 'OPENING_EQUITY',
      items: [{ productId: product.id, quantity: 20, unitPrice: 10 }]
    }));
    await prisma.$transaction((tx) => postReceiptDocument(tx, {
      tenantId: tenant.id,
      warehouseId: van.id,
      referenceType: 'OPENING',
      referenceId: `${tenant.id}-van`,
      date: today,
      description: 'Van opening',
      creditKey: 'OPENING_EQUITY',
      items: [{ productId: product.id, quantity: 5, unitPrice: 10 }]
    }));
    await prisma.$transaction((tx) => postReceiptDocument(tx, {
      tenantId: tenant.id,
      warehouseId: factory.id,
      referenceType: 'OPENING',
      referenceId: `${tenant.id}-fac`,
      date: today,
      description: 'Factory opening',
      creditKey: 'OPENING_EQUITY',
      items: [{ productId: product.id, quantity: 4, unitPrice: 10 }]
    }));
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
    await prisma.auditLog.deleteMany({ where });
    await prisma.approvalAction.deleteMany({ where });
    await prisma.approvalRequest.deleteMany({ where });
    await prisma.partyNote.deleteMany({ where });
    await prisma.stockReturnItem.deleteMany({ where });
    await prisma.stockReturn.deleteMany({ where });
    await prisma.stockAllocation.deleteMany({ where });
    await prisma.proofLine.deleteMany({ where });
    await prisma.proofOfDelivery.deleteMany({ where });
    await prisma.salesReturnLine.deleteMany({ where });
    await prisma.salesReturn.deleteMany({ where });
    await prisma.gatePass.deleteMany({ where });
    await prisma.tripDelivery.deleteMany({ where });
    await prisma.tripSheet.deleteMany({ where });
    await prisma.routePickLine.deleteMany({ where });
    await prisma.routePickOrder.deleteMany({ where });
    await prisma.routePick.deleteMany({ where });
    await prisma.salesReservation.deleteMany({ where });
    await prisma.orderCancellation.deleteMany({ where });
    await prisma.customerPrice.deleteMany({ where });
    await prisma.sfaMessage.deleteMany({ where });
    await prisma.sfaApiKey.deleteMany({ where });
    await prisma.appNotification.deleteMany({ where });
    await prisma.bankFileExport.deleteMany({ where });
    await prisma.bankFileTemplate.deleteMany({ where });
    await prisma.vehicle.deleteMany({ where });
    await prisma.shipTo.deleteMany({ where });
    await prisma.deliveryRoute.deleteMany({ where });
    await prisma.dispatchSetting.deleteMany({ where });
    await prisma.costLayer.deleteMany({ where });
    await prisma.stockMovement.deleteMany({ where });
    await prisma.journalLine.deleteMany({ where: { journalEntry: where } });
    await prisma.journalEntry.deleteMany({ where });
    await prisma.glAccountMap.deleteMany({ where });
    await prisma.paymentReceiptLine.deleteMany({ where: { receipt: where } });
    await prisma.paymentReceipt.deleteMany({ where });
    await prisma.salesInvoiceItem.deleteMany({ where: { invoice: where } });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.salesDeliveryItem.deleteMany({ where: { delivery: where } });
    await prisma.salesDelivery.deleteMany({ where });
    await prisma.salesOrderItem.deleteMany({ where: { order: where } });
    await prisma.salesOrder.deleteMany({ where });
    await prisma.taxSlab.deleteMany({ where });
    await prisma.taxGroup.deleteMany({ where });
    await prisma.account.deleteMany({ where });
    await prisma.product.deleteMany({ where });
    await prisma.customer.deleteMany({ where });
    await prisma.customerCategory.deleteMany({ where });
    await prisma.warehouse.deleteMany({ where });
    await prisma.user.deleteMany({ where });
    await prisma.role.deleteMany({ where });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  async function balanced() {
    const lines = await prisma.journalLine.findMany({ where: { journalEntry: { tenantId: tenant.id } } });
    const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
    expect(Math.abs(debit - credit)).toBeLessThan(0.001);
    expect(debit).toBeGreaterThan(0);
  }

  test('price hierarchy is customer, then group, then channel, then selling price', async () => {
    await request(app).post('/api/sales/dispatch/prices').set(auth()).send({
      scope: 'CUSTOMER', customerId: customer.id, productId: product.id, price: 25, currency: 'LKR', minQty: 1
    }).expect(201);
    await request(app).post('/api/sales/dispatch/prices').set(auth()).send({
      scope: 'GROUP', customerCategoryId: group.id, productId: product.id, price: 30, currency: 'LKR', minQty: 1
    }).expect(201);
    await request(app).post('/api/sales/dispatch/prices').set(auth()).send({
      scope: 'CHANNEL', channel: 'MODERN_TRADE', productId: product.id, price: 32, currency: 'LKR', minQty: 5
    }).expect(201);
    await request(app).post('/api/sales/dispatch/prices').set(auth()).send({
      scope: 'DEFAULT', productId: product.id, price: 36, currency: 'LKR', minQty: 1
    }).expect(201);

    const own = await request(app).get('/api/sales/dispatch/quote').set(auth())
      .query({ customerId: customer.id, productId: product.id, quantity: 1 });
    expect(own.body.source).toBe('CUSTOMER');
    expect(own.body.price).toBe(25);

    const groupCustomer = await prisma.customer.create({
      data: { tenantId: tenant.id, code: 'CUS-G', name: 'Group shop', customerCategoryId: group.id, allowCreditSales: true, creditLimit: 1000 }
    });
    const grouped = await request(app).get('/api/sales/dispatch/quote').set(auth())
      .query({ customerId: groupCustomer.id, productId: product.id, quantity: 1, channel: 'GENERAL_TRADE' });
    expect(grouped.body.source).toBe('GROUP');
    expect(grouped.body.price).toBe(30);

    const channel = await request(app).get('/api/sales/dispatch/quote').set(auth())
      .query({ customerId: other.id, productId: product.id, quantity: 5, channel: 'MODERN_TRADE' });
    expect(channel.body.source).toBe('CHANNEL');
    expect(channel.body.price).toBe(32);
  });

  test('release reserves stock, blocks a discount above the limit, and blocks dispatch without a gate pass', async () => {
    const route = await request(app).post('/api/sales/dispatch/routes').set(auth()).send({
      code: 'NORTH', name: 'North', warehouseId: warehouse.id
    });
    expect(route.status).toBe(201);
    const vehicle = await request(app).post('/api/sales/dispatch/vehicles').set(auth()).send({
      code: 'T1', registration: 'WP-1', driverName: 'Ranjith', kind: 'TRUCK', routeId: route.body.id
    });
    expect(vehicle.status).toBe(201);

    const over = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id, date: today, channel: 'GENERAL_TRADE',
      items: [{ productId: product.id, quantity: 2, unitPrice: 10, total: 20 }]
    });
    expect(over.status).toBe(201);
    const blocked = await request(app).post(`/api/sales/dispatch/orders/${over.body.id}/release`).set(auth()).send({ warehouseId: warehouse.id });
    expect(blocked.status).toBe(400);
    expect(blocked.body.fields.discount).toMatch(/limit/);

    const order = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id, date: today,
      items: [{ productId: product.id, quantity: 4, unitPrice: 24, total: 96 }]
    });
    expect(order.status).toBe(201);
    const released = await request(app).post(`/api/sales/dispatch/orders/${order.body.id}/release`).set(auth()).send({
      warehouseId: warehouse.id, routeId: route.body.id
    });
    expect(released.status).toBe(200);
    expect(released.body.order.status).toBe('RELEASED');
    const held = await prisma.stockAllocation.findMany({ where: { sourceId: order.body.id, status: 'OPEN' } });
    expect(Number(held[0].quantity)).toBe(4);

    const early = await request(app).post('/api/sales/dispatch/trips').set(auth()).send({
      date: today, deliveryIds: ['00000000-0000-0000-0000-000000000000'], vehicleId: vehicle.body.id
    });
    expect(early.status).toBe(400);

    const pick = await request(app).post('/api/sales/dispatch/picks').set(auth()).send({
      date: today, warehouseId: warehouse.id, routeId: route.body.id, vehicleId: vehicle.body.id, orderIds: [order.body.id]
    });
    expect(pick.status).toBe(201);
    expect(pick.body.summary[0].quantity).toBe(4);
    await request(app).post(`/api/sales/dispatch/picks/${pick.body.id}/advance`).set(auth()).send({ action: 'PICK' }).expect(200);
    await request(app).post(`/api/sales/dispatch/picks/${pick.body.id}/advance`).set(auth()).send({ action: 'PACK' }).expect(200);
    const notes = await request(app).post(`/api/sales/dispatch/picks/${pick.body.id}/deliveries`).set(auth()).send({ date: today });
    expect(notes.status).toBe(201);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id })).toBe(16);

    const trip = await request(app).post('/api/sales/dispatch/trips').set(auth()).send({
      date: today, deliveryIds: notes.body.map((row) => row.id), vehicleId: vehicle.body.id, routeId: route.body.id, driverName: 'Ranjith'
    });
    expect(trip.status).toBe(201);
    const refused = await request(app).post(`/api/sales/dispatch/trips/${trip.body.id}/depart`).set(auth()).send({});
    expect(refused.status).toBe(400);
    const invoices = await request(app).post(`/api/sales/dispatch/trips/${trip.body.id}/invoices`).set(auth()).send({ date: today });
    expect(invoices.status).toBe(201);
    expect(Number(invoices.body[0].taxAmount)).toBeCloseTo(17.28, 2);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id })).toBe(16);
    const pass = await request(app).post(`/api/sales/dispatch/trips/${trip.body.id}/gate-pass`).set(auth()).send({ securityName: 'Gate', loadNote: '4 packs' });
    expect(pass.status).toBe(201);
    expect(pass.body.status).toBe('ISSUED');
    await request(app).post(`/api/sales/dispatch/trips/${trip.body.id}/depart`).set(auth()).send({}).expect(200);

    const proof = await request(app).post('/api/sales/dispatch/proofs').set(auth()).send({
      deliveryId: notes.body[0].id,
      receivedBy: 'Shop keeper',
      lines: [{ productId: product.id, rejectedQty: 1, reason: 'Damaged carton' }]
    });
    expect(proof.status).toBe(201);
    expect(proof.body.status).toBe('PARTIAL');
    const credit = await request(app).post(`/api/sales/dispatch/proofs/${proof.body.id}/credit`).set(auth()).send({ date: today, kind: 'GRA' });
    expect(credit.status).toBe(201);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id })).toBe(17);

    const revenue = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.id, referenceType: 'PARTY_NOTE' }
    });
    expect(revenue).toBeTruthy();
    const stockReturn = await prisma.stockReturn.findFirst({ where: { tenantId: tenant.id, customerId: customer.id } });
    expect(stockReturn.status).toBe('POSTED');
    await balanced();

    const partial = await request(app).post(`/api/sales/dispatch/orders/${order.body.id}/cancel`).set(auth()).send({ reason: 'Customer cut the balance' });
    expect(partial.status).toBe(400);

    const fresh = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id, date: today,
      items: [{ productId: product.id, quantity: 1, unitPrice: 25, total: 25 }]
    });
    await request(app).post(`/api/sales/dispatch/orders/${fresh.body.id}/release`).set(auth()).send({ warehouseId: warehouse.id }).expect(200);
    const cancelled = await request(app).post(`/api/sales/dispatch/orders/${fresh.body.id}/cancel`).set(auth()).send({ reason: 'Called off' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const still = await prisma.stockAllocation.count({ where: { sourceId: fresh.body.id, status: 'OPEN' } });
    expect(still).toBe(0);

    const note = await prisma.appNotification.findFirst({ where: { tenantId: tenant.id, kind: 'GATE_PASS' } });
    expect(note.emailStatus).toBe('SKIPPED');
  });

  test('van and factory cash sales reduce stock and post revenue, tax, COGS and cash', async () => {
    const beforeVan = await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: van.id });
    const sale = await request(app).post('/api/sales/dispatch/cash-sales').set(auth()).send({
      customerId: customer.id,
      warehouseId: van.id,
      date: today,
      saleKind: 'VAN_CASH',
      items: [{ productId: product.id, quantity: 2, unitPrice: 25, total: 50 }]
    });
    expect(sale.status).toBe(201);
    expect(sale.body.status).toBe('PAID');
    expect(sale.body.stockPosted).toBe(true);
    expect(Number(sale.body.taxAmount)).toBeCloseTo(9, 2);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: van.id })).toBe(beforeVan - 2);

    const plain = await request(app).post('/api/sales/invoices').set(auth()).send({
      customerId: customer.id, date: today, status: 'UNPAID',
      items: [{ productId: product.id, quantity: 1, unitPrice: 25, total: 25 }]
    });
    expect(plain.status).toBe(201);
    expect(plain.body.stockPosted).toBe(false);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: van.id })).toBe(beforeVan - 2);

    const viaInvoice = await request(app).post('/api/sales/invoices').set(auth()).send({
      customerId: customer.id, date: today, saleKind: 'FACTORY_CASH', warehouseId: factory.id, status: 'UNPAID',
      items: [{ productId: product.id, quantity: 1, unitPrice: 25, total: 25 }]
    });
    expect(viaInvoice.status).toBe(201);
    expect(viaInvoice.body.saleKind).toBe('FACTORY_CASH');
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: factory.id })).toBe(3);
    const cancelledSale = await request(app).post(`/api/sales/dispatch/cash-sales/${viaInvoice.body.id}/cancel`).set(auth()).send({ reason: 'Counter void' });
    expect(cancelledSale.status).toBe(200);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: factory.id })).toBe(4);
    const audit = await prisma.auditLog.findFirst({ where: { tenantId: tenant.id, entity: 'CASH_SALE', action: 'REVERSE' } });
    expect(audit).toBeTruthy();

    const issue = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.id, referenceId: sale.body.id, description: { contains: 'Cash sale' } },
      include: { lines: true }
    });
    expect(issue).toBeTruthy();
    const accounts = await prisma.account.findMany({ where: { tenantId: tenant.id } });
    const byId = new Map(accounts.map((account) => [account.id, account.code]));
    const codes = issue.lines.map((line) => byId.get(line.accountId));
    expect(codes).toEqual(expect.arrayContaining(['5000', '1300']));
    await balanced();
  });

  test('SFA imports are idempotent, failures stay on the queue, and the bank file is configurable', async () => {
    const key = await request(app).post('/api/sales/dispatch/sfa/keys').set(auth()).send({ name: 'iForce' });
    expect(key.status).toBe(201);
    const api = { 'x-api-key': key.body.apiKey };
    const bad = await request(app).post('/api/sfa/v1/orders').set(api).send({
      externalRef: 'ORD-1', customerRef: 'missing', items: [{ productCode: 'SOYA', quantity: 1 }]
    });
    expect(bad.status).toBe(400);
    const queued = await prisma.sfaMessage.findFirst({ where: { tenantId: tenant.id, externalRef: 'ORD-1' } });
    expect(queued.status).toBe('FAILED');

    await request(app).post('/api/sfa/v1/customers').set(api).send({
      externalRef: 'C-9', code: 'C-9', name: 'Field shop', channel: 'GENERAL_TRADE', creditLimit: 5000, allowCreditSales: true
    }).expect(201);
    const again = await request(app).post('/api/sfa/v1/customers').set(api).send({
      externalRef: 'C-9', name: 'Field shop'
    });
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);

    const first = await request(app).post('/api/sfa/v1/orders').set(api).send({
      externalRef: 'ORD-9', customerRef: 'C-9', warehouseCode: 'ELK', date: today,
      items: [{ productCode: 'SOYA', quantity: 1 }]
    });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/sfa/v1/orders').set(api).send({
      externalRef: 'ORD-9', customerRef: 'C-9', items: [{ productCode: 'SOYA', quantity: 1 }]
    });
    expect(second.status).toBe(200);
    expect(await prisma.salesOrder.count({ where: { tenantId: tenant.id, externalRef: 'ORD-9' } })).toBe(1);

    const retry = await request(app).post(`/api/sales/dispatch/sfa/messages/${queued.id}/retry`).set(auth()).send({});
    expect(retry.status).toBe(400);
    await prisma.customer.update({ where: { id: customer.id }, data: { externalRef: 'missing' } });
    const recovered = await request(app).post(`/api/sales/dispatch/sfa/messages/${queued.id}/retry`).set(auth()).send({});
    expect(recovered.status).toBe(200);
    expect(recovered.body.order.status).toBe('RELEASED');

    const collected = await request(app).post('/api/sfa/v1/collections').set(api).send({
      externalRef: 'COL-1', customerCode: 'C-9', amount: 10, date: today, method: 'CASH'
    });
    expect(collected.status).toBe(201);
    const collectedAgain = await request(app).post('/api/sfa/v1/collections').set(api).send({
      externalRef: 'COL-1', customerCode: 'C-9', amount: 10, date: today
    });
    expect(collectedAgain.status).toBe(200);
    expect(await prisma.paymentReceipt.count({ where: { tenantId: tenant.id, reference: 'COL-1' } })).toBe(1);

    const items = await request(app).get('/api/sfa/v1/items').set(api);
    expect(items.body.some((row) => row.code === 'SOYA')).toBe(true);
    const stock = await request(app).get('/api/sfa/v1/stock').set(api);
    expect(stock.body.some((row) => row.productCode === 'SOYA' && row.quantity > 0)).toBe(true);

    const file = await request(app).post('/api/sales/dispatch/bank-file/export').set(auth()).send({ from: today, to: today });
    expect(file.status).toBe(201);
    expect(file.body.body.split('\n')[0]).toBe('Date,Reference,Customer,Amount,Method,Invoice');
    expect(file.body.rowCount).toBeGreaterThan(0);
    await request(app).put('/api/sales/dispatch/bank-file').set(auth()).send({
      columns: [{ key: 'reference', header: 'Ref' }, { key: 'amount', header: 'Amt' }]
    }).expect(200);
    await balanced();
  });
});

describe('SFA key helper', () => {
  test('hashes the same key to the same digest', () => {
    expect(hashKey('ncc-demo-sfa-key')).toBe(hashKey('ncc-demo-sfa-key'));
    expect(hashKey('ncc-demo-sfa-key')).not.toBe('ncc-demo-sfa-key');
  });
});
