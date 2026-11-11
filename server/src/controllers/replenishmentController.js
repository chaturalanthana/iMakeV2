const replenishment = require('../services/replenishment');

function send(res, error, fallback) {
  const status = error.status || 500;
  if (status >= 500) console.error(fallback, error);
  res.status(status).json({ error: status >= 500 ? fallback : error.message });
}

const policies = async (req, res) => {
  try {
    res.json(await replenishment.listPolicies(req.tenantId));
  } catch (error) {
    send(res, error, 'Failed to load reorder policies');
  }
};

const savePolicy = async (req, res) => {
  try {
    res.status(201).json(await replenishment.savePolicy(req.tenantId, req.body));
  } catch (error) {
    send(res, error, 'Failed to save reorder policy');
  }
};

const deletePolicy = async (req, res) => {
  try {
    res.json(await replenishment.deletePolicy(req.tenantId, req.params.id));
  } catch (error) {
    send(res, error, 'Failed to delete reorder policy');
  }
};

const current = async (req, res) => {
  try {
    res.json({
      settings: await replenishment.getSettings(req.tenantId),
      run: await replenishment.latestRun(req.tenantId)
    });
  } catch (error) {
    send(res, error, 'Failed to load replenishment');
  }
};

const saveSettings = async (req, res) => {
  try {
    res.json(await replenishment.saveSettings(req.tenantId, req.body));
  } catch (error) {
    send(res, error, 'Failed to save replenishment settings');
  }
};

const run = async (req, res) => {
  try {
    res.status(201).json(await replenishment.executeRun(req.tenantId, req.user.userId, 'MANUAL'));
  } catch (error) {
    send(res, error, 'Failed to run replenishment');
  }
};

const approve = async (req, res) => {
  try {
    res.json(await replenishment.approveDrafts(req.tenantId));
  } catch (error) {
    send(res, error, 'Failed to approve replenishment');
  }
};

const tick = async (req, res) => {
  try {
    res.json({ ran: await replenishment.runDueReplenishment() });
  } catch (error) {
    send(res, error, 'Failed to run the replenishment schedule');
  }
};

module.exports = {
  policies, savePolicy, deletePolicy, current, saveSettings, run, approve, tick
};
