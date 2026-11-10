const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');

const getUsers = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        role: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Remove passwordHash from response
    const sanitizedUsers = users.map(user => {
      const { passwordHash, ...rest } = user;
      return rest;
    });

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        role: {
          select: { id: true, name: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...rest } = user;
    res.json(rest);
  } catch (error) {
    console.error('getUserById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { email, password, firstName, lastName, roleId, status } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists globally (emails must be unique across system in this schema)
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    // Verify role belongs to tenant
    if (roleId) {
      const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId }
      });
      if (!role) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        roleId,
        status: status || 'ACTIVE',
        createdBy: req.user.userId
      }
    });

    const { passwordHash: ph, ...rest } = user;
    res.status(201).json(rest);
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { firstName, lastName, roleId, status, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { id, tenantId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect super admin user from status change or role removal (basic protection)
    const isEditingSelf = req.user.userId === id;
    if (isEditingSelf && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    if (roleId && roleId !== user.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId }
      });
      if (!role) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
    }

    const updateData = {
      firstName: firstName !== undefined ? firstName : user.firstName,
      lastName: lastName !== undefined ? lastName : user.lastName,
      roleId: roleId !== undefined ? roleId : user.roleId,
      status: status !== undefined ? status : user.status,
    };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    const { passwordHash: ph, ...rest } = updatedUser;
    res.json(rest);
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser
};
