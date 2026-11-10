const prisma = require('../lib/prisma');

// ==========================================
// SHIFT PATTERNS CONTROLLERS
// ==========================================

const getShiftPatterns = async (req, res) => {
  try {
    const shifts = await prisma.shiftPattern.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(shifts);
  } catch (error) {
    console.error('Fetch shift patterns error:', error);
    res.status(500).json({ error: 'Failed to fetch shift patterns' });
  }
};

const createShiftPattern = async (req, res) => {
  try {
    const { name, startTime, endTime, workDays, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Shift pattern name is required' });
    }
    if (!startTime || !startTime.trim()) {
      return res.status(400).json({ error: 'Start time is required (e.g. 08:00)' });
    }
    if (!endTime || !endTime.trim()) {
      return res.status(400).json({ error: 'End time is required (e.g. 16:00)' });
    }

    // Check duplicate name
    const existing = await prisma.shiftPattern.findFirst({
      where: {
        tenantId: req.tenantId,
        name: { equals: name.trim(), mode: 'insensitive' }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Shift pattern with this name already exists' });
    }

    const shift = await prisma.shiftPattern.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        workDays: workDays || [],
        description,
        createdBy: req.user.userId
      }
    });

    res.status(201).json(shift);
  } catch (error) {
    console.error('Create shift pattern error:', error);
    res.status(500).json({ error: 'Failed to create shift pattern' });
  }
};

const updateShiftPattern = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, workDays, description } = req.body;

    const shift = await prisma.shiftPattern.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!shift) {
      return res.status(404).json({ error: 'Shift pattern not found' });
    }

    if (name && name.trim() !== shift.name) {
      const existing = await prisma.shiftPattern.findFirst({
        where: {
          tenantId: req.tenantId,
          name: { equals: name.trim(), mode: 'insensitive' },
          NOT: { id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Shift pattern with this name already exists' });
      }
    }

    const updated = await prisma.shiftPattern.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : shift.name,
        startTime: startTime !== undefined ? startTime.trim() : shift.startTime,
        endTime: endTime !== undefined ? endTime.trim() : shift.endTime,
        workDays: workDays !== undefined ? workDays : shift.workDays,
        description: description !== undefined ? description : shift.description
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update shift pattern error:', error);
    res.status(500).json({ error: 'Failed to update shift pattern' });
  }
};

const deleteShiftPattern = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await prisma.shiftPattern.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!shift) {
      return res.status(404).json({ error: 'Shift pattern not found' });
    }

    // Check if used in calendar events
    const inUse = await prisma.productionCalendarEvent.findFirst({
      where: { tenantId: req.tenantId, shiftPatternId: id }
    });
    if (inUse) {
      return res.status(400).json({ error: 'Cannot delete shift pattern since it is referenced in calendar events' });
    }

    await prisma.shiftPattern.delete({
      where: { id }
    });

    res.json({ message: 'Shift pattern deleted successfully' });
  } catch (error) {
    console.error('Delete shift pattern error:', error);
    res.status(500).json({ error: 'Failed to delete shift pattern' });
  }
};

// ==========================================
// CALENDAR EVENT CONTROLLERS
// ==========================================

const getCalendarEvents = async (req, res) => {
  try {
    const { year, month } = req.query;
    const where = { tenantId: req.tenantId };

    if (year) {
      const startOfYear = new Date(parseInt(year), 0, 1);
      const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      
      if (month) {
        const startOfMonth = new Date(parseInt(year), parseInt(month), 1);
        const endOfMonth = new Date(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
        where.date = { gte: startOfMonth, lte: endOfMonth };
      } else {
        where.date = { gte: startOfYear, lte: endOfYear };
      }
    }

    const events = await prisma.productionCalendarEvent.findMany({
      where,
      include: {
        shiftPattern: {
          select: { id: true, name: true, startTime: true, endTime: true }
        }
      },
      orderBy: { date: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Fetch calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
};

const createCalendarEvent = async (req, res) => {
  try {
    const { type, date, name, description, shiftPatternId, workCenterId, metadata } = req.body;

    if (!type || !['HOLIDAY', 'MAINTENANCE', 'OVERTIME', 'SHIFT_EXCEPTION'].includes(type)) {
      return res.status(400).json({ error: 'Invalid or missing calendar event type' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Event name/label is required' });
    }

    // Zero-trust ShiftPattern verification
    if (shiftPatternId) {
      const shift = await prisma.shiftPattern.findFirst({
        where: { id: shiftPatternId, tenantId: req.tenantId }
      });
      if (!shift) {
        return res.status(400).json({ error: 'Invalid shift pattern selected' });
      }
    }

    const event = await prisma.productionCalendarEvent.create({
      data: {
        tenantId: req.tenantId,
        type,
        date: new Date(date),
        name: name.trim(),
        description,
        shiftPatternId: shiftPatternId || null,
        workCenterId: workCenterId || null,
        metadata: metadata || {},
        createdBy: req.user.userId
      },
      include: {
        shiftPattern: true
      }
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
};

const updateCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, date, name, description, shiftPatternId, workCenterId, metadata } = req.body;

    const event = await prisma.productionCalendarEvent.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    if (type && !['HOLIDAY', 'MAINTENANCE', 'OVERTIME', 'SHIFT_EXCEPTION'].includes(type)) {
      return res.status(400).json({ error: 'Invalid calendar event type' });
    }

    if (shiftPatternId) {
      const shift = await prisma.shiftPattern.findFirst({
        where: { id: shiftPatternId, tenantId: req.tenantId }
      });
      if (!shift) {
        return res.status(400).json({ error: 'Invalid shift pattern selected' });
      }
    }

    const updated = await prisma.productionCalendarEvent.update({
      where: { id },
      data: {
        type: type !== undefined ? type : event.type,
        date: date !== undefined ? new Date(date) : event.date,
        name: name !== undefined ? name.trim() : event.name,
        description: description !== undefined ? description : event.description,
        shiftPatternId: shiftPatternId !== undefined ? (shiftPatternId || null) : event.shiftPatternId,
        workCenterId: workCenterId !== undefined ? (workCenterId || null) : event.workCenterId,
        metadata: metadata !== undefined ? metadata : event.metadata
      },
      include: {
        shiftPattern: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
};

const deleteCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.productionCalendarEvent.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    await prisma.productionCalendarEvent.delete({
      where: { id }
    });

    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
};

module.exports = {
  getShiftPatterns,
  createShiftPattern,
  updateShiftPattern,
  deleteShiftPattern,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
};
