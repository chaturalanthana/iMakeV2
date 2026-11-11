const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { movementEffect } = require('./stockService');
const { num, money, dec } = require('./money');
const { reorderPointOf } = require('./inventory/itemMaster');

const round = (value) => money(value);

function levels(policy) {
  const reorder = Math.max(0, num(policy.reorderPoint));
  const min = Math.max(0, num(policy.minQty));
  const max = Math.max(0, num(policy.maxQty));
  const trigger = reorder > 0 ? reorder : min;
  const target = max > 0 ? max : Math.max(min, trigger);
  return { trigger, target };
}

function stockMap(movements) {
  const totals = new Map();
  movements.forEach((movement) => {
    const key = `${movement.productId}|${movement.warehouseId || ''}`;
    totals.set(key, round((totals.get(key) || 0) + movementEffect(movement)));
  });
  return totals;
}

async function mrpShortages(db, tenantId) {
  const orders = await db.productionOrder.findMany({
    where: { tenantId, status: { in: ['RELEASED', 'WIP'] } }
  });
  const workOrders = await db.workOrder.findMany({
    where: { tenantId, status: { in: ['RELEASED', 'IN_PROGRESS'] } },
    include: { components: { include: { product: true } } }
  });
  const [activeBoms, orderBoms, movements, openJobs, openWorkOrders] = await Promise.all([
    db.bOM.findMany({
      where: { tenantId, status: 'ACTIVE', isDefault: true },
      include: { items: { include: { componentProduct: true } } }
    }),
    db.bOM.findMany({
      where: { tenantId, id: { in: orders.map((order) => order.bomId).filter(Boolean) } },
      include: { items: { include: { componentProduct: true } } }
    }),
    db.stockMovement.findMany({ where: { tenantId } }),
    db.productionJob.findMany({ where: { tenantId, status: { in: ['QUEUED', 'WIP', 'QC'] } } }),
    db.workOrder.findMany({ where: { tenantId, status: { in: ['CREATED', 'RELEASED', 'IN_PROGRESS'] } } })
  ]);
  const bomByProduct = new Map(activeBoms.map((bom) => [bom.productId, bom]));
  const bomById = new Map(orderBoms.map((bom) => [bom.id, bom]));
  const stock = {};
  movements.forEach((movement) => {
    stock[movement.productId] = round((stock[movement.productId] || 0) + movementEffect(movement));
  });
  const supply = {};
  const linkedJobs = new Set(openWorkOrders.map((row) => row.legacyJobId).filter(Boolean));
  const linkedOrders = new Set(openWorkOrders.map((row) => row.legacyOrderId).filter(Boolean));
  orders.forEach((order) => {
    if (linkedOrders.has(order.id)) return;
    supply[order.productId] = round((supply[order.productId] || 0) + num(order.quantity));
  });
  openJobs.forEach((job) => {
    if (linkedJobs.has(job.id)) return;
    supply[job.productId] = round((supply[job.productId] || 0) + num(job.quantity));
  });
  openWorkOrders.forEach((row) => {
    supply[row.productId] = round((supply[row.productId] || 0) + Math.max(0, num(row.quantity) - num(row.quantityCompleted)));
  });

  const products = {};
  const demand = {};
  const planned = {};
  const scrapFactor = (scrapPercent) => 1 + Math.max(0, num(scrapPercent)) / 100;
  const plan = (productId, path) => {
    const product = products[productId];
    if (!product || !product.bomApplicable || path.has(productId)) return;
    const shortage = num(demand[productId]) + Math.max(0, num(product.safetyStock)) - num(stock[productId]) - num(supply[productId]) - num(planned[productId]);
    if (shortage <= 0.00005) return;
    planned[productId] = num(planned[productId]) + shortage;
    const bom = bomByProduct.get(productId);
    if (!bom) return;
    const nextPath = new Set(path);
    nextPath.add(productId);
    bom.items.forEach((item) => {
      const component = item.componentProduct;
      if (!component || nextPath.has(component.id)) return;
      const need = num(item.quantity) * shortage * scrapFactor(item.scrapPercent);
      if (!(need > 0)) return;
      products[component.id] = component;
      demand[component.id] = num(demand[component.id]) + need;
      plan(component.id, nextPath);
    });
  };

  const explode = (productId, bom, quantity, path) => {
    if (!bom || !(quantity > 0)) return;
    bom.items.forEach((item) => {
      const component = item.componentProduct;
      if (!component || path.has(component.id)) return;
      const need = num(item.quantity) * quantity * scrapFactor(item.scrapPercent);
      if (!(need > 0)) return;
      products[component.id] = component;
      demand[component.id] = num(demand[component.id]) + need;
      const next = new Set(path);
      next.add(productId);
      plan(component.id, next);
    });
  };

  orders.forEach((order) => {
    const bom = (order.bomId && bomById.get(order.bomId)) || bomByProduct.get(order.productId);
    explode(order.productId, bom, num(order.quantity), new Set([order.productId]));
  });
  const explodedOrders = new Set(orders.map((order) => order.id));
  workOrders.forEach((order) => {
    if (order.legacyOrderId && explodedOrders.has(order.legacyOrderId)) return;
    const remaining = Math.max(0, num(order.quantity) - num(order.quantityCompleted));
    order.components.forEach((component) => {
      if (!component.product) return;
      const per = num(order.quantity) > 0 ? num(component.requiredQty) / num(order.quantity) : num(component.quantityPer);
      const need = per * remaining;
      if (!(need > 0)) return;
      products[component.productId] = component.product;
      demand[component.productId] = num(demand[component.productId]) + need;
      plan(component.productId, new Set([order.productId]));
    });
  });

  const shortages = new Map();
  Object.keys(demand).forEach((productId) => {
    const product = products[productId];
    if (!product) return;
    const shortage = round(num(demand[productId]) + Math.max(0, num(product.safetyStock)) - num(stock[productId]) - num(supply[productId]));
    if (shortage > 0) shortages.set(productId, { product, shortage });
  });
  return shortages;
}

async function firmSupply(db, tenantId) {
  const [orders, requisitions, workOrders] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED', 'RECEIVED'] } },
      include: { items: true, grns: { include: { items: true } } }
    }),
    db.purchaseRequisition.findMany({
      where: { tenantId, status: { in: ['PENDING', 'APPROVED'] } },
      include: { items: true }
    }),
    db.workOrder.findMany({
      where: { tenantId, status: { in: ['CREATED', 'RELEASED', 'IN_PROGRESS'] } }
    })
  ]);
  const po = {};
  orders.forEach((order) => {
    const received = {};
    order.grns.forEach((grn) => {
      if (grn.status === 'CANCELLED') return;
      grn.items.forEach((item) => {
        received[item.productId] = (received[item.productId] || 0) + num(item.quantityReceived);
      });
    });
    order.items.forEach((item) => {
      po[item.productId] = round((po[item.productId] || 0) + Math.max(0, num(item.quantity) - (received[item.productId] || 0)));
    });
  });
  const pr = {};
  requisitions.forEach((requisition) => {
    requisition.items.forEach((item) => {
      pr[item.productId] = round((pr[item.productId] || 0) + num(item.quantity));
    });
  });
  const wo = {};
  workOrders.forEach((order) => {
    wo[order.productId] = round((wo[order.productId] || 0) + Math.max(0, num(order.quantity) - num(order.quantityCompleted)));
  });
  return { po, pr, wo };
}

async function buildSuggestions(db, tenantId) {
  const [policies, movements, products, shortages, firm] = await Promise.all([
    db.itemWarehousePolicy.findMany({ where: { tenantId }, include: { product: true, warehouse: true } }),
    db.stockMovement.findMany({ where: { tenantId } }),
    db.product.findMany({ where: { tenantId, activeStatus: { not: 'INACTIVE' } } }),
    mrpShortages(db, tenantId),
    firmSupply(db, tenantId)
  ]);
  const onHand = stockMap(movements);
  const byProduct = new Map();
  policies.forEach((policy) => {
    if (!byProduct.has(policy.productId)) byProduct.set(policy.productId, []);
    byProduct.get(policy.productId).push(policy);
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  shortages.forEach((row) => {
    if (!productById.has(row.product.id)) productById.set(row.product.id, row.product);
  });

  const suggestions = [];
  productById.forEach((product) => {
    // Made items are planned from sales orders and MRP. Reorder point only buys.
    if (product.type === 'SERVICE' || product.nonStock || product.activeStatus === 'INACTIVE' || product.bomApplicable) return;
    const rows = byProduct.get(product.id) || [];
    let raw = 0;
    let warehouseId = rows[0]?.warehouseId || null;
    let best = -1;
    if (!rows.length) {
      const rop = reorderPointOf(product);
      if (rop > 0) {
        let have = 0;
        onHand.forEach((qty, key) => {
          if (key.startsWith(`${product.id}|`)) have += qty;
        });
        const gap = have <= rop + 0.00005 ? Math.max(0, rop - have) : 0;
        raw = round(gap);
      }
    }
    rows.forEach((policy) => {
      const have = onHand.get(`${product.id}|${policy.warehouseId}`) || 0;
      const { trigger, target } = levels(policy);
      const gap = have <= trigger + 0.00005 ? Math.max(0, target - have) : 0;
      raw = round(raw + gap);
      if (gap > best) {
        best = gap;
        warehouseId = policy.warehouseId;
      }
    });
    const covered = round((firm.po[product.id] || 0) + (firm.pr[product.id] || 0) + (firm.wo[product.id] || 0));
    const minMaxQty = round(Math.max(0, raw - covered));
    const mrpQty = round(shortages.get(product.id)?.shortage || 0);
    const mrpNet = round(Math.max(0, mrpQty - (firm.po[product.id] || 0) - (firm.pr[product.id] || 0)));
    const quantity = round(Math.max(minMaxQty, mrpNet));
    if (quantity <= 0.00005) return;
    let reason = rows.length ? 'MINMAX' : 'ROP';
    if (minMaxQty > 0.00005 && mrpNet > 0.00005) reason = 'BOTH';
    else if (mrpNet > 0.00005) reason = 'MRP';
    suggestions.push({
      product,
      warehouseId,
      kind: 'BUY',
      quantity,
      minMaxQty,
      mrpQty,
      reason
    });
  });
  suggestions.sort((a, b) => String(a.product.code).localeCompare(String(b.product.code)));
  return suggestions;
}

async function clearDraftDocuments(db, tenantId, run) {
  if (!run) return;
  const prIds = [...new Set(run.lines.map((line) => line.prId).filter(Boolean))];
  const woIds = [...new Set(run.lines.map((line) => line.workOrderId).filter(Boolean))];
  await db.replenishmentLine.deleteMany({ where: { runId: run.id } });
  if (prIds.length) {
    const blocked = await db.purchaseOrder.count({ where: { tenantId, prId: { in: prIds } } });
    if (blocked) {
      const error = new Error('A draft requisition from this run is already on a purchase order.');
      error.status = 409;
      throw error;
    }
    await db.purchaseRequisition.deleteMany({
      where: { id: { in: prIds }, tenantId, status: 'DRAFT', sourceType: 'REPLENISHMENT' }
    });
  }
  if (woIds.length) {
    await db.workOrder.deleteMany({
      where: { id: { in: woIds }, tenantId, status: 'DRAFT', sourceType: 'REPLENISHMENT' }
    });
  }
}

async function executeRun(tenantId, userId, trigger = 'MANUAL') {
  return prisma.$transaction(async (tx) => {
    const suggestions = await buildSuggestions(tx, tenantId);
    let run = await tx.replenishmentRun.findFirst({
      where: { tenantId, status: 'DRAFT' },
      include: { lines: true },
      orderBy: { createdAt: 'desc' }
    });
    await clearDraftDocuments(tx, tenantId, run);
    if (!run) {
      const runNumber = await generateDocumentNumber(tenantId, 'replenishmentRun', 'RPL', 'runNumber', tx);
      run = await tx.replenishmentRun.create({
        data: { tenantId, runNumber, status: 'DRAFT', trigger, createdBy: userId || null }
      });
    } else if (run.trigger !== trigger && trigger === 'SCHEDULE') {
      await tx.replenishmentRun.update({ where: { id: run.id }, data: { trigger } });
    }

    const bySupplier = new Map();
    suggestions.forEach((row) => {
      const key = row.product.supplierId || '';
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key).push(row);
    });
    const prByProduct = new Map();
    for (const [supplierKey, rows] of bySupplier) {
      const prNumber = await generateDocumentNumber(tenantId, 'purchaseRequisition', 'PR', 'prNumber', tx);
      const items = rows.map((row) => {
        const unit = num(row.product.costPrice) || num(row.product.standardCost);
        return {
          productId: row.product.id,
          quantity: dec(row.quantity),
          unitPrice: dec(unit),
          total: dec(round(unit * row.quantity))
        };
      });
      const requisition = await tx.purchaseRequisition.create({
        data: {
          tenantId,
          supplierId: supplierKey || null,
          prNumber,
          date: new Date(),
          status: 'DRAFT',
          total: dec(items.reduce((sum, item) => sum + num(item.total), 0)),
          sourceType: 'REPLENISHMENT',
          sourceId: run.id,
          notes: `Replenishment ${run.runNumber}`,
          createdBy: userId || null,
          items: { create: items }
        }
      });
      rows.forEach((row) => prByProduct.set(row.product.id, { id: requisition.id, number: requisition.prNumber }));
    }

    if (suggestions.length) {
      await tx.replenishmentLine.createMany({
        data: suggestions.map((row) => ({
          tenantId,
          runId: run.id,
          productId: row.product.id,
          warehouseId: row.warehouseId,
          kind: row.kind,
          quantity: dec(row.quantity),
          reason: row.reason,
          minMaxQty: dec(row.minMaxQty),
          mrpQty: dec(row.mrpQty),
          prId: prByProduct.get(row.product.id)?.id || null,
          workOrderId: null
        }))
      });
    }

    const saved = await tx.replenishmentRun.findUnique({
      where: { id: run.id },
      include: {
        lines: { include: { product: true, warehouse: true } }
      }
    });
    return presentRun(saved);
  }, { timeout: 20000 });
}

function presentRun(run) {
  if (!run) return null;
  const lines = (run.lines || []).filter((line) => line.kind !== 'MAKE').map((line) => ({
    id: line.id,
    productId: line.productId,
    code: line.product?.code || null,
    name: line.product?.name || null,
    warehouseId: line.warehouseId,
    warehouse: line.warehouse?.code || null,
    kind: line.kind,
    quantity: num(line.quantity),
    reason: line.reason,
    minMaxQty: num(line.minMaxQty),
    mrpQty: num(line.mrpQty),
    prId: line.prId,
    workOrderId: line.workOrderId
  }));
  return {
    id: run.id,
    runNumber: run.runNumber,
    status: run.status,
    trigger: run.trigger,
    createdAt: run.createdAt,
    lines,
    message: lines.length
      ? `${run.runNumber} drafted ${lines.length} purchase ${lines.length === 1 ? 'line' : 'lines'}`
      : 'No replenishment needed'
  };
}

async function listPolicies(tenantId) {
  const rows = await prisma.itemWarehousePolicy.findMany({
    where: { tenantId },
    include: { product: true, warehouse: true },
    orderBy: [{ product: { code: 'asc' } }, { warehouse: { code: 'asc' } }]
  });
  return rows.filter((row) => !row.product.bomApplicable).map((row) => ({
    id: row.id,
    productId: row.productId,
    code: row.product.code,
    name: row.product.name,
    warehouseId: row.warehouseId,
    warehouse: row.warehouse.code,
    warehouseName: row.warehouse.name,
    reorderPoint: num(row.reorderPoint),
    minQty: num(row.minQty),
    maxQty: num(row.maxQty)
  }));
}

async function savePolicy(tenantId, body) {
  const reorderPoint = num(body.reorderPoint);
  const minQty = num(body.minQty);
  const maxQty = num(body.maxQty);
  if (maxQty > 0 && reorderPoint > 0 && maxQty + 0.00005 < reorderPoint) {
    const error = new Error('Max qty must be at least the reorder point.');
    error.status = 400;
    throw error;
  }
  const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
  const warehouse = await prisma.warehouse.findFirst({ where: { id: body.warehouseId, tenantId } });
  if (!product) {
    const error = new Error('Product not found');
    error.status = 400;
    throw error;
  }
  if (product.bomApplicable) {
    const error = new Error('Made items are planned in MRP. Reorder policies are for bought items.');
    error.status = 400;
    throw error;
  }
  if (!warehouse) {
    const error = new Error('Warehouse not found');
    error.status = 400;
    throw error;
  }
  const saved = await prisma.itemWarehousePolicy.upsert({
    where: {
      tenantId_productId_warehouseId: {
        tenantId,
        productId: body.productId,
        warehouseId: body.warehouseId
      }
    },
    update: { reorderPoint: dec(reorderPoint), minQty: dec(minQty), maxQty: dec(maxQty) },
    create: {
      tenantId,
      productId: body.productId,
      warehouseId: body.warehouseId,
      reorderPoint: dec(reorderPoint),
      minQty: dec(minQty),
      maxQty: dec(maxQty)
    },
    include: { product: true, warehouse: true }
  });
  return {
    id: saved.id,
    productId: saved.productId,
    code: saved.product.code,
    name: saved.product.name,
    warehouseId: saved.warehouseId,
    warehouse: saved.warehouse.code,
    reorderPoint: num(saved.reorderPoint),
    minQty: num(saved.minQty),
    maxQty: num(saved.maxQty)
  };
}

async function deletePolicy(tenantId, id) {
  const existing = await prisma.itemWarehousePolicy.findFirst({ where: { id, tenantId } });
  if (!existing) {
    const error = new Error('Reorder policy not found');
    error.status = 404;
    throw error;
  }
  await prisma.itemWarehousePolicy.delete({ where: { id } });
  return { message: 'Reorder policy deleted' };
}

async function latestRun(tenantId) {
  const run = await prisma.replenishmentRun.findFirst({
    where: { tenantId },
    include: { lines: { include: { product: true, warehouse: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return presentRun(run);
}

async function getSettings(tenantId) {
  const row = await prisma.operationsSetting.findUnique({ where: { tenantId } });
  return { replenishDaily: Boolean(row?.replenishDaily) };
}

async function saveSettings(tenantId, body) {
  const replenishDaily = Boolean(body.replenishDaily);
  const row = await prisma.operationsSetting.upsert({
    where: { tenantId },
    update: { replenishDaily },
    create: { tenantId, replenishDaily }
  });
  return { replenishDaily: row.replenishDaily };
}

async function approveDrafts(tenantId) {
  const runs = await prisma.replenishmentRun.findMany({
    where: { tenantId, status: 'DRAFT' },
    include: { lines: true }
  });
  if (!runs.length) return { runs: 0, purchaseRequisitions: 0, message: 'Nothing is waiting for approval' };
  let purchaseRequisitions = 0;
  await prisma.$transaction(async (tx) => {
    for (const run of runs) {
      const prIds = [...new Set(run.lines.map((line) => line.prId).filter(Boolean))];
      const woIds = [...new Set(run.lines.map((line) => line.workOrderId).filter(Boolean))];
      if (prIds.length) {
        const updated = await tx.purchaseRequisition.updateMany({
          where: { id: { in: prIds }, tenantId, status: 'DRAFT' },
          data: { status: 'APPROVED' }
        });
        purchaseRequisitions += updated.count;
      }
      if (woIds.length) {
        await tx.workOrder.deleteMany({
          where: { id: { in: woIds }, tenantId, status: 'DRAFT', sourceType: 'REPLENISHMENT' }
        });
      }
      await tx.replenishmentRun.update({ where: { id: run.id }, data: { status: 'APPROVED' } });
    }
  });
  return {
    runs: runs.length,
    purchaseRequisitions,
    message: `Approved ${purchaseRequisitions} requisition${purchaseRequisitions === 1 ? '' : 's'}`
  };
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

async function runDueReplenishment(now = new Date()) {
  const settings = await prisma.operationsSetting.findMany({ where: { replenishDaily: true } });
  const today = dayKey(now);
  const results = [];
  for (const setting of settings) {
    if (setting.lastReplenishOn && dayKey(setting.lastReplenishOn) === today) continue;
    const outcome = await executeRun(setting.tenantId, null, 'SCHEDULE');
    await prisma.operationsSetting.update({
      where: { id: setting.id },
      data: { lastReplenishOn: now }
    });
    results.push({ tenantId: setting.tenantId, runNumber: outcome.runNumber, lines: outcome.lines.length });
  }
  return results;
}

module.exports = {
  listPolicies,
  savePolicy,
  deletePolicy,
  executeRun,
  latestRun,
  getSettings,
  saveSettings,
  approveDrafts,
  runDueReplenishment,
  levels
};
