const prisma = require('../../lib/prisma');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { ensureGlMap, postJournal } = require('../glService');
const { money, dec } = require('../money');
const { receiveLayer, issueFifo } = require('./fifo');
const { ProductionError } = require('./errors');
const {
  round4, num, weekStart, weekKey, planItem, lineStandard, abnormalLoss,
  yieldPercents, substitutionDelta, stageCompletion, absorptionVariance, CONFIRMED_DEFAULTS
} = require('./productionMath');

const OPEN_WO = ['CREATED', 'RELEASED', 'IN_PROGRESS'];
const OPEN_SO = ['CANCELLED', 'CLOSED'];

function movementQty(movements) {
  return round4(movements.reduce((total, movement) => {
    const qty = num(movement.quantity);
    if (movement.type === 'GR' || (movement.type === 'ADJ' && qty > 0)) return total + Math.abs(qty);
    if (movement.type === 'GI' || (movement.type === 'ADJ' && qty < 0)) return total - Math.abs(qty);
    return total;
  }, 0));
}

async function batchIdFor(db, tenantId, productId, lotNumber) {
  if (!lotNumber || typeof db.stockBatch?.findFirst !== 'function') return null;
  const row = await db.stockBatch.findFirst({
    where: { tenantId, productId, lotNumber: String(lotNumber) }
  });
  return row?.id || null;
}

async function assertCostCenter(db, tenantId, costCenterId) {
  if (!costCenterId) return null;
  if (typeof db.orgCenter?.findFirst !== 'function') return String(costCenterId);
  const row = await db.orgCenter.findFirst({ where: { id: costCenterId, tenantId } });
  if (!row) throw new ProductionError('Cost center not found');
  return row.id;
}

function horizonWeeks(settings, requested) {
  const value = parseInt(requested ?? settings?.planningHorizonWeeks ?? 8, 10);
  if (!Number.isFinite(value) || value < 1 || value > 52) {
    throw new ProductionError('Planning horizon must be between 1 and 52 weeks');
  }
  return value;
}

async function runMps({ tenantId, userId, horizonWeeks: requested }) {
  const settings = await prisma.productionSetting.findUnique({ where: { tenantId } })
    || await prisma.productionSetting.create({ data: { tenantId } });
  const weeksCount = horizonWeeks(settings, requested);
  const first = weekStart(new Date());
  const weeks = Array.from({ length: weeksCount }, (_, index) => {
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() + index * 7);
    return start;
  });
  const weekIndex = new Map(weeks.map((start, index) => [weekKey(start), index]));
  const blank = () => weeks.map(() => 0);

  const products = await prisma.product.findMany({
    where: { tenantId, bomApplicable: true, planningPolicy: 'MAKE_TO_STOCK', activeStatus: { not: 'INACTIVE' } }
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  const [forecasts, salesOrders, workOrders, productionOrders, boms, movements] = await Promise.all([
    prisma.demandForecast.findMany({ where: { tenantId, weekStart: { gte: first } } }),
    prisma.salesOrder.findMany({
      where: { tenantId, status: { notIn: OPEN_SO } },
      include: { items: true, deliveries: { where: { status: 'DELIVERED' }, include: { items: true } } }
    }),
    prisma.workOrder.findMany({ where: { tenantId, status: { in: OPEN_WO } } }),
    prisma.productionOrder.findMany({ where: { tenantId, status: { in: ['RELEASED', 'WIP'] } } }),
    prisma.bOM.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { items: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    }),
    prisma.stockMovement.findMany({ where: { tenantId } })
  ]);

  const bomByProduct = new Map();
  boms.forEach((bom) => {
    if (!bomByProduct.has(bom.productId)) bomByProduct.set(bom.productId, bom);
  });
  const stock = new Map();
  movements.forEach((movement) => {
    if (!stock.has(movement.productId)) stock.set(movement.productId, []);
    stock.get(movement.productId).push(movement);
  });

  const forecastGrid = new Map();
  const orderGrid = new Map();
  const receiptGrid = new Map();
  const touch = (grid, productId) => {
    if (!grid.has(productId)) grid.set(productId, blank());
    return grid.get(productId);
  };
  forecasts.forEach((row) => {
    const index = weekIndex.get(weekKey(row.weekStart));
    if (index === undefined || !byId.has(row.productId)) return;
    const cells = touch(forecastGrid, row.productId);
    cells[index] = round4(cells[index] + num(row.quantity));
  });
  salesOrders.forEach((order) => {
    const index = weekIndex.get(weekKey(order.date));
    if (index === undefined) return;
    const shipped = new Map();
    order.deliveries.forEach((delivery) => {
      delivery.items.forEach((line) => {
        shipped.set(line.productId, round4((shipped.get(line.productId) || 0) + num(line.quantity)));
      });
    });
    order.items.forEach((line) => {
      if (!byId.has(line.productId)) return;
      const open = round4(Math.max(0, num(line.quantity) - (shipped.get(line.productId) || 0)));
      if (!(open > 0)) return;
      const cells = touch(orderGrid, line.productId);
      cells[index] = round4(cells[index] + open);
    });
  });

  const linkedOrders = new Set(workOrders.map((row) => row.legacyOrderId).filter(Boolean));
  const addReceipt = (productId, when, quantity) => {
    if (!byId.has(productId) || !(quantity > 0)) return;
    let index = weekIndex.get(weekKey(when || first));
    if (index === undefined) index = 0;
    const cells = touch(receiptGrid, productId);
    cells[index] = round4(cells[index] + quantity);
  };
  workOrders.forEach((row) => {
    addReceipt(row.productId, row.endDate || row.startDate, Math.max(0, num(row.quantity) - num(row.quantityCompleted)));
  });
  productionOrders.forEach((row) => {
    if (linkedOrders.has(row.id)) return;
    addReceipt(row.productId, row.endDate || row.startDate, num(row.quantity));
  });

  const interesting = products.filter((product) => {
    const safety = num(product.safetyStock);
    const target = num(product.stockTarget);
    const hasForecast = (forecastGrid.get(product.id) || []).some((qty) => qty > 0);
    const hasOrders = (orderGrid.get(product.id) || []).some((qty) => qty > 0);
    const onHand = movementQty(stock.get(product.id) || []);
    return hasForecast || hasOrders || safety > 0 || target > 0 || onHand < safety;
  });

  let dependent = new Map();
  let plannedByProduct = new Map();
  let purchaseNeeds = [];
  for (let depth = 0; depth < 6; depth += 1) {
    const nextDependent = new Map();
    purchaseNeeds = [];
    plannedByProduct = new Map();
    interesting.forEach((product) => {
      const extra = dependent.get(product.id) || blank();
      const forecast = forecastGrid.get(product.id) || blank();
      const orders = orderGrid.get(product.id) || blank();
      const receipts = receiptGrid.get(product.id) || blank();
      const result = planItem({
        opening: movementQty(stock.get(product.id) || []),
        buckets: weeks.map((start, index) => ({
          weekStart: start,
          forecast: forecast[index],
          orders: round4(orders[index] + extra[index]),
          receipts: receipts[index]
        })),
        safetyStock: product.safetyStock,
        stockTarget: product.stockTarget,
        lotPolicy: product.lotPolicy,
        fixedLotQty: product.fixedLotQty,
        minLotQty: product.minLotQty,
        leadDays: product.manufacturingLeadDays
      });
      plannedByProduct.set(product.id, { product, ...result });
      const bom = bomByProduct.get(product.id);
      result.plannedOrders.forEach((order) => {
        const index = weekIndex.get(weekKey(order.startDate)) ?? 0;
        (bom?.items || []).forEach((item) => {
          const component = byId.get(item.productId);
          const need = round4(num(item.quantity) * order.quantity * (1 + num(item.scrapPercent) / 100));
          if (!(need > 0)) return;
          if (component) {
            if (!nextDependent.has(item.productId)) nextDependent.set(item.productId, blank());
            const cells = nextDependent.get(item.productId);
            cells[index] = round4(cells[index] + need);
            if (!interesting.find((row) => row.id === item.productId)) interesting.push(component);
          } else {
            purchaseNeeds.push({ productId: item.productId, quantity: need, weekStart: weeks[index] });
          }
        });
      });
    });
    const same = [...nextDependent.entries()].every(([productId, cells]) => {
      const previous = dependent.get(productId) || blank();
      return cells.every((qty, index) => Math.abs(qty - previous[index]) < 0.0001);
    }) && nextDependent.size === dependent.size;
    dependent = nextDependent;
    if (same) break;
  }

  const purchaseByProduct = new Map();
  for (const need of purchaseNeeds) {
    const current = purchaseByProduct.get(need.productId) || { productId: need.productId, quantity: 0 };
    current.quantity = round4(current.quantity + need.quantity);
    purchaseByProduct.set(need.productId, current);
  }
  const componentProducts = await prisma.product.findMany({
    where: { tenantId, id: { in: [...purchaseByProduct.keys()] } }
  });
  const componentById = new Map(componentProducts.map((product) => [product.id, product]));

  const run = await prisma.$transaction(async (tx) => {
    await tx.plannedProductionOrder.updateMany({
      where: { tenantId, status: 'PLANNED' },
      data: { status: 'SUPERSEDED' }
    });
    const created = await tx.mpsRun.create({
      data: {
        tenantId,
        horizonWeeks: weeksCount,
        weekStart: first,
        createdBy: userId || null
      }
    });
    const bucketRows = [];
    const orderRows = [];
    plannedByProduct.forEach(({ product, buckets, plannedOrders }) => {
      buckets.forEach((bucket) => bucketRows.push({
        tenantId,
        runId: created.id,
        productId: product.id,
        weekStart: bucket.weekStart,
        opening: bucket.opening,
        forecastQty: bucket.forecast,
        orderQty: bucket.orders,
        demandQty: bucket.demand,
        receiptsQty: bucket.receipts,
        projected: bucket.projected,
        safetyStock: bucket.safetyStock,
        stockTarget: bucket.stockTarget,
        plannedQty: bucket.plannedQty
      }));
      plannedOrders.forEach((order) => orderRows.push({
        tenantId,
        runId: created.id,
        productId: product.id,
        quantity: order.quantity,
        startDate: order.startDate,
        dueDate: order.dueDate,
        weekStart: order.weekStart,
        status: 'PLANNED'
      }));
    });
    if (bucketRows.length) await tx.mpsBucket.createMany({ data: bucketRows });
    if (orderRows.length) await tx.plannedProductionOrder.createMany({ data: orderRows });
    return created;
  });

  const plannedOrders = await prisma.plannedProductionOrder.findMany({
    where: { tenantId, runId: run.id, status: 'PLANNED' },
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: [{ dueDate: 'asc' }, { productId: 'asc' }]
  });
  return {
    runId: run.id,
    horizonWeeks: weeksCount,
    weekStart: first,
    buckets: await prisma.mpsBucket.findMany({
      where: { runId: run.id },
      include: { product: { select: { id: true, code: true, name: true } } },
      orderBy: [{ productId: 'asc' }, { weekStart: 'asc' }]
    }),
    plannedOrders,
    purchaseNeeds: [...purchaseByProduct.values()].map((need) => {
      const product = componentById.get(need.productId);
      return {
        productId: need.productId,
        code: product?.code,
        name: product?.name,
        quantity: need.quantity,
        grossDemand: need.quantity,
        currentStock: movementQty(stock.get(need.productId) || []),
        safetyStock: num(product?.safetyStock),
        openOrders: 0,
        shortage: need.quantity,
        costPrice: num(product?.costPrice)
      };
    })
  };
}

async function latestMps(tenantId) {
  const run = await prisma.mpsRun.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });
  if (!run) return { run: null, buckets: [], plannedOrders: [] };
  const [buckets, plannedOrders] = await Promise.all([
    prisma.mpsBucket.findMany({
      where: { runId: run.id },
      include: { product: { select: { id: true, code: true, name: true } } },
      orderBy: [{ weekStart: 'asc' }, { productId: 'asc' }]
    }),
    prisma.plannedProductionOrder.findMany({
      where: { tenantId, status: { in: ['PLANNED', 'CONVERTED'] } },
      include: { product: { select: { id: true, code: true, name: true } }, workOrder: { select: { id: true, orderNumber: true } } },
      orderBy: { dueDate: 'asc' }
    })
  ]);
  return { run, buckets, plannedOrders };
}

async function saveForecast(tenantId, body) {
  if (!body.productId) throw new ProductionError('Product is required');
  const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
  if (!product) throw new ProductionError('Product not found');
  const quantity = num(body.quantity);
  if (quantity < 0) throw new ProductionError('Forecast quantity cannot be negative');
  const start = weekStart(body.weekStart || new Date());
  if (!start) throw new ProductionError('Week is required');
  if (!(quantity > 0)) {
    await prisma.demandForecast.deleteMany({ where: { tenantId, productId: product.id, weekStart: start } });
    return { productId: product.id, weekStart: start, quantity: 0 };
  }
  return prisma.demandForecast.upsert({
    where: { tenantId_productId_weekStart: { tenantId, productId: product.id, weekStart: start } },
    update: { quantity },
    create: { tenantId, productId: product.id, weekStart: start, quantity, notes: body.notes || null }
  });
}

async function listForecasts(tenantId) {
  return prisma.demandForecast.findMany({
    where: { tenantId },
    include: { product: { select: { id: true, code: true, name: true, planningPolicy: true } } },
    orderBy: [{ weekStart: 'asc' }, { productId: 'asc' }]
  });
}

async function firmPlannedOrder(tenantId, userId, id) {
  const planned = await prisma.plannedProductionOrder.findFirst({
    where: { id, tenantId },
    include: { workOrder: true }
  });
  if (!planned) throw new ProductionError('Planned order not found', 404);
  if (planned.status === 'CONVERTED' && planned.workOrder) return planned;
  if (planned.status !== 'PLANNED') throw new ProductionError('Only a planned order can be firmed');
  const { createWorkOrder } = require('./workOrders');
  const workOrder = await createWorkOrder(tenantId, userId, {
    productId: planned.productId,
    quantity: num(planned.quantity),
    startDate: planned.startDate,
    endDate: planned.dueDate,
    sourceType: 'MPS',
    sourceId: planned.id,
    notes: 'Firmed from the weekly MPS'
  });
  return prisma.plannedProductionOrder.update({
    where: { id },
    data: { status: 'CONVERTED', workOrderId: workOrder.id },
    include: { product: true, workOrder: { select: { id: true, orderNumber: true } } }
  });
}

async function saveAlternate(tenantId, body) {
  const ratio = num(body.ratio ?? 1);
  if (!(ratio > 0)) throw new ProductionError('Substitution ratio must be greater than zero');
  const item = await prisma.bOMItem.findFirst({
    where: { id: body.bomItemId, tenantId },
    include: { bom: true }
  });
  if (!item) throw new ProductionError('BOM component not found');
  const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId, activeStatus: { not: 'INACTIVE' } } });
  if (!product) throw new ProductionError('Alternate product not found');
  if (product.id === item.productId) throw new ProductionError('The alternate must be a different item');
  return prisma.bomAlternate.upsert({
    where: { bomItemId_productId: { bomItemId: item.id, productId: product.id } },
    update: { ratio, approved: body.approved !== false },
    create: {
      tenantId,
      bomItemId: item.id,
      productId: product.id,
      ratio,
      approved: body.approved !== false
    },
    include: { product: { select: { id: true, code: true, name: true } }, bomItem: true }
  });
}

async function listAlternates(tenantId, query) {
  const where = { tenantId };
  if (query.bomId) where.bomItem = { bomId: query.bomId };
  if (query.workOrderId) {
    const wo = await prisma.workOrder.findFirst({ where: { id: query.workOrderId, tenantId } });
    if (!wo?.bomId) return [];
    where.bomItem = { bomId: wo.bomId };
  }
  return prisma.bomAlternate.findMany({
    where,
    include: {
      product: { select: { id: true, code: true, name: true } },
      bomItem: { include: { componentProduct: { select: { id: true, code: true, name: true } } } }
    },
    orderBy: { createdAt: 'asc' }
  });
}

async function findAlternate(db, { tenantId, bomId, componentProductId, substituteProductId }) {
  if (!substituteProductId || substituteProductId === componentProductId) return null;
  const alternate = await db.bomAlternate.findFirst({
    where: {
      tenantId,
      productId: substituteProductId,
      approved: true,
      bomItem: { bomId, productId: componentProductId }
    }
  });
  if (!alternate) throw new ProductionError('Substitution is not an approved alternate');
  return alternate;
}

function deltaForIssue({ actualCost, standardUnitCost, componentQty }) {
  return substitutionDelta({ actualCost, standardUnitCost, componentQty });
}

async function recordGenealogy(db, wo, { fgLot, confirmationId }) {
  const issues = await db.workOrderIssue.findMany({ where: { workOrderId: wo.id } });
  for (const issue of issues) {
    const rmProductId = issue.issuedProductId || issue.productId;
    if (!issue.lotNumber && !fgLot) continue;
    const existing = await db.batchGenealogy.findFirst({
      where: { tenantId: wo.tenantId, issueId: issue.id, fgLotNumber: fgLot || null }
    });
    if (existing) continue;
    await db.batchGenealogy.create({
      data: {
        tenantId: wo.tenantId,
        workOrderId: wo.id,
        confirmationId: confirmationId || null,
        issueId: issue.id,
        fgProductId: wo.productId,
        fgLotNumber: fgLot || null,
        fgBatchId: await batchIdFor(db, wo.tenantId, wo.productId, fgLot),
        rmProductId,
        rmLotNumber: issue.lotNumber || null,
        rmBatchId: await batchIdFor(db, wo.tenantId, rmProductId, issue.lotNumber),
        quantity: issue.quantity
      }
    });
  }
}

async function flagAbnormalLoss(db, workOrderId) {
  const fresh = await db.workOrder.findFirst({
    where: { id: workOrderId },
    include: { product: { include: { productGroupRel: true } } }
  });
  if (!fresh) return null;
  const settings = await db.productionSetting.findUnique({ where: { tenantId: fresh.tenantId } });
  const standard = lineStandard(fresh.product, fresh.product.productGroupRel, settings || {});
  const loss = abnormalLoss({
    good: fresh.quantityCompleted,
    scrap: fresh.quantityScrapped,
    standardScrapPercent: standard.scrapPercent,
    threshold: standard.threshold
  });
  const existing = await db.abnormalLoss.findFirst({ where: { workOrderId, tenantId: fresh.tenantId } });
  if (!loss) {
    if (existing && existing.status === 'PENDING') await db.abnormalLoss.delete({ where: { id: existing.id } });
    return null;
  }
  const throughput = num(fresh.quantityCompleted) + num(fresh.quantityScrapped);
  const unit = throughput > 0 ? num(fresh.actualMaterialCost) / throughput : num(fresh.product.standardCost);
  const amount = round4(loss.excessQty * unit);
  if (existing?.status === 'POSTED') return existing;
  const data = { ...loss, amount, productLine: fresh.product.productGroupRel?.name || fresh.product.code };
  if (existing) return db.abnormalLoss.update({ where: { id: existing.id }, data });
  return db.abnormalLoss.create({
    data: {
      tenantId: fresh.tenantId,
      workOrderId,
      status: 'PENDING',
      reason: 'Scrap above the product-line tolerance',
      ...data
    }
  });
}

async function listLosses(tenantId) {
  return prisma.abnormalLoss.findMany({
    where: { tenantId },
    include: { workOrder: { select: { id: true, orderNumber: true, product: { select: { code: true, name: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
}

async function approveLoss(tenantId, userId, id, body) {
  const reason = String(body.reason || '').trim();
  if (!reason) throw new ProductionError('A reason is required to approve an abnormal loss');
  return prisma.$transaction(async (tx) => {
    const loss = await tx.abnormalLoss.findFirst({
      where: { id, tenantId },
      include: { workOrder: true }
    });
    if (!loss) throw new ProductionError('Abnormal loss not found', 404);
    if (loss.status === 'POSTED') return loss;
    const amount = money(loss.amount);
    let journal = null;
    if (amount > 0) {
      const map = await ensureGlMap(tx, tenantId, userId);
      journal = await postJournal(tx, {
        tenantId,
        date: new Date(),
        createdBy: userId,
        description: `Abnormal loss ${loss.workOrder?.orderNumber || ''}`.trim(),
        referenceType: 'ABNORMAL_LOSS',
        referenceId: loss.id,
        lines: [
          { accountId: map.ABNORMAL_LOSS, debit: amount, credit: 0, description: reason },
          { accountId: map.WIP, debit: 0, credit: amount, description: 'Abnormal loss' }
        ]
      });
    }
    return tx.abnormalLoss.update({
      where: { id },
      data: {
        status: 'POSTED',
        reason,
        approvedBy: userId || null,
        approvedAt: new Date(),
        journalEntryId: journal?.id || null
      }
    });
  });
}

async function captureMachine(tenantId, userId, body) {
  const order = await prisma.workOrder.findFirst({
    where: { id: body.workOrderId, tenantId },
    include: { operations: true }
  });
  if (!order) throw new ProductionError('Work order not found', 404);
  const machine = await prisma.machine.findFirst({ where: { id: body.machineId, tenantId } });
  if (!machine) throw new ProductionError('Machine not found');
  const operation = body.operationId
    ? order.operations.find((row) => row.id === body.operationId)
    : order.operations[0];
  if (!operation) throw new ProductionError('Operation not found');
  const inputQty = num(body.inputQty);
  const outputQty = num(body.outputQty);
  const wastageQty = num(body.wastageQty);
  if (inputQty < 0 || outputQty < 0 || wastageQty < 0) throw new ProductionError('Quantities cannot be negative');
  if (!(inputQty > 0 || outputQty > 0)) throw new ProductionError('Enter an input or output quantity');
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    throw new ProductionError('Date and time are required');
  }
  const percents = yieldPercents({ input: inputQty, output: outputQty, wastage: wastageQty });
  const product = await prisma.product.findFirst({
    where: { id: order.productId, tenantId },
    include: { productGroupRel: true }
  });
  const settings = await prisma.productionSetting.findUnique({ where: { tenantId } });
  const standard = lineStandard(product, product?.productGroupRel, settings || {});
  return prisma.machineCapture.create({
    data: {
      tenantId,
      workOrderId: order.id,
      operationId: operation.id,
      machineId: machine.id,
      startedAt,
      endedAt,
      inputQty,
      outputQty,
      wastageQty,
      downtimeMinutes: Math.max(0, num(body.downtimeMinutes)),
      downtimeReason: body.downtimeReason || null,
      reworkQty: Math.max(0, num(body.reworkQty)),
      scrapQty: Math.max(0, num(body.scrapQty)),
      coproductQty: Math.max(0, num(body.coproductQty)),
      byproductProductId: body.byproductProductId || null,
      byproductQty: Math.max(0, num(body.byproductQty)),
      lotNumber: body.lotNumber || null,
      batchId: await batchIdFor(prisma, tenantId, order.productId, body.lotNumber),
      yieldPercent: percents.yieldPercent,
      wastagePercent: percents.wastagePercent,
      theoreticalYieldPercent: standard.yieldPercent,
      notes: body.notes || null,
      createdBy: userId || null
    },
    include: { machine: { select: { id: true, code: true, name: true } } }
  });
}

async function listCaptures(tenantId, query) {
  return prisma.machineCapture.findMany({
    where: { tenantId, ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}) },
    include: {
      machine: { select: { id: true, code: true, name: true } },
      workOrder: { select: { id: true, orderNumber: true } }
    },
    orderBy: { startedAt: 'desc' }
  });
}

async function saveLineStandard(tenantId, productGroupId, body) {
  const group = await prisma.productGroup.findFirst({ where: { id: productGroupId, tenantId } });
  if (!group) throw new ProductionError('Product line not found', 404);
  const yieldPercent = num(body.standardYieldPercent ?? group.standardYieldPercent);
  const scrap = num(body.standardScrapPercent ?? group.standardScrapPercent);
  const threshold = num(body.abnormalLossThreshold ?? group.abnormalLossThreshold);
  if (yieldPercent < 0 || yieldPercent > 100 || scrap < 0 || scrap > 100 || threshold < 0) {
    throw new ProductionError('Yield, scrap and the loss threshold must be between 0 and 100');
  }
  return prisma.productGroup.update({
    where: { id: group.id },
    data: {
      standardYieldPercent: yieldPercent,
      standardScrapPercent: scrap,
      abnormalLossThreshold: threshold
    }
  });
}

async function listLineStandards(tenantId) {
  return prisma.productGroup.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' }
  });
}

async function setMilestoneWeight(tenantId, operationId, body) {
  const weight = num(body.milestoneWeight);
  if (weight < 0 || weight > 100) throw new ProductionError('Milestone weight must be between 0 and 100');
  const operation = await prisma.workOrderOperation.findFirst({ where: { id: operationId, tenantId } });
  if (!operation) throw new ProductionError('Operation not found', 404);
  return prisma.workOrderOperation.update({ where: { id: operationId }, data: { milestoneWeight: weight } });
}

async function wipReport(tenantId) {
  const orders = await prisma.workOrder.findMany({
    where: { tenantId, status: { in: ['RELEASED', 'IN_PROGRESS', 'TECO'] } },
    include: {
      product: { select: { code: true, name: true } },
      operations: { orderBy: { sequence: 'asc' } }
    },
    orderBy: { orderNumber: 'asc' }
  });
  const rows = [];
  for (const order of orders) {
    const stage = stageCompletion(order.operations);
    const map = await ensureGlMap(prisma, tenantId, null);
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: map.WIP,
        journalEntry: { tenantId, referenceType: 'WORK_ORDER', referenceId: order.id, isPosted: true }
      }
    });
    const balance = money(lines.reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0));
    rows.push({
      orderNumber: order.orderNumber,
      item: `${order.product?.code || ''} ${order.product?.name || ''}`.trim(),
      stage: stage.stage,
      completionPercent: stage.percent,
      materialCost: round4(num(order.actualMaterialCost) + num(order.actualScrapCost)),
      labourOverhead: round4(num(order.actualLabourCost) + num(order.actualMachineCost) + num(order.actualSubcontractCost) + num(order.actualOverheadCost)),
      wipValue: balance
    });
  }
  return {
    key: 'wip-valuation',
    title: 'Work in Progress (WIP) Valuation',
    note: 'Stage comes from supervisor-confirmed routing milestones. Value is the open WIP balance.',
    columns: [
      { key: 'orderNumber', label: 'Production Order No' },
      { key: 'item', label: 'Item Description' },
      { key: 'stage', label: 'Stage of Completion' },
      { key: 'completionPercent', label: 'Completion %' },
      { key: 'materialCost', label: 'Material Cost Incurred' },
      { key: 'labourOverhead', label: 'Labor/Overhead Applied' },
      { key: 'wipValue', label: 'Total WIP Value' }
    ],
    rows
  };
}

async function varianceReport(tenantId) {
  const { productVarianceReport, costView } = require('./workOrders');
  const report = await productVarianceReport(tenantId);
  const issues = await prisma.workOrderIssue.findMany({ where: { tenantId } });
  const deltaByOrder = new Map();
  issues.forEach((issue) => {
    deltaByOrder.set(issue.workOrderId, round4((deltaByOrder.get(issue.workOrderId) || 0) + num(issue.substitutionDelta)));
  });
  const rows = [];
  for (const order of report.orders) {
    const buckets = order.variance?.buckets || {};
    const push = (type, standard, actual) => {
      const variance = round4(num(actual) - num(standard));
      const base = Math.abs(num(standard)) > 0.0001 ? num(standard) : (Math.abs(num(actual)) > 0.0001 ? num(actual) : 0);
      rows.push({
        orderNumber: order.orderNumber,
        item: order.code,
        costType: type,
        standardCost: round4(num(standard)),
        actualCost: round4(num(actual)),
        varianceAmount: variance,
        variancePercent: base ? round4(variance / base * 100) : 0
      });
    };
    push('Material', buckets.material?.planned, buckets.material?.actual);
    push('Substitution', 0, deltaByOrder.get(order.id) || 0);
    push('Yield / scrap', buckets.scrap?.planned, buckets.scrap?.actual);
    push('Labour', buckets.labour?.planned, buckets.labour?.actual);
    push('Overhead', buckets.overhead?.planned, buckets.overhead?.actual);
    if (order.variance) order.substitutionDelta = deltaByOrder.get(order.id) || 0;
  }
  return {
    key: 'production-cost-variance',
    title: 'Production Cost Variance Report (Standard vs. Actual)',
    note: 'Substitution is shown on its own row, separate from yield and scrap.',
    columns: [
      { key: 'orderNumber', label: 'Production Order No' },
      { key: 'item', label: 'Finished Good Code' },
      { key: 'costType', label: 'Component Item/Cost Type' },
      { key: 'standardCost', label: 'Standard Cost' },
      { key: 'actualCost', label: 'Actual Cost' },
      { key: 'varianceAmount', label: 'Variance Amount' },
      { key: 'variancePercent', label: 'Variance %' }
    ],
    rows,
    orders: report.orders,
    products: report.products,
    costView
  };
}

async function yieldReport(tenantId) {
  const captures = await listCaptures(tenantId, {});
  return {
    key: 'machine-yield',
    title: 'Machine yield and wastage',
    note: 'Actual yield against the theoretical product-line yield.',
    columns: [
      { key: 'orderNumber', label: 'Production Order No' },
      { key: 'machine', label: 'Machine' },
      { key: 'startedAt', label: 'Started' },
      { key: 'inputQty', label: 'Input' },
      { key: 'outputQty', label: 'Output' },
      { key: 'wastageQty', label: 'Wastage' },
      { key: 'yieldPercent', label: 'Yield %' },
      { key: 'theoreticalYieldPercent', label: 'Theoretical yield %' },
      { key: 'downtimeMinutes', label: 'Downtime minutes' },
      { key: 'scrapQty', label: 'Scrap' },
      { key: 'reworkQty', label: 'Rework' },
      { key: 'coproductQty', label: 'Co-product' },
      { key: 'byproductQty', label: 'By-product' }
    ],
    rows: captures.map((row) => ({
      orderNumber: row.workOrder?.orderNumber,
      machine: row.machine?.name,
      startedAt: row.startedAt,
      inputQty: num(row.inputQty),
      outputQty: num(row.outputQty),
      wastageQty: num(row.wastageQty),
      yieldPercent: num(row.yieldPercent),
      theoreticalYieldPercent: num(row.theoreticalYieldPercent),
      downtimeMinutes: num(row.downtimeMinutes),
      scrapQty: num(row.scrapQty),
      reworkQty: num(row.reworkQty),
      coproductQty: num(row.coproductQty),
      byproductQty: num(row.byproductQty)
    }))
  };
}

async function genealogyReport(tenantId, query) {
  const rows = await prisma.batchGenealogy.findMany({
    where: { tenantId, ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}) },
    include: {
      workOrder: { select: { orderNumber: true } },
      fgProduct: { select: { code: true, name: true } },
      rmProduct: { select: { code: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  return {
    key: 'batch-genealogy',
    title: 'Finished goods to raw material batches',
    note: 'Uses stock batches when that register is present, and the issued lot number otherwise.',
    columns: [
      { key: 'orderNumber', label: 'Production Order No' },
      { key: 'fg', label: 'Finished good' },
      { key: 'fgLot', label: 'FG batch' },
      { key: 'rm', label: 'Raw material' },
      { key: 'rmLot', label: 'RM batch' },
      { key: 'quantity', label: 'Quantity' }
    ],
    rows: rows.map((row) => ({
      orderNumber: row.workOrder?.orderNumber,
      fg: row.fgProduct?.code,
      fgLot: row.fgLotNumber,
      fgBatchId: row.fgBatchId,
      rm: row.rmProduct?.code,
      rmLot: row.rmLotNumber,
      rmBatchId: row.rmBatchId,
      quantity: num(row.quantity)
    }))
  };
}

async function reportByKey(tenantId, key, query) {
  if (key === 'wip') return wipReport(tenantId);
  if (key === 'variance') return varianceReport(tenantId);
  if (key === 'yield') return yieldReport(tenantId);
  if (key === 'genealogy') return genealogyReport(tenantId, query);
  throw new ProductionError('Report not found', 404);
}

async function importPayroll(tenantId, userId, body) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) throw new ProductionError('Add at least one payroll line');
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new ProductionError('Date is required');
  return prisma.$transaction(async (tx) => {
    const map = await ensureGlMap(tx, tenantId, userId);
    const accounts = await tx.account.findMany({ where: { tenantId } });
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    const journalLines = lines.map((line) => {
      const account = line.accountId
        ? accounts.find((row) => row.id === line.accountId)
        : (byCode.get(String(line.accountCode || '')) || null);
      const keyAccount = line.accountKey ? map[line.accountKey] : null;
      const accountId = account?.id || keyAccount;
      if (!accountId) throw new ProductionError('Payroll line account was not found');
      return {
        accountId,
        debit: money(line.debit),
        credit: money(line.credit),
        description: line.description || 'Payroll import'
      };
    });
    const journal = await postJournal(tx, {
      tenantId,
      date,
      createdBy: userId,
      description: body.description || 'Payroll import',
      referenceType: 'PAYROLL',
      referenceId: null,
      lines: journalLines
    });
    if (!journal) throw new ProductionError('Payroll journal is empty or unbalanced');
    await tx.journalEntry.update({ where: { id: journal.id }, data: { referenceId: journal.id } });
    const total = money(journalLines.reduce((sum, line) => sum + line.debit, 0));
    return tx.payrollImport.create({
      data: {
        tenantId,
        reference: body.reference || journal.entryNumber,
        date,
        description: body.description || 'Payroll import',
        totalDebit: total,
        journalEntryId: journal.id,
        createdBy: userId || null
      }
    });
  });
}

async function reconcileOverhead(tenantId, userId, body) {
  const from = body.from ? new Date(body.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = body.to ? new Date(body.to) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ProductionError('Period dates are required');
  const costCenterId = await assertCostCenter(prisma, tenantId, body.costCenterId);
  const existing = await prisma.overheadReconciliation.findFirst({
    where: { tenantId, periodStart: from, periodEnd: to, costCenterId }
  });
  if (existing) return existing;
  const confirmations = await prisma.workOrderConfirmation.findMany({
    where: { tenantId, confirmedAt: { gte: from, lte: to } }
  });
  const absorbedLabour = round4(confirmations.reduce((sum, row) => sum + num(row.labourCost) + num(row.machineCost) + num(row.subcontractCost), 0));
  const absorbedOverhead = round4(confirmations.reduce((sum, row) => sum + num(row.overheadCost), 0));
  const map = await ensureGlMap(prisma, tenantId, userId);
  const journals = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        tenantId,
        isPosted: true,
        date: { gte: from, lte: to },
        referenceType: { in: ['PAYROLL', 'FACTORY_OVERHEAD'] }
      }
    },
    include: { journalEntry: true }
  });
  let actualPayroll = 0;
  let actualOverhead = 0;
  journals.forEach((line) => {
    const amount = num(line.debit) - num(line.credit);
    if (line.journalEntry.referenceType === 'PAYROLL' && line.accountId === map.SALARY_EXPENSE) actualPayroll = round4(actualPayroll + amount);
    if (line.journalEntry.referenceType === 'FACTORY_OVERHEAD') actualOverhead = round4(actualOverhead + Math.max(0, amount));
  });
  const labourVariance = absorptionVariance(absorbedLabour, actualPayroll);
  const overheadVariance = absorptionVariance(absorbedOverhead, actualOverhead);
  return prisma.$transaction(async (tx) => {
    const lines = [];
    const add = (variance, varianceKey, absorbedKey, label) => {
      const amount = money(Math.abs(variance));
      if (!(amount > 0)) return;
      if (variance > 0) {
        lines.push({ accountId: map[varianceKey], debit: amount, credit: 0, description: label });
        lines.push({ accountId: map[absorbedKey], debit: 0, credit: amount, description: label });
      } else {
        lines.push({ accountId: map[absorbedKey], debit: amount, credit: 0, description: label });
        lines.push({ accountId: map[varianceKey], debit: 0, credit: amount, description: label });
      }
    };
    add(labourVariance, 'VARIANCE_LABOUR', 'ABSORBED_LABOUR', 'Labour absorption');
    add(overheadVariance, 'VARIANCE_OVERHEAD', 'ABSORBED_OVERHEAD', 'Overhead absorption');
    const journal = await postJournal(tx, {
      tenantId,
      date: to,
      createdBy: userId,
      description: 'Overhead and labour absorption reconciliation',
      referenceType: 'ABSORPTION_RECONCILIATION',
      referenceId: null,
      lines
    });
    return tx.overheadReconciliation.create({
      data: {
        tenantId,
        periodStart: from,
        periodEnd: to,
        costCenterId,
        absorbedLabour,
        absorbedOverhead,
        actualPayroll,
        actualOverhead,
        labourVariance,
        overheadVariance,
        journalEntryId: journal?.id || null
      }
    });
  });
}

async function createContract(tenantId, userId, body) {
  const supplier = await prisma.supplier.findFirst({ where: { id: body.supplierId, tenantId } });
  if (!supplier) throw new ProductionError('Supplier not found');
  const virtual = await prisma.warehouse.findFirst({ where: { id: body.virtualWarehouseId, tenantId } });
  if (!virtual || virtual.locationRole !== 'VIRTUAL') throw new ProductionError('Choose a factory sub-location virtual warehouse');
  const fgWarehouse = await prisma.warehouse.findFirst({ where: { id: body.fgWarehouseId, tenantId } });
  if (!fgWarehouse) throw new ProductionError('Finished goods warehouse not found');
  const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
  if (!product) throw new ProductionError('Product not found');
  const quantity = num(body.quantity);
  if (!(quantity > 0)) throw new ProductionError('Quantity must be greater than zero');
  const orderNumber = await generateDocumentNumber(tenantId, 'contractOrder', 'CM', 'orderNumber');
  return prisma.contractOrder.create({
    data: {
      tenantId,
      orderNumber,
      supplierId: supplier.id,
      virtualWarehouseId: virtual.id,
      fgWarehouseId: fgWarehouse.id,
      productId: product.id,
      quantity,
      serviceCharge: Math.max(0, num(body.serviceCharge)),
      status: 'DRAFT',
      createdBy: userId || null,
      issues: {
        create: (body.lines || []).filter((line) => num(line.quantity) > 0).map((line) => ({
          tenantId,
          productId: line.productId,
          quantity: num(line.quantity),
          kind: 'PLANNED'
        }))
      }
    },
    include: { issues: true, supplier: true, virtualWarehouse: true }
  });
}

async function issueContract(tenantId, userId, id, body) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.contractOrder.findFirst({
      where: { id, tenantId },
      include: { issues: true }
    });
    if (!order) throw new ProductionError('Contract order not found', 404);
    if (!['DRAFT', 'ISSUED'].includes(order.status)) throw new ProductionError('Materials are already received');
    const onHandRows = await tx.stockMovement.findMany({ where: { tenantId, productId: body.productId, warehouseId: body.warehouseId } });
    if (num(body.quantity) - movementQty(onHandRows) > 0.00005) throw new ProductionError('Insufficient stock to issue to the subcontractor');
    const source = await tx.warehouse.findFirst({ where: { id: body.warehouseId, tenantId } });
    if (!source) throw new ProductionError('Source warehouse not found');
    const product = await tx.product.findFirst({ where: { id: body.productId, tenantId } });
    if (!product) throw new ProductionError('Component not found');
    const quantity = num(body.quantity);
    if (!(quantity > 0)) throw new ProductionError('Quantity must be greater than zero');
    const fifo = await issueFifo(tx, {
      tenantId,
      productId: product.id,
      warehouseId: source.id,
      quantity,
      strictWarehouse: true
    });
    await tx.stockMovement.create({
      data: {
        tenantId, productId: product.id, type: 'GI', quantity, unitCost: fifo.unitCost, value: fifo.totalCost,
        referenceType: 'CONTRACT_ORDER', referenceId: order.id, warehouseId: source.id,
        lotNumber: body.lotNumber || null, createdBy: userId || null
      }
    });
    await receiveLayer(tx, {
      tenantId, productId: product.id, warehouseId: order.virtualWarehouseId,
      quantity, unitCost: fifo.unitCost, sourceType: 'CONTRACT_ORDER', sourceId: order.id, lotNumber: body.lotNumber || null
    });
    await tx.stockMovement.create({
      data: {
        tenantId, productId: product.id, type: 'GR', quantity, unitCost: fifo.unitCost, value: fifo.totalCost,
        referenceType: 'CONTRACT_ORDER', referenceId: order.id, warehouseId: order.virtualWarehouseId,
        lotNumber: body.lotNumber || null, createdBy: userId || null
      }
    });
    await tx.contractIssue.create({
      data: {
        tenantId, contractOrderId: order.id, productId: product.id, quantity,
        unitCost: fifo.unitCost, lotNumber: body.lotNumber || null, warehouseId: source.id
      }
    });
    return tx.contractOrder.update({
      where: { id },
      data: { status: 'ISSUED' },
      include: { issues: true }
    });
  });
}

async function receiveContract(tenantId, userId, id, body) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.contractOrder.findFirst({
      where: { id, tenantId },
      include: { issues: true }
    });
    if (!order) throw new ProductionError('Contract order not found', 404);
    if (order.status !== 'ISSUED') throw new ProductionError('Issue materials before receiving finished goods');
    const quantity = num(body.quantity);
    if (!(quantity > 0)) throw new ProductionError('Quantity must be greater than zero');
    let material = 0;
    for (const issue of order.issues) {
      const fifo = await issueFifo(tx, {
        tenantId,
        productId: issue.productId,
        warehouseId: order.virtualWarehouseId,
        quantity: num(issue.quantity),
        strictWarehouse: true
      });
      material = round4(material + fifo.totalCost);
      await tx.stockMovement.create({
        data: {
          tenantId, productId: issue.productId, type: 'GI', quantity: num(issue.quantity),
          unitCost: fifo.unitCost, value: fifo.totalCost, referenceType: 'CONTRACT_ORDER',
          referenceId: order.id, warehouseId: order.virtualWarehouseId, lotNumber: issue.lotNumber, createdBy: userId || null
        }
      });
    }
    const unitCost = quantity > 0 ? round4(material / quantity) : 0;
    const value = round4(unitCost * quantity);
    if (value > 0) {
      const map = await ensureGlMap(tx, tenantId, userId);
      await postJournal(tx, {
        tenantId,
        date: new Date(),
        createdBy: userId,
        description: `Contract receipt ${order.orderNumber}`,
        referenceType: 'CONTRACT_ORDER',
        referenceId: order.id,
        lines: [
          { accountId: map.INVENTORY_FG, debit: value, credit: 0, description: 'Finished goods' },
          { accountId: map.INVENTORY, debit: 0, credit: value, description: 'Material at subcontractor' }
        ]
      });
    }
    await tx.stockMovement.create({
      data: {
        tenantId, productId: order.productId, type: 'GR', quantity, unitCost, value,
        referenceType: 'CONTRACT_ORDER', referenceId: order.id, warehouseId: order.fgWarehouseId,
        lotNumber: body.lotNumber || null, createdBy: userId || null
      }
    });
    await receiveLayer(tx, {
      tenantId, productId: order.productId, warehouseId: order.fgWarehouseId,
      quantity, unitCost, sourceType: 'CONTRACT_ORDER', sourceId: order.id, lotNumber: body.lotNumber || null
    });
    if (body.lotNumber) {
      for (const issue of order.issues) {
        await tx.batchGenealogy.create({
          data: {
            tenantId, workOrderId: order.workOrderId || undefined,
            fgProductId: order.productId, fgLotNumber: body.lotNumber,
            fgBatchId: await batchIdFor(tx, tenantId, order.productId, body.lotNumber),
            rmProductId: issue.productId, rmLotNumber: issue.lotNumber,
            rmBatchId: await batchIdFor(tx, tenantId, issue.productId, issue.lotNumber),
            quantity: issue.quantity,
            contractOrderId: order.id
          }
        });
      }
    }
    return tx.contractOrder.update({
      where: { id },
      data: { status: 'RECEIVED', quantityReceived: round4(num(order.quantityReceived) + quantity) }
    });
  });
}

async function chargeContract(tenantId, userId, id, body) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.contractOrder.findFirst({ where: { id, tenantId }, include: { supplier: true } });
    if (!order) throw new ProductionError('Contract order not found', 404);
    if (order.status === 'INVOICED') throw new ProductionError('The service charge is already posted');
    if (!['RECEIVED', 'ISSUED'].includes(order.status)) throw new ProductionError('Receive or issue the order before the service charge');
    const amount = money(body.amount ?? order.serviceCharge);
    if (!(amount > 0)) throw new ProductionError('Service charge must be greater than zero');
    const map = await ensureGlMap(tx, tenantId, userId);
    const journal = await postJournal(tx, {
      tenantId,
      date: new Date(),
      createdBy: userId,
      description: `Contract service ${order.orderNumber}`,
      referenceType: 'CONTRACT_ORDER',
      referenceId: order.id,
      lines: [
        { accountId: map.SUBCONTRACT_EXPENSE, debit: amount, credit: 0, description: 'Service charge' },
        { accountId: map.AP, debit: 0, credit: amount, description: order.supplier?.name || 'Subcontractor' }
      ]
    });
    const invoiceNumber = await generateDocumentNumber(tenantId, 'supplierInvoice', 'SINV', 'invoiceNumber', tx);
    const invoice = await tx.supplierInvoice.create({
      data: {
        tenantId,
        supplierId: order.supplierId,
        invoiceNumber,
        supplierReference: order.orderNumber,
        date: new Date(),
        status: 'UNPAID',
        subtotal: dec(amount),
        total: dec(amount),
        createdBy: userId || null,
        items: {
          create: [{
            productId: order.productId,
            quantity: dec(order.quantity),
            unitPrice: dec(round4(amount / Math.max(num(order.quantity), 1))),
            poUnitPrice: dec(0),
            total: dec(amount)
          }]
        }
      }
    });
    return tx.contractOrder.update({
      where: { id },
      data: { status: 'INVOICED', serviceCharge: amount, supplierInvoiceId: invoice.id },
      include: { supplier: true }
    });
  });
}

async function listContracts(tenantId) {
  return prisma.contractOrder.findMany({
    where: { tenantId },
    include: {
      supplier: { select: { id: true, code: true, name: true } },
      product: { select: { id: true, code: true, name: true } },
      virtualWarehouse: { select: { id: true, code: true, name: true } },
      issues: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function closeDueWorkOrders(now = new Date()) {
  const due = await prisma.workOrder.findMany({
    where: { status: 'TECO', closeDueAt: { lte: now } }
  });
  const { closeWorkOrder } = require('./workOrders');
  const closed = [];
  for (const order of due) {
    try {
      await closeWorkOrder(order.tenantId, order.id);
      closed.push({ tenantId: order.tenantId, id: order.id, orderNumber: order.orderNumber });
    } catch (error) {
      closed.push({ tenantId: order.tenantId, id: order.id, orderNumber: order.orderNumber, error: error.message });
    }
  }
  return closed;
}

function defaults() {
  return {
    decisions: CONFIRMED_DEFAULTS,
    settings: {
      planningHorizonWeeks: 8,
      closeGraceDays: 3,
      labourAbsorptionBase: 'PER_LABOUR_HOUR',
      overheadAbsorptionBase: 'PERCENT_OF_CONVERSION',
      overheadPercent: 10,
      abnormalLossThreshold: 2,
      defaultYieldPercent: 98,
      defaultScrapPercent: 2,
      planningPolicy: 'MAKE_TO_ORDER',
      lotPolicy: 'LOT_FOR_LOT',
      manufacturingLeadDays: 1
    }
  };
}

module.exports = {
  ProductionError,
  runMps,
  latestMps,
  saveForecast,
  listForecasts,
  firmPlannedOrder,
  saveAlternate,
  listAlternates,
  findAlternate,
  deltaForIssue,
  recordGenealogy,
  flagAbnormalLoss,
  listLosses,
  approveLoss,
  captureMachine,
  listCaptures,
  saveLineStandard,
  listLineStandards,
  setMilestoneWeight,
  wipReport,
  varianceReport,
  yieldReport,
  genealogyReport,
  reportByKey,
  importPayroll,
  reconcileOverhead,
  createContract,
  issueContract,
  receiveContract,
  chargeContract,
  listContracts,
  closeDueWorkOrders,
  defaults,
  movementQty
};
