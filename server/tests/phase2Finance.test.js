const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { trialBalance } = require('../src/services/glService');
const { catalog } = require('../src/services/phase2/reports');

function expectStatus(res, status) {
  if (res.status !== status) {
    throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

describe('phase 2 procurement, landed cost and finance', () => {
  let tenant;
  let token;
  let warehouse;
  let supplier;
  let customer;
  let material;
  let machine;
  let expense;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const day = '2026-11-10';

  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: 'Phase 2', slug: `p2-${Date.now()}`, currency: 'LKR' } });
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true } });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `p2-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id }
    });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '2h' });
    warehouse = await prisma.warehouse.create({ data: { tenantId: tenant.id, code: 'MAIN', name: 'Main' } });
    supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, code: 'SUP', name: 'Mill', currency: 'USD', leadTime: 7 } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS', name: 'Buyer', creditPeriod: 30 } });
    material = await prisma.product.create({ data: { tenantId: tenant.id, code: 'TEAK', name: 'Teak', costPrice: 10, sellingPrice: 40 } });
    machine = await prisma.product.create({ data: { tenantId: tenant.id, code: 'PRESS', name: 'Press', costPrice: 1, sellingPrice: 1 } });
    const account = await request(app).post('/api/finance/accounts').set(auth()).send({ code: '6100', name: 'Workshop expense', type: 'EXPENSE' });
    expectStatus(account, 201);
    expense = account.body;
    await prisma.currency.create({ data: { tenantId: tenant.id, code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 300, isBase: false } });
    await prisma.currency.create({ data: { tenantId: tenant.id, code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', exchangeRate: 1, isBase: true } });
  });

  afterAll(async () => {
    if (!tenant) return;
    const where = { tenantId: tenant.id };
    await prisma.depreciationLine.deleteMany({ where });
    await prisma.assetEvent.deleteMany({ where });
    await prisma.depreciationRun.deleteMany({ where });
    await prisma.fixedAsset.deleteMany({ where });
    await prisma.fixedAssetClass.deleteMany({ where });
    await prisma.landedCostAllocation.deleteMany({ where });
    await prisma.landedCostCharge.deleteMany({ where });
    await prisma.landedCost.deleteMany({ where });
    await prisma.iouSettlement.deleteMany({ where });
    await prisma.iouAdvance.deleteMany({ where });
    await prisma.pettyCashFund.deleteMany({ where });
    await prisma.cheque.deleteMany({ where });
    await prisma.collectionActivity.deleteMany({ where });
    await prisma.collectionCase.deleteMany({ where });
    await prisma.partyNote.deleteMany({ where });
    await prisma.quotationSelection.deleteMany({ where });
    await prisma.supplierQuotationLine.deleteMany({ where });
    await prisma.supplierQuotation.deleteMany({ where });
    await prisma.rfqInvitation.deleteMany({ where });
    await prisma.rfqLine.deleteMany({ where });
    await prisma.requestForQuotation.deleteMany({ where });
    await prisma.priceException.deleteMany({ where });
    await prisma.contractPrice.deleteMany({ where });
    await prisma.approvedSupplierItem.deleteMany({ where });
    await prisma.tradeProfile.deleteMany({ where });
    await prisma.purchaseClassification.deleteMany({ where });
    await prisma.documentDimension.deleteMany({ where });
    await prisma.itemMeasure.deleteMany({ where });
    await prisma.allocationRuleLine.deleteMany({ where });
    await prisma.allocationRule.deleteMany({ where });
    await prisma.budget.deleteMany({ where });
    await prisma.capitalProject.deleteMany({ where });
    await prisma.orgCenter.deleteMany({ where });
    await prisma.financeSetting.deleteMany({ where });
    await prisma.periodCloseStep.deleteMany({ where });
    await prisma.periodClose.deleteMany({ where });
    await prisma.recurringJournal.deleteMany({ where });
    await prisma.costLayer.deleteMany({ where });
    await prisma.stockMovement.deleteMany({ where });
    await prisma.stockBatch.deleteMany({ where });
    await prisma.journalLine.deleteMany({ where: { journalEntry: where } });
    await prisma.journalEntry.deleteMany({ where });
    await prisma.glAccountMap.deleteMany({ where });
    await prisma.supplierPaymentAllocation.deleteMany({ where });
    await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoice: where } });
    await prisma.supplierInvoice.deleteMany({ where });
    await prisma.paymentReceiptLine.deleteMany({ where: { receipt: where } });
    await prisma.paymentReceipt.deleteMany({ where });
    await prisma.paymentVoucherLine.deleteMany({ where: { voucher: where } });
    await prisma.paymentVoucher.deleteMany({ where });
    await prisma.salesInvoiceItem.deleteMany({ where: { invoice: where } });
    await prisma.salesInvoice.deleteMany({ where });
    await prisma.gRNItem.deleteMany({ where: { grn: where } });
    await prisma.gRN.deleteMany({ where });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } });
    await prisma.purchaseOrder.deleteMany({ where });
    await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } });
    await prisma.purchaseRequisition.deleteMany({ where });
    await prisma.goodsIssueItem.deleteMany({ where: { goodsIssue: where } });
    await prisma.goodsIssue.deleteMany({ where });
    await prisma.account.deleteMany({ where });
    await prisma.product.deleteMany({ where });
    await prisma.customer.deleteMany({ where });
    await prisma.supplier.deleteMany({ where });
    await prisma.warehouse.deleteMany({ where });
    await prisma.currency.deleteMany({ where });
    await prisma.user.deleteMany({ where });
    await prisma.role.deleteMany({ where });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  async function balanced() {
    const tb = await trialBalance(prisma, tenant.id);
    expect(tb.balanced).toBe(true);
  }

  test('contract price tolerance and RFQ selection', async () => {
    const contract = await request(app).post('/api/phase2/contracts').set(auth()).send({
      supplierId: supplier.id, productId: material.id, unitPrice: 100, validFrom: '2026-01-01', currencyCode: 'LKR'
    });
    expectStatus(contract, 201);

    const outside = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id, date: day, items: [{ productId: material.id, quantity: 2, unitPrice: 110, total: 220 }]
    });
    expect(outside.status).toBe(400);
    expect(outside.body.fields.unitPrice).toBeTruthy();

    const allowed = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id, date: day, acknowledgeVariance: true, varianceReason: 'Spot buy approved',
      items: [{ productId: material.id, quantity: 2, unitPrice: 110, total: 220 }]
    });
    expectStatus(allowed, 201);

    const rfq = await request(app).post('/api/phase2/rfqs').set(auth()).send({
      date: day,
      supplierIds: [supplier.id],
      lines: [{ productId: material.id, quantity: 5 }]
    });
    expectStatus(rfq, 201);
    const quote = await request(app).post(`/api/phase2/rfqs/${rfq.body.id}/quotes`).set(auth()).send({
      supplierId: supplier.id, date: day, leadTimeDays: 4, currencyCode: 'LKR', exchangeRate: 1,
      lines: [{ productId: material.id, quantity: 5, unitPrice: 90 }]
    });
    expectStatus(quote, 201);
    const selected = await request(app).post(`/api/phase2/rfqs/${rfq.body.id}/select`).set(auth()).send({
      quotationId: quote.body.id, reason: 'Lowest landed price and acceptable lead time'
    });
    expectStatus(selected, 200);
    const board = await request(app).get(`/api/phase2/rfqs/${rfq.body.id}`).set(auth());
    expectStatus(board, 200);
    expect(board.body.quotes[0].rank).toBe(1);
    expect(board.body.rfq.status).toBe('CLOSED');
  });

  test('import landed cost updates the remaining FIFO layer and stays balanced', async () => {
    const usd = await prisma.currency.findFirst({ where: { tenantId: tenant.id, code: 'USD' } });
    const po = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id, date: day, tradeType: 'IMPORT', currencyId: usd.id, exchangeRate: 300, shipmentRef: 'BL-1',
      items: [{ productId: material.id, quantity: 10, unitPrice: 100, total: 1000 }]
    });
    expectStatus(po, 201);
    expect(po.body.poNumber.startsWith('IPO/')).toBe(true);

    const grn = await request(app).post('/api/procurement/grn').set(auth()).send({
      supplierId: supplier.id, poId: po.body.id, warehouseId: warehouse.id, date: day, exchangeRate: 300,
      items: [{ productId: material.id, quantityReceived: 10, quantityOrdered: 10, unitPrice: 100, lotNumber: 'TEAK-IMP-1' }]
    });
    expectStatus(grn, 201);
    expect(grn.body.grnNumber.startsWith('IGRN/')).toBe(true);

    const issue = await request(app).post('/api/warehouse/costing/issue').set(auth()).send({
      productId: material.id, warehouseId: warehouse.id, quantity: 4, referenceType: 'TEST', referenceId: grn.body.id
    });
    expectStatus(issue, 201);

    const landed = await request(app).post('/api/phase2/landed-costs').set(auth()).send({
      grnId: grn.body.id, date: day, basis: 'VALUE',
      charges: [{ kind: 'FREIGHT', amount: 20, exchangeRate: 310, reference: 'BL-1' }]
    });
    expectStatus(landed, 201);
    const layer = await prisma.costLayer.findFirst({ where: { tenantId: tenant.id, sourceId: grn.body.id, quantityRemaining: { gt: 0 } } });
    expect(layer.batchId).toBeTruthy();
    expect(Number(layer.quantityRemaining)).toBeCloseTo(6, 4);
    expect(Number(layer.unitCost)).toBeCloseTo(30600, 2);
    expect(landed.body.allocations[0].batchId).toBe(layer.batchId);
    await balanced();
  });

  test('capex budget, CWIP, capitalization and both depreciation books', async () => {
    const project = await request(app).post('/api/phase2/projects').set(auth()).send({
      code: 'LINE-1', name: 'Packing line', budgetAmount: 500000
    });
    expectStatus(project, 201);
    const blocked = await request(app).post('/api/procurement/purchase-requisitions').set(auth()).send({
      date: day, spendClass: 'CAPEX', capitalProjectId: project.body.id,
      items: [{ productId: machine.id, quantity: 1, unitPrice: 600000, total: 600000 }]
    });
    expect(blocked.status).toBe(400);

    const pr = await request(app).post('/api/procurement/purchase-requisitions').set(auth()).send({
      date: '2026-11-01', spendClass: 'CAPEX', capitalProjectId: project.body.id,
      items: [{ productId: machine.id, quantity: 1, unitPrice: 200000, total: 200000 }]
    });
    expectStatus(pr, 201);
    const po = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id, prId: pr.body.id, date: '2026-11-01',
      items: [{ productId: machine.id, quantity: 1, unitPrice: 200000, total: 200000 }]
    });
    expectStatus(po, 201);
    const grn = await request(app).post('/api/procurement/grn').set(auth()).send({
      supplierId: supplier.id, poId: po.body.id, warehouseId: warehouse.id, date: '2026-11-01',
      items: [{ productId: machine.id, quantityReceived: 1, quantityOrdered: 1, unitPrice: 200000 }]
    });
    expectStatus(grn, 201);
    const asset = await prisma.fixedAsset.findFirst({ where: { tenantId: tenant.id, sourceGrnId: grn.body.id } });
    expect(asset.status).toBe('CWIP');
    expect(Number(asset.cwipBalance)).toBeCloseTo(200000, 2);
    const stock = await prisma.costLayer.count({ where: { tenantId: tenant.id, productId: machine.id } });
    expect(stock).toBe(0);

    const bill = await request(app).post('/api/procurement/supplier-invoices').set(auth()).send({
      supplierId: supplier.id, poId: po.body.id, grnId: grn.body.id, date: '2026-11-02',
      items: [{ productId: machine.id, quantity: 1, unitPrice: 200000 }]
    });
    expectStatus(bill, 201);
    const still = await prisma.fixedAsset.findFirst({ where: { id: asset.id } });
    expect(Number(still.cwipBalance)).toBeCloseTo(200000, 2);

    const assetClass = await request(app).post('/api/phase2/asset-classes').set(auth()).send({
      code: 'PLANT', name: 'Plant', accountingMethod: 'SL', accountingLifeMonths: 12, taxMethod: 'RB', taxRate: 20
    });
    expectStatus(assetClass, 201);
    const capitalized = await request(app).post(`/api/phase2/assets/${asset.id}/capitalize`).set(auth()).send({
      classId: assetClass.body.id, date: '2026-11-01', name: 'Packing press'
    });
    expectStatus(capitalized, 200);
    expect(capitalized.body.status).toBe('ACTIVE');

    const run = await request(app).post('/api/phase2/depreciation-runs').set(auth()).send({ year: 2026, month: 11 });
    expectStatus(run, 201);
    const accounting = run.body.lines.find((line) => line.book === 'ACCOUNTING');
    const tax = run.body.lines.find((line) => line.book === 'TAX');
    expect(Number(accounting.amount)).toBeCloseTo(200000 / 12, 2);
    expect(Number(tax.amount)).toBeGreaterThan(0);
    expect(Number(accounting.days)).toBe(30);
    await balanced();
  });

  test('customer credit note, PDC cheque and IOU settlement keep the ledger balanced', async () => {
    const invoice = await request(app).post('/api/sales/invoices').set(auth()).send({
      customerId: customer.id, date: day, items: [{ productId: material.id, quantity: 1, unitPrice: 1000, total: 1000 }]
    });
    expectStatus(invoice, 201);
    const note = await request(app).post('/api/phase2/notes').set(auth()).send({
      partyType: 'CUSTOMER', partyId: customer.id, kind: 'CREDIT', date: day,
      invoiceId: invoice.body.id, reasonCode: 'RETURN', subtotal: 200, taxAmount: 0
    });
    expectStatus(note, 201);

    const cheque = await request(app).post('/api/phase2/cheques').set(auth()).send({
      direction: 'IN', chequeNumber: '10021', chequeDate: '2026-12-01', payee: 'Ceylon Woodworks',
      partyId: customer.id, invoiceId: invoice.body.id, amount: 100, isPdc: true
    });
    expectStatus(cheque, 201);
    expect(cheque.body.status).toBe('UNREALISED');
    const deposited = await request(app).post(`/api/phase2/cheques/${cheque.body.id}/deposit`).set(auth()).send({});
    expectStatus(deposited, 200);
    const realised = await request(app).post(`/api/phase2/cheques/${cheque.body.id}/realise`).set(auth()).send({ date: '2026-12-05' });
    expectStatus(realised, 200);
    const bounced = await request(app).post(`/api/phase2/cheques/${cheque.body.id}/bounce`).set(auth()).send({ date: '2026-12-06' });
    expectStatus(bounced, 200);
    expect(bounced.body.status).toBe('BOUNCED');

    const fund = await request(app).post('/api/phase2/petty-cash').set(auth()).send({ name: 'Stores tin', amount: 5000, date: day });
    expectStatus(fund, 201);
    const iou = await request(app).post('/api/phase2/ious').set(auth()).send({
      date: day, employeeName: 'Kumari Silva', department: 'Assembly', amount: 1000, fundId: fund.body.id
    });
    expectStatus(iou, 201);
    const spent = await request(app).post(`/api/phase2/ious/${iou.body.id}/settle`).set(auth()).send({
      date: day, amount: 600, kind: 'EXPENSE', expenseAccountId: expense.id, description: 'Tea and fuel'
    });
    expectStatus(spent, 200);
    const returned = await request(app).post(`/api/phase2/ious/${iou.body.id}/settle`).set(auth()).send({
      date: day, amount: 400, kind: 'RETURN'
    });
    expectStatus(returned, 200);
    expect(returned.body.status).toBe('CLOSED');
    await balanced();
  });

  test('period close follows the checklist order and posts a balanced closing entry', async () => {
    const opened = await request(app).post('/api/phase2/period-closes').set(auth()).send({ year: 2026, month: 10 });
    expectStatus(opened, 201);
    const early = await request(app).post(`/api/phase2/period-closes/${opened.body.id}/steps/GL`).set(auth()).send({ status: 'DONE' });
    expect(early.status).toBe(400);
    for (const code of ['INVENTORY', 'PRODUCTION', 'AP', 'AR', 'CASH_BANK', 'FIXED_ASSETS', 'GL']) {
      const step = await request(app).post(`/api/phase2/period-closes/${opened.body.id}/steps/${code}`).set(auth()).send({ status: 'DONE' });
      expectStatus(step, 200);
    }
    const closed = await request(app).post(`/api/phase2/period-closes/${opened.body.id}/closing-entries`).set(auth()).send({});
    expectStatus(closed, 200);
    expect(closed.body.status).toBe('HARD');
    await balanced();
  });

  test('every finance catalogue report filters and exports a flat workbook', async () => {
    const list = await request(app).get('/api/phase2/reports').set(auth());
    expectStatus(list, 200);
    expect(list.body.map((row) => row.key).sort()).toEqual(catalog().map((row) => row.key).sort());
    for (const row of catalog()) {
      const built = await request(app).get(`/api/phase2/reports/${row.key}`).set(auth()).query({ from: '2026-01-01', to: '2026-12-31', asOf: '2026-11-30' });
      expectStatus(built, 200);
      expect(Array.isArray(built.body.columns)).toBe(true);
      expect(built.body.columns.length).toBeGreaterThan(0);
    }
    const file = await request(app).get('/api/phase2/reports/trial-balance').set(auth()).query({ format: 'xlsx' }).buffer(true).parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('spreadsheet');
    expect(file.body.slice(0, 2).toString()).toBe('PK');
    await balanced();
  });
});
