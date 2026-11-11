const { receive, issue, transfer, reverseReceipt, reverseIssue } = require('./stockService');
const { recordBatch } = require('./inventory/batches');
const { ensureGlMap, postJournal, reverseJournal } = require('./glService');
const { slabsFor, applySlabs, sumBucket } = require('./taxService');
const { DocumentError } = require('./errors');
const { num, money, dec, rateOf, addDays } = require('./money');

function requireWarehouse(warehouseId) {
  if (!warehouseId) {
    throw new DocumentError('Warehouse is required.', { warehouseId: 'Warehouse is required.' });
  }
}

async function inventoryJournal(tx, { tenantId, date, createdBy, referenceType, referenceId, description, debitKey, creditKey, amount }) {
  const value = money(amount);
  if (value <= 0) return null;
  const map = await ensureGlMap(tx, tenantId, createdBy);
  return postJournal(tx, {
    tenantId,
    date,
    createdBy,
    description,
    referenceType,
    referenceId,
    lines: [
      { accountId: map[debitKey], debit: value, credit: 0, description },
      { accountId: map[creditKey], debit: 0, credit: value, description }
    ]
  });
}

async function postReceiptDocument(tx, { tenantId, warehouseId, items, referenceType, referenceId, date, createdBy, description, creditKey = 'STOCK_ADJUSTMENT' }) {
  requireWarehouse(warehouseId);
  let value = 0;
  for (const item of items || []) {
    const qty = money(item.quantity ?? item.quantityReceived);
    if (qty <= 0) continue;
    const result = await receive(tx, {
      tenantId,
      productId: item.productId,
      warehouseId,
      quantity: qty,
      unitCost: item.baseUnitCost != null ? item.baseUnitCost : item.unitPrice,
      referenceType,
      referenceId,
      movementType: 'GR',
      createdBy,
      receivedAt: date,
      lotNumber: item.lotNumber || null
    });
    value = money(value + result.value);
  }
  await inventoryJournal(tx, {
    tenantId, date, createdBy, referenceType, referenceId, description,
    debitKey: 'INVENTORY', creditKey, amount: value
  });
  return value;
}

async function postIssueDocument(tx, { tenantId, warehouseId, items, referenceType, referenceId, date, createdBy, description, debitKey = 'COGS', quantitySign = 1 }) {
  requireWarehouse(warehouseId);
  let value = 0;
  const results = [];
  for (const item of items || []) {
    const qty = money(Math.abs(num(item.quantity)));
    if (qty <= 0) continue;
    const result = await issue(tx, {
      tenantId,
      productId: item.productId,
      warehouseId,
      quantity: qty,
      referenceType,
      referenceId,
      movementType: 'GI',
      quantitySign,
      createdBy,
      batchId: item.batchId || null,
      eligibleOnly: !!item.eligibleOnly,
      lotNumber: item.lotNumber || null
    });
    value = money(value + result.value);
    results.push({ ...result, productId: item.productId, itemId: item.id });
  }
  await inventoryJournal(tx, {
    tenantId, date, createdBy, referenceType, referenceId, description,
    debitKey, creditKey: 'INVENTORY', amount: value
  });
  return { value, results };
}

async function postAdjustmentDocument(tx, { tenantId, warehouseId, items, referenceId, date, createdBy }) {
  requireWarehouse(warehouseId);
  const referenceType = 'ADJ';
  let increase = 0;
  let decrease = 0;
  for (const item of items || []) {
    const diff = money(item.diffQty);
    if (diff > 0) {
      const result = await receive(tx, {
        tenantId,
        productId: item.productId,
        warehouseId,
        quantity: diff,
        unitCost: item.unitPrice || 0,
        referenceType,
        referenceId,
        movementType: 'ADJ',
        createdBy,
        receivedAt: date
      });
      increase = money(increase + result.value);
    } else if (diff < 0) {
      const result = await issue(tx, {
        tenantId,
        productId: item.productId,
        warehouseId,
        quantity: Math.abs(diff),
        referenceType,
        referenceId,
        movementType: 'ADJ',
        quantitySign: -1,
        createdBy
      });
      decrease = money(decrease + result.value);
    }
  }
  const net = money(increase - decrease);
  if (net > 0) {
    await inventoryJournal(tx, {
      tenantId, date, createdBy, referenceType, referenceId,
      description: 'Stock adjustment',
      debitKey: 'INVENTORY', creditKey: 'STOCK_ADJUSTMENT', amount: net
    });
  } else if (net < 0) {
    await inventoryJournal(tx, {
      tenantId, date, createdBy, referenceType, referenceId,
      description: 'Stock adjustment',
      debitKey: 'STOCK_ADJUSTMENT', creditKey: 'INVENTORY', amount: Math.abs(net)
    });
  }
  return { increase, decrease };
}

async function postTransferDocument(tx, { tenantId, fromWarehouseId, toWarehouseId, items, referenceId, date, createdBy }) {
  for (const item of items || []) {
    const qty = money(item.quantity);
    if (qty <= 0) continue;
    await transfer(tx, {
      tenantId,
      productId: item.productId,
      fromWarehouseId,
      toWarehouseId,
      quantity: qty,
      referenceType: 'ST',
      referenceId,
      createdBy,
      receivedAt: date
    });
  }
}

async function cancelStockAndJournal(tx, { tenantId, referenceType, referenceId, date, createdBy, description }) {
  await reverseReceipt(tx, { tenantId, referenceType, referenceId, createdBy });
  await reverseIssue(tx, { tenantId, referenceType, referenceId, createdBy });
  await reverseJournal(tx, { tenantId, referenceType, referenceId, date, createdBy, description });
}

async function refreshPoReceiptStatus(tx, poId) {
  if (!poId) return;
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true, grns: { include: { items: true } } }
  });
  if (!po || po.status === 'CANCELLED') return;
  const received = {};
  for (const grn of po.grns) {
    if (grn.status === 'CANCELLED') continue;
    for (const item of grn.items) {
      received[item.productId] = money((received[item.productId] || 0) + num(item.quantityReceived));
    }
  }
  let all = po.items.length > 0;
  let any = false;
  for (const item of po.items) {
    const got = received[item.productId] || 0;
    if (got > 0) any = true;
    if (got + 0.0001 < num(item.quantity)) all = false;
  }
  const status = all && any ? 'RECEIVED' : any ? 'PARTIALLY_RECEIVED' : 'PENDING';
  await tx.purchaseOrder.update({ where: { id: poId }, data: { status } });
}

async function assertWithinOrdered(label, ordered, already, requested, tolerance, field) {
  const limit = money(ordered * (1 + (tolerance || 0)));
  if (money(already + requested) > limit + 0.0001) {
    const remaining = money(Math.max(ordered - already, 0));
    throw new DocumentError(
      `${label} quantity exceeds the remaining quantity (${remaining}).`,
      { [field]: `${label} quantity exceeds the remaining quantity (${remaining}).` }
    );
  }
}

async function grnUnitPrice(tx, { poId, productId, item }) {
  if (item.unitPrice != null && item.unitPrice !== '' && num(item.unitPrice) > 0) return money(item.unitPrice);
  if (poId) {
    const poItem = await tx.purchaseOrderItem.findFirst({ where: { poId, productId } });
    if (poItem) return money(poItem.unitPrice);
  }
  return 0;
}

async function postGrn(tx, { tenantId, grn, items, overReceiptTolerance = 0, createdBy }) {
  const rate = rateOf(grn.exchangeRate);
  if (grn.poId) {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: grn.poId, tenantId },
      include: { items: true }
    });
    if (!po) throw new DocumentError('Purchase order not found.', { poId: 'Purchase order not found.' });
    const prior = await tx.gRNItem.findMany({
      where: {
        grn: { poId: grn.poId, tenantId, status: { not: 'CANCELLED' }, id: { not: grn.id } }
      }
    });
    const already = {};
    for (const row of prior) already[row.productId] = money((already[row.productId] || 0) + num(row.quantityReceived));
    const ordered = {};
    for (const row of po.items) ordered[row.productId] = money((ordered[row.productId] || 0) + num(row.quantity));
    for (const item of items) {
      if (!ordered[item.productId] && ordered[item.productId] !== 0) {
        throw new DocumentError('Cannot receive a product that is not on the purchase order.', {
          productId: 'Cannot receive a product that is not on the purchase order.'
        });
      }
      await assertWithinOrdered('Receipt', ordered[item.productId] || 0, already[item.productId] || 0, num(item.quantityReceived), overReceiptTolerance, 'quantityReceived');
    }
  }

  let inventoryValue = 0;
  for (const item of items) {
    const qty = money(item.quantityReceived);
    const unitPrice = await grnUnitPrice(tx, { poId: grn.poId, productId: item.productId, item });
    if (!(unitPrice > 0)) {
      throw new DocumentError('Enter the receipt price. Stock is not received at zero cost.', {
        unitPrice: 'Enter the receipt price. Stock is not received at zero cost.'
      });
    }
    const baseUnitCost = money(unitPrice * rate);
    await tx.gRNItem.update({
      where: { id: item.id },
      data: { unitPrice: dec(unitPrice) }
    });
    const damaged = money(item.damagedQty || 0);
    const rejected = money(item.rejectedQty || 0);
    if (damaged + rejected - qty > 0.0001) {
      throw new DocumentError('Damaged and rejected quantities cannot exceed the receipt.', {
        damagedQty: 'Damaged and rejected quantities cannot exceed the receipt.'
      });
    }
    const batch = item.lotNumber ? await recordBatch(tx, {
      tenantId,
      productId: item.productId,
      lotNumber: item.lotNumber,
      expiryDate: item.expiryDate,
      supplierId: grn.supplierId,
      receiptDate: grn.date
    }) : null;
    const usable = money(qty - damaged - rejected);
    const slices = [];
    if (damaged <= 0 && rejected <= 0) slices.push({ quantity: qty, stockStatus: item.stockStatus || 'UNRESTRICTED' });
    else {
      if (usable > 0) slices.push({ quantity: usable, stockStatus: 'UNRESTRICTED' });
      if (damaged > 0) slices.push({ quantity: damaged, stockStatus: 'QUARANTINE' });
      if (rejected > 0) slices.push({ quantity: rejected, stockStatus: 'BLOCKED' });
    }
    for (const slice of slices) {
      const result = await receive(tx, {
        tenantId,
        productId: item.productId,
        warehouseId: grn.warehouseId,
        quantity: slice.quantity,
        unitCost: baseUnitCost,
        referenceType: 'GRN',
        referenceId: grn.id,
        movementType: 'GR',
        createdBy,
        receivedAt: grn.date,
        lotNumber: item.lotNumber || null,
        batchId: batch?.id || null,
        stockStatus: slice.stockStatus,
        expiryDate: item.expiryDate || null
      });
      inventoryValue = money(inventoryValue + result.value);
    }
  }

  await inventoryJournal(tx, {
    tenantId,
    date: grn.date,
    createdBy,
    referenceType: 'GRN',
    referenceId: grn.id,
    description: `Goods receipt ${grn.grnNumber}`,
    debitKey: 'INVENTORY',
    creditKey: 'GRNI',
    amount: inventoryValue
  });
  await refreshPoReceiptStatus(tx, grn.poId);
  return inventoryValue;
}

async function assertPrQuantity(tx, { tenantId, prId, items, excludePoId }) {
  const pr = await tx.purchaseRequisition.findFirst({
    where: { id: prId, tenantId },
    include: { items: true }
  });
  if (!pr) throw new DocumentError('Purchase requisition not found.', { prId: 'Purchase requisition not found.' });
  const orders = await tx.purchaseOrder.findMany({
    where: { prId, tenantId, status: { not: 'CANCELLED' }, ...(excludePoId ? { id: { not: excludePoId } } : {}) },
    include: { items: true }
  });
  const ordered = {};
  for (const order of orders) {
    for (const item of order.items) ordered[item.productId] = money((ordered[item.productId] || 0) + num(item.quantity));
  }
  const requested = {};
  for (const item of pr.items) requested[item.productId] = money((requested[item.productId] || 0) + num(item.quantity));
  for (const item of items) {
    if (!requested[item.productId]) {
      throw new DocumentError('Cannot order a product that is not on the requisition.', {
        productId: 'Cannot order a product that is not on the requisition.'
      });
    }
    await assertWithinOrdered('Order', requested[item.productId], ordered[item.productId] || 0, num(item.quantity), 0, 'quantity');
  }
  return { pr, requested, ordered };
}

async function refreshPrStatus(tx, prId) {
  const pr = await tx.purchaseRequisition.findUnique({
    where: { id: prId },
    include: { items: true, purchaseOrders: { where: { status: { not: 'CANCELLED' } }, include: { items: true } } }
  });
  if (!pr) return;
  const ordered = {};
  for (const order of pr.purchaseOrders) {
    for (const item of order.items) ordered[item.productId] = money((ordered[item.productId] || 0) + num(item.quantity));
  }
  let all = pr.items.length > 0;
  let any = false;
  for (const item of pr.items) {
    const got = ordered[item.productId] || 0;
    if (got > 0) any = true;
    if (got + 0.0001 < num(item.quantity)) all = false;
  }
  const status = all && any ? 'CONVERTED' : any ? 'PARTIALLY_ORDERED' : (pr.status === 'CONVERTED' || pr.status === 'PARTIALLY_ORDERED' ? 'PENDING' : pr.status);
  await tx.purchaseRequisition.update({ where: { id: prId }, data: { status } });
}

async function assertQuotationQuantity(tx, { tenantId, quotationId, items, excludeOrderId }) {
  const quotation = await tx.salesQuotation.findFirst({
    where: { id: quotationId, tenantId },
    include: { items: true }
  });
  if (!quotation) throw new DocumentError('Source quotation not found.', { quotationId: 'Source quotation not found.' });
  const orders = await tx.salesOrder.findMany({
    where: { quotationId, tenantId, status: { not: 'CANCELLED' }, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
    include: { items: true }
  });
  const ordered = {};
  for (const order of orders) {
    for (const item of order.items) ordered[item.productId] = money((ordered[item.productId] || 0) + num(item.quantity));
  }
  const quoted = {};
  for (const item of quotation.items) quoted[item.productId] = money((quoted[item.productId] || 0) + num(item.quantity));
  for (const item of items) {
    if (!quoted[item.productId]) {
      throw new DocumentError('Cannot add new products that are not in the source quotation.', {
        productId: 'Cannot add new products that are not in the source quotation.'
      });
    }
    await assertWithinOrdered('Order', quoted[item.productId], ordered[item.productId] || 0, num(item.quantity), 0, 'quantity');
  }
}

async function refreshQuotationStatus(tx, quotationId) {
  if (!quotationId) return;
  const quotation = await tx.salesQuotation.findUnique({
    where: { id: quotationId },
    include: { items: true, salesOrders: { where: { status: { not: 'CANCELLED' } }, include: { items: true } } }
  });
  if (!quotation) return;
  const ordered = {};
  for (const order of quotation.salesOrders) {
    for (const item of order.items) ordered[item.productId] = money((ordered[item.productId] || 0) + num(item.quantity));
  }
  let all = quotation.items.length > 0;
  let any = false;
  for (const item of quotation.items) {
    const got = ordered[item.productId] || 0;
    if (got > 0) any = true;
    if (got + 0.0001 < num(item.quantity)) all = false;
  }
  const status = all && any ? 'ACCEPTED' : any ? 'PARTIALLY_ACCEPTED' : quotation.status;
  await tx.salesQuotation.update({ where: { id: quotationId }, data: { status } });
}

async function creditWarning(db, { tenantId, customerId, documentBase }) {
  const customer = await db.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) return null;
  const limit = num(customer.creditLimit);
  if (limit <= 0) return null;
  const invoices = await db.salesInvoice.findMany({
    where: { tenantId, customerId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }
  });
  let open = 0;
  for (const invoice of invoices) {
    open = money(open + (num(invoice.total) - num(invoice.amountPaid)) * (num(invoice.exchangeRate) || 1));
  }
  const next = money(documentBase);
  if (open + next > limit + 0.0001) {
    return `Credit limit of ${limit.toFixed(2)} LKR is exceeded. Open balance ${open.toFixed(2)}, this document ${next.toFixed(2)}.`;
  }
  return null;
}

function ageBucket(date, today = new Date()) {
  const days = Math.floor((today.getTime() - new Date(date).getTime()) / 86400000);
  if (days > 120) return 'days120';
  if (days > 90) return 'days90';
  if (days > 60) return 'days60';
  if (days > 30) return 'days30';
  return 'current';
}

function emptyAging(id, name) {
  return {
    id,
    name,
    supplierName: name,
    customerName: name,
    outstanding: 0,
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    days120: 0
  };
}

async function salesTaxParts(db, { tenantId, customerId, productIds, subtotal }) {
  const customer = customerId
    ? await db.customer.findFirst({ where: { id: customerId, tenantId } })
    : null;
  let groupName = customer?.taxGroup || null;
  if (!groupName && productIds?.length) {
    const product = await db.product.findFirst({
      where: { tenantId, id: { in: productIds }, taxGroup: { not: null } }
    });
    groupName = product?.taxGroup || null;
  }
  const slabs = await slabsFor(db, tenantId, 'sales', groupName);
  return { customer, parts: applySlabs(subtotal, slabs) };
}

async function finalizeSalesInvoice(tx, { tenantId, invoiceId, createdBy }) {
  const invoice = await tx.salesInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { items: true, customer: true }
  });
  if (!invoice) throw new DocumentError('Invoice not found.');
  if (['DRAFT', 'PENDING', 'CANCELLED'].includes(String(invoice.status || '').toUpperCase())) return invoice;
  const existing = await tx.journalEntry.findFirst({
    where: {
      tenantId,
      referenceType: 'SALES_INVOICE',
      referenceId: invoice.id,
      description: { not: { startsWith: 'Reversal:' } }
    }
  });
  if (existing) return invoice;

  const subtotal = money(invoice.items.reduce((sum, item) => sum + num(item.quantity) * num(item.unitPrice), 0));
  const { customer, parts } = await salesTaxParts(tx, {
    tenantId,
    customerId: invoice.customerId,
    productIds: invoice.items.map((item) => item.productId),
    subtotal
  });
  const vat = sumBucket(parts, 'VAT');
  const sscl = sumBucket(parts, 'SSCL');
  const taxAmount = money(vat + sscl);
  const total = money(subtotal + taxAmount);
  const rate = rateOf(invoice.exchangeRate);
  const dueDate = invoice.dueDate || (customer?.creditPeriod ? addDays(invoice.date, customer.creditPeriod) : null);
  const updated = await tx.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      subtotal: dec(subtotal),
      taxAmount: dec(taxAmount),
      total: dec(total),
      dueDate
    },
    include: { items: true, customer: true, currency: true }
  });

  const map = await ensureGlMap(tx, tenantId, createdBy);
  const lines = [
    { accountId: map.AR, debit: money(total * rate), credit: 0, description: invoice.invoiceNumber },
    { accountId: map.REVENUE, debit: 0, credit: money(subtotal * rate), description: invoice.invoiceNumber }
  ];
  if (vat > 0) lines.push({ accountId: parts.find((part) => part.bucket === 'VAT')?.accountId || map.VAT_OUTPUT, debit: 0, credit: money(vat * rate), description: 'VAT output' });
  if (sscl > 0) lines.push({ accountId: parts.find((part) => part.bucket === 'SSCL')?.accountId || map.SSCL, debit: 0, credit: money(sscl * rate), description: 'SSCL' });
  await postJournal(tx, {
    tenantId,
    date: invoice.date,
    createdBy,
    description: `Sales invoice ${invoice.invoiceNumber}`,
    referenceType: 'SALES_INVOICE',
    referenceId: invoice.id,
    lines
  });
  return updated;
}

function withinPrice(actual, expected, tolerance) {
  const allowed = Math.max(Math.abs(expected) * (tolerance || 0), 0.0001);
  return Math.abs(money(actual) - money(expected)) <= allowed + 0.0001;
}

async function createSupplierInvoice(tx, input) {
  const {
    tenantId, supplierId, poId, grnId, date, supplierReference, currencyId,
    exchangeRate, items, priceTolerance = 0.02, qtyTolerance = 0, createdBy
  } = input;
  if (!poId && !grnId) {
    throw new DocumentError('Link a goods receipt or a purchase order.', {
      grnId: 'Link a goods receipt or a purchase order.'
    });
  }
  const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new DocumentError('Supplier is required.', { supplierId: 'Supplier is required.' });

  let po = null;
  if (poId) {
    po = await tx.purchaseOrder.findFirst({ where: { id: poId, tenantId }, include: { items: true } });
    if (!po) throw new DocumentError('Purchase order not found.', { poId: 'Purchase order not found.' });
  }
  let grn = null;
  if (grnId) {
    grn = await tx.gRN.findFirst({ where: { id: grnId, tenantId }, include: { items: true, purchaseOrder: { include: { items: true } } } });
    if (!grn) throw new DocumentError('Goods receipt not found.', { grnId: 'Goods receipt not found.' });
    if (!po && grn.poId) po = grn.purchaseOrder;
  }

  const received = {};
  const grnCost = {};
  const grns = grn
    ? [grn]
    : await tx.gRN.findMany({
      where: { tenantId, poId: po.id, status: { not: 'CANCELLED' } },
      include: { items: true }
    });
  for (const note of grns) {
    const noteRate = rateOf(note.exchangeRate);
    for (const item of note.items) {
      received[item.productId] = money((received[item.productId] || 0) + num(item.quantityReceived));
      if (grnCost[item.productId] == null) grnCost[item.productId] = money(num(item.unitPrice) * noteRate);
    }
  }

  const priorWhere = {
    tenantId,
    status: { not: 'CANCELLED' },
    ...(grnId ? { grnId } : { poId: po.id })
  };
  const priorInvoices = await tx.supplierInvoice.findMany({ where: priorWhere, include: { items: true } });
  const invoiced = {};
  for (const invoice of priorInvoices) {
    for (const item of invoice.items) invoiced[item.productId] = money((invoiced[item.productId] || 0) + num(item.quantity));
  }

  const poPrice = {};
  for (const item of po?.items || []) poPrice[item.productId] = num(item.unitPrice);

  const rate = rateOf(exchangeRate || grn?.exchangeRate || po?.exchangeRate || 1);
  const prepared = [];
  for (const item of items) {
    const qty = money(item.quantity);
    if (qty <= 0) {
      throw new DocumentError('Quantity must be greater than zero.', { quantity: 'Quantity must be greater than zero.' });
    }
    const receiptUnit = grnCost[item.productId] > 0 ? money(grnCost[item.productId] / rate) : null;
    const expected = poPrice[item.productId] != null ? poPrice[item.productId] : (receiptUnit != null ? receiptUnit : num(item.unitPrice));
    const unitPrice = item.unitPrice != null && item.unitPrice !== '' ? money(item.unitPrice) : money(expected);
    if (!withinPrice(unitPrice, expected, priceTolerance)) {
      throw new DocumentError(`Invoice price ${unitPrice} differs from ${money(expected)}.`, {
        unitPrice: `Invoice price ${unitPrice} differs from ${money(expected)}.`
      });
    }
    await assertWithinOrdered('Invoice', received[item.productId] || 0, invoiced[item.productId] || 0, qty, qtyTolerance, 'quantity');
    prepared.push({
      productId: item.productId,
      quantity: qty,
      unitPrice,
      poUnitPrice: money(expected),
      total: money(qty * unitPrice),
      baseReceiptCost: grnCost[item.productId] != null ? grnCost[item.productId] : money(expected * rate)
    });
  }

  const subtotal = money(prepared.reduce((sum, item) => sum + item.total, 0));
  const purchaseParts = applySlabs(subtotal, await slabsFor(tx, tenantId, 'purchase', supplier.taxGroup));
  const whtParts = applySlabs(subtotal, await slabsFor(tx, tenantId, 'wht', supplier.withholdingTaxGroup));
  const vat = sumBucket(purchaseParts, 'VAT');
  const sscl = sumBucket(purchaseParts, 'SSCL');
  const whtAmount = money(whtParts.reduce((sum, part) => sum + part.amount, 0));
  const taxAmount = money(vat + sscl);
  const total = money(subtotal + taxAmount - whtAmount);
  const dueDate = supplier.creditPeriod ? addDays(date, supplier.creditPeriod) : null;

  const { generateDocumentNumber } = require('../utils/codeGenerator');
  const invoiceNumber = await generateDocumentNumber(tenantId, 'supplierInvoice', 'SINV', 'invoiceNumber', tx);
  const invoice = await tx.supplierInvoice.create({
    data: {
      tenantId,
      supplierId,
      poId: po?.id || poId || null,
      grnId: grnId || null,
      invoiceNumber,
      supplierReference: supplierReference || null,
      date: new Date(date),
      dueDate,
      status: 'UNPAID',
      currencyId: currencyId || grn?.currencyId || po?.currencyId || null,
      exchangeRate: rate,
      subtotal: dec(subtotal),
      taxAmount: dec(taxAmount),
      whtAmount: dec(whtAmount),
      total: dec(total),
      createdBy: createdBy || null,
      items: {
        create: prepared.map((item) => ({
          productId: item.productId,
          quantity: dec(item.quantity),
          unitPrice: dec(item.unitPrice),
          poUnitPrice: dec(item.poUnitPrice),
          total: dec(item.total)
        }))
      }
    },
    include: { items: true, supplier: true, currency: true, grn: true, purchaseOrder: true }
  });

  let grni = 0;
  let goodsBase = 0;
  for (const item of prepared) {
    grni = money(grni + item.quantity * item.baseReceiptCost);
    goodsBase = money(goodsBase + item.total * rate);
  }
  const variance = money(goodsBase - grni);
  const map = await ensureGlMap(tx, tenantId, createdBy);
  const lines = [
    { accountId: map.GRNI, debit: grni, credit: 0, description: invoiceNumber }
  ];
  if (variance > 0) lines.push({ accountId: map.PPV, debit: variance, credit: 0, description: 'Purchase price variance' });
  if (variance < 0) lines.push({ accountId: map.PPV, debit: 0, credit: Math.abs(variance), description: 'Purchase price variance' });
  if (vat > 0) lines.push({ accountId: purchaseParts.find((part) => part.bucket === 'VAT')?.accountId || map.VAT_INPUT, debit: money(vat * rate), credit: 0, description: 'VAT input' });
  if (sscl > 0) lines.push({ accountId: purchaseParts.find((part) => part.bucket === 'SSCL')?.accountId || map.SSCL, debit: money(sscl * rate), credit: 0, description: 'SSCL' });
  if (whtAmount > 0) lines.push({ accountId: whtParts.find((part) => part.accountId)?.accountId || map.WHT, debit: 0, credit: money(whtAmount * rate), description: 'WHT' });
  lines.push({ accountId: map.AP, debit: 0, credit: money(total * rate), description: invoiceNumber });
  await postJournal(tx, {
    tenantId,
    date,
    createdBy,
    description: `Supplier invoice ${invoiceNumber}`,
    referenceType: 'SUPPLIER_INVOICE',
    referenceId: invoice.id,
    lines
  });

  return { ...invoice, matchStatus: Math.abs(variance) > 0.0001 ? 'MATCHED_WITH_VARIANCE' : 'MATCHED' };
}

async function syncSalesInvoiceStatus(tx, invoiceId) {
  const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === 'CANCELLED') return;
  const paid = num(invoice.amountPaid);
  const total = num(invoice.total);
  const status = paid <= 0.0001 ? 'UNPAID' : paid + 0.0001 >= total ? 'PAID' : 'PARTIAL';
  await tx.salesInvoice.update({ where: { id: invoiceId }, data: { status } });
}

async function syncSupplierInvoiceStatus(tx, invoiceId) {
  const invoice = await tx.supplierInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === 'CANCELLED') return;
  const paid = num(invoice.amountPaid);
  const total = num(invoice.total);
  const status = paid <= 0.0001 ? 'UNPAID' : paid + 0.0001 >= total ? 'PAID' : 'PARTIAL';
  await tx.supplierInvoice.update({ where: { id: invoiceId }, data: { status } });
}

async function allocateCustomerReceipt(tx, { tenantId, receipt, allocations, createdBy }) {
  if (!allocations.length) return;
  const invoices = [];
  const currencyIds = new Set();
  for (const allocation of allocations) {
    const invoice = await tx.salesInvoice.findFirst({ where: { id: allocation.invoiceId, tenantId } });
    if (!invoice || invoice.status === 'CANCELLED') {
      throw new DocumentError('Invoice not found.', { invoiceId: 'Invoice not found.' });
    }
    if (invoice.customerId !== receipt.customerId) {
      throw new DocumentError('Invoice belongs to a different customer.', { invoiceId: 'Invoice belongs to a different customer.' });
    }
    currencyIds.add(invoice.currencyId || '');
    const outstanding = money(num(invoice.total) - num(invoice.amountPaid));
    if (allocation.amount - outstanding > 0.0001) {
      throw new DocumentError('Allocation exceeds the invoice balance.', { amount: 'Allocation exceeds the invoice balance.' });
    }
    invoices.push({ invoice, amount: allocation.amount });
  }
  if (currencyIds.size > 1) {
    throw new DocumentError('Allocate invoices that share one currency.', { currencyId: 'Allocate invoices that share one currency.' });
  }
  const map = await ensureGlMap(tx, tenantId, createdBy);
  let base = 0;
  for (const row of invoices) {
    await tx.salesInvoice.update({
      where: { id: row.invoice.id },
      data: { amountPaid: dec(money(num(row.invoice.amountPaid) + row.amount)) }
    });
    await syncSalesInvoiceStatus(tx, row.invoice.id);
    await tx.paymentReceiptLine.create({
      data: {
        receiptId: receipt.id,
        accountId: map.AR,
        invoiceId: row.invoice.id,
        amount: dec(row.amount),
        description: 'Allocated to invoice'
      }
    });
    base = money(base + row.amount * (num(row.invoice.exchangeRate) || 1));
  }
  const bankAccount = receipt.accountId || map[receipt.method === 'CASH' ? 'CASH' : 'BANK'];
  const cashBase = money(invoices.reduce((sum, row) => sum + row.amount * rateOf(receipt.exchangeRate), 0));
  const fx = money(cashBase - base);
  await postJournal(tx, {
    tenantId,
    date: receipt.date,
    createdBy,
    description: `Customer receipt ${receipt.receiptNumber}`,
    referenceType: 'PAYMENT_RECEIPT',
    referenceId: receipt.id,
    lines: [
      { accountId: bankAccount, debit: cashBase, credit: 0, description: receipt.receiptNumber },
      { accountId: map.AR, debit: 0, credit: base, description: receipt.receiptNumber },
      { accountId: map.FX_GAIN, debit: 0, credit: fx > 0 ? fx : 0, description: 'Realised FX gain' },
      { accountId: map.FX_LOSS, debit: fx < 0 ? Math.abs(fx) : 0, credit: 0, description: 'Realised FX loss' }
    ]
  });
}

async function allocateSupplierPayment(tx, { tenantId, voucher, allocations, createdBy }) {
  if (!allocations.length) return;
  const invoices = [];
  const currencyIds = new Set();
  for (const allocation of allocations) {
    const invoice = await tx.supplierInvoice.findFirst({ where: { id: allocation.supplierInvoiceId, tenantId } });
    if (!invoice || invoice.status === 'CANCELLED') {
      throw new DocumentError('Supplier invoice not found.', { supplierInvoiceId: 'Supplier invoice not found.' });
    }
    if (invoice.supplierId !== voucher.supplierId) {
      throw new DocumentError('Invoice belongs to a different supplier.', { supplierInvoiceId: 'Invoice belongs to a different supplier.' });
    }
    currencyIds.add(invoice.currencyId || '');
    const outstanding = money(num(invoice.total) - num(invoice.amountPaid));
    if (allocation.amount - outstanding > 0.0001) {
      throw new DocumentError('Allocation exceeds the invoice balance.', { amount: 'Allocation exceeds the invoice balance.' });
    }
    invoices.push({ invoice, amount: allocation.amount });
  }
  if (currencyIds.size > 1) {
    throw new DocumentError('Allocate invoices that share one currency.', { currencyId: 'Allocate invoices that share one currency.' });
  }
  let base = 0;
  const settled = [];
  for (const row of invoices) {
    await tx.supplierInvoice.update({
      where: { id: row.invoice.id },
      data: { amountPaid: dec(money(num(row.invoice.amountPaid) + row.amount)) }
    });
    await syncSupplierInvoiceStatus(tx, row.invoice.id);
    await tx.supplierPaymentAllocation.create({
      data: {
        tenantId,
        voucherId: voucher.id,
        supplierInvoiceId: row.invoice.id,
        amount: dec(row.amount)
      }
    });
    base = money(base + row.amount * (num(row.invoice.exchangeRate) || 1));
    settled.push({ invoice: row.invoice, amount: row.amount, invRate: num(row.invoice.exchangeRate) || 1 });
  }
  const supplier = await tx.supplier.findFirst({ where: { id: voucher.supplierId, tenantId } });
  const slabs = await slabsFor(tx, tenantId, 'wht', supplier?.withholdingTaxGroup);
  const voucherRate = rateOf(voucher.exchangeRate);
  let whtForeign = 0;
  let invoiceWhtForeign = 0;
  let whtBase = 0;
  let netCash = 0;
  let whtAccount = null;
  for (const row of settled) {
    const invoiceTotal = num(row.invoice.total);
    const already = num(row.invoice.whtAmount);
    const attributed = already > 0 && invoiceTotal > 0 ? money(already * (row.amount / invoiceTotal)) : 0;
    const parts = attributed > 0 ? [] : applySlabs(row.amount, slabs);
    const withheld = money(parts.reduce((sum, part) => sum + part.amount, 0));
    if (!whtAccount) whtAccount = parts.find((part) => part.accountId)?.accountId || null;
    whtForeign = money(whtForeign + withheld);
    invoiceWhtForeign = money(invoiceWhtForeign + attributed);
    whtBase = money(whtBase + withheld * row.invRate);
    netCash = money(netCash + (row.amount - withheld) * voucherRate);
  }
  const map = await ensureGlMap(tx, tenantId, createdBy);
  const bankAccount = voucher.accountId || map[voucher.method === 'CASH' ? 'CASH' : 'BANK'];
  const fx = money(netCash - (base - whtBase));
  await postJournal(tx, {
    tenantId,
    date: voucher.date,
    createdBy,
    description: `Supplier payment ${voucher.voucherNumber}`,
    referenceType: 'PAYMENT_VOUCHER',
    referenceId: voucher.id,
    lines: [
      { accountId: map.AP, debit: base, credit: 0, description: voucher.voucherNumber },
      { accountId: bankAccount, debit: 0, credit: netCash, description: voucher.voucherNumber },
      { accountId: whtAccount || map.WHT, debit: 0, credit: whtBase, description: 'WHT' },
      { accountId: map.FX_LOSS, debit: fx > 0 ? fx : 0, credit: 0, description: 'Realised FX loss' },
      { accountId: map.FX_GAIN, debit: 0, credit: fx < 0 ? Math.abs(fx) : 0, description: 'Realised FX gain' }
    ]
  });

  const gross = money(settled.reduce((sum, row) => sum + row.amount, 0));
  const whtTotal = money(whtForeign + invoiceWhtForeign);
  if (whtTotal > 0) {
    const slabRate = slabs.length === 1
      ? num(slabs[0].rate)
      : money(whtTotal / Math.max(gross, 0.0001) * 100);
    await tx.paymentVoucher.update({
      where: { id: voucher.id },
      data: { whtAmount: dec(whtTotal), whtRate: dec(slabRate) }
    });
    const { generateDocumentNumber } = require('../utils/codeGenerator');
    const certificateNumber = await generateDocumentNumber(tenantId, 'whtCertificate', 'WHT', 'certificateNumber', tx);
    await tx.whtCertificate.create({
      data: {
        tenantId,
        certificateNumber,
        voucherId: voucher.id,
        supplierId: voucher.supplierId,
        date: voucher.date,
        grossAmount: dec(gross),
        whtRate: dec(slabRate),
        whtAmount: dec(whtTotal),
        paymentWht: dec(whtForeign),
        invoiceWht: dec(invoiceWhtForeign),
        netPaid: dec(money(gross - whtForeign))
      }
    });
  }
}

async function customerAging(db, tenantId) {
  const invoices = await db.salesInvoice.findMany({
    where: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } },
    include: { customer: true }
  });
  const rows = new Map();
  for (const invoice of invoices) {
    const open = money((num(invoice.total) - num(invoice.amountPaid)) * (num(invoice.exchangeRate) || 1));
    if (open <= 0.0001) continue;
    const name = invoice.customer ? `${invoice.customer.code} - ${invoice.customer.name}` : 'Customer';
    if (!rows.has(invoice.customerId)) rows.set(invoice.customerId, emptyAging(invoice.customerId, name));
    const row = rows.get(invoice.customerId);
    const bucket = ageBucket(invoice.dueDate || invoice.date);
    row[bucket] = money(row[bucket] + open);
    row.outstanding = money(row.outstanding + open);
  }
  return [...rows.values()].filter((row) => row.outstanding > 0.01);
}

async function supplierAging(db, tenantId) {
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, status: { notIn: ['CANCELLED'] } },
    include: { supplier: true }
  });
  const rows = new Map();
  for (const invoice of invoices) {
    const open = money((num(invoice.total) - num(invoice.amountPaid)) * (num(invoice.exchangeRate) || 1));
    if (open <= 0.0001) continue;
    const name = invoice.supplier ? `${invoice.supplier.code} - ${invoice.supplier.name}` : 'Supplier';
    if (!rows.has(invoice.supplierId)) rows.set(invoice.supplierId, emptyAging(invoice.supplierId, name));
    const row = rows.get(invoice.supplierId);
    const bucket = ageBucket(invoice.dueDate || invoice.date);
    row[bucket] = money(row[bucket] + open);
    row.outstanding = money(row.outstanding + open);
  }
  return [...rows.values()].filter((row) => row.outstanding > 0.01);
}

function runningStatement(lines) {
  let balance = 0;
  return lines
    .sort((a, b) => new Date(a.date) - new Date(b.date) || a.document.localeCompare(b.document))
    .map((line) => {
      balance = money(balance + line.charge - line.payment);
      return { ...line, balance };
    });
}

async function customerStatement(db, tenantId, customerId) {
  const customer = await db.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) return null;
  const invoices = await db.salesInvoice.findMany({
    where: { tenantId, customerId, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }
  });
  const receipts = await db.paymentReceipt.findMany({
    where: { tenantId, customerId, status: { not: 'CANCELLED' } },
    include: { lines: true }
  });
  const lines = [];
  for (const invoice of invoices) {
    const rate = num(invoice.exchangeRate) || 1;
    lines.push({
      date: invoice.date,
      document: 'Invoice',
      number: invoice.invoiceNumber,
      charge: money(num(invoice.total) * rate),
      payment: 0
    });
  }
  for (const receipt of receipts) {
    const allocated = receipt.lines.filter((line) => line.invoiceId);
    if (allocated.length) {
      for (const line of allocated) {
        const invoice = invoices.find((row) => row.id === line.invoiceId);
        const rate = invoice ? (num(invoice.exchangeRate) || 1) : (num(receipt.exchangeRate) || 1);
        lines.push({
          date: receipt.date,
          document: 'Receipt',
          number: receipt.receiptNumber,
          charge: 0,
          payment: money(num(line.amount) * rate)
        });
      }
    }
  }
  const statement = runningStatement(lines);
  return {
    party: { id: customer.id, code: customer.code, name: customer.name },
    lines: statement,
    balance: statement.length ? statement[statement.length - 1].balance : 0
  };
}

async function supplierStatement(db, tenantId, supplierId) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) return null;
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, supplierId, status: { not: 'CANCELLED' } }
  });
  const vouchers = await db.paymentVoucher.findMany({
    where: { tenantId, supplierId, status: { not: 'CANCELLED' } },
    include: { allocations: true }
  });
  const lines = [];
  for (const invoice of invoices) {
    const rate = num(invoice.exchangeRate) || 1;
    lines.push({
      date: invoice.date,
      document: 'Invoice',
      number: invoice.invoiceNumber,
      charge: money(num(invoice.total) * rate),
      payment: 0
    });
  }
  for (const voucher of vouchers) {
    for (const allocation of voucher.allocations) {
      const invoice = invoices.find((row) => row.id === allocation.supplierInvoiceId);
      const rate = invoice ? (num(invoice.exchangeRate) || 1) : 1;
      lines.push({
        date: voucher.date,
        document: 'Payment',
        number: voucher.voucherNumber,
        charge: 0,
        payment: money(num(allocation.amount) * rate)
      });
    }
  }
  const statement = runningStatement(lines);
  return {
    party: { id: supplier.id, code: supplier.code, name: supplier.name },
    lines: statement,
    balance: statement.length ? statement[statement.length - 1].balance : 0
  };
}

module.exports = {
  postReceiptDocument,
  postIssueDocument,
  postAdjustmentDocument,
  postTransferDocument,
  cancelStockAndJournal,
  refreshPoReceiptStatus,
  postGrn,
  assertPrQuantity,
  refreshPrStatus,
  assertQuotationQuantity,
  refreshQuotationStatus,
  creditWarning,
  finalizeSalesInvoice,
  createSupplierInvoice,
  allocateCustomerReceipt,
  allocateSupplierPayment,
  syncSalesInvoiceStatus,
  syncSupplierInvoiceStatus,
  customerAging,
  supplierAging,
  customerStatement,
  supplierStatement
};
