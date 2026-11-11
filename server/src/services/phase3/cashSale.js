const { DocumentError } = require('../errors');
const { num, money, dec, rateOf } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { postIssueDocument, finalizeSalesInvoice, allocateCustomerReceipt, cancelStockAndJournal } = require('../documentPosting');
const { reverseJournal } = require('../glService');
const { assertPeriodOpen, assertStockCovered, submitApproval } = require('./bridges');
const { writeAudit } = require('../auditService');
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
    const approval = await submitApproval(tx, {
      tenantId: input.tenantId,
      documentType: 'CASH_SALE',
      documentId: created.id,
      documentNumber: number,
      amount: num(created.total),
      userId: input.createdBy
    });
    if (approval?.status === 'PENDING') {
      const held = await tx.salesInvoice.update({
        where: { id: created.id },
        data: { status: 'PENDING_APPROVAL', stockPosted: false }
      });
      await writeAudit(tx, {
        tenantId: input.tenantId,
        userId: input.createdBy,
        action: 'STATUS',
        entity: 'CASH_SALE',
        entityId: created.id,
        after: { status: 'PENDING_APPROVAL', invoiceNumber: number }
      });
      return held;
    }
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
      referenceType: 'CASH_SALE',
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
    await writeAudit(tx, {
      tenantId: input.tenantId,
      userId: input.createdBy,
      action: 'POST',
      entity: 'CASH_SALE',
      entityId: invoice.id,
      after: { status: 'PAID', invoiceNumber: invoice.invoiceNumber, saleKind, warehouseId: warehouse.id }
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

async function cancelCashSale(db, input) {
  if (!input.reason || String(input.reason).trim().length < 2) {
    throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  }
  const invoice = await db.salesInvoice.findFirst({ where: { id: input.invoiceId, tenantId: input.tenantId } });
  if (!invoice || !isCashKind(invoice.saleKind)) {
    throw new DocumentError('Cash sale not found.', { invoiceId: 'Cash sale not found.' });
  }
  if (invoice.status === 'CANCELLED') throw new DocumentError('This sale is already cancelled.', { status: 'This sale is already cancelled.' });
  const run = async (tx) => {
    await assertPeriodOpen(tx, { tenantId: input.tenantId, date: new Date(), userId: input.userId });
    if (invoice.stockPosted) {
      await cancelStockAndJournal(tx, {
        tenantId: input.tenantId,
        referenceType: 'CASH_SALE',
        referenceId: invoice.id,
        date: new Date(),
        createdBy: input.userId,
        description: input.reason
      });
    }
    await reverseJournal(tx, {
      tenantId: input.tenantId,
      referenceType: 'SALES_INVOICE',
      referenceId: invoice.id,
      date: new Date(),
      createdBy: input.userId,
      description: input.reason
    });
    const receipt = await tx.paymentReceipt.findFirst({ where: { tenantId: input.tenantId, invoiceId: invoice.id } });
    if (receipt && receipt.status !== 'CANCELLED') {
      await reverseJournal(tx, {
        tenantId: input.tenantId,
        referenceType: 'PAYMENT_RECEIPT',
        referenceId: receipt.id,
        date: new Date(),
        createdBy: input.userId,
        description: input.reason
      });
      await tx.paymentReceipt.update({ where: { id: receipt.id }, data: { status: 'CANCELLED' } });
    }
    const updated = await tx.salesInvoice.update({ where: { id: invoice.id }, data: { status: 'CANCELLED' } });
    await writeAudit(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'REVERSE',
      entity: 'CASH_SALE',
      entityId: invoice.id,
      before: { status: invoice.status },
      after: { status: 'CANCELLED', reason: String(input.reason).trim() }
    });
    return updated;
  };
  if (!input.managed && typeof db.$transaction === 'function') return db.$transaction(run);
  return run(db);
}

module.exports = { isCashKind, postCashSale, cancelCashSale };
