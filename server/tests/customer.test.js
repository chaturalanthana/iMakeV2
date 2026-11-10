const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let validARAccount;
let validRevenueAccount;
let parentARAccount;
let invalidTypeAccount;
let testPriceList;
let testDiscountGroup;
let testTaxGroup;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Customer Validations Tenant',
      slug: `test-cust-val-${Date.now()}`
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
      email: `testcust_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Test',
      lastName: 'User',
      roleId: testRole.id
    }
  });

  // Create valid Leaf AR Account (Asset)
  validARAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '1200_valid_ar',
      name: 'Valid Accounts Receivable',
      type: 'ASSET'
    }
  });

  // Create valid Leaf Revenue Account (Revenue)
  validRevenueAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '4000_valid_rev',
      name: 'Valid Sales Revenue',
      type: 'REVENUE'
    }
  });

  // Create parent AR Account (not a leaf account since we will add a child under it)
  parentARAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '1200_parent_ar',
      name: 'Parent Accounts Receivable',
      type: 'ASSET'
    }
  });

  // Create child account under parent AR Account
  await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      parentId: parentARAccount.id,
      code: '1200_child_ar',
      name: 'Child Accounts Receivable',
      type: 'ASSET'
    }
  });

  // Create an account with invalid type (e.g. LIABILITY instead of ASSET for AR)
  invalidTypeAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '2000_invalid_type',
      name: 'Invalid Type Account',
      type: 'LIABILITY'
    }
  });

  // Create registries: Price List, Discount Group, Tax Group
  testPriceList = await prisma.priceList.create({
    data: {
      tenantId: testTenant.id,
      name: 'Test Price List',
      status: 'ACTIVE',
      createdBy: testUser.id
    }
  });

  testDiscountGroup = await prisma.discountGroup.create({
    data: {
      tenantId: testTenant.id,
      name: 'Test Discount Group',
      status: 'ACTIVE',
      createdBy: testUser.id
    }
  });

  testTaxGroup = await prisma.taxGroup.create({
    data: {
      tenantId: testTenant.id,
      name: 'Test Tax Group',
      status: 'ACTIVE',
      createdBy: testUser.id
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
  await prisma.priceList.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.discountGroup.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.taxGroup.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.account.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Customer Creation and Validation API', () => {
  it('should create a valid customer with price list, discount group, tax group, and valid accounts', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-VALID-01',
        name: 'John Doe Enterprise',
        email: 'john@doe.com',
        phone: '1234567890',
        accountsReceivableId: validARAccount.id,
        revenueAccountId: validRevenueAccount.id,
        priceList: testPriceList.name,
        discountGroup: testDiscountGroup.name,
        taxGroup: testTaxGroup.name,
        creditCustomer: true,
        creditLimit: 50000,
        creditPeriod: 30
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toBe('CUS-VALID-01');
    expect(res.body.name).toBe('John Doe Enterprise');
    expect(res.body.priceList).toBe(testPriceList.name);
    expect(res.body.discountGroup).toBe(testDiscountGroup.name);
    expect(res.body.taxGroup).toBe(testTaxGroup.name);
    expect(res.body.accountsReceivableId).toBe(validARAccount.id);
    expect(res.body.revenueAccountId).toBe(validRevenueAccount.id);
    expect(res.body.creditCustomer).toBe(true);
    expect(parseFloat(res.body.creditLimit)).toBe(50000.00);
    expect(res.body.creditPeriod).toBe(30);
  });

  it('should fail to create a customer if name is missing', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-INVALID-NAME',
        accountsReceivableId: validARAccount.id,
        revenueAccountId: validRevenueAccount.id
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Customer name is required.');
  });

  it('should fail to create a customer with a duplicate code', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-VALID-01', // Already exists from first test
        name: 'Another Acme Store'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Customer code already exists.');
  });

  it('should fail to set credit limit/period when credit sales (allow credit sales) are disabled', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-NOCREDIT-ERR',
        name: 'No Credit Customer',
        creditCustomer: false,
        creditLimit: 1000,
        creditPeriod: 15
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Credit limit and credit period are only allowed when credit sales are enabled.');
  });

  it('should fail if the accounts receivable account does not exist', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-INVALID-AR-1',
        name: 'Invalid AR Account Customer',
        accountsReceivableId: '00000000-0000-0000-0000-000000000000'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Accounts Receivable account not found.');
  });

  it('should fail if the accounts receivable account is not an ASSET', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-INVALID-AR-2',
        name: 'Invalid AR Type Customer',
        accountsReceivableId: invalidTypeAccount.id
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Accounts Receivable account must be an ASSET.');
  });

  it('should fail if the accounts receivable account is a parent (non-leaf) account', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-INVALID-AR-3',
        name: 'Non-leaf AR Account Customer',
        accountsReceivableId: parentARAccount.id
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Accounts Receivable account must be a leaf account.');
  });

  it('should fail if the revenue account is not a REVENUE type account', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'CUS-INVALID-REV-1',
        name: 'Invalid Revenue Type Customer',
        revenueAccountId: invalidTypeAccount.id
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Revenue account must be a REVENUE account.');
  });
});
