const prisma = require('../lib/prisma');

const requirePermission = (module, action) => {
  return async (req, res, next) => {
    try {
      const { userId } = req.user;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'User account is inactive' });
      }

      // If user has a system role with all permissions, let them pass
      if (user.role && user.role.isSystem && user.role.permissions.all) {
        return next();
      }

      // If no role assigned, deny access
      if (!user.role) {
        return res.status(403).json({ error: 'No role assigned to user' });
      }

      const permissions = user.role.permissions || {};
      
      // Check if they have the specific module and action
      // Expected structure: permissions = { "products": ["read", "write"], "sales": ["read"] }
      if (permissions[module] && permissions[module].includes(action)) {
        return next();
      }

      return res.status(403).json({ error: `Forbidden: Requires ${action} permission for ${module}` });
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
};

module.exports = {
  requirePermission
};
