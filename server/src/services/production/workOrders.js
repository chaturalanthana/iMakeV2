const prisma = require('../../lib/prisma');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { syncRoutingForBom } = require('./routing');
const { receiveLayer, issueFifo, nextFifoUnitCost, lastReceiptUnitCost, onHandFromMovements } = require('./fifo');
const { ensureGlMap, postJournal } = require('../glService');
const { money } = require('../money');
const { round4, num, materialUnitCost, rollupCost, prorateSheet, splitIssueCost, varianceReport } = require('./costing');
const { buildLoadProfile } = require('./capacity');

const runTx = (fn) => prisma.$transaction(fn, { timeout: 20000 });

class ProductionError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const LEGACY_TO_WO = {
  DRAFT: 'CREATED',
  QUEUED: 'CREATED',
  RELEASED: 'RELEASED',
  WIP: 'IN_PROGRESS',
  QC: 'IN_PROGRESS',
  COMPLETED: 'TECO',
  CANCELLED: 'CANCELLED'
};

const RANK = { CREATED: 1, RELEASED: 2, IN_PROGRESS: 3, TECO: 4, CLOSED: 5 };

const detailInclude = {
  product: { select: { id: true, code: true, name: true, standardCost: true, costPrice: true, bomApplicable: true } },
  bom: { select: { id: true, code: true, name: true, version: true } },
  routing: { select: { id: true, code: true, version: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  salesOrder: { select: { id: true, orderNumber: true } },
  components: { include: { product: { select: { id: true, code: true, name: true } } } },
  operations: {
    include: { workstation: { select: { id: true, code: true, name: true, capacity: true, efficiency: true } } },
    orderBy: { sequence: 'asc' }
  },
  reservations: true,
  issues: { orderBy: { createdAt: 'asc' } },
  confirmations: {
    include: {
      scrapReason: true,
      reworkReason: true,
      operation: { select: { id: true, sequence: true, name: true } }
    },
    orderBy: { confirmedAt: 'asc' }
  }
};

const DEFAULT_REASONS = [
  ['SCRAP-DMG', 'Damaged', 'SCRAP'],
  ['SCRAP-DIM', 'Out of dimension', 'SCRAP'],
  ['SCRAP-MAT', 'Material defect', 'SCRAP'],
  ['RWK-QC', 'Failed inspection', 'REWORK'],
  ['RWK-OP', 'Operator error', 'REWORK']
];

const mergeStatus = (current, incoming) => {
  if (!current) return incoming;
  if (incoming === 'CANCELLED') return 'CANCELLED';
  if (current === 'CANCELLED' || current === 'CLOSED') return current;
  if ((RANK[incoming] || 0) >= (RANK[current] || 0)) return incoming;
  return current;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const serialText = (value) => {
  if (Array.isArray(value)) {
    const joined = value.map((part) => String(part).trim()).filter(Boolean).join(',');
    return joined || null;
  }
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const emptySheet = () => ({
  material: 0, scrap: 0, labour: 0, machine: 0, subcontract: 0, overhead: 0, total: 0
});

async function getSettings(db, tenantId) {
  const existing = await db.productionSetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.productionSetting.create({ data: { tenantId } });
}

async function updateSettings(tenantId, body) {
  await getSettings(prisma, tenantId);
  const data = {};
  if (body.materialCheck !== undefined) {
    if (!['WARN', 'BLOCK'].includes(body.materialCheck)) {
      throw new ProductionError('Material check must be WARN or BLOCK');
    }
    data.materialCheck = body.materialCheck;
  }
  if (body.issueMode !== undefined) {
    if (!['MANUAL', 'BACKFLUSH'].includes(body.issueMode)) {
      throw new ProductionError('Issue mode must be MANUAL or BACKFLUSH');
    }
    data.issueMode = body.issueMode;
  }
  if (body.overheadPercent !== undefined) data.overheadPercent = num(body.overheadPercent);
  if (body.labourRatePerHour !== undefined) data.labourRatePerHour = num(body.labourRatePerHour);
  if (body.hoursPerDay !== undefined) data.hoursPerDay = num(body.hoursPerDay) || 8;
  if (body.workDays !== undefined) data.workDays = body.workDays;
  return prisma.productionSetting.update({ where: { tenantId }, data });
}

async function ensureReasonCodes(db, tenantId) {
  const count = await db.reasonCode.count({ where: { tenantId } });
  if (count === 0) {
    await db.reasonCode.createMany({
      data: DEFAULT_REASONS.map(([code, name, category]) => ({ tenantId, code, name, category }))
    });
  }
  return db.reasonCode.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
}

async function onHand(db, tenantId, productId, warehouseId) {
  const where = { tenantId, productId };
  if (warehouseId) where.warehouseId = warehouseId;
  const movements = await db.stockMovement.findMany({ where });
  return round4(onHandFromMovements(movements));
}

async function openReserved(db, tenantId, productId, exceptWorkOrderId, warehouseId) {
  const rows = await db.materialReservation.findMany({
    where: {
      tenantId,
      productId,
      status: 'OPEN',
      workOrderId: { not: exceptWorkOrderId },
      ...(warehouseId ? { warehouseId } : {})
    }
  });
  return round4(rows.reduce((sum, row) => sum + Math.max(0, num(row.quantity) - num(row.consumedQty)), 0));
}

async function defaultWarehouseId(db, tenantId, warehouseId) {
  if (warehouseId) {
    const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, tenantId } });
    if (!warehouse) throw new ProductionError('Warehouse not found');
    return warehouse.id;
  }
  const first = await db.warehouse.findFirst({ where: { tenantId }, orderBy: { code: 'asc' } });
  return first ? first.id : null;
}

async function buildSnapshot(db, { tenantId, productId, bomId, quantity }) {
  const product = await db.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ProductionError('Product not found');
  if (product.activeStatus === 'INACTIVE') throw new ProductionError('Inactive products cannot be planned');

  let bom = null;
  if (bomId) {
    bom = await db.bOM.findFirst({ where: { id: bomId, tenantId, productId }, include: { items: true } });
    if (!bom) throw new ProductionError('BOM not found');
  } else {
    bom = await db.bOM.findFirst({
      where: { tenantId, productId, status: 'ACTIVE', isDefault: true },
      include: { items: true }
    });
    if (!bom) {
      bom = await db.bOM.findFirst({
        where: { tenantId, productId, status: 'ACTIVE' },
        include: { items: true },
        orderBy: { updatedAt: 'desc' }
      });
    }
  }

  let routing = null;
  if (bom) {
    routing = await syncRoutingForBom(bom.id, db);
  }

  const settings = await getSettings(db, tenantId);
  const components = [];
  for (const item of bom?.items || []) {
    const componentProduct = await db.product.findFirst({ where: { id: item.productId, tenantId } });
    if (!componentProduct) continue;
    const priced = materialUnitCost({
      standardCost: num(componentProduct.standardCost),
      fifoUnitCost: await nextFifoUnitCost(db, { tenantId, productId: item.productId }),
      lastReceiptCost: await lastReceiptUnitCost(db, { tenantId, productId: item.productId }),
      costPrice: num(componentProduct.costPrice)
    });
    components.push({
      productId: item.productId,
      quantityPer: num(item.quantity),
      scrapPercent: num(item.scrapPercent),
      unitCost: priced.unitCost,
      costSource: priced.costSource,
      type: item.type || 'Raw Material',
      instruction: item.instruction || null
    });
  }

  const routed = (routing?.operations || []).map((operation) => ({
    sequence: operation.sequence,
    name: operation.name,
    workstationId: operation.workstationId,
    setupMinutes: num(operation.setupMinutes),
    runMinutesPerUnit: num(operation.runMinutesPerUnit),
    noOfWorkers: operation.noOfWorkers || 1,
    isSubcontract: operation.isSubcontract,
    subcontractCostPerUnit: num(operation.subcontractCostPerUnit),
    machineRatePerHour: 0,
    instructions: operation.instructions || null
  }));

  const operations = routed.length ? routed : [{
    sequence: 10,
    name: 'Final assembly',
    workstationId: null,
    setupMinutes: 0,
    runMinutesPerUnit: 0,
    noOfWorkers: 1,
    isSubcontract: false,
    subcontractCostPerUnit: 0,
    machineRatePerHour: 0,
    instructions: null
  }];

  const planned = rollupCost({
    quantity,
    components,
    operations,
    labourRatePerHour: num(settings.labourRatePerHour),
    overheadPercent: num(settings.overheadPercent)
  });

  return { product, bom, routing, settings, components, operations, planned };
}

function plannedSpanDays(operations, quantity, hoursPerDay) {
  let minutes = 0;
  (operations || []).forEach((operation) => {
    minutes += num(operation.setupMinutes) + num(operation.runMinutesPerUnit) * quantity;
  });
  return Math.max(1, Math.ceil((minutes / 60) / (num(hoursPerDay) || 8)));
}

function suggestEnd(start, operations, quantity, hoursPerDay) {
  const end = new Date(start);
  end.setDate(end.getDate() + plannedSpanDays(operations, quantity, hoursPerDay) - 1);
  return end;
}

async function refreshPlan(db, workOrderId) {
  const wo = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: { components: true, operations: true }
  });
  if (!wo) return;
  const planned = rollupCost({
    quantity: num(wo.quantity),
    components: wo.components,
    operations: wo.operations,
    labourRatePerHour: num(wo.labourRatePerHour),
    overheadPercent: num(wo.overheadPercent)
  });
  await db.workOrder.update({
    where: { id: wo.id },
    data: {
      plannedMaterialCost: planned.material,
      plannedLabourCost: planned.labour,
      plannedMachineCost: planned.machine,
      plannedSubcontractCost: planned.subcontract,
      plannedOverheadCost: planned.overhead,
      plannedScrapCost: planned.scrap
    }
  });
  for (const line of planned.components) {
    const component = wo.components.find((row) => row.productId === line.productId);
    if (!component) continue;
    await db.workOrderComponent.update({
      where: { id: component.id },
      data: { requiredQty: line.requiredQty }
    });
  }
}

async function createInside(db, args) {
  const quantity = num(args.quantity);
  if (!(quantity > 0)) throw new ProductionError('Quantity must be greater than zero');
  const snapshot = await buildSnapshot(db, {
    tenantId: args.tenantId,
    productId: args.productId,
    bomId: args.bomId,
    quantity
  });
  const warehouseId = await defaultWarehouseId(db, args.tenantId, args.warehouseId);
  const requestedStart = parseDate(args.startDate);
  const requestedEnd = parseDate(args.endDate);
  const leaveOpen = args.unscheduled === true && !requestedStart && !requestedEnd;
  const start = leaveOpen ? null : (requestedStart || new Date());
  if (start) start.setHours(0, 0, 0, 0);
  const end = leaveOpen ? null : (requestedEnd || suggestEnd(start, snapshot.operations, quantity, snapshot.settings.hoursPerDay));
  const issueMode = ['MANUAL', 'BACKFLUSH'].includes(args.issueMode) ? args.issueMode : (snapshot.settings.issueMode || 'BACKFLUSH');
  const orderNumber = args.orderNumber || await generateDocumentNumber(args.tenantId, 'workOrder', 'WO', 'orderNumber', db);
  const planned = snapshot.planned;

  try {
    const created = await db.workOrder.create({
      data: {
        tenantId: args.tenantId,
        orderNumber,
        productId: args.productId,
        bomId: snapshot.bom?.id || null,
        routingId: snapshot.routing?.id || null,
        warehouseId,
        quantity,
        status: args.status || 'CREATED',
        priority: args.priority || 'MEDIUM',
        issueMode,
        startDate: start,
        endDate: end,
        assignedTo: args.assignedTo || null,
        notes: args.notes || null,
        sourceType: args.sourceType || 'MANUAL',
        sourceId: args.sourceId || null,
        salesOrderId: args.salesOrderId || null,
        salesOrderItemId: args.salesOrderItemId || null,
        legacyJobId: args.legacyJobId || null,
        legacyOrderId: args.legacyOrderId || null,
        labourRatePerHour: num(snapshot.settings.labourRatePerHour),
        overheadPercent: num(snapshot.settings.overheadPercent),
        plannedMaterialCost: planned.material,
        plannedLabourCost: planned.labour,
        plannedMachineCost: planned.machine,
        plannedSubcontractCost: planned.subcontract,
        plannedOverheadCost: planned.overhead,
        plannedScrapCost: planned.scrap,
        createdBy: args.userId || null,
        components: {
          create: snapshot.components.map((component) => ({
            tenantId: args.tenantId,
            productId: component.productId,
            quantityPer: component.quantityPer,
            scrapPercent: component.scrapPercent,
            requiredQty: round4(component.quantityPer * quantity * (1 + component.scrapPercent / 100)),
            unitCost: component.unitCost,
            costSource: component.costSource,
            type: component.type,
            instruction: component.instruction
          }))
        },
        operations: {
          create: snapshot.operations.map((operation) => ({
            tenantId: args.tenantId,
            sequence: operation.sequence,
            name: operation.name,
            workstationId: operation.workstationId,
            setupMinutes: operation.setupMinutes,
            runMinutesPerUnit: operation.runMinutesPerUnit,
            noOfWorkers: operation.noOfWorkers,
            isSubcontract: operation.isSubcontract,
            subcontractCostPerUnit: operation.subcontractCostPerUnit,
            machineRatePerHour: operation.machineRatePerHour,
            instructions: operation.instructions
          }))
        }
      }
    });
    return db.workOrder.findUnique({ where: { id: created.id }, include: detailInclude });
  } catch (error) {
    if (error.code === 'P2002' && (args.legacyJobId || args.legacyOrderId)) {
      return db.workOrder.findFirst({
        where: {
          OR: [
            args.legacyJobId ? { legacyJobId: args.legacyJobId } : undefined,
            args.legacyOrderId ? { legacyOrderId: args.legacyOrderId } : undefined
          ].filter(Boolean)
        },
        include: detailInclude
      });
    }
    if (error.code === 'P2002') throw new ProductionError('Work order number already exists');
    throw error;
  }
}

async function ensureReservations(db, wo, { mode }) {
  const warnings = [];
  for (const component of wo.components || []) {
    const need = round4(num(component.requiredQty) - num(component.reservedQty));
    if (need <= 0.00005) continue;
    const onHandQty = await onHand(db, wo.tenantId, component.productId, wo.warehouseId);
    const reservedElsewhere = await openReserved(db, wo.tenantId, component.productId, wo.id, wo.warehouseId);
    const available = round4(onHandQty - reservedElsewhere);
    const short = round4(Math.max(0, need - Math.max(0, available)));
    if (short > 0.00005) {
      warnings.push({
        productId: component.productId,
        code: component.product?.code || null,
        name: component.product?.name || null,
        required: num(component.requiredQty),
        available: round4(Math.max(0, available)),
        short
      });
    }
    if (short > 0.00005 && mode === 'BLOCK') {
      throw new ProductionError('Insufficient material to release this work order', 409, { shortages: warnings });
    }
    const reserve = round4(Math.max(0, Math.min(need, Math.max(0, available))));
    if (reserve > 0) {
      await db.materialReservation.create({
        data: {
          tenantId: wo.tenantId,
          workOrderId: wo.id,
          componentId: component.id,
          productId: component.productId,
          warehouseId: wo.warehouseId,
          quantity: reserve,
          status: 'OPEN'
        }
      });
      await db.workOrderComponent.update({
        where: { id: component.id },
        data: { reservedQty: round4(num(component.reservedQty) + reserve) }
      });
      component.reservedQty = round4(num(component.reservedQty) + reserve);
    }
  }
  return { warnings };
}

async function consumeReservation(db, component, quantity) {
  let left = round4(quantity);
  const rows = await db.materialReservation.findMany({
    where: { componentId: component.id, status: 'OPEN' },
    orderBy: { createdAt: 'asc' }
  });
  let consumedNow = 0;
  for (const row of rows) {
    if (left <= 0.00005) break;
    const open = Math.max(0, num(row.quantity) - num(row.consumedQty));
    const take = round4(Math.min(open, left));
    if (!(take > 0)) continue;
    const consumed = round4(num(row.consumedQty) + take);
    await db.materialReservation.update({
      where: { id: row.id },
      data: {
        consumedQty: consumed,
        status: consumed + 0.00005 >= num(row.quantity) ? 'CLOSED' : 'OPEN'
      }
    });
    consumedNow = round4(consumedNow + take);
    left = round4(left - take);
  }
  await db.workOrderComponent.update({
    where: { id: component.id },
    data: {
      reservedQty: round4(Math.max(0, num(component.reservedQty) - consumedNow)),
      issuedQty: round4(num(component.issuedQty) + quantity)
    }
  });
  component.reservedQty = round4(Math.max(0, num(component.reservedQty) - consumedNow));
  component.issuedQty = round4(num(component.issuedQty) + quantity);
}

async function postIssue(db, { wo, component, quantity, mode, lotNumber, serialNumber, userId, confirmationId, yieldQty, scrapQty }) {
  const qty = round4(quantity);
  if (!(qty > 0)) return null;
  const available = await onHand(db, wo.tenantId, component.productId, wo.warehouseId);
  if (qty - available > 0.00005) {
    throw new ProductionError(`Insufficient stock to issue ${component.product?.code || 'component'}`);
  }
    const fifo = await issueFifo(db, {
    tenantId: wo.tenantId,
    productId: component.productId,
    warehouseId: wo.warehouseId,
    quantity: qty,
    strictWarehouse: Boolean(wo.warehouseId)
  });
  const split = mode === 'BACKFLUSH'
    ? splitIssueCost(fifo.totalCost, num(component.scrapPercent), yieldQty, scrapQty)
    : { material: fifo.totalCost, scrap: 0 };
  await db.stockMovement.create({
    data: {
      tenantId: wo.tenantId,
      productId: component.productId,
      type: 'GI',
      quantity: qty,
      unitCost: fifo.unitCost,
      value: fifo.totalCost,
      referenceType: 'WORK_ORDER',
      referenceId: wo.id,
      warehouseId: wo.warehouseId,
      lotNumber: lotNumber || null,
      serialNumber: serialNumber || null,
      createdBy: userId || null
    }
  });
  if (fifo.totalCost > 0) {
    const map = await ensureGlMap(db, wo.tenantId, userId);
    await postJournal(db, {
      tenantId: wo.tenantId,
      date: new Date(),
      createdBy: userId,
      description: `Material issue ${wo.orderNumber}`,
      referenceType: 'WORK_ORDER',
      referenceId: wo.id,
      lines: [
        { accountId: map.WIP, debit: fifo.totalCost, credit: 0, description: component.product?.code || 'Material' },
        { accountId: map.INVENTORY, debit: 0, credit: fifo.totalCost, description: component.product?.code || 'Material' }
      ]
    });
  }
  const issue = await db.workOrderIssue.create({
    data: {
      tenantId: wo.tenantId,
      workOrderId: wo.id,
      componentId: component.id,
      confirmationId: confirmationId || null,
      productId: component.productId,
      quantity: qty,
      unitCost: fifo.unitCost,
      totalCost: fifo.totalCost,
      materialCost: split.material,
      scrapCost: split.scrap,
      mode,
      lotNumber: lotNumber || null,
      serialNumber: serialNumber || null,
      createdBy: userId || null
    }
  });
  await consumeReservation(db, component, qty);
  return issue;
}

async function postFinishedGoods(db, wo, { quantity, unitCost, lotNumber, serialNumber, userId }) {
  const qty = round4(quantity);
  if (!(qty > 0)) return;
  const value = round4(qty * num(unitCost));
  await db.stockMovement.create({
    data: {
      tenantId: wo.tenantId,
      productId: wo.productId,
      type: 'GR',
      quantity: qty,
      unitCost,
      value,
      referenceType: 'WORK_ORDER',
      referenceId: wo.id,
      warehouseId: wo.warehouseId,
      lotNumber: lotNumber || null,
      serialNumber: serialNumber || null,
      createdBy: userId || null
    }
  });
  if (value > 0) {
    const map = await ensureGlMap(db, wo.tenantId, userId);
    await postJournal(db, {
      tenantId: wo.tenantId,
      date: new Date(),
      createdBy: userId,
      description: `Finished goods ${wo.orderNumber}`,
      referenceType: 'WORK_ORDER',
      referenceId: wo.id,
      lines: [
        { accountId: map.INVENTORY_FG, debit: value, credit: 0, description: 'Finished goods' },
        { accountId: map.WIP, debit: 0, credit: value, description: 'Finished goods' }
      ]
    });
  }
  await receiveLayer(db, {
    tenantId: wo.tenantId,
    productId: wo.productId,
    warehouseId: wo.warehouseId,
    quantity: qty,
    unitCost,
    sourceType: 'WORK_ORDER',
    sourceId: wo.id
  });
}

async function recomputeActuals(db, wo) {
  const issues = await db.workOrderIssue.findMany({ where: { workOrderId: wo.id } });
  const confirmations = await db.workOrderConfirmation.findMany({ where: { workOrderId: wo.id } });
  const actualLabour = round4(confirmations.reduce((sum, row) => sum + num(row.labourCost), 0));
  const actualMachine = round4(confirmations.reduce((sum, row) => sum + num(row.machineCost), 0));
  const actualSubcontract = round4(confirmations.reduce((sum, row) => sum + num(row.subcontractCost), 0));
  const actualOverhead = round4((actualLabour + actualMachine + actualSubcontract) * num(wo.overheadPercent) / 100);
  await db.workOrder.update({
    where: { id: wo.id },
    data: {
      actualMaterialCost: round4(issues.reduce((sum, row) => sum + num(row.materialCost), 0)),
      actualScrapCost: round4(issues.reduce((sum, row) => sum + num(row.scrapCost), 0)),
      actualLabourCost: actualLabour,
      actualMachineCost: actualMachine,
      actualSubcontractCost: actualSubcontract,
      actualOverheadCost: actualOverhead
    }
  });
}

async function mirrorLegacy(db, wo, status) {
  const jobStatus = {
    CREATED: 'QUEUED',
    RELEASED: 'QUEUED',
    IN_PROGRESS: 'WIP',
    TECO: 'COMPLETED',
    CLOSED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  }[status];
  const orderStatus = {
    CREATED: 'DRAFT',
    RELEASED: 'RELEASED',
    IN_PROGRESS: 'WIP',
    TECO: 'COMPLETED',
    CLOSED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  }[status];
  if (wo.legacyJobId && jobStatus) {
    await db.productionJob.update({ where: { id: wo.legacyJobId }, data: { status: jobStatus } });
  }
  if (wo.legacyOrderId && orderStatus) {
    await db.productionOrder.update({ where: { id: wo.legacyOrderId }, data: { status: orderStatus } });
  }
}

async function closeReservations(db, workOrderId) {
  await db.materialReservation.updateMany({
    where: { workOrderId, status: 'OPEN' },
    data: { status: 'CLOSED' }
  });
}

const plannedTotal = (wo) => round4(
  num(wo.plannedMaterialCost) + num(wo.plannedScrapCost) + num(wo.plannedLabourCost)
  + num(wo.plannedMachineCost) + num(wo.plannedSubcontractCost) + num(wo.plannedOverheadCost)
);

async function receiptLegacyCompletion(db, wo, userId) {
  const fresh = await db.workOrder.findUnique({ where: { id: wo.id } });
  if (!fresh) return;
  if (num(fresh.quantityCompleted) > 0) return;
  const gap = round4(num(fresh.quantity) - num(fresh.quantityReceipted));
  if (!(gap > 0)) return;
  const unit = num(fresh.quantity) > 0 ? round4(plannedTotal(fresh) / num(fresh.quantity)) : 0;
  await postFinishedGoods(db, fresh, { quantity: gap, unitCost: unit, userId });
  await db.workOrder.update({
    where: { id: fresh.id },
    data: {
      quantityReceipted: round4(num(fresh.quantityReceipted) + gap),
      quantityCompleted: num(fresh.quantity)
    }
  });
}

async function syncLegacy(db, { tenantId, userId, legacy, kind, sourceType, receiptOnComplete }) {
  const where = kind === 'job' ? { legacyJobId: legacy.id } : { legacyOrderId: legacy.id };
  let wo = await db.workOrder.findUnique({ where, include: detailInclude });
  const incoming = LEGACY_TO_WO[legacy.status] || 'CREATED';
  if (!wo) {
    wo = await createInside(db, {
      tenantId,
      userId: userId || legacy.createdBy || null,
      productId: legacy.productId,
      bomId: legacy.bomId,
      quantity: num(legacy.quantity),
      startDate: legacy.startDate,
      endDate: legacy.endDate,
      priority: legacy.priority || 'MEDIUM',
      notes: legacy.notes,
      assignedTo: legacy.assignedTo,
      sourceType: sourceType || (kind === 'job' ? 'MIGRATED_JOB' : 'MIGRATED_ORDER'),
      legacyJobId: kind === 'job' ? legacy.id : null,
      legacyOrderId: kind === 'order' ? legacy.id : null,
      orderNumber: kind === 'job' ? legacy.jobNumber : legacy.orderNumber,
      status: incoming
    });
  } else {
    const status = mergeStatus(wo.status, incoming);
    await db.workOrder.update({
      where: { id: wo.id },
      data: {
        quantity: num(legacy.quantity),
        status,
        startDate: legacy.startDate || null,
        endDate: legacy.endDate || null,
        priority: legacy.priority || wo.priority,
        notes: legacy.notes,
        assignedTo: legacy.assignedTo
      }
    });
    await refreshPlan(db, wo.id);
    wo = await db.workOrder.findUnique({ where: { id: wo.id }, include: detailInclude });
  }
  if (!wo) return null;
  if (wo.status === 'RELEASED' || wo.status === 'IN_PROGRESS') {
    await ensureReservations(db, wo, { mode: 'WARN' });
  }
  if (wo.status === 'CANCELLED') await closeReservations(db, wo.id);
  if (receiptOnComplete) await receiptLegacyCompletion(db, wo, userId);
  return db.workOrder.findUnique({ where: { id: wo.id }, include: detailInclude });
}

async function migrateMissing(db, tenantId) {
  const jobs = await db.productionJob.findMany({ where: { tenantId, workOrder: { is: null } } });
  for (const job of jobs) {
    await syncLegacy(db, {
      tenantId,
      userId: job.createdBy,
      legacy: job,
      kind: 'job',
      sourceType: job.notes === 'MRP' ? 'MRP' : 'MIGRATED_JOB',
      receiptOnComplete: false
    });
  }
  const orders = await db.productionOrder.findMany({ where: { tenantId, workOrder: { is: null } } });
  for (const order of orders) {
    await syncLegacy(db, {
      tenantId,
      userId: order.createdBy,
      legacy: order,
      kind: 'order',
      sourceType: 'MIGRATED_ORDER',
      receiptOnComplete: false
    });
  }
}

async function migrateAllTenants() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await migrateMissing(prisma, tenant.id);
  }
}

async function listWorkOrders(tenantId, query = {}) {
  await migrateMissing(prisma, tenantId);
  const settings = await getSettings(prisma, tenantId);
  const where = { tenantId };
  if (query.status) {
    const statuses = String(query.status).split(',').map((status) => status.trim()).filter(Boolean);
    if (statuses.length) where.status = { in: statuses };
  }
  if (query.productId) where.productId = query.productId;
  const orders = await prisma.workOrder.findMany({
    where,
    include: {
      product: { select: { id: true, code: true, name: true, stockUom: { select: { name: true } } } },
      bom: { select: { id: true, code: true, version: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      operations: { select: { setupMinutes: true, runMinutesPerUnit: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  return orders.map((order) => {
    const { operations, ...rest } = order;
    return {
      ...rest,
      plannedDays: plannedSpanDays(operations, num(order.quantity), settings.hoursPerDay)
    };
  });
}

async function getWorkOrder(tenantId, id) {
  const wo = await prisma.workOrder.findFirst({ where: { id, tenantId }, include: detailInclude });
  if (!wo) throw new ProductionError('Work order not found', 404);
  return wo;
}

async function createWorkOrder(tenantId, userId, body, db = prisma) {
  if (!body.productId) throw new ProductionError('Product is required');
  const status = body.status === 'DRAFT' ? 'DRAFT' : 'CREATED';
  return createInside(db, {
    tenantId,
    userId,
    productId: body.productId,
    bomId: body.bomId || null,
    quantity: body.quantity,
    startDate: body.startDate,
    endDate: body.endDate,
    priority: body.priority,
    notes: body.notes,
    assignedTo: body.assignedTo,
    warehouseId: body.warehouseId,
    issueMode: body.issueMode,
    sourceType: body.sourceType || 'MANUAL',
    sourceId: body.sourceId || null,
    salesOrderId: body.salesOrderId || null,
    salesOrderItemId: body.salesOrderItemId || null,
    status
  });
}

function planDatesOnly(body) {
  const keys = Object.keys(body).filter((key) => body[key] !== undefined);
  return keys.length > 0 && keys.every((key) => key === 'startDate' || key === 'endDate');
}

async function updateWorkOrder(tenantId, id, body) {
  const wo = await getWorkOrder(tenantId, id);
  if (!['CREATED', 'DRAFT'].includes(wo.status)) {
    if (planDatesOnly(body) && ['IN_PROGRESS', 'TECO', 'CLOSED'].includes(wo.status)) {
      throw new ProductionError('Started work orders stay on the plan');
    }
    if (wo.status === 'RELEASED' && planDatesOnly(body)) {
      await prisma.workOrder.update({
        where: { id },
        data: {
          startDate: body.startDate !== undefined ? parseDate(body.startDate) : wo.startDate,
          endDate: body.endDate !== undefined ? parseDate(body.endDate) : wo.endDate
        }
      });
      return getWorkOrder(tenantId, id);
    }
    throw new ProductionError('Only draft or created work orders can be edited');
  }
  const quantity = body.quantity !== undefined ? num(body.quantity) : num(wo.quantity);
  if (!(quantity > 0)) throw new ProductionError('Quantity must be greater than zero');
  let warehouseId = wo.warehouseId;
  if (body.warehouseId !== undefined) warehouseId = await defaultWarehouseId(prisma, tenantId, body.warehouseId || null);
  const issueMode = body.issueMode !== undefined ? body.issueMode : wo.issueMode;
  if (body.issueMode && !['MANUAL', 'BACKFLUSH'].includes(body.issueMode)) {
    throw new ProductionError('Issue mode must be MANUAL or BACKFLUSH');
  }
  await prisma.workOrder.update({
    where: { id },
    data: {
      quantity,
      warehouseId,
      issueMode,
      priority: body.priority !== undefined ? body.priority : wo.priority,
      notes: body.notes !== undefined ? body.notes : wo.notes,
      assignedTo: body.assignedTo !== undefined ? body.assignedTo : wo.assignedTo,
      startDate: body.startDate !== undefined ? parseDate(body.startDate) : wo.startDate,
      endDate: body.endDate !== undefined ? parseDate(body.endDate) : wo.endDate
    }
  });
  await refreshPlan(prisma, id);
  return getWorkOrder(tenantId, id);
}

async function deleteWorkOrder(tenantId, id) {
  const wo = await getWorkOrder(tenantId, id);
  if (!['CREATED', 'DRAFT', 'CANCELLED'].includes(wo.status)) {
    throw new ProductionError('Only draft, created, or cancelled work orders can be deleted');
  }
  if (wo.legacyJobId) {
    await prisma.productionJob.delete({ where: { id: wo.legacyJobId } });
    return { message: 'Work order deleted successfully' };
  }
  if (wo.legacyOrderId) {
    await prisma.productionOrder.delete({ where: { id: wo.legacyOrderId } });
    return { message: 'Work order deleted successfully' };
  }
  await prisma.workOrder.delete({ where: { id } });
  return { message: 'Work order deleted successfully' };
}

async function releaseWorkOrder(tenantId, id) {
  return runTx(async (tx) => {
    const wo = await tx.workOrder.findFirst({ where: { id, tenantId }, include: detailInclude });
    if (!wo) throw new ProductionError('Work order not found', 404);
    if (wo.status !== 'CREATED') throw new ProductionError('Only created work orders can be released');
    const settings = await getSettings(tx, tenantId);
    const mode = settings.materialCheck === 'BLOCK' ? 'BLOCK' : 'WARN';
    const { warnings } = await ensureReservations(tx, wo, { mode });
    await tx.workOrder.update({ where: { id }, data: { status: 'RELEASED' } });
    await mirrorLegacy(tx, wo, 'RELEASED');
    const workOrder = await tx.workOrder.findFirst({ where: { id }, include: detailInclude });
    return { workOrder, warnings };
  });
}

async function issueMaterial(tenantId, id, body, userId) {
  return runTx(async (tx) => {
    const wo = await tx.workOrder.findFirst({ where: { id, tenantId }, include: detailInclude });
    if (!wo) throw new ProductionError('Work order not found', 404);
    if (!['RELEASED', 'IN_PROGRESS'].includes(wo.status)) {
      throw new ProductionError('Release the work order before issuing material');
    }
    const component = wo.components.find((row) => row.productId === body.productId || row.id === body.componentId);
    if (!component) throw new ProductionError('Component is not on this work order');
    const quantity = num(body.quantity);
    if (!(quantity > 0)) throw new ProductionError('Quantity must be greater than zero');
    await postIssue(tx, {
      wo,
      component,
      quantity,
      mode: 'MANUAL',
      lotNumber: body.lotNumber,
      serialNumber: serialText(body.serialNumber || body.serialNumbers),
      userId
    });
    if (wo.status === 'RELEASED') {
      await tx.workOrder.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      await mirrorLegacy(tx, wo, 'IN_PROGRESS');
    }
    await recomputeActuals(tx, wo);
    return tx.workOrder.findFirst({ where: { id }, include: detailInclude });
  });
}

async function clockOperation(tenantId, id, operationId, action, body, userId) {
  return runTx(async (tx) => {
    const wo = await tx.workOrder.findFirst({ where: { id, tenantId }, include: detailInclude });
    if (!wo) throw new ProductionError('Work order not found', 404);
    if (!['RELEASED', 'IN_PROGRESS'].includes(wo.status)) {
      throw new ProductionError('Release the work order before starting');
    }
    const operation = wo.operations.find((row) => row.id === operationId);
    if (!operation) throw new ProductionError('Operation not found', 404);
    if (operation.status === 'COMPLETE') throw new ProductionError('This operation is already complete');
    const operatorName = body.operatorName || body.operator || null;

    if (action === 'START') {
      if (operation.status !== 'RUNNING') {
        await tx.workOrderOperation.update({
          where: { id: operation.id },
          data: { status: 'RUNNING', runningSince: new Date() }
        });
        await tx.operationTimeLog.create({
          data: { tenantId, operationId: operation.id, action: 'START', operatorName }
        });
      }
    } else {
      if (operation.status !== 'RUNNING') throw new ProductionError('Start the operation before stopping it');
      const elapsed = operation.runningSince
        ? Math.max(0, (Date.now() - new Date(operation.runningSince).getTime()) / 60000)
        : 0;
      await tx.workOrderOperation.update({
        where: { id: operation.id },
        data: {
          status: 'PAUSED',
          runningSince: null,
          actualMachineMinutes: round4(num(operation.actualMachineMinutes) + elapsed)
        }
      });
      await tx.operationTimeLog.create({
        data: {
          tenantId,
          operationId: operation.id,
          action: action === 'PAUSE' ? 'PAUSE' : 'STOP',
          elapsedMinutes: round4(elapsed),
          operatorName
        }
      });
    }

    if (wo.status === 'RELEASED') {
      await tx.workOrder.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      await mirrorLegacy(tx, { ...wo, createdBy: userId }, 'IN_PROGRESS');
    }
    return tx.workOrder.findFirst({ where: { id }, include: detailInclude });
  });
}

async function confirmOperation(tenantId, id, body, userId) {
  return runTx(async (tx) => {
    const wo = await tx.workOrder.findFirst({ where: { id, tenantId }, include: detailInclude });
    if (!wo) throw new ProductionError('Work order not found', 404);
    if (!['RELEASED', 'IN_PROGRESS'].includes(wo.status)) {
      throw new ProductionError('Release the work order before confirming');
    }
    const operation = body.operationId
      ? wo.operations.find((row) => row.id === body.operationId)
      : (wo.operations.length === 1 ? wo.operations[0] : null);
    if (!operation) throw new ProductionError('Operation is required');

    const yieldQty = round4(Math.max(0, num(body.yieldQty ?? body.yield)));
    const scrapQty = round4(Math.max(0, num(body.scrapQty ?? body.scrap)));
    const reworkQty = round4(Math.max(0, num(body.reworkQty ?? body.rework)));
    if (yieldQty + scrapQty + reworkQty <= 0) {
      throw new ProductionError('Enter a yield, scrap, or rework quantity');
    }
    const lastSequence = (wo.operations || []).reduce((max, row) => Math.max(max, num(row.sequence)), 0);
    const isLast = num(operation.sequence) === lastSequence;
    const previous = [...wo.operations]
      .filter((row) => num(row.sequence) < num(operation.sequence))
      .sort((a, b) => num(b.sequence) - num(a.sequence))[0];
    const ceiling = previous ? num(previous.yieldQty) : num(wo.quantity);
    const upstreamClosed = !previous || previous.status === 'COMPLETE';
    const processed = round4(num(operation.yieldQty) + num(operation.scrapQty) + yieldQty + scrapQty);
    if (processed - ceiling > 0.00005) {
      throw new ProductionError('Yield exceeds the remaining quantity for this operation');
    }
    if (scrapQty > 0 && !body.scrapReasonId) throw new ProductionError('Scrap reason is required');
    if (reworkQty > 0 && !body.reworkReasonId) throw new ProductionError('Rework reason is required');

    if (body.scrapReasonId) {
      const reason = await tx.reasonCode.findFirst({ where: { id: body.scrapReasonId, tenantId, category: 'SCRAP' } });
      if (!reason) throw new ProductionError('Scrap reason is required');
    }
    if (body.reworkReasonId) {
      const reason = await tx.reasonCode.findFirst({ where: { id: body.reworkReasonId, tenantId, category: 'REWORK' } });
      if (!reason) throw new ProductionError('Rework reason is required');
    }

    const labourMinutes = round4(Math.max(0, num(body.labourMinutes)));
    const machineMinutes = round4(Math.max(0, num(body.machineMinutes)));
    const labourCost = round4((labourMinutes / 60) * num(wo.labourRatePerHour));
    const machineCost = round4((machineMinutes / 60) * num(operation.machineRatePerHour));
    const subcontractCost = operation.isSubcontract
      ? round4(num(operation.subcontractCostPerUnit) * (yieldQty + scrapQty))
      : 0;
    const overheadCost = round4((labourCost + machineCost + subcontractCost) * num(wo.overheadPercent) / 100);

    const confirmation = await tx.workOrderConfirmation.create({
      data: {
        tenantId,
        workOrderId: wo.id,
        operationId: operation.id,
        yieldQty,
        scrapQty,
        reworkQty,
        scrapReasonId: body.scrapReasonId || null,
        reworkReasonId: body.reworkReasonId || null,
        labourMinutes,
        machineMinutes,
        labourCost,
        machineCost,
        subcontractCost,
        overheadCost,
        lotNumber: body.lotNumber || null,
        serialNumbers: serialText(body.serialNumbers || body.serialNumber),
        operatorName: body.operatorName || null,
        createdBy: userId || null
      }
    });

    let materialCost = 0;
    let scrapCost = 0;
    if (isLast && wo.issueMode === 'BACKFLUSH' && (yieldQty + scrapQty) > 0) {
      const lots = Array.isArray(body.componentLots) ? body.componentLots : [];
      for (const component of wo.components) {
        const qty = round4(num(component.quantityPer) * (yieldQty + scrapQty) * (1 + num(component.scrapPercent) / 100));
        if (!(qty > 0)) continue;
        const lot = lots.find((row) => row.productId === component.productId || row.componentId === component.id) || {};
        const issue = await postIssue(tx, {
          wo,
          component,
          quantity: qty,
          mode: 'BACKFLUSH',
          lotNumber: lot.lotNumber || body.componentLotNumber || null,
          serialNumber: serialText(lot.serialNumber || lot.serialNumbers),
          userId,
          confirmationId: confirmation.id,
          yieldQty,
          scrapQty
        });
        materialCost = round4(materialCost + num(issue?.materialCost));
        scrapCost = round4(scrapCost + num(issue?.scrapCost));
      }
    }

    await tx.workOrderConfirmation.update({
      where: { id: confirmation.id },
      data: { materialCost, scrapCost }
    });

    const labourAbsorb = round4(labourCost + machineCost + subcontractCost);
    if (labourAbsorb > 0 || overheadCost > 0) {
      const map = await ensureGlMap(tx, tenantId, userId);
      await postJournal(tx, {
        tenantId,
        date: new Date(),
        createdBy: userId,
        description: `Absorption ${wo.orderNumber}`,
        referenceType: 'WORK_ORDER',
        referenceId: wo.id,
        lines: [
          { accountId: map.WIP, debit: round4(labourAbsorb + overheadCost), credit: 0, description: 'Absorption' },
          { accountId: map.ABSORBED_LABOUR, debit: 0, credit: labourAbsorb, description: 'Absorbed labour' },
          { accountId: map.ABSORBED_OVERHEAD, debit: 0, credit: overheadCost, description: 'Absorbed overhead' }
        ]
      });
    }

    if (isLast && yieldQty > 0) {
      const capitalized = round4(materialCost + labourCost + machineCost + subcontractCost + overheadCost);
      await postFinishedGoods(tx, wo, {
        quantity: yieldQty,
        unitCost: round4(capitalized / yieldQty),
        lotNumber: body.lotNumber,
        serialNumber: serialText(body.serialNumbers || body.serialNumber),
        userId
      });
    }

    let clockMinutes = num(operation.actualMachineMinutes);
    let runningSince = operation.runningSince;
    let opStatus = operation.status;
    if (operation.status === 'RUNNING' && operation.runningSince) {
      const elapsed = Math.max(0, (Date.now() - new Date(operation.runningSince).getTime()) / 60000);
      clockMinutes = round4(clockMinutes + elapsed);
      runningSince = null;
      opStatus = 'PAUSED';
    }
    const nextYield = round4(num(operation.yieldQty) + yieldQty);
    const nextScrap = round4(num(operation.scrapQty) + scrapQty);
    if (upstreamClosed && ceiling > 0 && nextYield + nextScrap + 0.00005 >= ceiling) opStatus = 'COMPLETE';
    await tx.workOrderOperation.update({
      where: { id: operation.id },
      data: {
        yieldQty: nextYield,
        scrapQty: round4(num(operation.scrapQty) + scrapQty),
        reworkQty: round4(num(operation.reworkQty) + reworkQty),
        actualMachineMinutes: clockMinutes,
        runningSince,
        status: opStatus
      }
    });

    await tx.workOrder.update({
      where: { id: wo.id },
      data: {
        status: 'IN_PROGRESS',
        quantityCompleted: isLast ? round4(num(wo.quantityCompleted) + yieldQty) : num(wo.quantityCompleted),
        quantityScrapped: isLast ? round4(num(wo.quantityScrapped) + scrapQty) : num(wo.quantityScrapped),
        quantityRework: isLast ? round4(num(wo.quantityRework) + reworkQty) : num(wo.quantityRework),
        quantityReceipted: isLast ? round4(num(wo.quantityReceipted) + yieldQty) : num(wo.quantityReceipted)
      }
    });
    await mirrorLegacy(tx, wo, 'IN_PROGRESS');
    await recomputeActuals(tx, wo);
    const workOrder = await tx.workOrder.findFirst({ where: { id }, include: detailInclude });
    return { workOrder, confirmationId: confirmation.id };
  });
}

async function technicallyComplete(tenantId, id) {
  const wo = await getWorkOrder(tenantId, id);
  if (!['RELEASED', 'IN_PROGRESS'].includes(wo.status)) {
    throw new ProductionError('Only released or in-progress work orders can be technically completed');
  }
  await prisma.workOrder.update({ where: { id }, data: { status: 'TECO' } });
  await mirrorLegacy(prisma, wo, 'TECO');
  return getWorkOrder(tenantId, id);
}

async function wipBalance(tx, tenantId, workOrderId) {
  const map = await ensureGlMap(tx, tenantId, null);
  const lines = await tx.journalLine.findMany({
    where: {
      accountId: map.WIP,
      journalEntry: { tenantId, referenceType: 'WORK_ORDER', referenceId: workOrderId, isPosted: true }
    }
  });
  return {
    map,
    balance: money(lines.reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0))
  };
}

async function closeWorkOrder(tenantId, id) {
  const wo = await getWorkOrder(tenantId, id);
  if (wo.status !== 'TECO') throw new ProductionError('Technically complete the work order before closing it');
  await runTx(async (tx) => {
    const { map, balance } = await wipBalance(tx, tenantId, id);
    if (Math.abs(balance) > 0.0001) {
      const view = costView(wo);
      const names = [
        ['material', 'VARIANCE_MATERIAL'],
        ['labour', 'VARIANCE_LABOUR'],
        ['overhead', 'VARIANCE_OVERHEAD'],
        ['scrap', 'VARIANCE_SCRAP']
      ];
      const weights = names.map(([name, key]) => ({
        key,
        weight: Math.abs(num(view.variance.buckets[name]?.variance))
      }));
      let weightTotal = weights.reduce((sum, row) => sum + row.weight, 0);
      if (weightTotal < 0.0001) {
        weights.forEach((row) => { row.weight = row.key === 'VARIANCE_SCRAP' ? 1 : 0; });
        weightTotal = 1;
      }
      const amount = Math.abs(balance);
      let used = 0;
      const varianceLines = weights.map((row, index) => {
        const share = index === weights.length - 1
          ? money(amount - used)
          : money(amount * row.weight / weightTotal);
        used = money(used + share);
        return balance > 0
          ? { accountId: map[row.key], debit: share, credit: 0, description: row.key }
          : { accountId: map[row.key], debit: 0, credit: share, description: row.key };
      }).filter((line) => line.debit > 0 || line.credit > 0);
      await postJournal(tx, {
        tenantId,
        date: new Date(),
        description: `Close WIP ${wo.orderNumber}`,
        referenceType: 'WORK_ORDER',
        referenceId: id,
        lines: [
          ...varianceLines,
          balance > 0
            ? { accountId: map.WIP, debit: 0, credit: money(balance), description: 'Close WIP' }
            : { accountId: map.WIP, debit: money(amount), credit: 0, description: 'Close WIP' }
        ]
      });
    }
    await closeReservations(tx, id);
    await tx.workOrder.update({ where: { id }, data: { status: 'CLOSED' } });
    await mirrorLegacy(tx, wo, 'CLOSED');
  });
  return getWorkOrder(tenantId, id);
}

async function cancelWorkOrder(tenantId, id) {
  const wo = await getWorkOrder(tenantId, id);
  if (!['CREATED', 'RELEASED'].includes(wo.status)) {
    throw new ProductionError('Only created or released work orders can be cancelled');
  }
  const touched = wo.issues.length > 0 || wo.confirmations.length > 0 || wo.components.some((row) => num(row.issuedQty) > 0);
  if (touched) throw new ProductionError('Cannot cancel a work order that has issues or confirmations');
  await runTx(async (tx) => {
    await closeReservations(tx, id);
    await tx.workOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await mirrorLegacy(tx, wo, 'CANCELLED');
  });
  return getWorkOrder(tenantId, id);
}

function costView(wo) {
  const fullPlan = rollupCost({
    quantity: num(wo.quantity),
    components: wo.components || [],
    operations: wo.operations || [],
    labourRatePerHour: num(wo.labourRatePerHour),
    overheadPercent: num(wo.overheadPercent)
  });
  const confirmedQty = round4(num(wo.quantityCompleted) + num(wo.quantityScrapped));
  const factor = num(wo.quantity) > 0 ? confirmedQty / num(wo.quantity) : 0;
  const planned = prorateSheet(fullPlan, factor);
  const actual = {
    material: num(wo.actualMaterialCost),
    scrap: num(wo.actualScrapCost),
    labour: num(wo.actualLabourCost),
    machine: num(wo.actualMachineCost),
    subcontract: num(wo.actualSubcontractCost),
    overhead: num(wo.actualOverheadCost)
  };
  actual.total = round4(actual.material + actual.scrap + actual.labour + actual.machine + actual.subcontract + actual.overhead);
  actual.unitCost = num(wo.quantityCompleted) > 0 ? round4((actual.material + actual.labour + actual.machine + actual.subcontract + actual.overhead) / num(wo.quantityCompleted)) : 0;
  return {
    planned,
    fullPlan,
    actual,
    variance: varianceReport(planned, actual),
    confirmedQuantity: confirmedQty,
    quantityCompleted: num(wo.quantityCompleted),
    quantityScrapped: num(wo.quantityScrapped),
    quantityRework: num(wo.quantityRework)
  };
}

async function getCost(tenantId, id) {
  const wo = await getWorkOrder(tenantId, id);
  return { workOrderId: wo.id, orderNumber: wo.orderNumber, ...costView(wo) };
}

async function quoteRollup(tenantId, { productId, quantity, bomId }) {
  if (!productId) throw new ProductionError('Product is required');
  const qty = num(quantity);
  if (!(qty > 0)) throw new ProductionError('Quantity must be greater than zero');
  const snapshot = await buildSnapshot(prisma, { tenantId, productId, bomId, quantity: qty });
  return {
    product: {
      id: snapshot.product.id,
      code: snapshot.product.code,
      name: snapshot.product.name
    },
    bom: snapshot.bom ? { id: snapshot.bom.id, code: snapshot.bom.code, version: snapshot.bom.version } : null,
    quantity: qty,
    ...snapshot.planned,
    note: 'Material uses standard cost, then the next open FIFO layer, then the last receipt, then cost price. Labour uses the tenant labour rate. Overhead is the tenant percent on labour and subcontract.'
  };
}

async function productVarianceReport(tenantId) {
  const orders = await prisma.workOrder.findMany({
    where: { tenantId, status: { in: ['RELEASED', 'IN_PROGRESS', 'TECO', 'CLOSED'] } },
    include: detailInclude,
    orderBy: { orderNumber: 'asc' }
  });
  const lines = orders.map((wo) => ({
    id: wo.id,
    orderNumber: wo.orderNumber,
    status: wo.status,
    productId: wo.productId,
    code: wo.product?.code,
    name: wo.product?.name,
    quantity: num(wo.quantity),
    quantityCompleted: num(wo.quantityCompleted),
    ...costView(wo)
  }));
  const products = new Map();
  lines.forEach((line) => {
    const current = products.get(line.productId) || {
      productId: line.productId,
      code: line.code,
      name: line.name,
      orderCount: 0,
      planned: emptySheet(),
      actual: emptySheet()
    };
    current.orderCount += 1;
    Object.keys(current.planned).forEach((key) => {
      current.planned[key] = round4(current.planned[key] + num(line.planned[key]));
      current.actual[key] = round4(current.actual[key] + num(line.actual[key]));
    });
    current.variance = varianceReport(current.planned, current.actual);
    products.set(line.productId, current);
  });
  return { orders: lines, products: [...products.values()] };
}

async function loadCapacity(tenantId, query = {}) {
  const settings = await getSettings(prisma, tenantId);
  const start = query.from ? new Date(query.from) : new Date();
  if (!query.from) {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
  }
  const end = query.to
    ? new Date(query.to)
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const [workstations, shifts, events, orders] = await Promise.all([
    prisma.workstation.findMany({ where: { tenantId } }),
    prisma.shiftPattern.findMany({ where: { tenantId } }),
    prisma.productionCalendarEvent.findMany({
      where: { tenantId, date: { gte: start, lte: end } }
    }),
    prisma.workOrder.findMany({
      where: { tenantId, status: { in: ['CREATED', 'RELEASED', 'IN_PROGRESS'] } },
      include: { operations: true }
    })
  ]);
  const loads = [];
  orders.forEach((order) => {
    order.operations.forEach((operation) => {
      const done = num(operation.yieldQty) + num(operation.scrapQty);
      const remaining = Math.max(0, num(order.quantity) - num(operation.yieldQty) - num(operation.scrapQty));
      const setup = done > 0 ? 0 : num(operation.setupMinutes);
      const hours = (setup + num(operation.runMinutesPerUnit) * remaining) / 60;
      if (!(hours > 0)) return;
      loads.push({
        workstationId: operation.workstationId,
        hours,
        startDate: order.startDate || new Date(),
        endDate: order.endDate || order.startDate || new Date()
      });
    });
  });
  return buildLoadProfile({
    from: start,
    to: end,
    settings,
    workstations,
    shifts,
    events,
    loads
  });
}

async function scanWorkOrder(tenantId, code) {
  const trimmed = String(code || '').trim();
  if (!trimmed) throw new ProductionError('Scan a work order number');
  const wo = await prisma.workOrder.findFirst({
    where: {
      tenantId,
      OR: [
        { orderNumber: { equals: trimmed, mode: 'insensitive' } },
        { legacyJob: { is: { jobNumber: { equals: trimmed, mode: 'insensitive' } } } },
        { legacyOrder: { is: { orderNumber: { equals: trimmed, mode: 'insensitive' } } } }
      ]
    },
    include: detailInclude
  });
  if (!wo) throw new ProductionError('Work order not found', 404);
  return wo;
}

function takeQty(bucket, productId, quantity) {
  const have = Math.max(0, num(bucket.get(productId)));
  const used = Math.min(have, Math.max(0, num(quantity)));
  bucket.set(productId, round4(have - used));
  return round4(used);
}

async function freeFinishedStock(db, tenantId, productIds, exceptSalesOrderId) {
  const pool = new Map();
  for (const productId of productIds) {
    pool.set(productId, await onHand(db, tenantId, productId, null));
  }
  if (!productIds.length) return pool;
  const others = await db.salesOrder.findMany({
    where: {
      tenantId,
      id: { not: exceptSalesOrderId },
      status: { notIn: ['CANCELLED', 'CLOSED'] }
    },
    include: {
      items: { where: { productId: { in: productIds } } },
      deliveries: { where: { status: 'DELIVERED' }, include: { items: true } }
    }
  });
  for (const other of others) {
    const shipped = new Map();
    for (const delivery of other.deliveries) {
      for (const line of delivery.items) {
        shipped.set(line.productId, round4((shipped.get(line.productId) || 0) + num(line.quantity)));
      }
    }
    for (const item of other.items) {
      const shippedQty = takeQty(shipped, item.productId, item.quantity);
      const remaining = round4(num(item.quantity) - shippedQty);
      if (remaining > 0.00005 && pool.has(item.productId)) {
        pool.set(item.productId, round4(pool.get(item.productId) - remaining));
      }
    }
  }
  return pool;
}

async function createDraftsForSalesOrder({ tenantId, userId, salesOrderId }) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, tenantId },
    include: {
      items: { include: { product: true } },
      deliveries: { where: { status: 'DELIVERED' }, include: { items: true } }
    }
  });
  if (!order) return [];

  const drafts = await prisma.workOrder.findMany({
    where: { tenantId, salesOrderId, status: 'CREATED' },
    orderBy: { createdAt: 'asc' }
  });
  const used = new Set();
  const result = [];
  const makeableIds = [...new Set(order.items.filter((item) => item.product?.bomApplicable).map((item) => item.productId))];
  const pool = await freeFinishedStock(prisma, tenantId, makeableIds, order.id);
  const shipped = new Map();
  for (const delivery of order.deliveries) {
    for (const line of delivery.items) {
      shipped.set(line.productId, round4((shipped.get(line.productId) || 0) + num(line.quantity)));
    }
  }

  for (const item of order.items) {
    if (!item.product || !item.product.bomApplicable) continue;
    const ordered = num(item.quantity);
    const alreadyShipped = takeQty(shipped, item.productId, ordered);
    const stillNeeded = round4(ordered - alreadyShipped);
    const covered = takeQty(pool, item.productId, stillNeeded);
    const shortfall = round4(stillNeeded - covered);
    if (!(shortfall > 0.00005)) continue;
    const draft = drafts.find((row) => !used.has(row.id) && row.productId === item.productId);
    if (draft) {
      used.add(draft.id);
      if (round4(num(draft.quantity)) !== shortfall || draft.salesOrderItemId !== item.id) {
        await prisma.workOrder.update({
          where: { id: draft.id },
          data: {
            quantity: shortfall,
            salesOrderItemId: item.id,
            sourceId: order.id,
            notes: `Sales order ${order.orderNumber}`
          }
        });
        await refreshPlan(prisma, draft.id);
      }
      result.push(await prisma.workOrder.findUnique({ where: { id: draft.id } }));
      continue;
    }
    result.push(await createInside(prisma, {
      tenantId,
      userId,
      productId: item.productId,
      quantity: shortfall,
      sourceType: 'SALES_ORDER',
      sourceId: order.id,
      salesOrderId: order.id,
      salesOrderItemId: item.id,
      notes: `Sales order ${order.orderNumber}`,
      status: 'CREATED',
      unscheduled: true
    }));
  }

  for (const draft of drafts) {
    if (used.has(draft.id)) continue;
    await prisma.workOrder.update({
      where: { id: draft.id },
      data: { status: 'CANCELLED', salesOrderItemId: null }
    });
  }
  return result;
}

module.exports = {
  ProductionError,
  getSettings,
  updateSettings,
  ensureReasonCodes,
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  releaseWorkOrder,
  issueMaterial,
  clockOperation,
  confirmOperation,
  technicallyComplete,
  closeWorkOrder,
  cancelWorkOrder,
  getCost,
  quoteRollup,
  productVarianceReport,
  loadCapacity,
  scanWorkOrder,
  createDraftsForSalesOrder,
  syncLegacy,
  migrateMissing,
  migrateAllTenants,
  costView
};
