const express = require('express');
const productionCalendarController = require('../controllers/productionCalendarController');
const { requireTenant } = require('../middlewares/tenantMiddleware');
const { validateBody } = require('../validation/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

router.use(requireTenant);

// Shifts Routes
router.get('/shifts', productionCalendarController.getShiftPatterns);
router.post('/shifts', validateBody(schemas.shiftPattern), productionCalendarController.createShiftPattern);
router.put('/shifts/:id', validateBody(schemas.shiftPattern), productionCalendarController.updateShiftPattern);
router.delete('/shifts/:id', productionCalendarController.deleteShiftPattern);

// Events Routes
router.get('/events', productionCalendarController.getCalendarEvents);
router.post('/events', validateBody(schemas.calendarEvent), productionCalendarController.createCalendarEvent);
router.put('/events/:id', validateBody(schemas.calendarEvent), productionCalendarController.updateCalendarEvent);
router.delete('/events/:id', productionCalendarController.deleteCalendarEvent);

module.exports = router;
