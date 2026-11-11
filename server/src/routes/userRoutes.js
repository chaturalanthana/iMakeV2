const express = require('express');
const { getUsers, getUserById, createUser, updateUser } = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(authenticateToken);
router.use(requirePermission('settings', 'read')); 

router.get('/', getUsers);
router.get('/:id', getUserById);

router.post('/', requirePermission('settings', 'write'), validateBody(schemas.userBody), createUser);
router.put('/:id', requirePermission('settings', 'write'), validateBody(schemas.userUpdate), updateUser);

module.exports = router;
