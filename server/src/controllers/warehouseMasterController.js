const prisma = require('../lib/prisma');
const { assertWarehouseType } = require('../services/inventory/locations');
const { sendError } = require('../services/errors');

function warehouseData(body, userId) {
  assertWarehouseType(body.warehouseType);
  const data = {
    code: body.code,
    name: body.name,
    address: body.address
  };
  if (body.branchId !== undefined) data.branchId = body.branchId || null;
  if (body.warehouseType) data.warehouseType = body.warehouseType;
  if (body.isVirtual !== undefined) data.isVirtual = body.isVirtual === true || body.isVirtual === 'true';
  if (body.tracksPallets !== undefined) data.tracksPallets = body.tracksPallets === true || body.tracksPallets === 'true';
  if (userId) data.createdBy = userId;
  return data;
}

const getWarehouses = async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: req.tenantId },
      include: { branch: true, bins: true },
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
    const { code, name } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId: req.tenantId,
        ...warehouseData(req.body, req.user?.userId || null)
      }
    });
    res.status(201).json(warehouse);
  } catch (error) {
    return sendError(res, error, 'Failed to create warehouse');
  }
};

const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;

    const warehouse = await prisma.warehouse.update({
      where: { id, tenantId: req.tenantId },
      data: warehouseData(req.body)
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
