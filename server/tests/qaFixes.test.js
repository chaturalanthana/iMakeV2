const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { trialBalance, postJournal } = require('../src/services/glService');

describe('final QA regressions', () => {
  let tenant;
  let maker;
  let approver;
  let token;
  let approverToken;
  let cash;
  let equity;
  let warehouse;
  let customer;
  let product;

  const auth = (value = token) => ({ Authorization: `Bearer ${value}` });

  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: 'QA fixes', slug: `qa-fixes-${Date.now()}`, currency: 'LKR' } });
    const finance = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Finance', permissions: { finance: ['read', 'write'], sales: ['read', 'write'], warehouse: ['read', 'write'], products: ['read', 'write'] } }
    });
    const clerk = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Clerk', permissions: { all: true } }
    });
    maker = await prisma.user.create({
      data: { tenantId: tenant.id, email: `qa-maker-${Date.now()}@test.com`, passwordHash: 'x', roleId: clerk.id, firstName: 'Maker' }
    });
    approver = await prisma.user.create({
      data: { tenantId: tenant.id, email: `qa-approver-${Date.now()}@test.com`, passwordHash: 'x', roleId: finance.id, firstName: 'Approver' }
    });
    token = jwt.sign({ userId: maker.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    approverToken = jwt.sign({ userId: approver.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    cash = await prisma.account.create({ data: { tenantId: tenant.id, code: '1000', name: 'Cash', type: 'ASSET' } });
    equity = await prisma.account.create({ data: { tenantId: tenant.id, code: '3000', name: 'Equity', type: 'EQUITY' } });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'MAIN', name: 'Main' } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS', name: 'Cafe', creditLimit: 50, creditPeriod: 14, allowCreditSales: true } });
    product = await prisma.product.create({ data: { tenantId: tenant.id, code: 'CHAIR', name: 'Chair', costPrice: 10, sellingPrice: 40 } });
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id,
        documentType: 'JOURNAL',
        enabled: true,
        allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
      }
    });
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id,
        documentType: 'SALES_ORDER_CREDIT',
        enabled: true,
        allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverUserId: approver.id }] }
      }
    });
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
    await prisma.salesOrderItem.deleteMany({ where: { order: where } }).catch(() => {});
    await prisma.salesOrder.deleteMany({ where }).catch(() => {});
    await prisma.stockMovement.deleteMany({ where }).catch(() => {});
    await prisma.costLayer.deleteMany({ where }).catch(() => {});
    await prisma.journalLine.deleteMany({ where: { journalEntry: where } }).catch(() => {});
    await prisma.journalEntry.deleteMany({ where }).catch(() => {});
    await prisma.approvalAction.deleteMany({ where }).catch(() => {});
    await prisma.approvalRequest.deleteMany({ where }).catch(() => {});
    await prisma.approvalLevel.deleteMany({ where }).catch(() => {});
    await prisma.approvalRule.deleteMany({ where }).catch(() => {});
    await prisma.auditLog.deleteMany({ where }).catch(() => {});
    await prisma.fiscalPeriod.deleteMany({ where }).catch(() => {});
    await prisma.product.deleteMany({ where }).catch(() => {});
    await prisma.customer.deleteMany({ where }).catch(() => {});
    await prisma.warehouse.deleteMany({ where }).catch(() => {});
    await prisma.account.deleteMany({ where }).catch(() => {});
    await prisma.user.deleteMany({ where }).catch(() => {});
    await prisma.role.deleteMany({ where }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  });

  test('trial balance nets each account and still balances', async () => {
    await prisma.$transaction(async (tx) => {
      await postJournal(tx, {
        tenantId: tenant.id,
        date: new Date('2026-11-02'),
        description: 'Cash in',
        referenceType: 'QA',
        referenceId: 'in',
        lines: [
          { accountId: cash.id, debit: 80, credit: 0 },
          { accountId: equity.id, debit: 0, credit: 80 }
        ]
      });
      await postJournal(tx, {
        tenantId: tenant.id,
        date: new Date('2026-11-03'),
        description: 'Cash out',
        referenceType: 'QA',
        referenceId: 'out',
        lines: [
          { accountId: equity.id, debit: 30, credit: 0 },
          { accountId: cash.id, debit: 0, credit: 30 }
        ]
      });
    });
    const books = await trialBalance(prisma, tenant.id);
    const cashRow = books.accounts.find((row) => row.code === '1000');
    expect(cashRow.debit).toBe(50);
    expect(cashRow.credit).toBe(0);
    expect(books.balanced).toBe(true);
    expect(books.debit).toBe(books.credit);
  });

  test('a journal without a number is numbered, and a closed month is blocked even when approval is on', async () => {
    const open = await request(app).post('/api/finance/journal-entries').set(auth()).send({
      date: '2026-11-11',
      description: 'Number me',
      lines: [
        { accountId: cash.id, debit: 4, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 4 }
      ]
    });
    expect(open.status).toBe(201);
    expect(open.body.entryNumber).toMatch(/^JE\//);
    expect(open.body.status).toBe('PENDING_APPROVAL');

    await prisma.fiscalPeriod.create({ data: { tenantId: tenant.id, year: 2026, month: 10, status: 'CLOSED' } });
    const closed = await request(app).post('/api/finance/journal-entries').set(auth()).send({
      date: '2026-10-15',
      description: 'Too late',
      lines: [
        { accountId: cash.id, debit: 4, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 4 }
      ]
    });
    expect(closed.status).toBe(400);
    expect(closed.body.error).toMatch(/closed/i);
  });

  test('credit hold parks an over-limit order for the other approver', async () => {
    const held = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id,
      date: '2026-11-11',
      status: 'PENDING',
      items: [{ productId: product.id, quantity: 2, unitPrice: 40, total: 80 }]
    });
    expect(held.status).toBe(201);
    expect(held.body.status).toBe('PENDING_APPROVAL');
    const queue = await request(app).get('/api/approvals').set(auth(approverToken));
    expect(queue.body.some((row) => row.documentId === held.body.id && row.documentType === 'SALES_ORDER_CREDIT')).toBe(true);
  });

  test('stock movement export is an xlsx workbook', async () => {
    const sheet = await request(app).get('/api/inventory/reports/movement').set(auth()).query({ format: 'xlsx' }).responseType('blob');
    expect(sheet.status).toBe(200);
    expect(sheet.headers['content-type']).toContain('spreadsheet');
    const bytes = Buffer.isBuffer(sheet.body) ? sheet.body : Buffer.from(sheet.body);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
  });
});
