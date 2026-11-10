const prisma = require('../lib/prisma');
const { generateDocumentNumber } = require('../utils/codeGenerator');

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
    const orders = await prisma.productionOrder.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ['RELEASED', 'WIP'] }
      }
    });

    const [activeBoms, orderBoms, movements] = await Promise.all([
      prisma.bOM.findMany({
        where: { tenantId: req.tenantId, status: 'ACTIVE', isDefault: true },
        include: { items: { include: { componentProduct: true } } }
      }),
      prisma.bOM.findMany({
        where: { tenantId: req.tenantId, id: { in: orders.map((order) => order.bomId).filter(Boolean) } },
        include: { items: { include: { componentProduct: true } } }
      }),
      prisma.stockMovement.findMany({ where: { tenantId: req.tenantId } })
    ]);

    const bomByProduct = new Map(activeBoms.map((bom) => [bom.productId, bom]));
    const bomById = new Map(orderBoms.map((bom) => [bom.id, bom]));
    const movementsByProduct = {};
    movements.forEach((movement) => {
      if (!movementsByProduct[movement.productId]) movementsByProduct[movement.productId] = [];
      movementsByProduct[movement.productId].push(movement);
    });
    const stockByProduct = {};
    Object.keys(movementsByProduct).forEach((productId) => {
      stockByProduct[productId] = stockOnHand(movementsByProduct[productId]);
    });

    const supply = {};
    const openJobs = await prisma.productionJob.findMany({
      where: { tenantId: req.tenantId, status: { in: ['QUEUED', 'WIP', 'QC'] } }
    });
    orders.forEach((order) => {
      supply[order.productId] = num(supply[order.productId]) + num(order.quantity);
    });
    openJobs.forEach((job) => {
      supply[job.productId] = num(supply[job.productId]) + num(job.quantity);
    });

    const products = {};
    const demand = {};
    const planned = {};

    const plan = (productId, path) => {
      const product = products[productId];
      if (!product || !product.bomApplicable || path.has(productId)) return;
      const safety = Math.max(0, num(product.safetyStock));
      const shortage = num(demand[productId]) + safety - num(stockByProduct[productId]) - num(supply[productId]) - num(planned[productId]);
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

    orders.forEach((order) => {
      const bom = (order.bomId && bomById.get(order.bomId)) || bomByProduct.get(order.productId);
      const quantity = num(order.quantity);
      if (!bom || !(quantity > 0)) return;
      const path = new Set([order.productId]);
      bom.items.forEach((item) => {
        const component = item.componentProduct;
        if (!component) return;
        const need = num(item.quantity) * quantity * scrapFactor(item.scrapPercent);
        if (!(need > 0)) return;
        products[component.id] = component;
        demand[component.id] = num(demand[component.id]) + need;
        plan(component.id, path);
      });
    });

    const purchaseSuggestions = [];
    const productionSuggestions = [];
    Object.keys(demand).forEach((productId) => {
      const product = products[productId];
      if (!product) return;
      const grossDemand = roundQty(num(demand[productId]));
      const currentStock = roundQty(num(stockByProduct[productId]));
      const safetyStock = roundQty(Math.max(0, num(product.safetyStock)));
      const openOrders = roundQty(num(supply[productId]));
      const shortage = roundQty(grossDemand + safetyStock - currentStock - openOrders);
      if (shortage <= 0) return;
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
      if (product.bomApplicable) productionSuggestions.push(item);
      else purchaseSuggestions.push(item);
    });

    const byCode = (a, b) => String(a.code).localeCompare(String(b.code));
    purchaseSuggestions.sort(byCode);
    productionSuggestions.sort(byCode);

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
      message: raised.message
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
      if (!jobByProduct.has(job.productId)) jobByProduct.set(job.productId, job);
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
      if (covered) {
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
      if (covered) {
        const updated = await tx.productionJob.update({
          where: { id: covered.id },
          data: { quantity: roundQty(num(covered.quantity) + row.shortage) }
        });
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
    res.status(row.action === 'created' ? 201 : 200).json({ message: raised.message, documentNumber: row.documentNumber });
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
