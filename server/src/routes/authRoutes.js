const express = require('express');
const { login, register, me } = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/register', register); // Setup a tenant & first user
router.get('/me', authenticateToken, me); // Verify current JWT token and get profile

module.exports = router;
