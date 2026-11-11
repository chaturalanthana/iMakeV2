const prisma = require('../lib/prisma');
const { listAlerts } = require('../services/alerts');
const { loadActor } = require('../middlewares/rbacMiddleware');

const inbox = async (req, res) => {
  try {
    const user = await loadActor(req);
    res.json(await listAlerts(prisma, req.tenantId, user?.role));
  } catch (error) {
    console.error('Failed to load alerts', error);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
};

module.exports = { inbox };
