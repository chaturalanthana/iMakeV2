const express = require('express');
const productionCalendarController = require('../controllers/productionCalendarController');
const { requireTenant } = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(requireTenant);

// Shifts Routes
router.get('/shifts', productionCalendarController.getShiftPatterns);
router.post('/shifts', productionCalendarController.createShiftPattern);
router.put('/shifts/:id', productionCalendarController.updateShiftPattern);
router.delete('/shifts/:id', productionCalendarController.deleteShiftPattern);

// Events Routes
router.get('/events', productionCalendarController.getCalendarEvents);
router.post('/events', productionCalendarController.createCalendarEvent);
router.put('/events/:id', productionCalendarController.updateCalendarEvent);
router.delete('/events/:id', productionCalendarController.deleteCalendarEvent);

module.exports = router;
