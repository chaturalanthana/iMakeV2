const { DocumentError } = require('../errors');
const { num, dec, money } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { receive, issue } = require('../stockService');
const { receiveLayer } = require('../production/fifo');
const { postAdjustmentDocument, postIssueDocument, cancelStockAndJournal } = require('../documentPosting');
const { writeAudit } = require('../auditService');
const { loadRule, levelsForAmount, submitForApproval, cancelOpenRequests } = require('../approvalService');
const { reverseIssue, reverseReceipt } = require('../stockService');
const { itemUsable } = require('./itemMaster');
const { recordBatch, assertConsumable, suggestPicks, productWithType } = require('./batches');
const { syncHard, consumeSource } = require('./allocations');
const { bookQty, positionReport, inTransitQty } = require('./positions');
const { movementEffect } = require('../stockService');

const RETURN_KINDS = ['MARKET', 'DAMAGE', 'GRA', 'SUPPLIER'];

function requireItems(items) {
  const rows = (items || []).filter((item) => item && item.productId);
  if (!rows.length) throw new DocumentError('Add at least one product.', { items: 'Add at least one product.' });
  return rows;
}

async function assertWarehouse(db, tenantId, warehouseId, field = 'warehouseId') {
  if (!warehouseId) throw new DocumentError('Warehouse is required.', { [field]: 'Warehouse is required.' });
  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, tenantId } });
  if (!warehouse) throw new DocumentError('Unknown warehouse.', { [field]: 'Unknown warehouse.' });
  return warehouse;
}

async function assertBin(db, tenantId, warehouseId, binId) {
  if (!binId) return null;
  const bin = await db.bin.findFirst({ where: { id: binId, tenantId, warehouseId } });
  if (!bin || !bin.active) throw new DocumentError('Unknown bin for this warehouse.', { binId: 'Unknown bin for this warehouse.' });
  return bin;
}

async function assertPallet(db, tenantId, warehouseId, palletId) {
  if (!palletId) return null;
  const pallet = await db.pallet.findFirst({ where: { id: palletId, tenantId, warehouseId } });
  if (!pallet || pallet.status !== 'ACTIVE') {
    throw new DocumentError('Select an active pallet at this warehouse.', { palletId: 'Select an active pallet at this warehouse.' });
  }
  return pallet;
}

async function loadProduct(db, tenantId, productId) {
  const product = await productWithType(db, tenantId, productId);
  const reason = itemUsable(product);
  if (reason) throw new DocumentError(reason, { productId: reason });
  if (product.nonStock || product.type === 'SERVICE') {
    throw new DocumentError('Non-stock and service items are not received into a warehouse.', { productId: 'Non-stock and service items are not received into a warehouse.' });
  }
  return product;
}

async function postBatchReceipt(db, { tenantId, warehouseId, supplierId, items, date, createdBy, referenceType = 'BATCH_RECEIPT', referenceId }) {
  const warehouse = await assertWarehouse(db, tenantId, warehouseId);
  const rows = requireItems(items);
  const when = date ? new Date(date) : new Date();
  const posted = [];
  for (const item of rows) {
    const product = await loadProduct(db, tenantId, item.productId);
    const qty = money(item.quantity);
    if (!(qty > 0)) throw new DocumentError('Quantity must be greater than zero.', { quantity: 'Quantity must be greater than zero.' });
    const damaged = money(item.damagedQty || 0);
    const rejected = money(item.rejectedQty || 0);
    if (damaged + rejected - qty > 0.0001) {
      throw new DocumentError('Damaged and rejected quantities cannot exceed the receipt.', { damagedQty: 'Damaged and rejected quantities cannot exceed the receipt.' });
    }
    await assertBin(db, tenantId, warehouse.id, item.binId);
    if (warehouse.tracksPallets && item.palletId) await assertPallet(db, tenantId, warehouse.id, item.palletId);
    if (product.batchTracked && !String(item.lotNumber || '').trim()) {
      throw new DocumentError('Enter the batch or lot number.', { lotNumber: 'Enter the batch or lot number.' });
    }
    const batch = item.lotNumber ? await recordBatch(db, {
      tenantId,
      productId: product.id,
      lotNumber: item.lotNumber,
      expiryDate: item.expiryDate,
      supplierId,
      receiptDate: when,
      status: 'UNRESTRICTED'
    }) : null;
    const usable = money(qty - damaged - rejected);
    const slices = [];
    if (usable > 0) slices.push({ quantity: usable, stockStatus: item.stockStatus || 'UNRESTRICTED' });
    if (damaged > 0) slices.push({ quantity: damaged, stockStatus: 'QUARANTINE' });
    if (rejected > 0) slices.push({ quantity: rejected, stockStatus: 'BLOCKED' });
    for (const slice of slices) {
      const result = await receive(db, {
        tenantId,
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: slice.quantity,
        unitCost: item.unitCost != null ? item.unitCost : product.costPrice,
        referenceType,
        referenceId: referenceId || null,
        createdBy,
        receivedAt: when,
        lotNumber: batch?.lotNumber || item.lotNumber || null,
        batchId: batch?.id || null,
        binId: item.binId || null,
        palletId: item.palletId || null,
        stockStatus: slice.stockStatus,
        expiryDate: item.expiryDate || null
      });
      posted.push({ ...result, stockStatus: slice.stockStatus, batchId: batch?.id || null });
    }
  }
  return posted;
}

async function createMaterialRequest(db, input) {
  const kind = input.kind === 'TRANSFER' ? 'TRANSFER' : input.kind === 'ISSUE' ? 'ISSUE' : null;
  if (!kind) throw new DocumentError('Choose issue or transfer.', { kind: 'Choose issue or transfer.' });
  if (!String(input.requestingParty || '').trim()) {
    throw new DocumentError('Requesting party is required.', { requestingParty: 'Requesting party is required.' });
  }
  const source = await assertWarehouse(db, input.tenantId, input.sourceWarehouseId, 'sourceWarehouseId');
  let dest = null;
  if (kind === 'TRANSFER') {
    dest = await assertWarehouse(db, input.tenantId, input.destWarehouseId, 'destWarehouseId');
    if (dest.id === source.id) throw new DocumentError('Source and destination must differ.', { destWarehouseId: 'Source and destination must differ.' });
  }
  const rows = requireItems(input.items);
  for (const item of rows) {
    await loadProduct(db, input.tenantId, item.productId);
    if (!(num(item.quantity) > 0)) throw new DocumentError('Quantity must be greater than zero.', { quantity: 'Quantity must be greater than zero.' });
  }
  const number = await generateDocumentNumber(input.tenantId, 'materialRequest', 'MR', 'number', db);
  return db.materialRequest.create({
    data: {
      tenantId: input.tenantId,
      number,
      date: new Date(input.date),
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
      requestingParty: String(input.requestingParty).trim(),
      purpose: input.purpose || null,
      sourceWarehouseId: source.id,
      destWarehouseId: dest?.id || null,
      kind,
      status: 'DRAFT',
      approvalStatus: 'PENDING',
      createdBy: input.createdBy || null,
      items: {
        create: rows.map((item) => ({
          tenantId: input.tenantId,
          productId: item.productId,
          quantity: dec(item.quantity)
        }))
      }
    },
    include: mrInclude
  });
}

const mrInclude = {
  items: { include: { product: true } },
  sourceWarehouse: true,
  destWarehouse: true,
  pickLists: { include: { lines: true } }
};

function requireReason(reason) {
  const text = String(reason || '').trim();
  if (text.length < 3) throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  return text;
}

async function releaseMaterialRequest(db, { tenantId, id, userId }) {
  const mr = await db.materialRequest.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!mr) throw new DocumentError('Material request was not found.');
  if (!['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'].includes(mr.status)) {
    throw new DocumentError('This material request is already approved.');
  }
  await syncHard(db, {
    tenantId,
    sourceType: 'MATERIAL_REQUEST',
    sourceId: mr.id,
    lines: mr.items.map((item) => ({
      lineId: item.id,
      productId: item.productId,
      warehouseId: mr.sourceWarehouseId,
      quantity: item.quantity
    }))
  });
  const updated = await db.materialRequest.update({
    where: { id: mr.id },
    data: { status: 'APPROVED', approvalStatus: 'APPROVED' },
    include: mrInclude
  });
  await writeAudit(db, {
    tenantId,
    userId,
    action: 'APPROVE',
    entity: 'MATERIAL_REQUEST',
    entityId: mr.id,
    before: { status: mr.status },
    after: { status: 'APPROVED' }
  });
  return updated;
}

async function approveMaterialRequest(db, { tenantId, id, userId }) {
  const mr = await db.materialRequest.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!mr) throw new DocumentError('Material request was not found.');
  if (mr.status === 'PENDING_APPROVAL') {
    throw new DocumentError('This material request is waiting in the approvals worklist.');
  }
  if (!['DRAFT', 'SUBMITTED'].includes(mr.status)) {
    throw new DocumentError('This material request is already approved.');
  }
  const rule = await loadRule(db, tenantId, 'MATERIAL_REQUEST');
  const amount = mr.items.reduce((sum, item) => sum + num(item.quantity), 0);
  if (rule?.enabled && levelsForAmount(rule, amount).length) {
    await submitForApproval(db, {
      tenantId,
      documentType: 'MATERIAL_REQUEST',
      documentId: mr.id,
      documentNumber: mr.number,
      amount,
      userId
    });
    return db.materialRequest.update({
      where: { id: mr.id },
      data: { status: 'PENDING_APPROVAL', approvalStatus: 'PENDING' },
      include: mrInclude
    });
  }
  return releaseMaterialRequest(db, { tenantId, id, userId });
}

async function buildPickList(db, { tenantId, id }) {
  const mr = await db.materialRequest.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!mr) throw new DocumentError('Material request was not found.');
  if (!['APPROVED', 'PARTIAL'].includes(mr.status)) {
    throw new DocumentError('Approve the material request before picking.');
  }
  const number = await generateDocumentNumber(tenantId, 'pickList', 'PK', 'number', db);
  const lines = [];
  for (const item of mr.items) {
    const open = Math.max(0, num(item.quantity) - num(item.fulfilledQty));
    if (!(open > 0)) continue;
    const suggestion = await suggestPicks(db, tenantId, {
      productId: item.productId,
      warehouseId: mr.sourceWarehouseId,
      quantity: open
    });
    suggestion.suggestions.forEach((row) => {
      lines.push({
        tenantId,
        productId: item.productId,
        batchId: row.batchId,
        palletId: row.palletId,
        suggestedQty: dec(row.quantity),
        confirmedQty: dec(row.quantity)
      });
    });
  }
  if (!lines.length) throw new DocumentError('No eligible stock to pick.');
  return db.pickList.create({
    data: { tenantId, mrId: mr.id, number, status: 'DRAFT', lines: { create: lines } },
    include: { lines: { include: { product: true } }, mr: true }
  });
}

async function fulfilMaterialRequest(db, { tenantId, id, lines, userId }) {
  const mr = await db.materialRequest.findFirst({ where: { id, tenantId }, include: { items: true, sourceWarehouse: true } });
  if (!mr) throw new DocumentError('Material request was not found.');
  if (!['APPROVED', 'PARTIAL'].includes(mr.status)) throw new DocumentError('Approve the material request before fulfilment.');
  const requested = requireItems(lines);
  for (const line of requested) {
    const item = mr.items.find((row) => row.productId === line.productId);
    if (!item) throw new DocumentError('That item is not on the material request.', { productId: 'That item is not on the material request.' });
    const open = num(item.quantity) - num(item.fulfilledQty);
    if (num(line.quantity) - open > 0.0001) {
      throw new DocumentError('Fulfilment cannot exceed the open quantity.', { quantity: 'Fulfilment cannot exceed the open quantity.' });
    }
    const product = await productWithType(db, tenantId, line.productId);
    let batch = null;
    if (line.batchId) {
      batch = await db.stockBatch.findFirst({ where: { id: line.batchId, tenantId, productId: line.productId } });
      if (!batch) throw new DocumentError('Unknown batch.', { batchId: 'Unknown batch.' });
    }
    await assertConsumable(db, tenantId, product, batch);
  }
  if (mr.kind === 'TRANSFER') {
    await shipTransfer(db, {
      tenantId,
      fromWarehouseId: mr.sourceWarehouseId,
      toWarehouseId: mr.destWarehouseId,
      mrId: mr.id,
      mode: 'IMMEDIATE',
      date: new Date(),
      reason: mr.purpose || mr.number,
      createdBy: userId,
      items: requested
    });
  } else {
    await postIssueDocument(db, {
      tenantId,
      warehouseId: mr.sourceWarehouseId,
      referenceType: 'MR',
      referenceId: mr.id,
      date: new Date(),
      createdBy: userId,
      description: `Material request ${mr.number}`,
      items: requested.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        batchId: line.batchId || null,
        eligibleOnly: true
      }))
    });
  }
  await consumeSource(db, {
    tenantId,
    sourceType: 'MATERIAL_REQUEST',
    sourceId: mr.id,
    lines: requested
  });
  for (const line of requested) {
    const item = mr.items.find((row) => row.productId === line.productId);
    await db.materialRequestItem.update({
      where: { id: item.id },
      data: { fulfilledQty: dec(num(item.fulfilledQty) + num(line.quantity)) }
    });
  }
  const fresh = await db.materialRequest.findFirst({ where: { id: mr.id }, include: { items: true } });
  const done = fresh.items.every((item) => num(item.fulfilledQty) + 0.00005 >= num(item.quantity));
  return db.materialRequest.update({
    where: { id: mr.id },
    data: { status: done ? 'FULFILLED' : 'PARTIAL' },
    include: mrInclude
  });
}

async function createTransfer(db, input) {
  const mode = input.mode === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'IMMEDIATE';
  const from = await assertWarehouse(db, input.tenantId, input.fromWarehouseId, 'fromWarehouseId');
  const to = await assertWarehouse(db, input.tenantId, input.toWarehouseId, 'toWarehouseId');
  if (from.id === to.id) throw new DocumentError('Source and destination must differ.', { toWarehouseId: 'Source and destination must differ.' });
  const rows = requireItems(input.items);
  const number = await generateDocumentNumber(input.tenantId, 'inventoryTransfer', 'GT', 'number', db);
  const transfer = await db.inventoryTransfer.create({
    data: {
      tenantId: input.tenantId,
      number,
      date: new Date(input.date),
      fromWarehouseId: from.id,
      toWarehouseId: to.id,
      mrId: input.mrId || null,
      mode,
      status: 'DRAFT',
      reason: input.reason || null,
      createdBy: input.createdBy || null,
      items: {
        create: rows.map((item) => ({
          tenantId: input.tenantId,
          productId: item.productId,
          quantity: dec(item.quantity),
          batchId: item.batchId || null,
          palletId: item.palletId || null
        }))
      }
    },
    include: transferInclude
  });
  if (input.post) return shipTransfer(db, { ...input, id: transfer.id });
  return transfer;
}

const transferInclude = {
  items: { include: { product: true } },
  fromWarehouse: true,
  toWarehouse: true,
  legs: true
};

async function moveSlice(db, { tenantId, productId, fromWarehouseId, toWarehouseId, quantity, batchId, palletId, referenceId, createdBy, date, holdInTransit }) {
  const issued = await issue(db, {
    tenantId,
    productId,
    warehouseId: fromWarehouseId,
    quantity,
    referenceType: 'GT',
    referenceId,
    createdBy,
    batchId: batchId || null,
    eligibleOnly: true,
    lotNumber: null
  });
  if (issued.consumptions.some((row) => row.unlayered)) {
    throw new DocumentError('Not enough unrestricted stock to transfer this quantity.', { quantity: 'Not enough unrestricted stock to transfer this quantity.' });
  }
  const legs = [];
  for (const row of issued.consumptions) {
    if (holdInTransit) {
      legs.push(await db.inventoryTransferLeg.create({
        data: {
          tenantId,
          transferId: referenceId,
          productId,
          batchId: batchId || null,
          palletId: palletId || null,
          quantity: dec(row.quantity),
          quantityRemaining: dec(row.quantity),
          unitCost: dec(row.unitCost)
        }
      }));
    } else {
      await receive(db, {
        tenantId,
        productId,
        warehouseId: toWarehouseId,
        quantity: row.quantity,
        unitCost: row.unitCost,
        referenceType: 'GT',
        referenceId,
        createdBy,
        receivedAt: date,
        batchId: batchId || null,
        palletId: palletId || null,
        lotNumber: null
      });
      legs.push(row);
    }
  }
  return { issued, legs };
}

async function shipTransfer(db, input) {
  const existing = input.id
    ? await db.inventoryTransfer.findFirst({ where: { id: input.id, tenantId: input.tenantId }, include: { items: true } })
    : null;
  const transfer = existing || await createTransfer(db, { ...input, post: false });
  if (!['DRAFT'].includes(transfer.status)) throw new DocumentError('This transfer has already left the source warehouse.');
  const mode = input.mode || transfer.mode;
  const items = (input.items && input.items.length ? input.items : transfer.items);
  for (const item of items) {
    await moveSlice(db, {
      tenantId: input.tenantId,
      productId: item.productId,
      fromWarehouseId: transfer.fromWarehouseId,
      toWarehouseId: transfer.toWarehouseId,
      quantity: item.quantity,
      batchId: item.batchId,
      palletId: item.palletId,
      referenceId: transfer.id,
      createdBy: input.createdBy,
      date: input.date || transfer.date,
      holdInTransit: mode === 'IN_TRANSIT'
    });
  }
  const posted = await db.inventoryTransfer.update({
    where: { id: transfer.id },
    data: { status: mode === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'POSTED', mode },
    include: transferInclude
  });
  await writeAudit(db, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'POST',
    entity: 'INVENTORY_TRANSFER',
    entityId: transfer.id,
    before: { status: transfer.status },
    after: { status: posted.status }
  });
  return posted;
}

async function cancelTransfer(db, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const transfer = await db.inventoryTransfer.findFirst({ where: { id, tenantId } });
  if (!transfer) throw new DocumentError('Transfer was not found.');
  if (transfer.status === 'CANCELLED') throw new DocumentError('This transfer is already cancelled.');
  if (transfer.status === 'RECEIVED' || transfer.status === 'POSTED') {
    await reverseReceipt(db, { tenantId, referenceType: 'GT', referenceId: id, createdBy });
  }
  if (transfer.status !== 'DRAFT') {
    await reverseIssue(db, { tenantId, referenceType: 'GT', referenceId: id, createdBy });
    await db.inventoryTransferLeg.updateMany({ where: { transferId: id }, data: { quantityRemaining: dec(0) } });
  }
  const updated = await db.inventoryTransfer.update({
    where: { id },
    data: { status: 'CANCELLED', reason: text },
    include: transferInclude
  });
  await writeAudit(db, {
    tenantId,
    userId: createdBy,
    action: transfer.status === 'DRAFT' ? 'STATUS' : 'REVERSE',
    entity: 'INVENTORY_TRANSFER',
    entityId: id,
    before: { status: transfer.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function receiveTransfer(db, { tenantId, id, createdBy }) {
  const transfer = await db.inventoryTransfer.findFirst({
    where: { id, tenantId },
    include: { legs: true }
  });
  if (!transfer) throw new DocumentError('Transfer was not found.');
  if (transfer.status !== 'IN_TRANSIT') throw new DocumentError('Only in-transit transfers can be received.');
  for (const leg of transfer.legs) {
    if (!(num(leg.quantityRemaining) > 0)) continue;
    await receiveLayer(db, {
      tenantId,
      productId: leg.productId,
      warehouseId: transfer.toWarehouseId,
      quantity: num(leg.quantityRemaining),
      unitCost: num(leg.unitCost),
      sourceType: 'GT',
      sourceId: transfer.id,
      batchId: leg.batchId,
      palletId: leg.palletId,
      receivedAt: new Date()
    });
    await db.stockMovement.create({
      data: {
        tenantId,
        productId: leg.productId,
        type: 'GR',
        quantity: dec(leg.quantityRemaining),
        unitCost: dec(leg.unitCost),
        value: dec(num(leg.quantityRemaining) * num(leg.unitCost)),
        referenceType: 'GT',
        referenceId: transfer.id,
        warehouseId: transfer.toWarehouseId,
        batchId: leg.batchId,
        createdBy: createdBy || null
      }
    });
    await db.inventoryTransferLeg.update({
      where: { id: leg.id },
      data: { quantityRemaining: dec(0) }
    });
  }
  return db.inventoryTransfer.update({
    where: { id: transfer.id },
    data: { status: 'RECEIVED' },
    include: transferInclude
  });
}

function dispositionFor(kind, requested) {
  if (kind === 'MARKET') return 'QUARANTINE';
  if (kind === 'SUPPLIER') return 'SUPPLIER';
  if (kind === 'GRA') return requested || 'QUARANTINE';
  if (kind === 'DAMAGE') {
    if (!['QUARANTINE', 'SCRAP'].includes(requested)) {
      throw new DocumentError('Damage returns go to quarantine or scrap.', { disposition: 'Damage returns go to quarantine or scrap.' });
    }
    return requested;
  }
  throw new DocumentError('Unknown return type.', { kind: 'Unknown return type.' });
}

async function createReturn(db, input) {
  if (!RETURN_KINDS.includes(input.kind)) throw new DocumentError('Unknown return type.', { kind: 'Unknown return type.' });
  const warehouse = await assertWarehouse(db, input.tenantId, input.warehouseId);
  if (input.kind === 'SUPPLIER' && !input.supplierId) {
    throw new DocumentError('Supplier is required.', { supplierId: 'Supplier is required.' });
  }
  if (input.kind !== 'SUPPLIER' && !input.customerId) {
    throw new DocumentError('Customer is required.', { customerId: 'Customer is required.' });
  }
  const rows = requireItems(input.items);
  const number = await generateDocumentNumber(input.tenantId, 'stockReturn', 'RTN', 'number', db);
  const items = rows.map((item) => {
    if (!String(item.reason || '').trim()) throw new DocumentError('Each return line needs a reason.', { reason: 'Each return line needs a reason.' });
    if (!(num(item.quantity) > 0)) throw new DocumentError('Quantity must be greater than zero.', { quantity: 'Quantity must be greater than zero.' });
    return {
      tenantId: input.tenantId,
      productId: item.productId,
      quantity: dec(item.quantity),
      batchId: item.batchId || null,
      reason: String(item.reason).trim(),
      disposition: dispositionFor(input.kind, item.disposition),
      unitCost: dec(item.unitCost || 0)
    };
  });
  const created = await db.stockReturn.create({
    data: {
      tenantId: input.tenantId,
      number,
      date: new Date(input.date),
      kind: input.kind,
      customerId: input.customerId || null,
      supplierId: input.supplierId || null,
      warehouseId: warehouse.id,
      reference: input.reference || null,
      status: 'DRAFT',
      createdBy: input.createdBy || null,
      items: { create: items }
    },
    include: returnInclude
  });
  if (input.post) return postReturn(db, { tenantId: input.tenantId, id: created.id, createdBy: input.createdBy });
  return created;
}

const returnInclude = { items: { include: { product: true } }, customer: true, supplier: true, warehouse: true };

async function postReturn(db, { tenantId, id, createdBy }) {
  const doc = await db.stockReturn.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!doc) throw new DocumentError('Return was not found.');
  if (doc.status === 'POSTED') throw new DocumentError('This return is already posted.');
  for (const item of doc.items) {
    if (item.disposition === 'SUPPLIER') {
      const issued = await issue(db, {
        tenantId,
        productId: item.productId,
        warehouseId: doc.warehouseId,
        quantity: item.quantity,
        referenceType: 'RETURN',
        referenceId: doc.id,
        createdBy,
        batchId: item.batchId,
        eligibleOnly: false
      });
      await db.stockReturnItem.update({ where: { id: item.id }, data: { unitCost: dec(issued.unitCost) } });
    } else {
      const status = item.disposition === 'SCRAP' ? 'BLOCKED' : 'QUARANTINE';
      await receive(db, {
        tenantId,
        productId: item.productId,
        warehouseId: doc.warehouseId,
        quantity: item.quantity,
        unitCost: num(item.unitCost),
        referenceType: 'RETURN',
        referenceId: doc.id,
        createdBy,
        batchId: item.batchId,
        stockStatus: status
      });
      if (item.batchId) {
        await db.stockBatch.updateMany({
          where: { id: item.batchId, tenantId },
          data: { status: status === 'BLOCKED' ? 'BLOCKED' : 'QUARANTINE' }
        });
      }
    }
  }
  const posted = await db.stockReturn.update({ where: { id: doc.id }, data: { status: 'POSTED' }, include: returnInclude });
  await writeAudit(db, {
    tenantId,
    userId: createdBy,
    action: 'POST',
    entity: 'STOCK_RETURN',
    entityId: doc.id,
    before: { status: doc.status },
    after: { status: 'POSTED' }
  });
  return posted;
}

async function cancelReturn(db, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const doc = await db.stockReturn.findFirst({ where: { id, tenantId } });
  if (!doc) throw new DocumentError('Return was not found.');
  if (doc.status === 'CANCELLED') throw new DocumentError('This return is already cancelled.');
  if (doc.status === 'POSTED') {
    await cancelStockAndJournal(db, {
      tenantId,
      referenceType: 'RETURN',
      referenceId: doc.id,
      date: new Date(),
      createdBy,
      description: text
    });
  }
  const updated = await db.stockReturn.update({ where: { id }, data: { status: 'CANCELLED' }, include: returnInclude });
  await writeAudit(db, {
    tenantId,
    userId: createdBy,
    action: doc.status === 'POSTED' ? 'REVERSE' : 'STATUS',
    entity: 'STOCK_RETURN',
    entityId: id,
    before: { status: doc.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function createCycleCount(db, input) {
  const warehouse = await assertWarehouse(db, input.tenantId, input.warehouseId);
  const number = await generateDocumentNumber(input.tenantId, 'cycleCount', 'CC', 'number', db);
  let lines = input.lines || [];
  if (!lines.length) {
    const products = await db.product.findMany({ where: { tenantId: input.tenantId, type: { not: 'SERVICE' }, nonStock: false } });
    lines = [];
    for (const product of products) {
      const book = await bookQty(db, input.tenantId, product.id, warehouse.id);
      if (input.kind === 'FULL' || book > 0) {
        lines.push({ productId: product.id, bookQty: book, countQty: book });
      }
    }
  }
  const prepared = [];
  for (const line of lines) {
    const book = line.bookQty !== undefined ? num(line.bookQty) : await bookQty(db, input.tenantId, line.productId, warehouse.id);
    const count = line.recountQty !== undefined && line.recountQty !== null && line.recountQty !== ''
      ? num(line.recountQty)
      : num(line.countQty);
    const variance = Math.round((count - book) * 10000) / 10000;
    const product = await db.product.findFirst({ where: { id: line.productId, tenantId: input.tenantId } });
    const unit = num(product?.costPrice) || num(product?.standardCost);
    prepared.push({
      tenantId: input.tenantId,
      productId: line.productId,
      batchId: line.batchId || null,
      bookQty: dec(book),
      countQty: dec(line.countQty !== undefined ? line.countQty : count),
      recountQty: line.recountQty !== undefined && line.recountQty !== null && line.recountQty !== '' ? dec(line.recountQty) : null,
      reason: line.reason || null,
      varianceQty: dec(variance),
      varianceValue: dec(variance * unit),
      unitCost: dec(unit)
    });
  }
  const created = await db.cycleCount.create({
    data: {
      tenantId: input.tenantId,
      number,
      warehouseId: warehouse.id,
      date: new Date(input.date),
      kind: input.kind === 'FULL' ? 'FULL' : 'CYCLE',
      status: 'COUNTED',
      financeStatus: 'PENDING',
      notes: input.notes || null,
      createdBy: input.createdBy || null,
      lines: { create: prepared }
    },
    include: { lines: { include: { product: true } }, warehouse: true }
  });
  await writeAudit(db, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'CREATE',
    entity: 'CYCLE_COUNT',
    entityId: created.id,
    after: { number, status: 'COUNTED' }
  });
  return created;
}

async function financeCycleCount(db, { tenantId, id, decision }) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new DocumentError('Finance decision must be approved or rejected.', { decision: 'Finance decision must be approved or rejected.' });
  }
  const count = await db.cycleCount.findFirst({ where: { id, tenantId } });
  if (!count) throw new DocumentError('Cycle count was not found.');
  if (count.status === 'POSTED') throw new DocumentError('This count is already posted.');
  return db.cycleCount.update({
    where: { id },
    data: { financeStatus: decision, status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
    include: { lines: { include: { product: true } }, warehouse: true }
  });
}

async function postApprovedCycleCount(db, { tenantId, id, createdBy }) {
  const count = await db.cycleCount.findFirst({ where: { id, tenantId }, include: { lines: true } });
  if (!count) throw new DocumentError('Cycle count was not found.');
  if (count.status === 'POSTED') return count;
  if (count.status === 'CANCELLED') throw new DocumentError('This count is cancelled.');
  await postAdjustmentDocument(db, {
    tenantId,
    warehouseId: count.warehouseId,
    referenceId: count.id,
    date: new Date(),
    createdBy,
    items: count.lines.map((line) => ({
      productId: line.productId,
      diffQty: line.varianceQty,
      unitPrice: line.unitCost
    }))
  });
  const posted = await db.cycleCount.update({
    where: { id },
    data: { status: 'POSTED', financeStatus: 'APPROVED' },
    include: { lines: { include: { product: true } }, warehouse: true }
  });
  await writeAudit(db, {
    tenantId,
    userId: createdBy,
    action: 'POST',
    entity: 'CYCLE_COUNT',
    entityId: id,
    before: { status: count.status },
    after: { status: 'POSTED' }
  });
  return posted;
}

async function postCycleCount(db, { tenantId, id, createdBy }) {
  const count = await db.cycleCount.findFirst({ where: { id, tenantId }, include: { lines: true } });
  if (!count) throw new DocumentError('Cycle count was not found.');
  if (count.status === 'POSTED') throw new DocumentError('This count is already posted.');
  if (count.status === 'CANCELLED') throw new DocumentError('This count is cancelled.');
  const rule = await loadRule(db, tenantId, 'CYCLE_COUNT');
  const amount = count.lines.reduce((sum, line) => sum + Math.abs(num(line.varianceValue) || num(line.varianceQty) * num(line.unitCost)), 0);
  if (rule?.enabled && levelsForAmount(rule, amount).length) {
    const approved = await db.approvalRequest.findFirst({
      where: { tenantId, documentType: 'CYCLE_COUNT', documentId: count.id, status: 'APPROVED' }
    });
    if (!approved) {
      await submitForApproval(db, {
        tenantId,
        documentType: 'CYCLE_COUNT',
        documentId: count.id,
        documentNumber: count.number,
        amount,
        userId: createdBy
      });
      return db.cycleCount.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL', financeStatus: 'PENDING_APPROVAL' },
        include: { lines: { include: { product: true } }, warehouse: true }
      });
    }
    return postApprovedCycleCount(db, { tenantId, id, createdBy });
  }
  if (count.financeStatus !== 'APPROVED') {
    throw new DocumentError('Finance has to approve the variance before it can post.', {
      financeStatus: 'Finance has to approve the variance before it can post.'
    });
  }
  return postApprovedCycleCount(db, { tenantId, id, createdBy });
}

async function cancelCycleCount(db, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const count = await db.cycleCount.findFirst({ where: { id, tenantId } });
  if (!count) throw new DocumentError('Cycle count was not found.');
  if (count.status === 'CANCELLED') throw new DocumentError('This count is already cancelled.');
  if (count.status === 'POSTED') {
    await cancelStockAndJournal(db, {
      tenantId,
      referenceType: 'ADJ',
      referenceId: count.id,
      date: new Date(),
      createdBy,
      description: text
    });
  }
  await cancelOpenRequests(db, { tenantId, documentId: count.id });
  const updated = await db.cycleCount.update({
    where: { id },
    data: { status: 'CANCELLED', financeStatus: 'CANCELLED' },
    include: { lines: { include: { product: true } }, warehouse: true }
  });
  await writeAudit(db, {
    tenantId,
    userId: createdBy,
    action: count.status === 'POSTED' ? 'REVERSE' : 'STATUS',
    entity: 'CYCLE_COUNT',
    entityId: id,
    before: { status: count.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function cancelMaterialRequest(db, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const mr = await db.materialRequest.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!mr) throw new DocumentError('Material request was not found.');
  if (mr.status === 'CANCELLED') throw new DocumentError('This material request is already cancelled.');
  const transfers = await db.inventoryTransfer.findMany({
    where: { tenantId, mrId: mr.id, status: { not: 'CANCELLED' } }
  });
  for (const transfer of transfers) {
    await cancelTransfer(db, { tenantId, id: transfer.id, createdBy, reason: text });
  }
  await cancelStockAndJournal(db, {
    tenantId,
    referenceType: 'MR',
    referenceId: mr.id,
    date: new Date(),
    createdBy,
    description: text
  });
  const { releaseSource } = require('./allocations');
  await releaseSource(db, tenantId, 'MATERIAL_REQUEST', mr.id);
  await cancelOpenRequests(db, { tenantId, documentId: mr.id });
  const updated = await db.materialRequest.update({
    where: { id },
    data: { status: 'CANCELLED', approvalStatus: 'CANCELLED' },
    include: mrInclude
  });
  await writeAudit(db, {
    tenantId,
    userId: createdBy,
    action: 'STATUS',
    entity: 'MATERIAL_REQUEST',
    entityId: id,
    before: { status: mr.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function movementReport(db, tenantId, { from, to, warehouseId }) {
  const start = from ? new Date(from) : new Date('2000-01-01');
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  const movements = await db.stockMovement.findMany({
    where: { tenantId, ...(warehouseId ? { warehouseId } : {}) },
    include: { product: { include: { stockUom: true } } }
  });
  const byProduct = new Map();
  movements.forEach((movement) => {
    if (!byProduct.has(movement.productId)) {
      byProduct.set(movement.productId, {
        productId: movement.productId,
        code: movement.product?.code,
        name: movement.product?.name,
        uom: movement.product?.stockUom?.name || '',
        opening: 0,
        received: 0,
        issued: 0
      });
    }
    const row = byProduct.get(movement.productId);
    const effect = movementEffect(movement);
    const at = new Date(movement.createdAt);
    if (at < start) row.opening += effect;
    else if (at <= end) {
      if (effect >= 0) row.received += effect;
      else row.issued += Math.abs(effect);
    }
  });
  const layers = await db.costLayer.findMany({ where: { tenantId, ...(warehouseId ? { warehouseId } : {}) } });
  const valueByProduct = new Map();
  layers.forEach((layer) => {
    const qty = num(layer.quantityRemaining);
    valueByProduct.set(layer.productId, (valueByProduct.get(layer.productId) || 0) + qty * num(layer.unitCost));
  });
  return [...byProduct.values()].map((row) => {
    const closing = Math.round((row.opening + row.received - row.issued) * 10000) / 10000;
    const value = Math.round((valueByProduct.get(row.productId) || 0) * 100) / 100;
    const unitCost = closing > 0 ? Math.round((value / closing) * 10000) / 10000 : 0;
    return {
      ...row,
      opening: Math.round(row.opening * 10000) / 10000,
      received: Math.round(row.received * 10000) / 10000,
      issued: Math.round(row.issued * 10000) / 10000,
      closing,
      unitCost,
      totalValue: Math.round(closing * unitCost * 100) / 100
    };
  }).filter((row) => row.opening || row.received || row.issued);
}

async function agingReport(db, tenantId, { warehouseId }) {
  const layers = await db.costLayer.findMany({
    where: { tenantId, quantityRemaining: { gt: 0 }, ...(warehouseId ? { warehouseId } : {}) },
    include: { product: true }
  });
  const now = Date.now();
  const bucket = (days) => {
    if (days <= 30) return 'd0';
    if (days <= 90) return 'd31';
    if (days <= 180) return 'd91';
    return 'd180';
  };
  const map = new Map();
  layers.forEach((layer) => {
    if (!map.has(layer.productId)) {
      map.set(layer.productId, {
        productId: layer.productId,
        code: layer.product?.code,
        name: layer.product?.name,
        qty: 0,
        value: 0,
        d0: 0,
        d31: 0,
        d91: 0,
        d180: 0
      });
    }
    const row = map.get(layer.productId);
    const qty = num(layer.quantityRemaining);
    const days = Math.floor((now - new Date(layer.receivedAt).getTime()) / 86400000);
    row.qty += qty;
    row.value += qty * num(layer.unitCost);
    row[bucket(days)] += qty;
  });
  return [...map.values()].map((row) => ({
    ...row,
    qty: Math.round(row.qty * 10000) / 10000,
    value: Math.round(row.value * 100) / 100,
    unitCost: row.qty > 0 ? Math.round((row.value / row.qty) * 10000) / 10000 : 0,
    d0: Math.round(row.d0 * 10000) / 10000,
    d31: Math.round(row.d31 * 10000) / 10000,
    d91: Math.round(row.d91 * 10000) / 10000,
    d180: Math.round(row.d180 * 10000) / 10000
  }));
}

async function livePalletQty(db, tenantId, palletId) {
  const layers = await db.costLayer.findMany({ where: { tenantId, palletId, quantityRemaining: { gt: 0 } } });
  return layers.reduce((sum, layer) => sum + num(layer.quantityRemaining), 0);
}

async function deactivatePallet(db, { tenantId, id }) {
  const pallet = await db.pallet.findFirst({ where: { id, tenantId } });
  if (!pallet) throw new DocumentError('Pallet was not found.');
  const live = await livePalletQty(db, tenantId, pallet.id);
  if (live > 0.00005) throw new DocumentError('A pallet with stock on it cannot be deactivated.');
  return db.pallet.update({ where: { id: pallet.id }, data: { status: 'INACTIVE' } });
}

async function renumberPallet(db, { tenantId, id, code }) {
  const pallet = await db.pallet.findFirst({ where: { id, tenantId } });
  if (!pallet) throw new DocumentError('Pallet was not found.');
  const nextCode = String(code || '').trim();
  if (!nextCode) throw new DocumentError('Enter the new pallet code.', { code: 'Enter the new pallet code.' });
  const clash = await db.pallet.findFirst({ where: { tenantId, code: nextCode } });
  if (clash) throw new DocumentError('That pallet code is already used.', { code: 'That pallet code is already used.' });
  const created = await db.pallet.create({
    data: {
      tenantId,
      warehouseId: pallet.warehouseId,
      code: nextCode,
      status: 'ACTIVE',
      supersedesId: pallet.id
    }
  });
  await db.pallet.update({
    where: { id: pallet.id },
    data: { status: 'SUPERSEDED', supersededById: created.id }
  });
  await db.costLayer.updateMany({
    where: { tenantId, palletId: pallet.id, quantityRemaining: { gt: 0 } },
    data: { palletId: created.id }
  });
  return created;
}

module.exports = {
  postBatchReceipt,
  createMaterialRequest,
  approveMaterialRequest,
  releaseMaterialRequest,
  cancelMaterialRequest,
  buildPickList,
  fulfilMaterialRequest,
  createTransfer,
  shipTransfer,
  cancelTransfer,
  receiveTransfer,
  createReturn,
  postReturn,
  cancelReturn,
  createCycleCount,
  financeCycleCount,
  postCycleCount,
  postApprovedCycleCount,
  cancelCycleCount,
  movementReport,
  agingReport,
  positionReport,
  inTransitQty,
  deactivatePallet,
  renumberPallet,
  livePalletQty,
  mrInclude,
  transferInclude,
  returnInclude
};
