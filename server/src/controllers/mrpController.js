const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');
const { syncLegacy } = require('../services/production/workOrders');
const { runMps } = require('../services/production/phase4');

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundQty = (value) => Math.round(value * 10000) / 10000;

const scrapFactor = (scrapPercent) => 1 + Math.max(0, num(scrapPercent)) / 100;

const stockOnHand = (movements) => movements.reduce((total, movement) => {
  const qty = num(movement.quantity);
  if (movement.type === 'GR' || (movement.type === 'ADJ' && qty > 0)) return total + Math.abs(qty);
  if (movement.type === 'GI' || (movement.type === 'ADJ' && qty < 0)) return total - Math.abs(qty);
  return total;
}, 0);

const runMRPAna = async (req, res) => {
  try {
    const [
      allProducts,
      activeBoms,
      movements,
      openWorkOrders,
      openJobs,
      openProductionOrders,
      openSalesOrders
    ] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId: req.tenantId },
        include: { productType: true }
      }),
      prisma.bOM.findMany({
        where: { tenantId: req.tenantId, status: 'ACTIVE' },
        include: {
          items: {
            include: {
              componentProduct: {
                include: { productType: true }
              }
            }
          }
        },
        orderBy: [{ isDefault: 'desc' }, { version: 'desc' }, { updatedAt: 'desc' }]
      }),
      prisma.stockMovement.findMany({ where: { tenantId: req.tenantId } }),
      prisma.workOrder.findMany({
        where: { tenantId: req.tenantId, status: { in: ['CREATED', 'RELEASED', 'IN_PROGRESS'] } },
        include: { components: true }
      }),
      prisma.productionJob.findMany({
        where: { tenantId: req.tenantId, status: { in: ['QUEUED', 'WIP', 'QC'] } }
      }),
      prisma.productionOrder.findMany({
        where: { tenantId: req.tenantId, status: { in: ['DRAFT', 'RELEASED', 'WIP'] } }
      }),
      prisma.salesOrder.findMany({
        where: { tenantId: req.tenantId, status: { in: ['CONFIRMED', 'PROCESSING', 'APPROVED'] } },
        include: { items: true }
      })
    ]);

    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const bomByProduct = new Map();
    const bomById = new Map();
    activeBoms.forEach((bom) => {
      bomById.set(bom.id, bom);
      if (!bomByProduct.has(bom.productId)) {
        bomByProduct.set(bom.productId, bom);
      }
    });

    const isMakeProduct = (product) => {
      if (!product) return false;
      if (product.bomApplicable) return true;
      const typeName = (product.productType?.name || product.type || '').toLowerCase();
      if (typeName.includes('semi') || typeName.includes('finished') || typeName === 'fg' || typeName === 'sfg') {
        return true;
      }
      return bomByProduct.has(product.id);
    };

    // Calculate stock on hand
    const movementsByProduct = {};
    movements.forEach((movement) => {
      if (!movementsByProduct[movement.productId]) movementsByProduct[movement.productId] = [];
      movementsByProduct[movement.productId].push(movement);
    });
    const stockByProduct = {};
    allProducts.forEach((p) => {
      stockByProduct[p.id] = stockOnHand(movementsByProduct[p.id] || []);
    });

    // Open production supply
    const productionSupply = {};
    const linkedJobs = new Set(openWorkOrders.map((row) => row.legacyJobId).filter(Boolean));
    const linkedOrders = new Set(openWorkOrders.map((row) => row.legacyOrderId).filter(Boolean));

    openWorkOrders.forEach((wo) => {
      const remaining = Math.max(0, num(wo.quantity) - num(wo.quantityCompleted));
      productionSupply[wo.productId] = num(productionSupply[wo.productId]) + remaining;
    });
    openJobs.forEach((job) => {
      if (linkedJobs.has(job.id)) return;
      productionSupply[job.productId] = num(productionSupply[job.productId]) + num(job.quantity);
    });
    openProductionOrders.forEach((order) => {
      if (linkedOrders.has(order.id)) return;
      productionSupply[order.productId] = num(productionSupply[order.productId]) + num(order.quantity);
    });

    // Demand tracking & recursive multi-level explosion
    const demand = {};
    const plannedMake = {};

    const explodeComponent = (productId, grossNeeded, path = new Set()) => {
      if (path.has(productId) || !(grossNeeded > 0)) return;
      const product = productById.get(productId);
      if (!product) return;

      demand[productId] = num(demand[productId]) + grossNeeded;

      // If it is a manufactured item (SFG or FG), check net shortage to trigger multi-level BOM explosion
      if (isMakeProduct(product)) {
        const bom = bomByProduct.get(productId);
        if (!bom || !bom.items || !bom.items.length) return;

        const onHand = num(stockByProduct[productId]);
        const openSupply = num(productionSupply[productId]);
        const safety = Math.max(0, num(product.safetyStock));
        const alreadyPlanned = num(plannedMake[productId]);

        const totalRequired = num(demand[productId]) + safety;
        const totalAvailable = onHand + openSupply + alreadyPlanned;
        const netShortage = Math.max(0, totalRequired - totalAvailable);

        if (netShortage > 0) {
          plannedMake[productId] = alreadyPlanned + netShortage;

          const nextPath = new Set(path);
          nextPath.add(productId);

          bom.items.forEach((item) => {
            const compId = item.productId || item.componentProduct?.id;
            if (!compId || nextPath.has(compId)) return;
            const need = num(item.quantity) * netShortage * scrapFactor(item.scrapPercent);
            if (need > 0) {
              explodeComponent(compId, need, nextPath);
            }
          });
        }
      }
    };

    // 1. Explode demand from open Work Orders
    openWorkOrders.forEach((wo) => {
      const remaining = Math.max(0, num(wo.quantity) - num(wo.quantityCompleted));
      if (!(remaining > 0)) return;

      if (wo.components && wo.components.length > 0) {
        wo.components.forEach((c) => {
          const unissued = Math.max(0, num(c.requiredQty) - num(c.issuedQty));
          if (unissued > 0) {
            explodeComponent(c.productId, unissued, new Set([wo.productId]));
          }
        });
      } else {
        const bom = (wo.bomId && bomById.get(wo.bomId)) || bomByProduct.get(wo.productId);
        if (bom && bom.items) {
          bom.items.forEach((item) => {
            const compId = item.productId || item.componentProduct?.id;
            const need = num(item.quantity) * remaining * scrapFactor(item.scrapPercent);
            if (need > 0) {
              explodeComponent(compId, need, new Set([wo.productId]));
            }
          });
        }
      }
    });

    // 2. Explode demand from standalone Production Jobs
    openJobs.forEach((job) => {
      if (linkedJobs.has(job.id)) return;
      const quantity = num(job.quantity);
      if (!(quantity > 0)) return;
      const bom = (job.bomId && bomById.get(job.bomId)) || bomByProduct.get(job.productId);
      if (bom && bom.items) {
        bom.items.forEach((item) => {
          const compId = item.productId || item.componentProduct?.id;
          const need = num(item.quantity) * quantity * scrapFactor(item.scrapPercent);
          if (need > 0) {
            explodeComponent(compId, need, new Set([job.productId]));
          }
        });
      }
    });

    // 3. Explode demand from standalone Production Orders
    openProductionOrders.forEach((order) => {
      if (linkedOrders.has(order.id)) return;
      const quantity = num(order.quantity);
      if (!(quantity > 0)) return;
      const bom = (order.bomId && bomById.get(order.bomId)) || bomByProduct.get(order.productId);
      if (bom && bom.items) {
        bom.items.forEach((item) => {
          const compId = item.productId || item.componentProduct?.id;
          const need = num(item.quantity) * quantity * scrapFactor(item.scrapPercent);
          if (need > 0) {
            explodeComponent(compId, need, new Set([order.productId]));
          }
        });
      }
    });

    // 4. Sales Orders not yet linked to work orders
    const linkedSalesOrderItems = new Set(openWorkOrders.map((wo) => wo.salesOrderItemId).filter(Boolean));
    openSalesOrders.forEach((so) => {
      so.items.forEach((item) => {
        if (linkedSalesOrderItems.has(item.id)) return;
        const unfulfilled = Math.max(0, num(item.quantity) - num(item.deliveredQuantity));
        if (unfulfilled > 0) {
          explodeComponent(item.productId, unfulfilled, new Set());
        }
      });
    });

    // Suggestions generation
    const purchaseSuggestions = [];
    const productionSuggestions = [];

    Object.keys(demand).forEach((productId) => {
      const product = productById.get(productId);
      if (!product) return;

      const grossDemand = roundQty(num(demand[productId]));
      const currentStock = roundQty(num(stockByProduct[productId]));
      const safetyStock = roundQty(Math.max(0, num(product.safetyStock)));
      const openOrders = roundQty(num(productionSupply[productId]));

      const shortage = roundQty(Math.max(0, grossDemand + safetyStock - currentStock));
      if (shortage <= 0 && grossDemand <= 0) return;

      const item = {
        productId,
        code: product.code,
        name: product.name,
        grossDemand,
        currentStock,
        safetyStock,
        openOrders,
        shortage,
        costPrice: num(product.costPrice)
      };

      if (isMakeProduct(product)) {
        productionSuggestions.push(item);
      } else {
        purchaseSuggestions.push(item);
      }
    });

    const byCode = (a, b) => String(a.code).localeCompare(String(b.code));
    purchaseSuggestions.sort(byCode);
    productionSuggestions.sort(byCode);

    let mps = { runId: null, horizonWeeks: 8, weekStart: new Date(), buckets: [], plannedOrders: [] };
    try {
      mps = await runMps({
        tenantId: req.tenantId,
        userId: req.user?.userId || null,
        horizonWeeks: req.body?.horizonWeeks
      });
      for (const need of mps.purchaseNeeds || []) {
        if (!(need.quantity > 0)) continue;
        const existing = purchaseSuggestions.find((row) => row.productId === need.productId);
        if (existing) {
          existing.shortage = roundQty(num(existing.shortage) + need.quantity);
          existing.grossDemand = roundQty(num(existing.grossDemand) + need.quantity);
        } else {
          purchaseSuggestions.push(need);
        }
      }
      purchaseSuggestions.sort(byCode);
    } catch (mpsErr) {
      console.warn('MPS run skipped or warning during MRP:', mpsErr.message);
    }

    const raised = await raiseRequirements({
      tenantId: req.tenantId,
      userId: req.user?.userId || null,
      purchaseSuggestions,
      productionSuggestions,
      bomByProduct
    });

    res.json({
      purchaseSuggestions,
      productionSuggestions,
      totalShortagesCount: purchaseSuggestions.length + productionSuggestions.length,
      purchaseRequisition: raised.purchaseRequisition,
      productionOrders: raised.productionOrders,
      message: raised.message,
      mps: {
        runId: mps.runId,
        horizonWeeks: mps.horizonWeeks,
        weekStart: mps.weekStart,
        buckets: mps.buckets,
        plannedOrders: mps.plannedOrders
      }
    });
  } catch (error) {
    console.error('MRP calculation error:', error);
    res.status(500).json({ error: 'Failed to execute MRP run calculation' });
  }
};

const nextJobNumber = async (tenantId, db) => {
  const date = new Date();
  const prefix = `JOB-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const existing = await db.productionJob.findMany({
    where: { tenantId, jobNumber: { startsWith: prefix } },
    select: { jobNumber: true }
  });
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  existing.forEach((row) => {
    const match = pattern.exec(row.jobNumber || '');
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};

const OPEN_PR = ['PENDING', 'APPROVED'];
const latestOpenRequisitions = async (tenantId, db = prisma) => {
  const rows = await db.purchaseRequisition.findMany({
    where: { tenantId, status: { in: OPEN_PR } },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
  const byProduct = new Map();
  rows.forEach((pr) => {
    pr.items.forEach((item) => {
      const current = byProduct.get(item.productId) || { qty: 0, item: null, pr: null };
      current.qty = roundQty(current.qty + num(item.quantity));
      if (!current.item) {
        current.item = item;
        current.pr = pr;
      }
      byProduct.set(item.productId, current);
    });
  });
  return byProduct;
};

const raiseRequirements = async ({ tenantId, userId, purchaseSuggestions, productionSuggestions, bomByProduct }) => {
  const createdOrders = [];
  let purchaseRequisition = null;
  let createdLines = 0;
  let updatedLines = 0;
  let updatedOrders = 0;

  await prisma.$transaction(async (tx) => {
    const prByProduct = await latestOpenRequisitions(tenantId, tx);
    const jobs = await tx.productionJob.findMany({
      where: { tenantId, status: { in: ['QUEUED', 'WIP', 'QC'] } },
      orderBy: { createdAt: 'desc' }
    });
    const jobByProduct = new Map();
    jobs.forEach((job) => {
      const current = jobByProduct.get(job.productId) || { qty: 0, job: null };
      current.qty = roundQty(current.qty + num(job.quantity));
      if (!current.job) current.job = job;
      jobByProduct.set(job.productId, current);
    });
    const freshLines = [];

    for (const row of purchaseSuggestions) {
      const covered = prByProduct.get(row.productId);
      const gap = roundQty(row.shortage - (covered ? covered.qty : 0));
      if (covered && gap <= 0) {
        row.documentNumber = covered.pr.prNumber;
        row.action = 'open';
        continue;
      }
      if (covered && covered.item) {
        const nextQty = roundQty(num(covered.item.quantity) + gap);
        const unit = num(covered.item.unitPrice);
        await tx.purchaseRequisitionItem.update({
          where: { id: covered.item.id },
          data: { quantity: nextQty, total: roundQty(unit * nextQty) }
        });
        const items = await tx.purchaseRequisitionItem.findMany({ where: { prId: covered.pr.id } });
        const total = roundQty(items.reduce((sum, item) => sum + (item.id === covered.item.id ? unit * nextQty : num(item.total)), 0));
        await tx.purchaseRequisition.update({
          where: { id: covered.pr.id },
          data: { total }
        });
        covered.qty = roundQty(covered.qty + gap);
        row.documentNumber = covered.pr.prNumber;
        row.action = 'updated';
        updatedLines += 1;
        continue;
      }
      freshLines.push(row);
    }

    if (freshLines.length) {
      const prNumber = await generateDocumentNumber(tenantId, 'purchaseRequisition', 'PR', 'prNumber', tx);
      const items = freshLines.map((row) => {
        const unit = num(row.costPrice);
        const quantity = row.shortage;
        return {
          productId: row.productId,
          quantity,
          unitPrice: unit,
          total: roundQty(unit * quantity)
        };
      });
      purchaseRequisition = await tx.purchaseRequisition.create({
        data: {
          tenantId,
          prNumber,
          date: new Date(),
          status: 'PENDING',
          total: roundQty(items.reduce((sum, item) => sum + item.total, 0)),
          createdBy: userId,
          items: { create: items }
        }
      });
      freshLines.forEach((row) => {
        row.documentNumber = prNumber;
        row.action = 'created';
      });
      createdLines = freshLines.length;
    }

    const planStart = new Date();
    planStart.setHours(0, 0, 0, 0);
    const planEnd = new Date(planStart);
    planEnd.setDate(planEnd.getDate() + 4);

    for (const row of productionSuggestions) {
      const covered = jobByProduct.get(row.productId);
      const gap = roundQty(row.shortage - (covered ? covered.qty : 0));
      if (covered && gap <= 0) {
        row.documentNumber = covered.job?.jobNumber || covered.job?.orderNumber || '';
        row.action = 'open';
        continue;
      }
      if (covered && covered.job) {
        const nextQty = roundQty(num(covered.job.quantity) + gap);
        const updated = await tx.productionJob.update({
          where: { id: covered.job.id },
          data: { quantity: nextQty }
        });
        await syncLegacy(tx, {
          tenantId,
          userId,
          legacy: updated,
          kind: 'job',
          sourceType: 'MRP',
          receiptOnComplete: false
        });
        covered.qty = roundQty(covered.qty + gap);
        row.documentNumber = updated.jobNumber;
        row.action = 'updated';
        updatedOrders += 1;
        continue;
      }
      const jobNumber = await nextJobNumber(tenantId, tx);
      const job = await tx.productionJob.create({
        data: {
          tenantId,
          jobNumber,
          productId: row.productId,
          bomId: bomByProduct.get(row.productId)?.id || null,
          quantity: row.shortage,
          status: 'QUEUED',
          priority: 'MEDIUM',
          startDate: planStart,
          endDate: planEnd,
          notes: 'MRP',
          createdBy: userId
        }
      });
      await syncLegacy(tx, {
        tenantId,
        userId,
        legacy: job,
        kind: 'job',
        sourceType: 'MRP',
        receiptOnComplete: false
      });
      row.documentNumber = job.jobNumber;
      row.action = 'created';
      createdOrders.push(job);
    }
  }, { timeout: 20000 });

  const raised = [];
  if (purchaseRequisition) raised.push(purchaseRequisition.prNumber);
  if (createdOrders.length) raised.push(`${createdOrders.length} job ${createdOrders.length === 1 ? 'order' : 'orders'}`);
  const updated = [];
  if (updatedLines) updated.push(`${updatedLines} requisition ${updatedLines === 1 ? 'line' : 'lines'}`);
  if (updatedOrders) updated.push(`${updatedOrders} job ${updatedOrders === 1 ? 'order' : 'orders'}`);

  let message = 'Open requisitions and job orders already cover these requirements';
  if (!purchaseSuggestions.length && !productionSuggestions.length) message = 'No shortages';
  else if (raised.length || updated.length) {
    message = [
      raised.length ? `Raised ${raised.join(' and ')}` : '',
      updated.length ? `Updated ${updated.join(' and ')}` : ''
    ].filter(Boolean).join('. ');
  }

  return {
    purchaseRequisition: purchaseRequisition ? { id: purchaseRequisition.id, prNumber: purchaseRequisition.prNumber, lines: createdLines } : null,
    productionOrders: createdOrders.map((job) => ({ id: job.id, orderNumber: job.jobNumber || job.orderNumber, productId: job.productId, quantity: num(job.quantity) })),
    message
  };
};

const convertPurchaseSuggestion = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Product and quantity are required' });
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });
    if (!product) return res.status(400).json({ error: 'Product not found' });

    const row = {
      productId,
      code: product.code,
      name: product.name,
      shortage: num(quantity),
      costPrice: num(product.costPrice)
    };
    const raised = await raiseRequirements({
      tenantId: req.tenantId,
      userId: req.user?.userId || null,
      purchaseSuggestions: [row],
      productionSuggestions: [],
      bomByProduct: new Map()
    });
    res.status(row.action === 'created' ? 201 : 200).json({
      message: row.action === 'created'
        ? `Successfully created Requisition ${row.documentNumber}`
        : raised.message,
      documentNumber: row.documentNumber,
      pr: raised.purchaseRequisition
    });
  } catch (error) {
    console.error('Convert purchase suggestion error:', error);
    res.status(500).json({ error: 'Failed to convert purchase suggestion' });
  }
};

const convertProductionSuggestion = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Product and quantity are required' });
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });
    if (!product) return res.status(400).json({ error: 'Product not found' });

    const activeBom = await prisma.bOM.findFirst({
      where: { tenantId: req.tenantId, productId, status: 'ACTIVE', isDefault: true }
    });
    const row = { productId, code: product.code, name: product.name, shortage: num(quantity) };
    const raised = await raiseRequirements({
      tenantId: req.tenantId,
      userId: req.user?.userId || null,
      purchaseSuggestions: [],
      productionSuggestions: [row],
      bomByProduct: new Map(activeBom ? [[productId, activeBom]] : [])
    });
    res.status(row.action === 'created' ? 201 : 200).json({
      message: raised.message,
      documentNumber: row.documentNumber,
      order: raised.productionOrders[0] || null
    });
  } catch (error) {
    console.error('Convert production suggestion error:', error);
    res.status(500).json({ error: 'Failed to convert production suggestion' });
  }
};

module.exports = {
  runMRPAna,
  convertPurchaseSuggestion,
  convertProductionSuggestion
};
