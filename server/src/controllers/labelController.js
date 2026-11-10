const labels = require('../services/labels');

function send(res, error, fallback) {
  const status = error.status || 500;
  if (status >= 500) console.error(fallback, error);
  res.status(status).json({ error: status >= 500 ? fallback : error.message });
}

const catalog = async (req, res) => {
  try {
    res.json(await labels.catalog(req.tenantId));
  } catch (error) {
    send(res, error, 'Failed to load labels');
  }
};

const render = async (req, res) => {
  try {
    res.json(await labels.renderLabels(req.tenantId, req.body || {}));
  } catch (error) {
    send(res, error, 'Failed to render labels');
  }
};

const resolve = async (req, res) => {
  try {
    res.json(await labels.resolveCode(req.tenantId, req.query.code || req.query.q));
  } catch (error) {
    send(res, error, 'Failed to resolve the scan');
  }
};

module.exports = { catalog, render, resolve };
