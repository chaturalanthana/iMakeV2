const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let testProduct1;
let testProduct2;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Discount Group Tenant',
      slug: `test-discount-group-${Date.now()}`
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
      email: `testdg_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Test',
      lastName: 'User',
      roleId: testRole.id
    }
  });

  // Create active sellable products
  testProduct1 = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: `PROD-C-${Date.now()}`,
      name: 'Test Product C',
      sellingPrice: 150.0,
      activeStatus: 'ACTIVE'
    }
  });

  testProduct2 = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: `PROD-D-${Date.now()}`,
      name: 'Test Product D',
      sellingPrice: 250.0,
      activeStatus: 'ACTIVE'
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
  await prisma.discountGroupProduct.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.discountGroup.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Discount Group API', () => {
  let discountGroupId;

  it('should create a new discount group with custom product discounts', async () => {
    const res = await request(app)
      .post('/api/discount-groups')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'VIP Discounts',
        status: 'ACTIVE',
        discounts: [
          { productId: testProduct1.id, discountType: 'PERCENTAGE', discountValue: 15.00 },
          { productId: testProduct2.id, discountType: 'AMOUNT', discountValue: 25.00 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('VIP Discounts');
    discountGroupId = res.body.id;

    // Verify database entries
    const dbDiscounts = await prisma.discountGroupProduct.findMany({
      where: { discountGroupId }
    });
    expect(dbDiscounts.length).toBe(2);
    const discountMap = new Map(dbDiscounts.map(d => [d.productId, { type: d.discountType, value: d.discountValue.toString() }]));
    expect(discountMap.get(testProduct1.id).type).toBe('PERCENTAGE');
    expect(parseFloat(discountMap.get(testProduct1.id).value)).toBe(15.00);
    expect(discountMap.get(testProduct2.id).type).toBe('AMOUNT');
    expect(parseFloat(discountMap.get(testProduct2.id).value)).toBe(25.00);
  });

  it('should list all discount groups', async () => {
    const res = await request(app)
      .get('/api/discount-groups')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].name).toBe('VIP Discounts');
  });

  it('should fetch a single discount group with mapped product discounts', async () => {
    const res = await request(app)
      .get(`/api/discount-groups/${discountGroupId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('VIP Discounts');
    expect(res.body.products.length).toBe(2);
    
    const productC = res.body.products.find(p => p.productId === testProduct1.id);
    expect(productC).toBeDefined();
    expect(productC.discountType).toBe('PERCENTAGE');
    expect(parseFloat(productC.discountValue)).toBe(15.00);
  });

  it('should update a discount group and modify discount mappings', async () => {
    const res = await request(app)
      .put(`/api/discount-groups/${discountGroupId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'VIP Discounts - Updated',
        status: 'ACTIVE',
        discounts: [
          { productId: testProduct1.id, discountType: 'PERCENTAGE', discountValue: 20.00 } // Price changed
        ]
      });

    expect(res.status).toBe(200);

    // Verify database changes
    const dbDiscounts = await prisma.discountGroupProduct.findMany({
      where: { discountGroupId }
    });
    expect(dbDiscounts.length).toBe(1);
    expect(parseFloat(dbDiscounts[0].discountValue)).toBe(20.00);
  });

  it('should delete a discount group and cascade delete mapped discounts', async () => {
    const res = await request(app)
      .delete(`/api/discount-groups/${discountGroupId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    // Verify cleanup
    const dg = await prisma.discountGroup.findUnique({ where: { id: discountGroupId } });
    expect(dg).toBeNull();
    const discounts = await prisma.discountGroupProduct.findMany({ where: { discountGroupId } });
    expect(discounts.length).toBe(0);
  });
});
