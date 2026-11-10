const prisma = require('../lib/prisma');

const present = ({ efficiency, capacity, ...workstation }) => workstation;

const getWorkstations = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const workstations = await prisma.workstation.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' }
    });
    res.json(workstations.map(present));
  } catch (error) {
    console.error('Error fetching workstations:', error);
    res.status(500).json({ error: 'Failed to fetch workstations' });
  }
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

const getWorkstationById = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const where = isUuid(id)
    ? { id, tenantId }
    : { tenantId, code: { equals: id, mode: 'insensitive' } };
  try {
    const workstation = await prisma.workstation.findFirst({
      where
    });
    if (!workstation) {
      return res.status(404).json({ error: 'Workstation not found' });
    }
    res.json(present(workstation));
  } catch (error) {
    console.error('Error fetching workstation:', error);
    res.status(500).json({ error: 'Failed to fetch workstation' });
  }
};

const createWorkstation = async (req, res) => {
  const tenantId = req.tenantId;
  const { code, name, description, hourlyRate, status } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Code and Name are required' });
  }

  const rateVal = parseFloat(hourlyRate || 0);

  if (rateVal < 0) {
    return res.status(400).json({ error: 'Hourly rate cannot be negative' });
  }

  try {
    // Unique code validation within tenant scope
    const existing = await prisma.workstation.findFirst({
      where: { tenantId, code }
    });
    if (existing) {
      return res.status(400).json({ error: 'Workstation code already exists' });
    }

    const workstation = await prisma.workstation.create({
      data: {
        tenantId,
        code,
        name,
        description,
        hourlyRate: rateVal,
        status: status || 'ACTIVE',
        createdBy: req.user?.email || 'System'
      }
    });

    res.status(201).json(present(workstation));
  } catch (error) {
    console.error('Error creating workstation:', error);
    res.status(500).json({ error: 'Failed to create workstation' });
  }
};

const updateWorkstation = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { code, name, description, hourlyRate, status } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Code and Name are required' });
  }

  const rateVal = parseFloat(hourlyRate || 0);

  if (rateVal < 0) {
    return res.status(400).json({ error: 'Hourly rate cannot be negative' });
  }

  try {
    const workstation = await prisma.workstation.findFirst({
      where: { id, tenantId }
    });
    if (!workstation) {
      return res.status(404).json({ error: 'Workstation not found' });
    }

    // Unique code validation within tenant scope (excluding current item)
    const existing = await prisma.workstation.findFirst({
      where: { 
        tenantId, 
        code,
        NOT: { id }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Workstation code already exists' });
    }

    const updated = await prisma.workstation.update({
      where: { id },
      data: {
        code,
        name,
        description,
        hourlyRate: rateVal,
        status: status || 'ACTIVE'
      }
    });

    res.json(present(updated));
  } catch (error) {
    console.error('Error updating workstation:', error);
    res.status(500).json({ error: 'Failed to update workstation' });
  }
};

const deleteWorkstation = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const workstation = await prisma.workstation.findFirst({
      where: { id, tenantId }
    });
    if (!workstation) {
      return res.status(404).json({ error: 'Workstation not found' });
    }

    await prisma.workstation.delete({
      where: { id }
    });

    res.json({ message: 'Workstation successfully deleted' });
  } catch (error) {
    console.error('Error deleting workstation:', error);
    res.status(500).json({ error: 'Failed to delete workstation' });
  }
};

module.exports = {
  getWorkstations,
  getWorkstationById,
  createWorkstation,
  updateWorkstation,
  deleteWorkstation
};
