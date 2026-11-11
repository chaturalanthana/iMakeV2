const { authenticateToken } = require('./authMiddleware');

const enforceTenantContext = (req, res, next) => {
  // Ensure the user is authenticated first
  if (!req.user || !req.user.tenantId) {
    return res.status(403).json({ error: 'Tenant context is missing from the request' });
  }

  // Inject tenantId to req so controllers always have easy access to it
  req.tenantId = req.user.tenantId;
  next();
};

const requireTenant = [authenticateToken, enforceTenantContext];

module.exports = {
  enforceTenantContext,
  requireTenant
};
