const { DocumentError } = require('../errors');
const { num, money, dec, rateOf } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { ensureGlMap, postJournal } = require('../glService');
const { allocateCustomerReceipt } = require('../documentPosting');
const { onHand } = require('../stockService');
const { getSettings } = require('./settings');
const { releaseOrder } = require('./dispatch');
const { postSalesReturn } = require('./returns');
const { resolvePrice } = require('./pricing');
const { treasuryApi } = require('./bridges');
const { notify } = require('./notify');

function messageWhere(tenantId, entity, externalRef) {
  return {
    tenantId_direction_entity_externalRef: {
      tenantId,
      direction: 'IN',
      entity,
      externalRef
    }
  };
}

async function existingProcessed(db, tenantId, entity, externalRef) {
  if (!externalRef) throw new DocumentError('External reference is required.', { externalRef: 'External reference is required.' });
  const row = await db.sfaMessage.findUnique({ where: messageWhere(tenantId, entity, externalRef) });
  if (row?.status === 'PROCESSED') return row;
  return null;
}

async function remember(db, { tenantId, entity, externalRef, payload, status, error, resultId }) {
  if (status === 'FAILED') {
    const current = await db.sfaMessage.findUnique({ where: messageWhere(tenantId, entity, externalRef) });
    if (current?.status === 'PROCESSED') return current;
  }
  const where = messageWhere(tenantId, entity, externalRef);
  const data = {
    status,
    error: error || null,
    resultId: resultId || null,
    payload,
    processedAt: status === 'PROCESSED' ? new Date() : null
  };
  const current = await db.sfaMessage.findUnique({ where });
  if (!current) {
    return db.sfaMessage.create({
      data: {
        tenantId,
        direction: 'IN',
        entity,
        externalRef,
        attempts: 1,
        ...data
      }
    });
  }
  return db.sfaMessage.update({
    where,
    data: { ...data, attempts: { increment: 1 } }
  });
}

async function findCustomer(db, tenantId, input) {
  const ref = input.customerRef || input.externalRef;
  if (ref) {
    const byRef = await db.customer.findFirst({ where: { tenantId, externalRef: ref } });
    if (byRef) return byRef;
  }
  if (input.customerCode || input.code) {
    const code = input.customerCode || input.code;
    const byCode = await db.customer.findFirst({ where: { tenantId, code } });
    if (byCode) return byCode;
  }
  return null;
}

async function findWarehouse(db, tenantId, code) {
  if (!code) return db.warehouse.findFirst({ where: { tenantId }, orderBy: { code: 'asc' } });
  const warehouse = await db.warehouse.findFirst({ where: { tenantId, code } });
  if (!warehouse) throw new DocumentError('Unknown warehouse.', { warehouseCode: 'Unknown warehouse.' });
  return warehouse;
}

async function importCustomer(db, input) {
  const settings = await getSettings(db, input.tenantId);
  if (!settings.sfaImportCustomers) throw new DocumentError('Customer import is turned off.', { sync: 'Customer import is turned off.' });
  const done = await existingProcessed(db, input.tenantId, 'CUSTOMER', input.externalRef);
  if (done) return { duplicate: true, message: done, customerId: done.resultId };
  try {
    const customer = await db.$transaction(async (tx) => {
      const current = await findCustomer(tx, input.tenantId, input);
      const data = {
        name: input.name,
        channel: input.channel || 'GENERAL_TRADE',
        phone: input.phone || null,
        address: input.address || null,
        email: input.email || null,
        taxGroup: input.taxGroup || null,
        externalRef: input.externalRef
      };
      if (input.creditLimit !== undefined) data.creditLimit = input.creditLimit;
      if (input.creditPeriod !== undefined) data.creditPeriod = input.creditPeriod;
      if (input.allowCreditSales !== undefined) data.allowCreditSales = Boolean(input.allowCreditSales);
      let saved;
      if (current) {
        saved = await tx.customer.update({ where: { id: current.id }, data });
      } else {
        if (!input.name) throw new DocumentError('Customer name is required.', { name: 'Customer name is required.' });
        saved = await tx.customer.create({
          data: {
            tenantId: input.tenantId,
            code: input.code || input.externalRef,
            allowCreditSales: true,
            ...data
          }
        });
      }
      await remember(tx, {
        tenantId: input.tenantId,
        entity: 'CUSTOMER',
        externalRef: input.externalRef,
        payload: input,
        status: 'PROCESSED',
        resultId: saved.id
      });
      return saved;
    });
    return { duplicate: false, customer };
  } catch (error) {
    await remember(db, {
      tenantId: input.tenantId,
      entity: 'CUSTOMER',
      externalRef: input.externalRef,
      payload: input,
      status: 'FAILED',
      error: error.message
    });
    throw error;
  }
}

async function importOrder(db, input) {
  const settings = await getSettings(db, input.tenantId);
  if (!settings.sfaImportOrders) throw new DocumentError('Order import is turned off.', { sync: 'Order import is turned off.' });
  const done = await existingProcessed(db, input.tenantId, 'ORDER', input.externalRef);
  if (done) return { duplicate: true, message: done, orderId: done.resultId };
  try {
    const order = await db.$transaction(async (tx) => {
      const customer = await findCustomer(tx, input.tenantId, input);
      if (!customer) throw new DocumentError('Customer is not in iMake.', { customerRef: 'Customer is not in iMake.' });
      const warehouse = await findWarehouse(tx, input.tenantId, input.warehouseCode);
      if (!warehouse) throw new DocumentError('Warehouse is required.', { warehouseCode: 'Warehouse is required.' });
      const items = [];
      for (const line of input.items || []) {
        const product = line.productId
          ? await tx.product.findFirst({ where: { tenantId: input.tenantId, id: line.productId } })
          : await tx.product.findFirst({ where: { tenantId: input.tenantId, code: line.productCode } });
        if (!product) throw new DocumentError(`Unknown item ${line.productCode || ''}.`, { productCode: `Unknown item ${line.productCode || ''}.` });
        const quantity = money(line.quantity);
        if (!(quantity > 0)) throw new DocumentError('Quantity must be greater than zero.', { quantity: 'Quantity must be greater than zero.' });
        const quote = await resolvePrice(tx, {
          tenantId: input.tenantId,
          customerId: customer.id,
          productId: product.id,
          channel: input.channel || customer.channel,
          quantity
        });
        const unitPrice = line.unitPrice === undefined || line.unitPrice === null || line.unitPrice === ''
          ? quote.price
          : money(line.unitPrice);
        items.push({ productId: product.id, quantity, unitPrice, total: money(quantity * unitPrice), listPrice: quote.price });
      }
      if (!items.length) throw new DocumentError('Add at least one product.', { items: 'Add at least one product.' });
      const number = await generateDocumentNumber(input.tenantId, 'salesOrder', 'SO', 'orderNumber', tx);
      const created = await tx.salesOrder.create({
        data: {
          tenantId: input.tenantId,
          customerId: customer.id,
          orderNumber: number,
          date: new Date(input.date || new Date()),
          status: 'PENDING',
          total: dec(items.reduce((sum, item) => sum + item.total, 0)),
          channel: input.channel || customer.channel || 'GENERAL_TRADE',
          externalRef: input.externalRef,
          sourceSystem: 'IFORCE',
          warehouseId: warehouse.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: dec(item.quantity),
              unitPrice: dec(item.unitPrice),
              total: dec(item.total),
              listPrice: dec(item.listPrice)
            }))
          }
        }
      });
      const released = await releaseOrder(tx, {
        tenantId: input.tenantId,
        orderId: created.id,
        warehouseId: warehouse.id,
        userId: null
      });
      await remember(tx, {
        tenantId: input.tenantId,
        entity: 'ORDER',
        externalRef: input.externalRef,
        payload: input,
        status: 'PROCESSED',
        resultId: created.id
      });
      return released.order;
    });
    return { duplicate: false, order };
  } catch (error) {
    await remember(db, {
      tenantId: input.tenantId,
      entity: 'ORDER',
      externalRef: input.externalRef,
      payload: input,
      status: 'FAILED',
      error: error.message
    });
    await notify(db, {
      tenantId: input.tenantId,
      kind: 'SFA_FAILED',
      title: `SFA order ${input.externalRef} failed`,
      body: error.message,
      entityType: 'SFA_MESSAGE',
      entityId: input.externalRef
    });
    throw error;
  }
}

async function importCollection(db, input) {
  const settings = await getSettings(db, input.tenantId);
  if (!settings.sfaImportCollections) throw new DocumentError('Collection import is turned off.', { sync: 'Collection import is turned off.' });
  const done = await existingProcessed(db, input.tenantId, 'COLLECTION', input.externalRef);
  if (done) return { duplicate: true, message: done, receiptId: done.resultId };
  try {
    const receipt = await db.$transaction(async (tx) => {
      const customer = await findCustomer(tx, input.tenantId, input);
      if (!customer) throw new DocumentError('Customer is not in iMake.', { customerRef: 'Customer is not in iMake.' });
      const amount = money(input.amount);
      if (!(amount > 0)) throw new DocumentError('Amount must be greater than zero.', { amount: 'Amount must be greater than zero.' });
      const openInvoices = input.invoiceNumber
        ? await tx.salesInvoice.findMany({ where: { tenantId: input.tenantId, customerId: customer.id, invoiceNumber: input.invoiceNumber } })
        : await tx.salesInvoice.findMany({
          where: { tenantId: input.tenantId, customerId: customer.id, status: { in: ['UNPAID', 'PARTIAL'] } },
          orderBy: { date: 'asc' }
        });
      if (input.invoiceNumber && !openInvoices.length) {
        throw new DocumentError('Invoice not found.', { invoiceNumber: 'Invoice not found.' });
      }
      let left = amount;
      const allocations = [];
      for (const invoice of openInvoices) {
        if (left <= 0.0001) break;
        const open = money(num(invoice.total) - num(invoice.amountPaid));
        const take = money(Math.min(open, left));
        if (take > 0) {
          allocations.push({ invoiceId: invoice.id, amount: take });
          left = money(left - take);
        }
      }
      const allocated = money(allocations.reduce((sum, row) => sum + row.amount, 0));
      const number = await generateDocumentNumber(input.tenantId, 'paymentReceipt', 'REC', 'receiptNumber', tx);
      const created = await tx.paymentReceipt.create({
        data: {
          tenantId: input.tenantId,
          customerId: customer.id,
          receiptNumber: number,
          amount: dec(allocated > 0 ? allocated : amount),
          date: new Date(input.date || new Date()),
          method: input.method || 'CASH',
          reference: input.externalRef,
          exchangeRate: rateOf(input.exchangeRate),
          createdBy: null
        }
      });
      if (allocations.length) {
        await allocateCustomerReceipt(tx, {
          tenantId: input.tenantId,
          receipt: created,
          allocations,
          createdBy: null
        });
      }
      const unapplied = allocations.length ? left : amount;
      if (!allocations.length || unapplied > 0.0001) {
        const map = await ensureGlMap(tx, input.tenantId, null);
        const cash = created.method === 'CASH' ? map.CASH : map.BANK;
        await postJournal(tx, {
          tenantId: input.tenantId,
          date: created.date,
          description: `SFA collection ${number}`,
          referenceType: 'PAYMENT_RECEIPT',
          referenceId: created.id,
          lines: [
            { accountId: cash, debit: unapplied, credit: 0, description: number },
            { accountId: map.AR, debit: 0, credit: unapplied, description: number }
          ]
        });
      }
      const treasury = treasuryApi();
      if (treasury?.saveCollection && tx.collectionCase) {
        await treasury.saveCollection(tx, {
          tenantId: input.tenantId,
          customerId: customer.id,
          notes: `SFA collection ${input.externalRef}`,
          body: `Collected ${amount} by ${created.method}.`,
          lastContact: created.date
        });
      }
      await remember(tx, {
        tenantId: input.tenantId,
        entity: 'COLLECTION',
        externalRef: input.externalRef,
        payload: input,
        status: 'PROCESSED',
        resultId: created.id
      });
      return created;
    });
    return { duplicate: false, receipt };
  } catch (error) {
    await remember(db, {
      tenantId: input.tenantId,
      entity: 'COLLECTION',
      externalRef: input.externalRef,
      payload: input,
      status: 'FAILED',
      error: error.message
    });
    throw error;
  }
}

async function importReturn(db, input) {
  const done = await existingProcessed(db, input.tenantId, 'RETURN', input.externalRef);
  if (done) return { duplicate: true, message: done, returnId: done.resultId };
  try {
    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({
        where: { tenantId: input.tenantId, invoiceNumber: input.invoiceNumber }
      });
      if (!invoice) throw new DocumentError('Invoice not found.', { invoiceNumber: 'Invoice not found.' });
      const items = [];
      for (const line of input.items || []) {
        const product = await tx.product.findFirst({ where: { tenantId: input.tenantId, code: line.productCode } });
        if (!product) throw new DocumentError(`Unknown item ${line.productCode}.`, { productCode: `Unknown item ${line.productCode}.` });
        items.push({ productId: product.id, quantity: line.quantity, reason: line.reason || input.reason });
      }
      const salesReturn = await postSalesReturn(tx, {
        tenantId: input.tenantId,
        invoiceId: invoice.id,
        date: input.date || new Date(),
        kind: input.kind || 'GRA',
        reason: input.reason || 'SFA return',
        items,
        managed: true
      });
      await remember(tx, {
        tenantId: input.tenantId,
        entity: 'RETURN',
        externalRef: input.externalRef,
        payload: input,
        status: 'PROCESSED',
        resultId: salesReturn.id
      });
      return salesReturn;
    });
    return { duplicate: false, salesReturn: created };
  } catch (error) {
    await remember(db, {
      tenantId: input.tenantId,
      entity: 'RETURN',
      externalRef: input.externalRef,
      payload: input,
      status: 'FAILED',
      error: error.message
    });
    throw error;
  }
}

async function importRoute(db, input) {
  const done = await existingProcessed(db, input.tenantId, 'ROUTE', input.externalRef);
  if (done) return { duplicate: true, message: done };
  if (!input.code || !input.name) throw new DocumentError('Route code and name are required.', { code: 'Route code and name are required.' });
  try {
    const route = await db.$transaction(async (tx) => {
      const saved = await tx.deliveryRoute.upsert({
        where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
        create: { tenantId: input.tenantId, code: input.code, name: input.name },
        update: { name: input.name, active: true }
      });
      await remember(tx, {
        tenantId: input.tenantId,
        entity: 'ROUTE',
        externalRef: input.externalRef,
        payload: input,
        status: 'PROCESSED',
        resultId: saved.id
      });
      return saved;
    });
    return { duplicate: false, route };
  } catch (error) {
    await remember(db, {
      tenantId: input.tenantId,
      entity: 'ROUTE',
      externalRef: input.externalRef,
      payload: input,
      status: 'FAILED',
      error: error.message
    });
    throw error;
  }
}

async function importVisit(db, input) {
  const done = await existingProcessed(db, input.tenantId, 'VISIT', input.externalRef);
  if (done) return { duplicate: true, message: done };
  if (!input.customerRef && !input.customerCode) {
    throw new DocumentError('Customer is required.', { customerRef: 'Customer is required.' });
  }
  const customer = await findCustomer(db, input.tenantId, input);
  if (!customer) throw new DocumentError('Customer is not in iMake.', { customerRef: 'Customer is not in iMake.' });
  const message = await remember(db, {
    tenantId: input.tenantId,
    entity: 'VISIT',
    externalRef: input.externalRef,
    payload: { ...input, customerId: customer.id },
    status: 'PROCESSED',
    resultId: customer.id
  });
  return { duplicate: false, message };
}

async function exportItems(db, tenantId) {
  const settings = await getSettings(db, tenantId);
  if (!settings.sfaExportItems) throw new DocumentError('Item export is turned off.', { sync: 'Item export is turned off.' });
  const products = await db.product.findMany({
    where: { tenantId, activeStatus: 'ACTIVE' },
    select: { code: true, name: true, sellingPrice: true, currency: true, type: true, taxGroup: true }
  });
  return products.map((product) => ({
    code: product.code,
    name: product.name,
    sellingPrice: num(product.sellingPrice),
    currency: product.currency,
    type: product.type,
    taxGroup: product.taxGroup
  }));
}

async function exportPrices(db, tenantId, customerRef) {
  const settings = await getSettings(db, tenantId);
  if (!settings.sfaExportPrices) throw new DocumentError('Price export is turned off.', { sync: 'Price export is turned off.' });
  if (!customerRef) {
    const rules = await db.customerPrice.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { product: true, customer: true, category: true }
    });
    return rules.map((rule) => ({
      scope: rule.scope,
      productCode: rule.product.code,
      customerCode: rule.customer?.code || null,
      groupCode: rule.category?.code || null,
      channel: rule.channel,
      minQty: num(rule.minQty),
      price: num(rule.price),
      currency: rule.currency
    }));
  }
  const customer = await findCustomer(db, tenantId, { customerRef });
  if (!customer) throw new DocumentError('Customer is not in iMake.', { customerRef: 'Customer is not in iMake.' });
  const products = await db.product.findMany({ where: { tenantId, activeStatus: 'ACTIVE', type: 'PRODUCT' } });
  const prices = [];
  for (const product of products) {
    const quote = await resolvePrice(db, { tenantId, customerId: customer.id, productId: product.id, channel: customer.channel, quantity: 1 });
    prices.push({ productCode: product.code, price: quote.price, source: quote.source, currency: quote.currency });
  }
  return prices;
}

async function exportStock(db, tenantId) {
  const settings = await getSettings(db, tenantId);
  if (!settings.sfaExportStock) throw new DocumentError('Stock export is turned off.', { sync: 'Stock export is turned off.' });
  const products = await db.product.findMany({ where: { tenantId, type: 'PRODUCT', activeStatus: 'ACTIVE' } });
  const warehouses = await db.warehouse.findMany({ where: { tenantId } });
  const rows = [];
  for (const product of products) {
    for (const warehouse of warehouses) {
      const quantity = await onHand(db, { tenantId, productId: product.id, warehouseId: warehouse.id });
      if (quantity > 0) rows.push({ productCode: product.code, warehouseCode: warehouse.code, quantity });
    }
  }
  return rows;
}

async function exportBalances(db, tenantId, customerRef) {
  const settings = await getSettings(db, tenantId);
  if (!settings.sfaExportBalances) throw new DocumentError('Balance export is turned off.', { sync: 'Balance export is turned off.' });
  const where = { tenantId };
  if (customerRef) {
    const customer = await findCustomer(db, tenantId, { customerRef });
    if (!customer) throw new DocumentError('Customer is not in iMake.', { customerRef: 'Customer is not in iMake.' });
    where.id = customer.id;
  }
  const customers = await db.customer.findMany({ where });
  const rows = [];
  for (const customer of customers) {
    const invoices = await db.salesInvoice.findMany({
      where: { tenantId, customerId: customer.id, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }
    });
    const balance = money(invoices.reduce((sum, invoice) => sum + (num(invoice.total) - num(invoice.amountPaid)) * (num(invoice.exchangeRate) || 1), 0));
    rows.push({
      customerCode: customer.code,
      externalRef: customer.externalRef,
      name: customer.name,
      creditLimit: num(customer.creditLimit),
      balance
    });
  }
  return rows;
}

async function retryMessage(db, tenantId, id) {
  const message = await db.sfaMessage.findFirst({ where: { id, tenantId, direction: 'IN' } });
  if (!message) throw new DocumentError('Message not found.', { id: 'Message not found.' });
  if (message.status === 'PROCESSED') return { duplicate: true, message };
  const payload = { ...(message.payload || {}), tenantId, externalRef: message.externalRef };
  if (message.entity === 'ORDER') return importOrder(db, payload);
  if (message.entity === 'CUSTOMER') return importCustomer(db, payload);
  if (message.entity === 'COLLECTION') return importCollection(db, payload);
  if (message.entity === 'RETURN') return importReturn(db, payload);
  if (message.entity === 'ROUTE') return importRoute(db, payload);
  if (message.entity === 'VISIT') return importVisit(db, payload);
  throw new DocumentError('This message cannot be retried.', { entity: 'This message cannot be retried.' });
}

async function runSync(db, tenantId) {
  const settings = await getSettings(db, tenantId);
  const failed = await db.sfaMessage.findMany({ where: { tenantId, direction: 'IN', status: 'FAILED' } });
  const retried = [];
  for (const message of failed) {
    try {
      retried.push({ id: message.id, ok: true, result: await retryMessage(db, tenantId, message.id) });
    } catch (error) {
      retried.push({ id: message.id, ok: false, error: error.message });
    }
  }
  const day = new Date().toISOString().slice(0, 10);
  const outbound = [];
  const jobs = [
    ['ITEM', settings.sfaExportItems, () => exportItems(db, tenantId)],
    ['PRICE', settings.sfaExportPrices, () => exportPrices(db, tenantId)],
    ['STOCK', settings.sfaExportStock, () => exportStock(db, tenantId)],
    ['BALANCE', settings.sfaExportBalances, () => exportBalances(db, tenantId)]
  ];
  for (const [entity, enabled, load] of jobs) {
    if (!enabled) continue;
    const payload = await load();
    const externalRef = `SYNC-${day}-${entity}`;
    const saved = await db.sfaMessage.upsert({
      where: {
        tenantId_direction_entity_externalRef: { tenantId, direction: 'OUT', entity, externalRef }
      },
      create: {
        tenantId,
        direction: 'OUT',
        entity,
        externalRef,
        payload,
        status: 'PROCESSED',
        attempts: 1,
        processedAt: new Date()
      },
      update: { payload, status: 'PROCESSED', processedAt: new Date(), attempts: { increment: 1 } }
    });
    outbound.push({ entity, id: saved.id, rows: Array.isArray(payload) ? payload.length : 0 });
  }
  return { retried, outbound, intervalMinutes: settings.sfaSyncMinutes };
}

module.exports = {
  importCustomer,
  importOrder,
  importCollection,
  importReturn,
  importRoute,
  importVisit,
  exportItems,
  exportPrices,
  exportStock,
  exportBalances,
  retryMessage,
  runSync
};
