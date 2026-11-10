const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

jest.setTimeout(30000);

describe('iMake v1 release candidate', () => {
  let tenant;
  let token;
  let warehouse;
  let supplier;
  let customer;
  let rm;
  let fg;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const today = '2026-11-10';

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Release Candidate', slug: `rc-${Date.now()}`, currency: 'LKR' }
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `rc-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id }
    });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'WH-1', name: 'Main' } });
    await prisma.workstation.create({
      data: { tenantId: tenant.id, code: 'CUT', name: 'Cutting', hourlyRate: 60, capacity: 1, efficiency: 1 }
    });
    supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, code: 'SUP-1', name: 'Mill' } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS-1', name: 'Buyer', creditLimit: 100000 } });
    rm = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'RM-1', name: 'Timber', standardCost: 4, costPrice: 4 }
    });
    fg = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'FG-1', name: 'Finished Chair', standardCost: 20, costPrice: 20, bomApplicable: true, sellingPrice: 80 }
    });
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
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
    await prisma.reasonCode.deleteMany({ where });
    await prisma.productionSetting.deleteMany({ where });
    await prisma.costLayer.deleteMany({ where });
    await prisma.stockMovement.deleteMany({ where });
    await prisma.supplierPaymentAllocation.deleteMany({ where });
    await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoice: where } });
    await prisma.supplierInvoice.deleteMany({ where });
    await prisma.paymentVoucher.deleteMany({ where });
    await prisma.paymentReceiptLine.deleteMany({ where: { receipt: where } });
    await prisma.paymentReceipt.deleteMany({ where });
    await prisma.salesInvoiceItem.deleteMany({ where: { invoice: where } });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.salesDeliveryItem.deleteMany({ where: { delivery: where } });
    await prisma.salesDelivery.deleteMany({ where });
    await prisma.salesOrderItem.deleteMany({ where: { order: where } });
    await prisma.salesOrder.deleteMany({ where });
    await prisma.gRNItem.deleteMany({ where: { grn: where } });
    await prisma.gRN.deleteMany({ where });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } });
    await prisma.purchaseOrder.deleteMany({ where });
    await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } });
    await prisma.purchaseRequisition.deleteMany({ where });
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

  test('buys, makes, sells, and closes with a balanced ledger and no WIP left', async () => {
    const settings = await request(app).put('/api/work-orders/settings').set(auth()).send({
      materialCheck: 'WARN', issueMode: 'BACKFLUSH', overheadPercent: 0, labourRatePerHour: 30, hoursPerDay: 8
    });
    expect(settings.status).toBe(200);

    const bom = await request(app).post('/api/boms').set(auth()).send({
      productId: fg.id,
      name: 'Chair BOM',
      version: '1',
      status: 'ACTIVE',
      items: [{ productId: rm.id, quantity: 1, scrapPercent: 0, type: 'Raw Material' }],
      routingSteps: [{ stepNumber: 1, sequence: 10, operation: 'Assemble', workCenter: 'CUT', setupMin: 0, runMin: 15, noOfWorkers: 1 }]
    });
    expect(bom.status).toBe(201);

    const pr = await request(app).post('/api/procurement/purchase-requisitions').set(auth()).send({
      supplierId: supplier.id, date: today, exchangeRate: 1,
      items: [{ productId: rm.id, quantity: 10, unitPrice: 4, total: 40 }]
    });
    expect(pr.status).toBe(201);
    const po = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id, prId: pr.body.id, date: today, exchangeRate: 1,
      items: [{ productId: rm.id, quantity: 10, unitPrice: 4, total: 40 }]
    });
    expect(po.status).toBe(201);
    const grn = await request(app).post('/api/procurement/grn').set(auth()).send({
      supplierId: supplier.id, poId: po.body.id, warehouseId: warehouse.id, date: today, exchangeRate: 1,
      items: [{ productId: rm.id, quantityReceived: 10, quantityOrdered: 10, unitPrice: 4 }]
    });
    expect(grn.status).toBe(201);
    const bill = await request(app).post('/api/procurement/supplier-invoices').set(auth()).send({
      supplierId: supplier.id, poId: po.body.id, grnId: grn.body.id, date: today, exchangeRate: 2,
      items: [{ productId: rm.id, quantity: 10, unitPrice: 4 }]
    });
    expect(bill.status).toBe(201);
    const payment = await request(app).post('/api/finance/payment-vouchers').set(auth()).send({
      supplierId: supplier.id, date: today, method: 'BANK_TRANSFER', amount: Number(bill.body.total), exchangeRate: 1,
      allocations: [{ supplierInvoiceId: bill.body.id, amount: Number(bill.body.total) }]
    });
    expect(payment.status).toBe(201);

    const order = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id, date: today, exchangeRate: 1,
      items: [{ productId: fg.id, quantity: 4, unitPrice: 80, total: 320 }]
    });
    expect(order.status).toBe(201);
    const draft = await prisma.workOrder.findFirst({
      where: { tenantId: tenant.id, salesOrderId: order.body.id, status: 'CREATED' },
      include: { operations: true }
    });
    expect(draft).toBeTruthy();

    const released = await request(app).post(`/api/work-orders/${draft.id}/release`).set(auth());
    expect(released.status).toBe(200);
    const reasons = await request(app).get('/api/work-orders/reason-codes').set(auth());
    const scrapReason = reasons.body.find((reason) => reason.code === 'SCRAP-DMG');
    const confirmed = await request(app).post(`/api/work-orders/${draft.id}/confirmations`).set(auth()).send({
      operationId: draft.operations[0].id,
      yieldQty: 3,
      scrapQty: 1,
      scrapReasonId: scrapReason.id,
      labourMinutes: 60,
      machineMinutes: 60,
      operatorName: 'Nimal'
    });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.quantityReceipted).toBeCloseTo ? expect(Number(confirmed.body.quantityReceipted)).toBeCloseTo(3) : expect(Number(confirmed.body.quantityReceipted)).toBe(3);

    const fgLayer = await prisma.costLayer.findFirst({
      where: { tenantId: tenant.id, productId: fg.id, sourceType: 'WORK_ORDER', quantityRemaining: { gt: 0 } }
    });
    expect(Number(fgLayer.unitCost)).toBeCloseTo(34);
    expect(Number(fgLayer.quantityRemaining)).toBeCloseTo(3);

    const teco = await request(app).post(`/api/work-orders/${draft.id}/teco`).set(auth());
    expect(teco.status).toBe(200);
    const closed = await request(app).post(`/api/work-orders/${draft.id}/close`).set(auth());
    expect(closed.status).toBe(200);
    const cost = await request(app).get(`/api/work-orders/${draft.id}/cost`).set(auth());
    expect(cost.status).toBe(200);
    expect(cost.body.variance.buckets.material.variance).toBeCloseTo(-4);
    expect(cost.body.variance.buckets.scrap.variance).toBeCloseTo(4);

    const delivery = await request(app).post('/api/sales/deliveries').set(auth()).send({
      customerId: customer.id, orderId: order.body.id, warehouseId: warehouse.id, date: today, status: 'DELIVERED',
      items: [{ productId: fg.id, quantity: 3 }]
    });
    expect(delivery.status).toBe(201);
    const delivered = await prisma.salesDeliveryItem.findFirst({ where: { deliveryId: delivery.body.id } });
    expect(Number(delivered.unitCost)).toBeCloseTo(34);
    expect(Number(delivered.costValue)).toBeCloseTo(102);

    const invoice = await request(app).post('/api/sales/invoices').set(auth()).send({
      customerId: customer.id, orderId: order.body.id, deliveryId: delivery.body.id, date: today, status: 'UNPAID', exchangeRate: 1,
      items: [{ productId: fg.id, quantity: 3, unitPrice: 80, total: 240 }]
    });
    expect(invoice.status).toBe(201);
    const receipt = await request(app).post('/api/finance/payment-receipts').set(auth()).send({
      customerId: customer.id, accountId: null, date: today, method: 'BANK_TRANSFER',
      amount: Number(invoice.body.total), exchangeRate: 1.1,
      allocations: [{ invoiceId: invoice.body.id, amount: Number(invoice.body.total) }]
    });
    expect(receipt.status).toBe(201);

    const rmLeft = await prisma.costLayer.findMany({
      where: { tenantId: tenant.id, productId: rm.id, quantityRemaining: { gt: 0 } }
    });
    const rmQty = rmLeft.reduce((sum, layer) => sum + Number(layer.quantityRemaining), 0);
    const rmValue = rmLeft.reduce((sum, layer) => sum + Number(layer.quantityRemaining) * Number(layer.unitCost), 0);
    expect(rmQty).toBeCloseTo(6);
    expect(rmValue).toBeCloseTo(24);
    const fgLeft = await prisma.costLayer.aggregate({
      where: { tenantId: tenant.id, productId: fg.id },
      _sum: { quantityRemaining: true }
    });
    expect(Number(fgLeft._sum.quantityRemaining || 0)).toBeCloseTo(0);

    const books = await request(app).get('/api/finance/trial-balance').set(auth());
    expect(books.body.balanced).toBe(true);
    expect(books.body.debit).toBeCloseTo(books.body.credit);
    const wip = books.body.accounts.find((row) => row.code === '1330');
    expect((wip?.debit || 0) - (wip?.credit || 0)).toBeCloseTo(0);
    const fxGain = books.body.accounts.find((row) => row.code === '4150');
    expect((fxGain?.credit || 0) - (fxGain?.debit || 0)).toBeGreaterThan(0);
  });
});
