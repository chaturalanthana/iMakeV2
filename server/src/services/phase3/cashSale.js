const { DocumentError } = require('../errors');
const { num, money, dec, rateOf } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { postIssueDocument, finalizeSalesInvoice, allocateCustomerReceipt } = require('../documentPosting');
const { assertPeriodOpen, assertStockCovered } = require('./bridges');
const { notify } = require('./notify');
const { CASH_KINDS } = require('./defaults');

function isCashKind(value) {
  return CASH_KINDS.includes(String(value || '').toUpperCase());
}

async function postCashSale(db, input) {
  const saleKind = String(input.saleKind || '').toUpperCase();
  if (!isCashKind(saleKind)) {
    throw new DocumentError('Choose van sales or factory cash sales.', { saleKind: 'Choose van sales or factory cash sales.' });
  }
  if (input.deliveryId) {
    throw new DocumentError('A cash sale is not linked to a delivery note.', { deliveryId: 'A cash sale is not linked to a delivery note.' });
  }
  if (!input.warehouseId) {
    throw new DocumentError('Warehouse is required.', { warehouseId: 'Choose the van or factory location.' });
  }
  if (!input.customerId) throw new DocumentError('Customer is required.', { customerId: 'Customer is required.' });
  const items = (input.items || []).filter((item) => item?.productId);
  if (!items.length) throw new DocumentError('Add at least one product.', { items: 'Add at least one product.' });
  const warehouse = await db.warehouse.findFirst({ where: { id: input.warehouseId, tenantId: input.tenantId } });
  if (!warehouse) throw new DocumentError('Warehouse is required.', { warehouseId: 'Choose the van or factory location.' });
  const customer = await db.customer.findFirst({ where: { id: input.customerId, tenantId: input.tenantId } });
  if (!customer) throw new DocumentError('Customer is required.', { customerId: 'Customer is required.' });

  const run = async (tx) => {
    await assertPeriodOpen(tx, { tenantId: input.tenantId, date: input.date, userId: input.createdBy });
    const prepared = items.map((item) => {
      const quantity = money(item.quantity);
      const unitPrice = money(item.unitPrice);
      if (!(quantity > 0)) throw new DocumentError('Quantity must be greater than zero.', { quantity: 'Quantity must be greater than zero.' });
      if (unitPrice < 0) throw new DocumentError('Price cannot be negative.', { unitPrice: 'Price cannot be negative.' });
      return { productId: item.productId, quantity, unitPrice, total: money(quantity * unitPrice) };
    });
    const number = await generateDocumentNumber(input.tenantId, 'salesInvoice', 'INV', 'invoiceNumber', tx);
    const created = await tx.salesInvoice.create({
      data: {
        tenantId: input.tenantId,
        customerId: customer.id,
        invoiceNumber: number,
        date: new Date(input.date),
        status: 'UNPAID',
        total: dec(prepared.reduce((sum, item) => sum + item.total, 0)),
        subtotal: dec(prepared.reduce((sum, item) => sum + item.total, 0)),
        currencyId: input.currencyId || null,
        exchangeRate: rateOf(input.exchangeRate),
        channel: saleKind === 'VAN_CASH' ? 'VAN_SALES' : 'FACTORY_CASH',
        saleKind,
        warehouseId: warehouse.id,
        stockPosted: true,
        externalRef: input.externalRef || null,
        createdBy: input.createdBy || null,
        items: { create: prepared.map((item) => ({ ...item, quantity: dec(item.quantity), unitPrice: dec(item.unitPrice), total: dec(item.total) })) }
      }
    });
    const invoice = await finalizeSalesInvoice(tx, {
      tenantId: input.tenantId,
      invoiceId: created.id,
      createdBy: input.createdBy
    });
    const savedItems = await tx.salesInvoiceItem.findMany({ where: { invoiceId: invoice.id } });
    const posted = await postIssueDocument(tx, {
      tenantId: input.tenantId,
      warehouseId: warehouse.id,
      items: savedItems,
      referenceType: 'SALES_INVOICE',
      referenceId: invoice.id,
      date: input.date,
      createdBy: input.createdBy,
      description: `Cash sale ${invoice.invoiceNumber}`,
      quantitySign: -1
    });
    assertStockCovered(posted);
    const receiptNumber = await generateDocumentNumber(input.tenantId, 'paymentReceipt', 'REC', 'receiptNumber', tx);
    const receipt = await tx.paymentReceipt.create({
      data: {
        tenantId: input.tenantId,
        customerId: customer.id,
        invoiceId: invoice.id,
        receiptNumber,
        amount: dec(invoice.total),
        date: new Date(input.date),
        method: 'CASH',
        reference: input.externalRef || saleKind,
        exchangeRate: rateOf(input.exchangeRate),
        createdBy: input.createdBy || null
      }
    });
    await allocateCustomerReceipt(tx, {
      tenantId: input.tenantId,
      receipt,
      allocations: [{ invoiceId: invoice.id, amount: num(invoice.total) }],
      createdBy: input.createdBy
    });
    await notify(tx, {
      tenantId: input.tenantId,
      userId: input.createdBy,
      kind: 'CASH_SALE',
      title: `Cash sale ${invoice.invoiceNumber}`,
      body: `${saleKind === 'VAN_CASH' ? 'Van' : 'Factory'} sale posted stock, revenue and cash.`,
      entityType: 'SALES_INVOICE',
      entityId: invoice.id
    });
    return tx.salesInvoice.findFirst({
      where: { id: invoice.id },
      include: { items: true, customer: true, currency: true }
    });
  };

  if (typeof db.$transaction === 'function') return db.$transaction(run);
  return run(db);
}

module.exports = { isCashKind, postCashSale };
