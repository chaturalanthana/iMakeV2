const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

describe('procure-to-pay and order-to-cash', () => {
  let tenant;
  let token;
  let warehouse;
  let otherWarehouse;
  let supplier;
  let customer;
  let product;
  let finished;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const today = '2026-11-10';

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Trade Cycle', slug: `trade-${Date.now()}`, currency: 'LKR' }
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `trade-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id }
    });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    warehouse = await prisma.warehouse.create({
      data: { tenantId: tenant.id, code: 'MAIN', name: 'Main' }
    });
    otherWarehouse = await prisma.warehouse.create({
      data: { tenantId: tenant.id, code: 'TWO', name: 'Second' }
    });
    supplier = await prisma.supplier.create({
      data: { tenantId: tenant.id, code: 'SUP-1', name: 'Mill', taxGroup: 'VAT', creditPeriod: 30 }
    });
    customer = await prisma.customer.create({
      data: { tenantId: tenant.id, code: 'CUS-1', name: 'Buyer', taxGroup: 'VAT', creditLimit: 1000000, creditPeriod: 30 }
    });
    product = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'RM-1', name: 'Coil', costPrice: 10, sellingPrice: 40 }
    });
    finished = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'FG-1', name: 'Cabinet', costPrice: 10, sellingPrice: 40 }
    });
    const salesVat = await prisma.taxGroup.create({
      data: { tenantId: tenant.id, name: 'VAT', description: 'VAT 18%' }
    });
    await prisma.taxSlab.create({
      data: { tenantId: tenant.id, taxGroupId: salesVat.id, name: 'VAT', rate: 18, calculationOrder: 1 }
    });
    const purchaseVat = await prisma.purchaseTaxGroup.create({
      data: { tenantId: tenant.id, name: 'VAT', description: 'Input VAT 18%' }
    });
    await prisma.purchaseTaxSlab.create({
      data: { tenantId: tenant.id, taxGroupId: purchaseVat.id, name: 'VAT', rate: 18, calculationOrder: 1 }
    });
  });

  afterAll(async () => {
    const where = { tenantId: tenant.id };
    await prisma.costLayer.deleteMany({ where });
    await prisma.stockMovement.deleteMany({ where });
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
    await prisma.salesDeliveryItem.deleteMany({ where: { delivery: where } });
    await prisma.salesDelivery.deleteMany({ where });
    await prisma.salesOrderItem.deleteMany({ where: { order: where } });
    await prisma.salesOrder.deleteMany({ where });
    await prisma.salesQuotationItem.deleteMany({ where: { quotation: where } });
    await prisma.salesQuotation.deleteMany({ where });
    await prisma.gRNItem.deleteMany({ where: { grn: where } });
    await prisma.gRN.deleteMany({ where });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } });
    await prisma.purchaseOrder.deleteMany({ where });
    await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } });
    await prisma.purchaseRequisition.deleteMany({ where });
    await prisma.stockReceiptItem.deleteMany({ where: { stockReceipt: where } });
    await prisma.stockReceipt.deleteMany({ where });
    await prisma.stockTransferItem.deleteMany({ where: { stockTransfer: where } });
    await prisma.stockTransfer.deleteMany({ where });
    await prisma.stockAdjustmentItem.deleteMany({ where: { stockAdjustment: where } });
    await prisma.stockAdjustment.deleteMany({ where });
    await prisma.taxSlab.deleteMany({ where });
    await prisma.taxGroup.deleteMany({ where });
    await prisma.purchaseTaxSlab.deleteMany({ where });
    await prisma.purchaseTaxGroup.deleteMany({ where });
    await prisma.account.deleteMany({ where });
    await prisma.product.deleteMany({ where });
    await prisma.customer.deleteMany({ where });
    await prisma.supplier.deleteMany({ where });
    await prisma.warehouse.deleteMany({ where });
    await prisma.user.deleteMany({ where });
    await prisma.role.deleteMany({ where });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  test('purchase requisition to supplier payment keeps FIFO stock and a balanced trial balance', async () => {
    const pr = await request(app).post('/api/procurement/purchase-requisitions').set(auth()).send({
      supplierId: supplier.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantity: 10, unitPrice: 100, total: 1000 }]
    });
    expect(pr.status).toBe(201);

    const partial = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id,
      prId: pr.body.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantity: 4, unitPrice: 100, total: 400 }]
    });
    expect(partial.status).toBe(201);
    const prAfterPartial = await prisma.purchaseRequisition.findUnique({ where: { id: pr.body.id } });
    expect(prAfterPartial.status).toBe('PARTIALLY_ORDERED');

    const rest = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id,
      prId: pr.body.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantity: 6, unitPrice: 100, total: 600 }]
    });
    expect(rest.status).toBe(201);
    const prAfter = await prisma.purchaseRequisition.findUnique({ where: { id: pr.body.id } });
    expect(prAfter.status).toBe('CONVERTED');

    const tooMuch = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id,
      prId: pr.body.id,
      date: today,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, total: 100 }]
    });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.fields.quantity).toBeTruthy();

    const firstReceipt = await request(app).post('/api/procurement/grn').set(auth()).send({
      supplierId: supplier.id,
      poId: partial.body.id,
      warehouseId: warehouse.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantityReceived: 4, quantityOrdered: 4 }]
    });
    expect(firstReceipt.status).toBe(201);
    const poPartial = await prisma.purchaseOrder.findUnique({ where: { id: partial.body.id } });
    expect(poPartial.status).toBe('RECEIVED');

    const over = await request(app).post('/api/procurement/grn').set(auth()).send({
      supplierId: supplier.id,
      poId: partial.body.id,
      warehouseId: warehouse.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantityReceived: 1, quantityOrdered: 4 }]
    });
    expect(over.status).toBe(400);

    const secondReceipt = await request(app).post('/api/procurement/grn').set(auth()).send({
      supplierId: supplier.id,
      poId: rest.body.id,
      warehouseId: warehouse.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantityReceived: 6, quantityOrdered: 6 }]
    });
    expect(secondReceipt.status).toBe(201);

    const layers = await prisma.costLayer.findMany({
      where: { tenantId: tenant.id, productId: product.id },
      orderBy: { receivedAt: 'asc' }
    });
    expect(layers).toHaveLength(2);
    expect(Number(layers[0].quantityRemaining)).toBeCloseTo(4);
    expect(Number(layers[0].unitCost)).toBeCloseTo(200);
    expect(Number(layers[1].unitCost)).toBeCloseTo(200);

    const badPrice = await request(app).post('/api/procurement/supplier-invoices').set(auth()).send({
      supplierId: supplier.id,
      poId: partial.body.id,
      grnId: firstReceipt.body.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantity: 4, unitPrice: 180 }]
    });
    expect(badPrice.status).toBe(400);
    expect(badPrice.body.fields.unitPrice).toBeTruthy();

    const firstBill = await request(app).post('/api/procurement/supplier-invoices').set(auth()).send({
      supplierId: supplier.id,
      poId: partial.body.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantity: 4, unitPrice: 100 }]
    });
    expect(firstBill.status).toBe(201);
    expect(firstBill.body.matchStatus).toBe('MATCHED');
    expect(Number(firstBill.body.total)).toBeCloseTo(472);

    const secondBill = await request(app).post('/api/procurement/supplier-invoices').set(auth()).send({
      supplierId: supplier.id,
      poId: rest.body.id,
      date: today,
      exchangeRate: 2,
      items: [{ productId: product.id, quantity: 6, unitPrice: 100 }]
    });
    expect(secondBill.status).toBe(201);
    expect(Number(secondBill.body.subtotal)).toBeCloseTo(600);
    expect(Number(secondBill.body.taxAmount)).toBeCloseTo(108);
    expect(Number(secondBill.body.total)).toBeCloseTo(708);

    const payment = await request(app).post('/api/finance/payment-vouchers').set(auth()).send({
      supplierId: supplier.id,
      date: today,
      method: 'BANK_TRANSFER',
      amount: 1180,
      allocations: [
        { supplierInvoiceId: firstBill.body.id, amount: 472 },
        { supplierInvoiceId: secondBill.body.id, amount: 708 }
      ]
    });
    expect(payment.status).toBe(201);
    const paid = await prisma.supplierInvoice.findUnique({ where: { id: secondBill.body.id } });
    expect(paid.status).toBe('PAID');
    expect(Number(paid.amountPaid)).toBeCloseTo(708);

    const aging = await request(app).get('/api/procurement/supplier-aging').set(auth());
    expect(aging.status).toBe(200);
    expect(aging.body.find((row) => row.id === supplier.id)).toBeUndefined();

    const books = await request(app).get('/api/finance/trial-balance').set(auth());
    expect(books.status).toBe(200);
    expect(books.body.balanced).toBe(true);
    expect(books.body.debit).toBeCloseTo(books.body.credit);
    const inventory = books.body.accounts.find((row) => row.code === '1300');
    const grni = books.body.accounts.find((row) => row.code === '1400') || { debit: 0, credit: 0 };
    expect(inventory.debit - inventory.credit).toBeCloseTo(2000);
    expect(grni.debit - grni.credit).toBeCloseTo(0);
  });

  test('quotation to customer receipt issues the oldest cost layers and stays in balance', async () => {
    const opening = await request(app).post('/api/warehouse/receipts').set(auth()).send({
      warehouseId: warehouse.id,
      date: today,
      status: 'COMPLETED',
      reason: 'Opening stock',
      items: [
        { productId: finished.id, quantity: 5, unitPrice: 10, total: 50 },
        { productId: finished.id, quantity: 5, unitPrice: 30, total: 150 }
      ]
    });
    expect(opening.status).toBe(201);

    const quote = await request(app).post('/api/sales/quotations').set(auth()).send({
      customerId: customer.id,
      date: today,
      exchangeRate: 1,
      items: [{ productId: finished.id, quantity: 6, unitPrice: 40, total: 240 }]
    });
    expect(quote.status).toBe(201);

    const order = await request(app).post('/api/sales/orders').set(auth()).send({
      customerId: customer.id,
      quotationId: quote.body.id,
      date: today,
      exchangeRate: 1,
      items: [{ productId: finished.id, quantity: 6, unitPrice: 40, total: 240 }]
    });
    expect(order.status).toBe(201);
    expect(order.body.creditWarning).toBeFalsy();
    const quotation = await prisma.salesQuotation.findUnique({ where: { id: quote.body.id } });
    expect(quotation.status).toBe('ACCEPTED');

    const delivery = await request(app).post('/api/sales/deliveries').set(auth()).send({
      customerId: customer.id,
      orderId: order.body.id,
      warehouseId: warehouse.id,
      date: today,
      status: 'DELIVERED',
      items: [{ productId: finished.id, quantity: 6 }]
    });
    expect(delivery.status).toBe(201);
    const delivered = await prisma.salesDeliveryItem.findFirst({ where: { deliveryId: delivery.body.id } });
    expect(Number(delivered.costValue)).toBeCloseTo(80);
    expect(Number(delivered.unitCost)).toBeCloseTo(80 / 6);

    const onHand = await prisma.costLayer.findMany({
      where: { tenantId: tenant.id, productId: finished.id, quantityRemaining: { gt: 0 } }
    });
    const qty = onHand.reduce((sum, layer) => sum + Number(layer.quantityRemaining), 0);
    const value = onHand.reduce((sum, layer) => sum + Number(layer.quantityRemaining) * Number(layer.unitCost), 0);
    expect(qty).toBeCloseTo(4);
    expect(value).toBeCloseTo(120);

    const invoice = await request(app).post('/api/sales/invoices').set(auth()).send({
      customerId: customer.id,
      orderId: order.body.id,
      deliveryId: delivery.body.id,
      date: today,
      status: 'UNPAID',
      exchangeRate: 1,
      items: [{ productId: finished.id, quantity: 6, unitPrice: 40, total: 240 }]
    });
    expect(invoice.status).toBe(201);
    expect(Number(invoice.body.subtotal)).toBeCloseTo(240);
    expect(Number(invoice.body.taxAmount)).toBeCloseTo(43.2);
    expect(Number(invoice.body.total)).toBeCloseTo(283.2);
    expect(invoice.body.creditWarning).toBeFalsy();

    const receipt = await request(app).post('/api/finance/payment-receipts').set(auth()).send({
      customerId: customer.id,
      date: today,
      method: 'CASH',
      amount: 283.2,
      allocations: [{ invoiceId: invoice.body.id, amount: 283.2 }]
    });
    expect(receipt.status).toBe(201);
    const settled = await prisma.salesInvoice.findUnique({ where: { id: invoice.body.id } });
    expect(settled.status).toBe('PAID');

    const customerAging = await request(app).get('/api/sales/customer-aging').set(auth());
    expect(customerAging.body.find((row) => row.id === customer.id)).toBeUndefined();
    const statement = await request(app).get(`/api/sales/customer-statement/${customer.id}`).set(auth());
    expect(statement.status).toBe(200);
    expect(statement.body.balance).toBeCloseTo(0);

    const moved = await request(app).post('/api/warehouse/transfers').set(auth()).send({
      fromWarehouseId: warehouse.id,
      toWarehouseId: otherWarehouse.id,
      date: today,
      status: 'COMPLETED',
      items: [{ productId: finished.id, quantity: 2 }]
    });
    expect(moved.status).toBe(201);
    const destination = await prisma.costLayer.findMany({
      where: { tenantId: tenant.id, productId: finished.id, warehouseId: otherWarehouse.id, quantityRemaining: { gt: 0 } }
    });
    expect(destination).toHaveLength(1);
    expect(Number(destination[0].unitCost)).toBeCloseTo(30);
    expect(Number(destination[0].quantityRemaining)).toBeCloseTo(2);

    const books = await request(app).get('/api/finance/trial-balance').set(auth());
    expect(books.body.balanced).toBe(true);
    expect(books.body.debit).toBeCloseTo(books.body.credit);
    const cogs = books.body.accounts.find((row) => row.code === '5000');
    expect(cogs.debit - cogs.credit).toBeCloseTo(80);
  });
});
