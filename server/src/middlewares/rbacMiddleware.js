const prisma = require('../lib/prisma');
const { authenticateToken } = require('./authMiddleware');
const { enforceTenantContext } = require('./tenantMiddleware');
const { hasFullAccess, allows, actionForMethod } = require('../permissions/catalog');

async function loadActor(req) {
  if (Object.prototype.hasOwnProperty.call(req, 'actorUser')) return req.actorUser;
  const userId = req.user && req.user.userId;
  if (!userId) {
    req.actorUser = null;
    return null;
  }
  req.actorUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true }
  });
  return req.actorUser;
}

const requirePermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Access token is missing' });
      }

      const user = await loadActor(req);
      if (!user) return res.status(401).json({ error: 'User not found' });
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'User account is inactive' });
      }
      if (!user.role) return res.status(403).json({ error: 'No role assigned to user' });
      if (hasFullAccess(user.role)) return next();

      const needed = action || actionForMethod(req.method);
      if (allows(user.role.permissions, moduleName, needed)) return next();

      return res.status(403).json({
        error: `Forbidden: Requires ${needed} permission for ${moduleName}`
      });
    } catch (error) {
      console.error('RBAC Error:', error);
      return res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
};

const secureModule = (moduleName) => [
  authenticateToken,
  enforceTenantContext,
  requirePermission(moduleName)
];

function requireAnyModule(moduleNames) {
  const names = Array.isArray(moduleNames) ? moduleNames : [moduleNames];
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Access token is missing' });
      }
      const user = await loadActor(req);
      if (!user) return res.status(401).json({ error: 'User not found' });
      if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'User account is inactive' });
      if (!user.role) return res.status(403).json({ error: 'No role assigned to user' });
      if (hasFullAccess(user.role)) return next();
      const needed = actionForMethod(req.method);
      if (names.some((name) => allows(user.role.permissions, name, needed))) return next();
      return res.status(403).json({
        error: `Forbidden: Requires ${needed} permission for ${names.join(' or ')}`
      });
    } catch (error) {
      console.error('RBAC Error:', error);
      return res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
}

const secureAny = (moduleNames) => [
  authenticateToken,
  enforceTenantContext,
  requireAnyModule(moduleNames)
];

module.exports = {
  loadActor,
  requirePermission,
  requireAnyModule,
  secureModule,
  secureAny
};
