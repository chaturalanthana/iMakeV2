const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let testAccount;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Tax Group Tenant',
      slug: `test-tax-group-${Date.now()}`
    }
  });

  // Create test role
  const testRole = await prisma.role.create({
    data: {
      tenantId: testTenant.id,
      name: 'Admin'
    }
  });

  // Create test user
  testUser = await prisma.user.create({
    data: {
      tenantId: testTenant.id,
      email: `testtax_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Test',
      lastName: 'User',
      roleId: testRole.id
    }
  });

  // Create test ledger account
  testAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: `TAX-PAY-${Date.now()}`,
      name: 'Sales Tax Payable',
      type: 'LIABILITY'
    }
  });

  // Generate JWT Token
  authToken = jwt.sign(
    { userId: testUser.id, tenantId: testTenant.id, email: testUser.email },
    jwtSecret,
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  // Cleanup test data
  await prisma.taxSlab.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.taxGroup.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.account.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Tax Group API', () => {
  let taxGroupId;

  it('should create a new tax group with compound and additive slabs', async () => {
    const res = await request(app)
      .post('/api/finance/tax-groups')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Sri Lanka Sale Tax',
        description: 'VAT + SSCL + CESS',
        status: 'ACTIVE',
        slabs: [
          { name: 'SSCL', rate: 2.50, calculationType: 'ADDITIVE', calculationOrder: 1, accountId: testAccount.id },
          { name: 'VAT', rate: 18.00, calculationType: 'COMPOUNDED', calculationOrder: 2, accountId: testAccount.id }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Sri Lanka Sale Tax');
    taxGroupId = res.body.id;

    // Verify database entries
    const dbSlabs = await prisma.taxSlab.findMany({
      where: { taxGroupId },
      orderBy: { calculationOrder: 'asc' }
    });
    expect(dbSlabs.length).toBe(2);
    expect(dbSlabs[0].name).toBe('SSCL');
    expect(parseFloat(dbSlabs[0].rate)).toBe(2.5);
    expect(dbSlabs[0].calculationType).toBe('ADDITIVE');
    expect(dbSlabs[1].name).toBe('VAT');
    expect(parseFloat(dbSlabs[1].rate)).toBe(18);
    expect(dbSlabs[1].calculationType).toBe('COMPOUNDED');
  });

  it('should list all tax groups', async () => {
    const res = await request(app)
      .get('/api/finance/tax-groups')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].name).toBe('Sri Lanka Sale Tax');
  });

  it('should fetch a single tax group with slabs and account', async () => {
    const res = await request(app)
      .get(`/api/finance/tax-groups/${taxGroupId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sri Lanka Sale Tax');
    expect(res.body.slabs.length).toBe(2);
    expect(res.body.slabs[0].account.code).toBe(testAccount.code);
  });

  it('should update a tax group and replace slabs', async () => {
    const res = await request(app)
      .put(`/api/finance/tax-groups/${taxGroupId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Sri Lanka Sale Tax - Updated',
        description: 'VAT only',
        status: 'ACTIVE',
        slabs: [
          { name: 'VAT', rate: 15.00, calculationType: 'ADDITIVE', calculationOrder: 1, accountId: testAccount.id }
        ]
      });

    expect(res.status).toBe(200);

    // Verify database changes
    const dbSlabs = await prisma.taxSlab.findMany({
      where: { taxGroupId }
    });
    expect(dbSlabs.length).toBe(1);
    expect(parseFloat(dbSlabs[0].rate)).toBe(15.00);
  });

  it('should delete a tax group and cascade delete slabs', async () => {
    const res = await request(app)
      .delete(`/api/finance/tax-groups/${taxGroupId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    // Verify cleanup
    const tg = await prisma.taxGroup.findUnique({ where: { id: taxGroupId } });
    expect(tg).toBeNull();
    const slabs = await prisma.taxSlab.findMany({ where: { taxGroupId } });
    expect(slabs.length).toBe(0);
  });
});
