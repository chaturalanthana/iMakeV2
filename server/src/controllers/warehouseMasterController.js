const prisma = require('../lib/prisma');

const getWarehouses = async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
};

const createWarehouse = async (req, res) => {
  try {
    const { code, name, address } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId: req.tenantId,
        code,
        name,
        address,
        createdBy: req.user?.userId || null
      }
    });
    res.status(201).json(warehouse);
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
};

const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, address } = req.body;

    const warehouse = await prisma.warehouse.update({
      where: { id, tenantId: req.tenantId },
      data: {
        code,
        name,
        address
      }
    });
    res.json(warehouse);
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
};

const deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.warehouse.delete({
      where: { id, tenantId: req.tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
};

module.exports = {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
};
