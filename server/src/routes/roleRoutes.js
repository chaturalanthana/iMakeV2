const express = require('express');
const { getRoles, getRoleById, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');
const { MODULES, ACTIONS } = require('../permissions/catalog');

const router = express.Router();

// Only users with 'settings:read' or 'users:read' or Super Admins can access
router.use(authenticateToken);
router.use(requirePermission('settings', 'read')); // Simplified, assume 'settings' module for Roles/Users

router.get('/', getRoles);
router.get('/catalog', (req, res) => {
  res.json({ modules: MODULES, actions: ACTIONS });
});
router.get('/:id', getRoleById);

// Requires write permission
router.post('/', requirePermission('settings', 'write'), createRole);
router.put('/:id', requirePermission('settings', 'write'), updateRole);
router.delete('/:id', requirePermission('settings', 'write'), deleteRole);

module.exports = router;
