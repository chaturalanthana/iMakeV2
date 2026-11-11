const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

describe('phase 0 go-live controls', () => {
  let tenant;
  let maker;
  let approver;
  let makerToken;
  let approverToken;
  let warehouse;
  let supplier;
  let customer;
  let product;
  let cash;
  let equity;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const today = '2026-03-15';

  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: 'Controls', slug: `controls-${Date.now()}`, currency: 'LKR' } });
    const finance = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Finance', permissions: { finance: ['read', 'write'], procurement: ['read', 'write'], sales: ['read', 'write'], warehouse: ['read', 'write'], products: ['read', 'write'] } }
    });
    const clerk = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Clerk', permissions: { finance: ['read', 'write'], procurement: ['read', 'write'], sales: ['read', 'write'], warehouse: ['read', 'write'], products: ['read', 'write'], settings: ['read', 'write'] } }
    });
    maker = await prisma.user.create({
      data: { tenantId: tenant.id, email: `maker-${Date.now()}@test.com`, passwordHash: 'x', roleId: clerk.id, firstName: 'Maker' }
    });
    approver = await prisma.user.create({
      data: { tenantId: tenant.id, email: `approver-${Date.now()}@test.com`, passwordHash: 'x', roleId: finance.id, firstName: 'Approver' }
    });
    makerToken = jwt.sign({ userId: maker.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    approverToken = jwt.sign({ userId: approver.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'MAIN', name: 'Main' } });
    supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, code: 'SUP', name: 'Mill' } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS', name: 'Buyer', creditLimit: 50, creditPeriod: 30 } });
    product = await prisma.product.create({ data: { tenantId: tenant.id, code: 'ITEM', name: 'Board', costPrice: 10, sellingPrice: 40 } });
    cash = await prisma.account.create({ data: { tenantId: tenant.id, code: '1000', name: 'Cash', type: 'ASSET' } });
    equity = await prisma.account.create({ data: { tenantId: tenant.id, code: '3000', name: 'Equity', type: 'EQUITY' } });
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id,
        documentType: 'JOURNAL',
        enabled: true,
        allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
      }
    });
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
    await prisma.salesOrderItem.deleteMany({ where: { order: where } }).catch(() => {});
    await prisma.salesOrder.deleteMany({ where }).catch(() => {});
    await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoice: where } }).catch(() => {});
    await prisma.supplierInvoice.deleteMany({ where }).catch(() => {});
    await prisma.gRNItem.deleteMany({ where: { grn: where } }).catch(() => {});
    await prisma.gRN.deleteMany({ where }).catch(() => {});
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } }).catch(() => {});
    await prisma.purchaseOrder.deleteMany({ where }).catch(() => {});
    await prisma.goodsIssueItem.deleteMany({ where: { goodsIssue: where } }).catch(() => {});
    await prisma.goodsIssue.deleteMany({ where }).catch(() => {});
    await prisma.journalLine.deleteMany({ where: { journalEntry: where } }).catch(() => {});
    await prisma.journalEntry.deleteMany({ where }).catch(() => {});
    await prisma.costLayer.deleteMany({ where }).catch(() => {});
    await prisma.stockMovement.deleteMany({ where }).catch(() => {});
    await prisma.cycleCountLine.deleteMany({ where }).catch(() => {});
    await prisma.cycleCount.deleteMany({ where }).catch(() => {});
    await prisma.partyNote.deleteMany({ where }).catch(() => {});
    await prisma.periodCloseStep.deleteMany({ where }).catch(() => {});
    await prisma.periodClose.deleteMany({ where }).catch(() => {});
    await prisma.purchaseClassification.deleteMany({ where }).catch(() => {});
    await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } }).catch(() => {});
    await prisma.purchaseRequisition.deleteMany({ where }).catch(() => {});
    await prisma.capitalProject.deleteMany({ where }).catch(() => {});
    await prisma.financeSetting.deleteMany({ where }).catch(() => {});
    await prisma.auditLog.deleteMany({ where }).catch(() => {});
    await prisma.approvalAction.deleteMany({ where }).catch(() => {});
    await prisma.approvalRequest.deleteMany({ where }).catch(() => {});
    await prisma.approvalLevel.deleteMany({ where }).catch(() => {});
    await prisma.approvalRule.deleteMany({ where }).catch(() => {});
    await prisma.fiscalPeriod.deleteMany({ where }).catch(() => {});
    await prisma.product.deleteMany({ where }).catch(() => {});
    await prisma.account.deleteMany({ where }).catch(() => {});
    await prisma.customer.deleteMany({ where }).catch(() => {});
    await prisma.supplier.deleteMany({ where }).catch(() => {});
    await prisma.warehouse.deleteMany({ where }).catch(() => {});
    await prisma.user.deleteMany({ where }).catch(() => {});
    await prisma.role.deleteMany({ where }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  });

  test('approval flow rejects self-approval and records an audit entry', async () => {
    const created = await request(app).post('/api/finance/journal-entries').set(auth(makerToken)).send({
      entryNumber: `JE-CTRL-${Date.now()}`,
      date: today,
      description: 'Accrual',
      lines: [
        { accountId: cash.id, debit: 25, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 25 }
      ]
    });
    expect(created.status).toBe(201);
    expect(created.body.isPosted).toBe(false);
    expect(created.body.status).toBe('PENDING_APPROVAL');

    const pending = await request(app).get('/api/approvals').set(auth(makerToken));
    expect(pending.status).toBe(200);
    const requestId = pending.body.find((row) => row.documentId === created.body.id).id;

    const self = await request(app).post(`/api/approvals/${requestId}/decide`).set(auth(makerToken)).send({ action: 'APPROVE' });
    expect(self.status).toBe(400);
    expect(self.body.error).toMatch(/own document/i);

    const approved = await request(app).post(`/api/approvals/${requestId}/decide`).set(auth(approverToken)).send({ action: 'APPROVE' });
    expect(approved.status).toBe(200);
    const posted = await prisma.journalEntry.findUnique({ where: { id: created.body.id } });
    expect(posted.isPosted).toBe(true);

    const audit = await request(app).get('/api/audit').set(auth(makerToken)).query({ entity: 'JOURNAL', entityId: created.body.id, page: 1 });
    expect(audit.status).toBe(200);
    expect(audit.body.items.some((row) => row.action === 'APPROVE' || row.action === 'POST')).toBe(true);
  });

  test('draft purchase orders can be deleted and posted ones are cancelled with a reason', async () => {
    const draft = await request(app).post('/api/procurement/purchase-orders').set(auth(makerToken)).send({
      supplierId: supplier.id, date: today, status: 'DRAFT', items: [{ productId: product.id, quantity: 1, unitPrice: 10, total: 10 }]
    });
    expect(draft.status).toBe(201);
    const removed = await request(app).delete(`/api/procurement/purchase-orders/${draft.body.id}`).set(auth(makerToken));
    expect(removed.status).toBe(200);
    const deletion = await prisma.auditLog.findFirst({ where: { tenantId: tenant.id, entity: 'PO', entityId: draft.body.id, action: 'DELETE' } });
    expect(deletion).toBeTruthy();

    const live = await request(app).post('/api/procurement/purchase-orders').set(auth(makerToken)).send({
      supplierId: supplier.id, date: today, status: 'PENDING', items: [{ productId: product.id, quantity: 1, unitPrice: 10, total: 10 }]
    });
    const blocked = await request(app).delete(`/api/procurement/purchase-orders/${live.body.id}`).set(auth(makerToken));
    expect(blocked.status).toBe(400);
    const cancelled = await request(app).post(`/api/procurement/purchase-orders/${live.body.id}/cancel`).set(auth(makerToken)).send({ reason: 'Ordered in error' });
    expect(cancelled.status).toBe(200);
    const saved = await prisma.purchaseOrder.findUnique({ where: { id: live.body.id } });
    expect(saved.status).toBe('CANCELLED');
  });

  test('closed and soft-closed periods reject posting', async () => {
    await prisma.approvalRule.update({
      where: { tenantId_documentType: { tenantId: tenant.id, documentType: 'JOURNAL' } },
      data: { enabled: false }
    });
    await prisma.fiscalPeriod.create({ data: { tenantId: tenant.id, year: 2026, month: 4, status: 'CLOSED' } });
    const closed = await request(app).post('/api/finance/journal-entries').set(auth(makerToken)).send({
      entryNumber: `JE-CLOSED-${Date.now()}`,
      date: '2026-04-02',
      description: 'Closed period',
      lines: [
        { accountId: cash.id, debit: 5, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 5 }
      ]
    });
    expect(closed.status).toBe(400);
    expect(closed.body.error).toMatch(/closed/i);

    await prisma.fiscalPeriod.create({ data: { tenantId: tenant.id, year: 2026, month: 5, status: 'SOFT_CLOSED' } });
    const soft = await request(app).post('/api/finance/journal-entries').set(auth(makerToken)).send({
      entryNumber: `JE-SOFT-${Date.now()}`,
      date: '2026-05-02',
      description: 'Soft closed',
      lines: [
        { accountId: cash.id, debit: 5, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 5 }
      ]
    });
    expect(soft.status).toBe(400);
    expect(soft.body.error).toMatch(/soft-closed/i);

    await prisma.role.update({
      where: { id: maker.roleId },
      data: { permissions: { finance: ['read', 'write'], procurement: ['read', 'write'], sales: ['read', 'write'], warehouse: ['read', 'write'], products: ['read', 'write'], settings: ['read', 'write'], financeClose: true } }
    });
    const allowed = await request(app).post('/api/finance/journal-entries').set(auth(makerToken)).send({
      entryNumber: `JE-SOFT-OK-${Date.now()}`,
      date: '2026-05-03',
      description: 'Soft closed allowed',
      lines: [
        { accountId: cash.id, debit: 5, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 5 }
      ]
    });
    expect(allowed.status).toBe(201);
  });

  test('stock issues cannot exceed the warehouse quantity unless negative stock is allowed', async () => {
    const short = await request(app).post('/api/warehouse/issues').set(auth(makerToken)).send({
      date: today, status: 'ISSUED', warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 4, unitPrice: 10, total: 40 }]
    });
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/not enough stock/i);

    await request(app).put('/api/controls/stock').set(auth(makerToken)).send({ allowNegativeStock: true });
    const allowed = await request(app).post('/api/warehouse/issues').set(auth(makerToken)).send({
      date: today, status: 'ISSUED', warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 4, unitPrice: 10, total: 40 }]
    });
    expect(allowed.status).toBe(201);
    await request(app).put('/api/controls/stock').set(auth(makerToken)).send({ allowNegativeStock: false });
  });

  test('over-limit sales orders are blocked until credit release is enabled', async () => {
    const blocked = await request(app).post('/api/sales/orders').set(auth(makerToken)).send({
      customerId: customer.id, date: today, status: 'PENDING',
      items: [{ productId: product.id, quantity: 2, unitPrice: 40, total: 80 }]
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/credit limit/i);

    const finance = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Finance' } });
    await prisma.approvalRule.create({
      data: {
        tenantId: tenant.id,
        documentType: 'SALES_ORDER_CREDIT',
        enabled: true,
        allowSelfApprove: false,
        levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
      }
    });
    const held = await request(app).post('/api/sales/orders').set(auth(makerToken)).send({
      customerId: customer.id, date: today, status: 'PENDING',
      items: [{ productId: product.id, quantity: 2, unitPrice: 40, total: 80 }]
    });
    expect(held.status).toBe(201);
    expect(held.body.status).toBe('PENDING_APPROVAL');
  });

  test('the same supplier invoice number cannot be saved twice', async () => {
    const po = await request(app).post('/api/procurement/purchase-orders').set(auth(makerToken)).send({
      supplierId: supplier.id, date: today, status: 'PENDING',
      items: [{ productId: product.id, quantity: 2, unitPrice: 10, total: 20 }]
    });
    const grn = await request(app).post('/api/procurement/grn').set(auth(makerToken)).send({
      supplierId: supplier.id, poId: po.body.id, warehouseId: warehouse.id, date: today,
      items: [{ productId: product.id, quantityReceived: 2, quantityOrdered: 2, unitPrice: 10 }]
    });
    expect(grn.status).toBe(201);
    const first = await request(app).post('/api/procurement/supplier-invoices').set(auth(makerToken)).send({
      supplierId: supplier.id, poId: po.body.id, grnId: grn.body.id, date: today, supplierReference: 'INV-100',
      items: [{ productId: product.id, quantity: 2, unitPrice: 10 }]
    });
    expect(first.status).toBe(201);
    const duplicate = await request(app).post('/api/procurement/supplier-invoices').set(auth(makerToken)).send({
      supplierId: supplier.id, poId: po.body.id, grnId: grn.body.id, date: today, supplierReference: 'INV-100',
      items: [{ productId: product.id, quantity: 1, unitPrice: 10 }]
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toMatch(/already used/i);
  });

  test('item lists page on the server and export a workbook', async () => {
    await prisma.product.create({ data: { tenantId: tenant.id, code: 'B', name: 'Second' } });
    await prisma.product.create({ data: { tenantId: tenant.id, code: 'C', name: 'Third' } });
    const page = await request(app).get('/api/products').set(auth(makerToken)).query({ page: 1, pageSize: 2, sort: 'code', dir: 'asc' });
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.total).toBeGreaterThanOrEqual(3);
    const file = await request(app).get('/api/products').set(auth(makerToken)).query({ export: 'xlsx' }).responseType('blob');
    expect(file.status).toBe(200);
    const bytes = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body);
    expect(bytes.slice(0, 2).toString()).toBe('PK');
  });

  test('phase 2 notes, capex requisitions and cycle counts wait for approval, and the close checklist locks the period', async () => {
    const finance = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Finance' } });
    await prisma.role.update({
      where: { id: finance.id },
      data: { permissions: { finance: ['read', 'write'], procurement: ['read', 'write'], sales: ['read', 'write'], warehouse: ['read', 'write'], products: ['read', 'write'], financeClose: true } }
    });
    for (const documentType of ['PARTY_NOTE', 'CAPEX_PR', 'CYCLE_COUNT']) {
      await prisma.approvalRule.create({
        data: {
          tenantId: tenant.id,
          documentType,
          enabled: true,
          allowSelfApprove: false,
          levels: { create: [{ tenantId: tenant.id, sequence: 1, threshold: 0, approverRoleId: finance.id }] }
        }
      });
    }

    const note = await request(app).post('/api/phase2/notes').set(auth(makerToken)).send({
      partyType: 'CUSTOMER', partyId: customer.id, kind: 'CREDIT', date: today, reasonCode: 'RETURN', subtotal: 25
    });
    expect(note.status).toBe(201);
    expect(note.body.status).toBe('PENDING_APPROVAL');
    const held = await prisma.journalEntry.count({ where: { tenantId: tenant.id, referenceType: 'PARTY_NOTE', referenceId: note.body.id } });
    expect(held).toBe(0);
    const noteRequest = await prisma.approvalRequest.findFirst({ where: { documentId: note.body.id, status: 'PENDING' } });
    const noteApproved = await request(app).post(`/api/approvals/${noteRequest.id}/decide`).set(auth(approverToken)).send({ action: 'APPROVE' });
    expect(noteApproved.status).toBe(200);
    const postedNote = await prisma.partyNote.findUnique({ where: { id: note.body.id } });
    expect(postedNote.status).toBe('POSTED');
    const removed = await request(app).delete(`/api/phase2/notes/${note.body.id}`).set(auth(makerToken));
    expect(removed.status).not.toBe(200);
    const cancelled = await request(app).post(`/api/phase2/notes/${note.body.id}/cancel`).set(auth(makerToken)).send({ reason: 'Raised in error' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const project = await request(app).post('/api/phase2/projects').set(auth(makerToken)).send({
      code: 'CW-1', name: 'New press', budgetAmount: 100000
    });
    expect(project.status).toBe(201);
    const pr = await request(app).post('/api/procurement/purchase-requisitions').set(auth(makerToken)).send({
      date: today,
      spendClass: 'CAPEX',
      capitalProjectId: project.body.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 1000, total: 1000 }]
    });
    expect(pr.status).toBe(201);
    expect(pr.body.status).toBe('PENDING_APPROVAL');
    const prDelete = await request(app).delete(`/api/procurement/purchase-requisitions/${pr.body.id}`).set(auth(makerToken));
    expect(prDelete.status).toBe(400);
    const prCancel = await request(app).post(`/api/procurement/purchase-requisitions/${pr.body.id}/cancel`).set(auth(makerToken)).send({ reason: 'Project deferred' });
    expect(prCancel.status).toBe(200);

    const count = await request(app).post('/api/inventory/cycle-counts').set(auth(makerToken)).send({
      date: today, warehouseId: warehouse.id, kind: 'CYCLE',
      lines: [{ productId: product.id, countQty: 2, reason: 'Found stock' }]
    });
    expect(count.status).toBe(201);
    const early = await request(app).post(`/api/inventory/cycle-counts/${count.body.id}/post`).set(auth(makerToken)).send({});
    expect(early.status).toBe(200);
    expect(early.body.status).toBe('PENDING_APPROVAL');
    const countRequest = await prisma.approvalRequest.findFirst({ where: { documentId: count.body.id, documentType: 'CYCLE_COUNT', status: 'PENDING' } });
    const countApproved = await request(app).post(`/api/approvals/${countRequest.id}/decide`).set(auth(approverToken)).send({ action: 'APPROVE' });
    expect(countApproved.status).toBe(200);
    const postedCount = await prisma.cycleCount.findUnique({ where: { id: count.body.id } });
    expect(postedCount.status).toBe('POSTED');

    const opened = await request(app).post('/api/phase2/period-closes').set(auth(makerToken)).send({ year: 2026, month: 6 });
    expect(opened.status).toBe(201);
    for (const code of ['INVENTORY', 'PRODUCTION', 'AP', 'AR', 'CASH_BANK', 'FIXED_ASSETS', 'GL']) {
      const step = await request(app).post(`/api/phase2/period-closes/${opened.body.id}/steps/${code}`).set(auth(makerToken)).send({ status: 'DONE' });
      expect(step.status).toBe(200);
    }
    const soft = await prisma.fiscalPeriod.findUnique({ where: { tenantId_year_month: { tenantId: tenant.id, year: 2026, month: 6 } } });
    expect(soft.status).toBe('SOFT_CLOSED');
    const closed = await request(app).post(`/api/phase2/period-closes/${opened.body.id}/closing-entries`).set(auth(approverToken)).send({});
    expect(closed.status).toBe(200);
    const hard = await prisma.fiscalPeriod.findUnique({ where: { tenantId_year_month: { tenantId: tenant.id, year: 2026, month: 6 } } });
    expect(hard.status).toBe('CLOSED');
    const blocked = await request(app).post('/api/finance/journal-entries').set(auth(approverToken)).send({
      entryNumber: `JE-LOCK-${Date.now()}`,
      date: '2026-06-15',
      description: 'After close',
      lines: [
        { accountId: cash.id, debit: 1, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 1 }
      ]
    });
    expect(blocked.status).toBe(400);
  });
});
