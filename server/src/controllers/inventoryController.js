const prisma = require('../lib/prisma');
const { sendError } = require('../services/errors');
const {
  ensureDefaultLocations,
  ensureUomTemplates,
  applyUomTemplate,
  assertBinType
} = require('../services/inventory/locations');
const {
  proposeRetest,
  decideRetest,
  setBatchStatus,
  traceBatch,
  suggestPicks,
  recordBatch
} = require('../services/inventory/batches');
const { releaseExpired } = require('../services/inventory/allocations');
const {
  postBatchReceipt,
  createMaterialRequest,
  approveMaterialRequest,
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
  cancelCycleCount,
  movementReport,
  agingReport,
  positionReport,
  deactivatePallet,
  renumberPallet,
  mrInclude,
  transferInclude,
  returnInclude
} = require('../services/inventory/ops');

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    return sendError(res, error, 'Request failed');
  }
};

const tenant = (req) => req.tenantId;

module.exports = {
  listBranches: wrap(async (req, res) => {
    res.json(await prisma.branch.findMany({ where: { tenantId: tenant(req) }, orderBy: { code: 'asc' }, include: { warehouses: true } }));
  }),
  saveBranch: wrap(async (req, res) => {
    const { code, name, address } = req.body;
    const row = req.params.id
      ? await prisma.branch.update({ where: { id: req.params.id, tenantId: tenant(req) }, data: { code, name, address } })
      : await prisma.branch.create({ data: { tenantId: tenant(req), code, name, address: address || null } });
    res.status(req.params.id ? 200 : 201).json(row);
  }),
  listBins: wrap(async (req, res) => {
    const where = { tenantId: tenant(req) };
    if (req.query.warehouseId) where.warehouseId = req.query.warehouseId;
    res.json(await prisma.bin.findMany({ where, include: { warehouse: true }, orderBy: { code: 'asc' } }));
  }),
  saveBin: wrap(async (req, res) => {
    assertBinType(req.body.binType);
    const data = {
      code: req.body.code,
      name: req.body.name,
      binType: req.body.binType || 'STORAGE',
      active: req.body.active !== false
    };
    if (req.params.id) {
      const owned = await prisma.bin.findFirst({ where: { id: req.params.id, tenantId: tenant(req) } });
      if (!owned) return res.status(404).json({ error: 'Bin was not found.' });
      return res.json(await prisma.bin.update({ where: { id: owned.id }, data }));
    }
    const warehouse = await prisma.warehouse.findFirst({ where: { id: req.body.warehouseId, tenantId: tenant(req) } });
    if (!warehouse) return res.status(400).json({ error: 'Unknown warehouse.', fields: { warehouseId: 'Unknown warehouse.' } });
    res.status(201).json(await prisma.bin.create({ data: { tenantId: tenant(req), warehouseId: warehouse.id, ...data } }));
  }),
  ensureLocations: wrap(async (req, res) => {
    const created = await ensureDefaultLocations(prisma, tenant(req), req.user?.userId);
    res.json({ created });
  }),
  listTemplates: wrap(async (req, res) => {
    res.json(await prisma.uomTemplate.findMany({ where: { tenantId: tenant(req) }, include: { lines: true }, orderBy: { code: 'asc' } }));
  }),
  ensureTemplates: wrap(async (req, res) => {
    res.json(await ensureUomTemplates(prisma, tenant(req)));
  }),
  applyTemplate: wrap(async (req, res) => {
    const product = await applyUomTemplate(prisma, tenant(req), req.params.id, req.body.productId);
    res.json(product);
  }),
  listBatches: wrap(async (req, res) => {
    const where = { tenantId: tenant(req) };
    if (req.query.productId) where.productId = req.query.productId;
    if (req.query.q) where.lotNumber = { contains: String(req.query.q), mode: 'insensitive' };
    res.json(await prisma.stockBatch.findMany({
      where,
      include: { product: true, supplier: true, retests: true },
      orderBy: { receiptDate: 'desc' }
    }));
  }),
  saveBatch: wrap(async (req, res) => {
    const batch = await recordBatch(prisma, { tenantId: tenant(req), ...req.body });
    if (!batch) return res.status(400).json({ error: 'Lot number is required.', fields: { lotNumber: 'Lot number is required.' } });
    res.status(201).json(batch);
  }),
  retest: wrap(async (req, res) => {
    res.status(201).json(await proposeRetest(prisma, {
      tenantId: tenant(req),
      batchId: req.params.id,
      proposedExpiry: req.body.proposedExpiry,
      evidence: req.body.evidence,
      requestedBy: req.user?.userId
    }));
  }),
  decideRetest: wrap(async (req, res) => {
    res.json(await decideRetest(prisma, {
      tenantId: tenant(req),
      batchId: req.params.id,
      decision: req.body.decision,
      decidedBy: req.user?.userId
    }));
  }),
  batchStatus: wrap(async (req, res) => {
    res.json(await setBatchStatus(prisma, { tenantId: tenant(req), batchId: req.params.id, ...req.body }));
  }),
  trace: wrap(async (req, res) => {
    res.json(await traceBatch(prisma, tenant(req), req.query));
  }),
  suggest: wrap(async (req, res) => {
    res.json(await suggestPicks(prisma, tenant(req), req.query));
  }),
  listPallets: wrap(async (req, res) => {
    const where = { tenantId: tenant(req) };
    if (req.query.warehouseId) where.warehouseId = req.query.warehouseId;
    res.json(await prisma.pallet.findMany({ where, include: { warehouse: true, supersededBy: true }, orderBy: { code: 'asc' } }));
  }),
  savePallet: wrap(async (req, res) => {
    const warehouse = await prisma.warehouse.findFirst({ where: { id: req.body.warehouseId, tenantId: tenant(req) } });
    if (!warehouse) return res.status(400).json({ error: 'Unknown warehouse.' });
    res.status(201).json(await prisma.pallet.create({
      data: { tenantId: tenant(req), warehouseId: warehouse.id, code: String(req.body.code || '').trim(), status: 'ACTIVE' }
    }));
  }),
  deactivatePallet: wrap(async (req, res) => {
    res.json(await deactivatePallet(prisma, { tenantId: tenant(req), id: req.params.id }));
  }),
  renumberPallet: wrap(async (req, res) => {
    res.status(201).json(await renumberPallet(prisma, { tenantId: tenant(req), id: req.params.id, code: req.body.code }));
  }),
  positions: wrap(async (req, res) => {
    res.json(await positionReport(prisma, tenant(req), req.query));
  }),
  movementReport: wrap(async (req, res) => {
    res.json(await movementReport(prisma, tenant(req), req.query));
  }),
  agingReport: wrap(async (req, res) => {
    res.json(await agingReport(prisma, tenant(req), req.query));
  }),
  varianceReport: wrap(async (req, res) => {
    const where = { tenantId: tenant(req) };
    if (req.query.countId) where.id = req.query.countId;
    const count = await prisma.cycleCount.findFirst({
      where,
      include: { lines: { include: { product: true } }, warehouse: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(count);
  }),
  receipt: wrap(async (req, res) => {
    const posted = await prisma.$transaction((tx) => postBatchReceipt(tx, {
      tenantId: tenant(req),
      createdBy: req.user?.userId,
      ...req.body
    }));
    res.status(201).json(posted);
  }),
  listRequests: wrap(async (req, res) => {
    res.json(await prisma.materialRequest.findMany({
      where: { tenantId: tenant(req) },
      include: mrInclude,
      orderBy: { date: 'desc' }
    }));
  }),
  saveRequest: wrap(async (req, res) => {
    const row = await prisma.$transaction((tx) => createMaterialRequest(tx, {
      tenantId: tenant(req),
      createdBy: req.user?.userId,
      ...req.body
    }));
    res.status(201).json(row);
  }),
  approveRequest: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => approveMaterialRequest(tx, { tenantId: tenant(req), id: req.params.id, userId: req.user?.userId })));
  }),
  pickRequest: wrap(async (req, res) => {
    res.status(201).json(await prisma.$transaction((tx) => buildPickList(tx, { tenantId: tenant(req), id: req.params.id })));
  }),
  fulfilRequest: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => fulfilMaterialRequest(tx, {
      tenantId: tenant(req),
      id: req.params.id,
      lines: req.body.lines || req.body.items,
      userId: req.user?.userId
    })));
  }),
  listTransfers: wrap(async (req, res) => {
    res.json(await prisma.inventoryTransfer.findMany({
      where: { tenantId: tenant(req) },
      include: transferInclude,
      orderBy: { date: 'desc' }
    }));
  }),
  saveTransfer: wrap(async (req, res) => {
    const row = await prisma.$transaction((tx) => createTransfer(tx, {
      tenantId: tenant(req),
      createdBy: req.user?.userId,
      post: req.body.post === true,
      ...req.body
    }));
    res.status(201).json(row);
  }),
  shipTransfer: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => shipTransfer(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId, ...req.body })));
  }),
  receiveTransfer: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => receiveTransfer(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId })));
  }),
  listReturns: wrap(async (req, res) => {
    res.json(await prisma.stockReturn.findMany({ where: { tenantId: tenant(req) }, include: returnInclude, orderBy: { date: 'desc' } }));
  }),
  saveReturn: wrap(async (req, res) => {
    const row = await prisma.$transaction((tx) => createReturn(tx, {
      tenantId: tenant(req),
      createdBy: req.user?.userId,
      post: req.body.post === true,
      ...req.body
    }));
    res.status(201).json(row);
  }),
  postReturn: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => postReturn(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId })));
  }),
  listCounts: wrap(async (req, res) => {
    res.json(await prisma.cycleCount.findMany({
      where: { tenantId: tenant(req) },
      include: { lines: { include: { product: true } }, warehouse: true },
      orderBy: { date: 'desc' }
    }));
  }),
  saveCount: wrap(async (req, res) => {
    const row = await prisma.$transaction((tx) => createCycleCount(tx, { tenantId: tenant(req), createdBy: req.user?.userId, ...req.body }));
    res.status(201).json(row);
  }),
  financeCount: wrap(async (req, res) => {
    res.json(await financeCycleCount(prisma, { tenantId: tenant(req), id: req.params.id, decision: req.body.decision }));
  }),
  postCount: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => postCycleCount(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId })));
  }),
  cancelCount: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => cancelCycleCount(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId, reason: req.body?.reason })));
  }),
  cancelRequest: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => cancelMaterialRequest(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId, reason: req.body?.reason })));
  }),
  cancelTransfer: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => cancelTransfer(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId, reason: req.body?.reason })));
  }),
  cancelReturn: wrap(async (req, res) => {
    res.json(await prisma.$transaction((tx) => cancelReturn(tx, { tenantId: tenant(req), id: req.params.id, createdBy: req.user?.userId, reason: req.body?.reason })));
  }),
  listAllocations: wrap(async (req, res) => {
    await releaseExpired(prisma, tenant(req));
    const where = { tenantId: tenant(req) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.productId) where.productId = req.query.productId;
    res.json(await prisma.stockAllocation.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    }));
  })
};
