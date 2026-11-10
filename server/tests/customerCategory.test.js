const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let testARAccount;
let testRevenueAccount;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Customer Category Tenant',
      slug: `test-cust-cat-${Date.now()}`
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
      email: `testcat_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Test',
      lastName: 'User',
      roleId: testRole.id
    }
  });

  // Create accounts for AR and Revenue
  testARAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '1200_test',
      name: 'Test Accounts Receivable',
      type: 'ASSET'
    }
  });

  testRevenueAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '4000_test',
      name: 'Test Sales Revenue',
      type: 'REVENUE'
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
  await prisma.customer.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.customerCategory.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.account.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Customer Category API', () => {
  let categoryId;

  it('should create a new customer category with defaults', async () => {
    const res = await request(app)
      .post('/api/customer-categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CAT-VIP',
        name: 'VIP Customers',
        description: 'VIP group classification',
        accountsReceivableId: testARAccount.id,
        revenueAccountId: testRevenueAccount.id,
        taxGroup: 'VAT-15',
        creditLimit: 50000.0,
        creditPeriod: 45,
        allowCreditSales: true,
        priceList: 'Wholesale List',
        discountGroup: 'VIP Discount Group',
        salesTerritory: 'North Region',
        salesRep: 'Rep Agent 1'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toBe('CAT-VIP');
    expect(res.body.accountsReceivableId).toBe(testARAccount.id);
    expect(res.body.creditPeriod).toBe(45);
    expect(res.body.allowCreditSales).toBe(true);

    categoryId = res.body.id;
  });

  it('should list customer categories', async () => {
    const res = await request(app)
      .get('/api/customer-categories')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].code).toBe('CAT-VIP');
  });

  it('should update customer category values', async () => {
    const res = await request(app)
      .put(`/api/customer-categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        creditLimit: 75000.0,
        creditPeriod: 60
      });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.creditLimit)).toBe(75000.0);
    expect(res.body.creditPeriod).toBe(60);
  });

  it('should create a customer that links to category and inherits/overrides configurations', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-OVERRIDE',
        name: 'Test Inheritance Customer',
        customerCategoryId: categoryId,
        accountsReceivableId: testARAccount.id,
        revenueAccountId: testRevenueAccount.id,
        creditLimit: 100000.0, // Override category limit
        creditPeriod: 60, // Override category credit period
        priceList: 'Custom Override List'
      });

    expect(res.status).toBe(201);
    expect(res.body.customerCategoryId).toBe(categoryId);
    expect(parseFloat(res.body.creditLimit)).toBe(100000.0);
    expect(res.body.priceList).toBe('Custom Override List');
    expect(res.body.customerCategoryRel).toBeDefined();
    expect(res.body.customerCategoryRel.code).toBe('CAT-VIP');
  });
});
