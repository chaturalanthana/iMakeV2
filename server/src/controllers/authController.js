const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { jwtSecret } = require('../config');
const { seedTenantRoles } = require('../permissions/catalog');
const { seedTenantFinance } = require('../services/glService');

// Resolves email to tenant during authentication
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token containing tenantId for strict data isolation
    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role ? {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
        isSystem: user.role.isSystem
      } : null
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions,
          isSystem: user.role.isSystem
        } : null,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { email, password, tenantName, address, currency } = req.body;

    if (!email || !password || !tenantName) {
      return res.status(400).json({ error: 'Email, password, and tenantName are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Tenant and User transactionally
    const data = await prisma.$transaction(async (tx) => {
      // Allow overriding default currency if provided
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
          address: address || null,
          currency: currency || 'LKR'
        }
      });

      await seedTenantRoles(tx, tenant.id);
      await seedTenantFinance(tx, tenant.id, currency || 'LKR');
      const role = await tx.role.findUnique({
        where: { tenantId_name: { tenantId: tenant.id, name: 'Super Admin' } }
      });

      // Seed default product types for the new tenant
      const defaultProductTypes = [
        { name: 'Service Material', description: 'Service material or non-inventory service items' },
        { name: 'Raw Material', description: 'Raw materials used in production' },
        { name: 'Product ( Finish Good ) Material', description: 'Finished goods ready for sale' },
        { name: 'Semi-Finishgood Material', description: 'Semi-finished goods or sub-assemblies' }
      ];

      await Promise.all(
        defaultProductTypes.map(pt =>
          tx.productType.create({
            data: {
              tenantId: tenant.id,
              name: pt.name,
              description: pt.description
            }
          })
        )
      );

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: 'Super',
          lastName: 'Admin',
          roleId: role.id,
          tenantId: tenant.id
        }
      });

      return { tenant, user, role };
    });
    
    // Automatically login user safely inside transaction scope
    const payload = {
      userId: data.user.id,
      tenantId: data.user.tenantId,
      role: {
        id: data.role.id,
        name: data.role.name,
        permissions: data.role.permissions,
        isSystem: data.role.isSystem
      }
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1d' });

    res.status(201).json({
      message: 'Tenant and user created successfully',
      token,
      tenant: data.tenant,
      user: { id: data.user.id, email: data.user.email, firstName: data.user.firstName, lastName: data.user.lastName }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { tenant: true, role: true }
    });
    if (!user) return res.status(404).json({ error: 'User no longer exists' });
    
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role ? {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
        isSystem: user.role.isSystem
      } : null,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug
      }
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  register,
  me
};
