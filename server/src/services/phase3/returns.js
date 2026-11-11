const { DocumentError } = require('../errors');
const { num, money, dec } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { receive } = require('../stockService');
const { ensureGlMap, postJournal } = require('../glService');
const { slabsFor, applySlabs, sumBucket } = require('../taxService');
const { assertPeriodOpen, inventoryOps, treasuryApi } = require('./bridges');
const { writeAudit } = require('../auditService');
const { reverseJournal } = require('../glService');
const { notify } = require('./notify');
const { RETURN_KINDS } = require('./defaults');

async function returnedQty(db, invoiceId, productId) {
  const rows = await db.salesReturn.findMany({
    where: { invoiceId, status: { not: 'CANCELLED' } },
    include: { lines: true }
  });
  let qty = 0;
  for (const row of rows) {
    for (const line of row.lines) {
      if (!productId || line.productId === productId) qty = money(qty + num(line.quantity));
    }
  }
  return qty;
}

async function unitCostFor(db, { tenantId, invoice, productId }) {
  if (invoice.deliveryId) {
    const item = await db.salesDeliveryItem.findFirst({
      where: { deliveryId: invoice.deliveryId, productId }
    });
    if (item && num(item.unitCost) > 0) return num(item.unitCost);
  }
  const movement = await db.stockMovement.findFirst({
    where: { tenantId, productId, referenceId: invoice.id, referenceType: 'SALES_INVOICE' },
    orderBy: { createdAt: 'desc' }
  });
  return movement ? num(movement.unitCost) : 0;
}

async function postSalesReturn(db, input) {
  const kind = String(input.kind || 'GRA').toUpperCase();
  if (!RETURN_KINDS.includes(kind)) {
    throw new DocumentError('Choose a market, damage or dissatisfaction return.', { kind: 'Choose a market, damage or dissatisfaction return.' });
  }
  if (!input.reason || String(input.reason).trim().length < 2) {
    throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  }
  const invoice = await db.salesInvoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
    include: { items: true, delivery: true }
  });
  if (!invoice || invoice.status === 'CANCELLED') {
    throw new DocumentError('Invoice not found.', { invoiceId: 'Invoice not found.' });
  }
  const lines = (input.items || []).filter((item) => item?.productId && num(item.quantity) > 0);
  if (!lines.length) throw new DocumentError('Add at least one product.', { items: 'Add at least one product.' });

  const prepared = [];
  for (const line of lines) {
    const sold = invoice.items.find((item) => item.productId === line.productId);
    if (!sold) throw new DocumentError('That product is not on the invoice.', { productId: 'That product is not on the invoice.' });
    const already = await returnedQty(db, invoice.id, line.productId);
    const qty = money(line.quantity);
    if (already + qty - num(sold.quantity) > 0.0001) {
      throw new DocumentError('Return quantity exceeds the invoice.', { quantity: 'Return quantity exceeds the invoice.' });
    }
    prepared.push({
      productId: line.productId,
      quantity: qty,
      unitPrice: num(sold.unitPrice),
      unitCost: await unitCostFor(db, { tenantId: input.tenantId, invoice, productId: line.productId }),
      reason: line.reason || input.reason
    });
  }

  const warehouseId = input.warehouseId || invoice.warehouseId || invoice.delivery?.warehouseId;
  if (!warehouseId) throw new DocumentError('Warehouse is required.', { warehouseId: 'Warehouse is required.' });

  const run = async (tx) => {
    await assertPeriodOpen(tx, { tenantId: input.tenantId, date: input.date, userId: input.createdBy });
    const subtotal = money(prepared.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const customer = await tx.customer.findFirst({ where: { id: invoice.customerId, tenantId: input.tenantId } });
    const slabs = await slabsFor(tx, input.tenantId, 'sales', customer?.taxGroup || null);
    const parts = applySlabs(subtotal, slabs);
    const vat = sumBucket(parts, 'VAT');
    const sscl = sumBucket(parts, 'SSCL');
    const taxAmount = money(vat + sscl);
    const total = money(subtotal + taxAmount);
    const number = await generateDocumentNumber(input.tenantId, 'salesReturn', 'SR', 'number', tx);

    let stockReturnId = null;
    const ops = inventoryOps();
    if (ops?.createReturn && tx.stockReturn) {
      const stock = await ops.createReturn(tx, {
        tenantId: input.tenantId,
        date: input.date,
        kind,
        customerId: invoice.customerId,
        warehouseId,
        reference: number,
        createdBy: input.createdBy,
        post: true,
        items: prepared.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          reason: line.reason,
          unitCost: line.unitCost,
          disposition: kind === 'DAMAGE' ? (input.disposition || 'QUARANTINE') : undefined
        }))
      });
      stockReturnId = stock.id;
    } else {
      for (const line of prepared) {
        await receive(tx, {
          tenantId: input.tenantId,
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          referenceType: 'SALES_RETURN',
          referenceId: number,
          createdBy: input.createdBy,
          receivedAt: input.date
        });
      }
    }

    const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
    const cost = money(prepared.reduce((sum, line) => sum + line.quantity * line.unitCost, 0));
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: input.date,
      createdBy: input.createdBy,
      description: `Sales return ${number}`,
      referenceType: 'SALES_RETURN',
      referenceId: number,
      lines: [
        { accountId: map.INVENTORY, debit: cost, credit: 0, description: number },
        { accountId: map.COGS, debit: 0, credit: cost, description: number }
      ]
    });

    let partyNoteId = null;
    const treasury = treasuryApi();
    const outstanding = money(num(invoice.total) - num(invoice.amountPaid));
    const rate = num(invoice.exchangeRate) || 1;
    const revenueBase = money(subtotal * rate);
    const vatBase = money(vat * rate);
    const ssclBase = money(sscl * rate);
    const creditBase = money(revenueBase + vatBase + ssclBase);
    if (treasury?.postPartyNote && tx.partyNote && creditBase - outstanding <= 0.0001) {
      const note = await treasury.postPartyNote(tx, {
        tenantId: input.tenantId,
        partyType: 'CUSTOMER',
        partyId: invoice.customerId,
        kind: 'CREDIT',
        date: input.date,
        invoiceId: invoice.id,
        reasonCode: kind,
        subtotal,
        taxAmount,
        exchangeRate: rate,
        createdBy: input.createdBy
      });
      partyNoteId = note.id;
    } else {
      await postJournal(tx, {
        tenantId: input.tenantId,
        date: input.date,
        createdBy: input.createdBy,
        description: `Credit note ${number}`,
        referenceType: 'SALES_RETURN',
        referenceId: `${number}:AR`,
        lines: [
          { accountId: map.REVENUE, debit: revenueBase, credit: 0, description: number },
          { accountId: parts.find((part) => part.bucket === 'VAT')?.accountId || map.VAT_OUTPUT, debit: vatBase, credit: 0, description: 'VAT' },
          { accountId: map.SSCL, debit: ssclBase, credit: 0, description: 'SSCL' },
          { accountId: map.AR, debit: 0, credit: creditBase, description: number }
        ]
      });
    }

    const created = await tx.salesReturn.create({
      data: {
        tenantId: input.tenantId,
        number,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        deliveryId: invoice.deliveryId,
        date: new Date(input.date),
        kind,
        reason: String(input.reason).trim(),
        status: 'POSTED',
        stockReturnId,
        partyNoteId,
        createdBy: input.createdBy || null,
        lines: {
          create: prepared.map((line) => ({
            tenantId: input.tenantId,
            productId: line.productId,
            quantity: dec(line.quantity),
            unitPrice: dec(line.unitPrice),
            unitCost: dec(line.unitCost),
            reason: line.reason
          }))
        }
      },
      include: { lines: { include: { product: true } }, customer: true, invoice: true }
    });
    await writeAudit(tx, {
      tenantId: input.tenantId,
      userId: input.createdBy,
      action: 'POST',
      entity: 'SALES_RETURN',
      entityId: created.id,
      after: { number, kind, invoiceId: invoice.id, stockReturnId, partyNoteId }
    });
    await notify(tx, {
      tenantId: input.tenantId,
      userId: input.createdBy,
      kind: 'SALES_RETURN',
      title: `Return ${number}`,
      body: `${kind} return posted against ${invoice.invoiceNumber}.`,
      entityType: 'SALES_RETURN',
      entityId: created.id
    });
    return created;
  };

  if (!input.managed && typeof db.$transaction === 'function') return db.$transaction(run);
  return run(db);
}

async function cancelSalesReturn(db, input) {
  if (!input.reason || String(input.reason).trim().length < 2) {
    throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  }
  const row = await db.salesReturn.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!row) throw new DocumentError('Return not found.', { id: 'Return not found.' });
  if (row.status === 'CANCELLED') throw new DocumentError('This return is already cancelled.', { status: 'This return is already cancelled.' });
  const run = async (tx) => {
    await assertPeriodOpen(tx, { tenantId: input.tenantId, date: new Date(), userId: input.userId });
    const ops = inventoryOps();
    if (row.stockReturnId && ops?.cancelReturn) {
      await ops.cancelReturn(tx, { tenantId: input.tenantId, id: row.stockReturnId, createdBy: input.userId, reason: input.reason });
    }
    await reverseJournal(tx, {
      tenantId: input.tenantId,
      referenceType: 'SALES_RETURN',
      referenceId: row.number,
      date: new Date(),
      createdBy: input.userId,
      description: input.reason
    });
    if (row.partyNoteId) {
      const treasury = treasuryApi();
      if (treasury?.cancelPartyNote) {
        await treasury.cancelPartyNote(tx, { tenantId: input.tenantId, id: row.partyNoteId, createdBy: input.userId, reason: input.reason });
      }
    } else {
      await reverseJournal(tx, {
        tenantId: input.tenantId,
        referenceType: 'SALES_RETURN',
        referenceId: `${row.number}:AR`,
        date: new Date(),
        createdBy: input.userId,
        description: input.reason
      });
    }
    const updated = await tx.salesReturn.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });
    await writeAudit(tx, {
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'REVERSE',
      entity: 'SALES_RETURN',
      entityId: row.id,
      before: { status: row.status },
      after: { status: 'CANCELLED', reason: String(input.reason).trim() }
    });
    return updated;
  };
  if (!input.managed && typeof db.$transaction === 'function') return db.$transaction(run);
  return run(db);
}

module.exports = { postSalesReturn, returnedQty, cancelSalesReturn };
