const workOrders = require('../services/production/workOrders');

const send = (res, error, label) => {
  if (error instanceof workOrders.ProductionError) {
    return res.status(error.status || 400).json({ error: error.message });
  }
  console.error(label, error);
  return res.status(500).json({ error: label });
};

const rollup = async (req, res) => {
  try {
    const sheet = await workOrders.quoteRollup(req.tenantId, {
      productId: req.query.productId,
      quantity: req.query.quantity,
      bomId: req.query.bomId
    });
    res.json(sheet);
  } catch (error) {
    send(res, error, 'Failed to roll up cost');
  }
};

const variances = async (req, res) => {
  try {
    res.json(await workOrders.productVarianceReport(req.tenantId));
  } catch (error) {
    send(res, error, 'Failed to load cost variances');
  }
};

module.exports = { rollup, variances };
