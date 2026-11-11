const workOrders = require('../services/production/workOrders');

const send = (res, error, label) => {
  if (error instanceof workOrders.ProductionError) {
    return res.status(error.status || 400).json({ error: error.message, ...error.extra });
  }
  console.error(label, error);
  return res.status(500).json({ error: label });
};

const list = async (req, res) => {
  try {
    res.json(await workOrders.listWorkOrders(req.tenantId, req.query));
  } catch (error) {
    send(res, error, 'Failed to fetch work orders');
  }
};

const getOne = async (req, res) => {
  try {
    res.json(await workOrders.getWorkOrder(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to fetch work order');
  }
};

const create = async (req, res) => {
  try {
    const created = await workOrders.createWorkOrder(req.tenantId, req.user?.userId || null, req.body);
    res.status(201).json(created);
  } catch (error) {
    send(res, error, 'Failed to create work order');
  }
};

const update = async (req, res) => {
  try {
    res.json(await workOrders.updateWorkOrder(req.tenantId, req.params.id, req.body));
  } catch (error) {
    send(res, error, 'Failed to update work order');
  }
};

const remove = async (req, res) => {
  try {
    res.json(await workOrders.deleteWorkOrder(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to delete work order');
  }
};

const release = async (req, res) => {
  try {
    const result = await workOrders.releaseWorkOrder(req.tenantId, req.params.id);
    res.json({ ...result.workOrder, warnings: result.warnings });
  } catch (error) {
    send(res, error, 'Failed to release work order');
  }
};

const issue = async (req, res) => {
  try {
    res.status(201).json(await workOrders.issueMaterial(req.tenantId, req.params.id, req.body, req.user?.userId || null));
  } catch (error) {
    send(res, error, 'Failed to issue material');
  }
};

const clock = (action) => async (req, res) => {
  try {
    res.json(await workOrders.clockOperation(
      req.tenantId,
      req.params.id,
      req.params.operationId,
      action,
      req.body || {},
      req.user?.userId || null
    ));
  } catch (error) {
    send(res, error, 'Failed to update operation');
  }
};

const confirm = async (req, res) => {
  try {
    const result = await workOrders.confirmOperation(req.tenantId, req.params.id, req.body, req.user?.userId || null);
    res.status(201).json({ ...result.workOrder, confirmationId: result.confirmationId });
  } catch (error) {
    send(res, error, 'Failed to confirm operation');
  }
};

const teco = async (req, res) => {
  try {
    res.json(await workOrders.technicallyComplete(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to technically complete work order');
  }
};

const close = async (req, res) => {
  try {
    res.json(await workOrders.closeWorkOrder(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to close work order');
  }
};

const closeNow = async (req, res) => {
  try {
    res.json(await workOrders.closeNow(req.tenantId, req.params.id, { short: false }));
  } catch (error) {
    send(res, error, 'Failed to close work order');
  }
};

const shortClose = async (req, res) => {
  try {
    res.json(await workOrders.closeNow(req.tenantId, req.params.id, { short: true }));
  } catch (error) {
    send(res, error, 'Failed to short-close work order');
  }
};

const cancel = async (req, res) => {
  try {
    res.json(await workOrders.cancelWorkOrder(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to cancel work order');
  }
};

const cost = async (req, res) => {
  try {
    res.json(await workOrders.getCost(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to load work order cost');
  }
};

const settings = async (req, res) => {
  try {
    res.json(await workOrders.getSettings(require('../lib/prisma'), req.tenantId));
  } catch (error) {
    send(res, error, 'Failed to load production settings');
  }
};

const saveSettings = async (req, res) => {
  try {
    res.json(await workOrders.updateSettings(req.tenantId, req.body));
  } catch (error) {
    send(res, error, 'Failed to save production settings');
  }
};

const capacity = async (req, res) => {
  try {
    res.json(await workOrders.loadCapacity(req.tenantId, req.query));
  } catch (error) {
    send(res, error, 'Failed to load capacity');
  }
};

const reasons = async (req, res) => {
  try {
    res.json(await workOrders.ensureReasonCodes(require('../lib/prisma'), req.tenantId));
  } catch (error) {
    send(res, error, 'Failed to load reason codes');
  }
};

const scan = async (req, res) => {
  try {
    res.json(await workOrders.scanWorkOrder(req.tenantId, req.query.code || req.query.q));
  } catch (error) {
    send(res, error, 'Failed to scan work order');
  }
};

const migrate = async (req, res) => {
  try {
    await workOrders.migrateMissing(require('../lib/prisma'), req.tenantId);
    res.json({ message: 'Legacy production jobs and production orders were copied onto work orders' });
  } catch (error) {
    send(res, error, 'Failed to migrate work orders');
  }
};

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  release,
  issue,
  start: clock('START'),
  pause: clock('PAUSE'),
  stop: clock('STOP'),
  confirm,
  teco,
  close,
  closeNow,
  shortClose,
  cancel,
  cost,
  settings,
  saveSettings,
  capacity,
  reasons,
  scan,
  migrate
};
