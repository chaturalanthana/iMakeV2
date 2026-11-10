const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { hasFullAccess, allows } = require('../src/permissions/catalog');

const sign = (user, tenantId) => jwt.sign(
  { userId: user.id, tenantId, email: user.email },
  jwtSecret,
  { expiresIn: '1h' }
);

describe('permission catalog', () => {
  test('an unconfigured Admin role keeps full access', () => {
    expect(hasFullAccess({ name: 'Admin', permissions: {}, isSystem: false })).toBe(true);
    expect(hasFullAccess({ name: 'Super Admin', permissions: { all: true }, isSystem: true })).toBe(true);
  });

  test('explicit module grants are enforced', () => {
    const permissions = { sales: ['read'] };
    expect(allows(permissions, 'sales', 'read')).toBe(true);
    expect(allows(permissions, 'sales', 'write')).toBe(false);
    expect(allows(permissions, 'products', 'read')).toBe(false);
    expect(hasFullAccess({ name: 'Admin', permissions })).toBe(false);
  });
});

describe('API permission layer', () => {
  let tenant;
  let salesToken;
  let adminToken;
  let inactiveToken;
  let noRoleToken;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Permission Tenant', slug: `perm-${Date.now()}` }
    });

    const salesRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Clerk',
        permissions: { sales: ['read'] }
      }
    });
    const adminRole = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: {} }
    });
    const makeUser = (email, roleId, status = 'ACTIVE') => prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash: 'x',
        roleId,
        status
      }
    });

    const salesUser = await makeUser(`sales-${Date.now()}@test.com`, salesRole.id);
    const adminUser = await makeUser(`admin-${Date.now()}@test.com`, adminRole.id);
    const inactiveUser = await makeUser(`inactive-${Date.now()}@test.com`, adminRole.id, 'INACTIVE');
    const plainUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `norole-${Date.now()}@test.com`,
        passwordHash: 'x'
      }
    });

    salesToken = sign(salesUser, tenant.id);
    adminToken = sign(adminUser, tenant.id);
    inactiveToken = sign(inactiveUser, tenant.id);
    noRoleToken = sign(plainUser, tenant.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.role.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  test('sales read can list quotations and cannot write or open products', async () => {
    const read = await request(app)
      .get('/api/sales/quotations')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(read.status).toBe(200);

    const write = await request(app)
      .post('/api/sales/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ customerId: 'x', date: '2026-01-01', items: [{ productId: 'x' }] });
    expect(write.status).toBe(403);

    const products = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(products.status).toBe(403);
  });

  test('admin role still reaches protected routes', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('missing, inactive, and unassigned users are rejected', async () => {
    const missing = await request(app).get('/api/products');
    expect(missing.status).toBe(401);

    const inactive = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${inactiveToken}`);
    expect(inactive.status).toBe(403);

    const noRole = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${noRoleToken}`);
    expect(noRole.status).toBe(403);
  });

  test('registration seeds module roles and the admin can read them', async () => {
    const email = `owner-${Date.now()}@test.com`;
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'secret-pass',
      tenantName: `Tenant ${Date.now()}`
    });
    expect(res.status).toBe(201);
    const roles = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(roles.status).toBe(200);
    const names = roles.body.map((role) => role.name);
    expect(names).toEqual(expect.arrayContaining(['Super Admin', 'Sales', 'Warehouse', 'Production']));

    const catalog = await request(app)
      .get('/api/roles/catalog')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.modules.map((module) => module.id)).toContain('production');

    await prisma.user.deleteMany({ where: { email } });
    await prisma.tenant.deleteMany({ where: { slug: res.body.tenant.slug } });
  });
});
