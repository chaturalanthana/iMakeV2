const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { postReceiptDocument } = require('../src/services/documentPosting');
const { onHand } = require('../src/services/stockService');

describe('dispatch approval, live dashboard, and payroll switch', () => {
  let tenant;
  let maker;
  let approver;
  let token;
  let approverToken;
  let warehouse;
  let customer;
  let product;
  let workOrder;

  const auth = (value = token) => ({ Authorization: `Bearer ${value}` });
  const today = '2026-11-11';

  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: 'Follow up', slug: `follow-${Date.now()}`, currency: 'LKR' } });
    const finance = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Finance', permissions: { finance: ['read', 'write'], sales: ['read', 'write'], warehouse: ['read', 'write'], production: ['read', 'write'], settings: ['read', 'write'] } }
    });
    const admin = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    maker = await prisma.user.create({
      data: { tenantId: tenant.id, email: `follow-maker-${Date.now()}@test.com`, passwordHash: 'x', roleId: admin.id, firstName: 'Maker' }
    });
    approver = await prisma.user.create({
      data: { tenantId: tenant.id, email: `follow-approver-${Date.now()}@test.com`, passwordHash: 'x', roleId: finance.id, firstName: 'Approver' }
    });
    token = jwt.sign({ userId: maker.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    approverToken = jwt.sign({ userId: approver.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'VAN', name: 'Van' } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS', name: 'Shop', allowCreditSales: true, creditLimit: 100000 } });
    product = await prisma.product.create({ data: { tenantId: tenant.id, code: 'CHAIR', name: 'Chair', costPrice: 10, sellingPrice: 40, reorderLevel: 20 } });
    await prisma.$transaction((tx) => postReceiptDocument(tx, {
      tenantId: tenant.id, warehouseId: warehouse.id, referenceType: 'OPENING', referenceId: tenant.id,
      date: today, description: 'Opening', creditKey: 'OPENING_EQUITY',
      items: [{ productId: product.id, quantity: 8, unitPrice: 10 }]
    }));
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id, documentType: 'CASH_SALE', enabled: true, allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
      }
    });
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id, documentType: 'ABNORMAL_LOSS', enabled: true, allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
      }
    });
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id, documentType: 'GATE_PASS', enabled: true, allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
      }
    });
    workOrder = await prisma.workOrder.create({
      data: { tenantId: tenant.id, orderNumber: 'WO-LOSS', productId: product.id, quantity: 2, status: 'IN_PROGRESS', warehouseId: warehouse.id }
    });
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
    await prisma.auditLog.deleteMany({ where }).catch(() => {});
    await prisma.approvalAction.deleteMany({ where }).catch(() => {});
    await prisma.approvalRequest.deleteMany({ where }).catch(() => {});
    await prisma.approvalLevel.deleteMany({ where }).catch(() => {});
    await prisma.approvalRule.deleteMany({ where }).catch(() => {});
    await prisma.abnormalLoss.deleteMany({ where }).catch(() => {});
    await prisma.paymentReceiptLine.deleteMany({ where: { receipt: where } }).catch(() => {});
    await prisma.paymentReceipt.deleteMany({ where }).catch(() => {});
    await prisma.salesInvoiceItem.deleteMany({ where: { invoice: where } }).catch(() => {});
    await prisma.salesInvoice.deleteMany({ where }).catch(() => {});
    await prisma.gatePass.deleteMany({ where }).catch(() => {});
    await prisma.journalLine.deleteMany({ where: { journalEntry: where } }).catch(() => {});
    await prisma.journalEntry.deleteMany({ where }).catch(() => {});
    await prisma.glAccountMap.deleteMany({ where }).catch(() => {});
    await prisma.costLayer.deleteMany({ where }).catch(() => {});
    await prisma.stockMovement.deleteMany({ where }).catch(() => {});
    await prisma.workOrder.deleteMany({ where }).catch(() => {});
    await prisma.account.deleteMany({ where }).catch(() => {});
    await prisma.product.deleteMany({ where }).catch(() => {});
    await prisma.customer.deleteMany({ where }).catch(() => {});
    await prisma.warehouse.deleteMany({ where }).catch(() => {});
    await prisma.user.deleteMany({ where }).catch(() => {});
    await prisma.role.deleteMany({ where }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  });

  test('home figures come from posted invoices and the payroll menu stays off', async () => {
    const me = await request(app).get('/api/auth/me').set(auth());
    expect(me.body.tenant.hrEnabled).toBe(false);
    const dash = await request(app).get('/api/dashboard').set(auth()).query({ period: 'ytd' });
    expect(dash.status).toBe(200);
    expect(dash.body.revenue).toBe(0);
    expect(dash.body.products).toBe(1);
    expect(dash.body.lowStock).toBe(1);
    const turnedOn = await request(app).put('/api/controls/modules').set(auth()).send({ hrEnabled: true });
    expect(turnedOn.body.hrEnabled).toBe(true);
  });

  test('an approved cash sale reduces van stock and a loss posts from the worklist', async () => {
    const sale = await request(app).post('/api/sales/dispatch/cash-sales').set(auth()).send({
      customerId: customer.id, warehouseId: warehouse.id, date: today, saleKind: 'VAN_CASH',
      items: [{ productId: product.id, quantity: 2, unitPrice: 40, total: 80 }]
    });
    expect(sale.status).toBe(201);
    expect(sale.body.status).toBe('PENDING_APPROVAL');
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id })).toBe(8);

    const loss = await prisma.abnormalLoss.create({
      data: {
        tenantId: tenant.id, workOrderId: workOrder.id, productLine: 'Furniture',
        actualScrapPercent: 20, standardScrapPercent: 2, threshold: 2, excessQty: 1, amount: 10,
        reason: 'Power cut', status: 'PENDING'
      }
    });
    const { submitForApproval } = require('../src/services/approvalService');
    await submitForApproval(prisma, {
      tenantId: tenant.id, documentType: 'ABNORMAL_LOSS', documentId: loss.id,
      documentNumber: workOrder.orderNumber, amount: 10, userId: maker.id
    });

    const queue = await request(app).get('/api/approvals').set(auth(approverToken));
    const cash = queue.body.find((row) => row.documentType === 'CASH_SALE');
    const pendingLoss = queue.body.find((row) => row.documentType === 'ABNORMAL_LOSS');
    expect(cash).toBeTruthy();
    expect(pendingLoss).toBeTruthy();

    await request(app).post(`/api/approvals/${cash.id}/decide`).set(auth(approverToken)).send({ action: 'APPROVE' }).expect(200);
    expect(await onHand(prisma, { tenantId: tenant.id, productId: product.id, warehouseId: warehouse.id })).toBe(6);
    const paid = await prisma.salesInvoice.findUnique({ where: { id: sale.body.id } });
    expect(paid.status).toBe('PAID');

    await request(app).post(`/api/approvals/${pendingLoss.id}/decide`).set(auth(approverToken)).send({ action: 'APPROVE' }).expect(200);
    const posted = await prisma.abnormalLoss.findUnique({ where: { id: loss.id } });
    expect(posted.status).toBe('POSTED');
    const dash = await request(app).get('/api/dashboard').set(auth()).query({ period: 'ytd' });
    expect(dash.body.revenue).toBeGreaterThan(0);
  });

  test('approving a gate pass marks it issued', async () => {
    const trip = await prisma.tripSheet.create({
      data: { tenantId: tenant.id, number: 'TS-1', date: new Date(today), status: 'LOADED', driverName: 'Ranjith' }
    });
    const pass = await prisma.gatePass.create({
      data: { tenantId: tenant.id, number: 'GP-1', tripId: trip.id, status: 'PENDING_APPROVAL', driverName: 'Ranjith' }
    });
    const { submitForApproval } = require('../src/services/approvalService');
    await submitForApproval(prisma, {
      tenantId: tenant.id, documentType: 'GATE_PASS', documentId: pass.id, documentNumber: 'GP-1', amount: 0, userId: maker.id
    });
    const queue = await request(app).get('/api/approvals').set(auth(approverToken));
    const row = queue.body.find((item) => item.documentId === pass.id);
    await request(app).post(`/api/approvals/${row.id}/decide`).set(auth(approverToken)).send({ action: 'APPROVE' }).expect(200);
    const saved = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(saved.status).toBe('ISSUED');
  });
});
