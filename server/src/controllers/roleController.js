const prisma = require('../lib/prisma');

const getRoles = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const roles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(roles);
  } catch (error) {
    console.error('getRoles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const role = await prisma.role.findFirst({
      where: { id, tenantId }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(role);
  } catch (error) {
    console.error('getRoleById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createRole = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check existing role name
    const existing = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name } }
    });

    if (existing) {
      return res.status(400).json({ error: 'Role name already exists' });
    }

    const role = await prisma.role.create({
      data: {
        tenantId,
        name,
        description,
        permissions: permissions || {},
        isSystem: false
      }
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('createRole error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateRole = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await prisma.role.findFirst({
      where: { id, tenantId }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(403).json({ error: 'Cannot modify a system role' });
    }

    if (name && name !== role.name) {
      const existing = await prisma.role.findUnique({
        where: { tenantId_name: { tenantId, name } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Role name already exists' });
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: name || role.name,
        description: description !== undefined ? description : role.description,
        permissions: permissions || role.permissions
      }
    });

    res.json(updatedRole);
  } catch (error) {
    console.error('updateRole error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const role = await prisma.role.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { users: true } } }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(403).json({ error: 'Cannot delete a system role' });
    }

    if (role._count.users > 0) {
      return res.status(400).json({ error: 'Cannot delete role assigned to users' });
    }

    await prisma.role.delete({
      where: { id }
    });

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('deleteRole error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole
};
