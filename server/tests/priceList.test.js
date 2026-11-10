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
      name: 'Test Price List Tenant',
      slug: `test-price-list-${Date.now()}`
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
      email: `testpl_${Date.now()}@test.com`,
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
      code: `PROD-A-${Date.now()}`,
      name: 'Test Product A',
      sellingPrice: 100.0,
      activeStatus: 'ACTIVE'
    }
  });

  testProduct2 = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: `PROD-B-${Date.now()}`,
      name: 'Test Product B',
      sellingPrice: 200.0,
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
  await prisma.priceListPrice.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.priceList.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Price List API', () => {
  let priceListId;

  it('should create a new price list with custom product prices', async () => {
    const res = await request(app)
      .post('/api/price-lists')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Standard Wholesale',
        currency: 'USD',
        isSelling: true,
        isBuying: false,
        status: 'ACTIVE',
        prices: [
          { productId: testProduct1.id, customPrice: 85.50 },
          { productId: testProduct2.id, customPrice: 180.00 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Standard Wholesale');
    priceListId = res.body.id;

    // Verify database entries
    const dbPrices = await prisma.priceListPrice.findMany({
      where: { priceListId }
    });
    expect(dbPrices.length).toBe(2);
    const priceMap = new Map(dbPrices.map(p => [p.productId, p.price.toString()]));
    expect(parseFloat(priceMap.get(testProduct1.id))).toBe(85.50);
    expect(parseFloat(priceMap.get(testProduct2.id))).toBe(180.00);
  });

  it('should list all price lists', async () => {
    const res = await request(app)
      .get('/api/price-lists')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].name).toBe('Standard Wholesale');
  });

  it('should fetch a single price list with mapped product prices', async () => {
    const res = await request(app)
      .get(`/api/price-lists/${priceListId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Standard Wholesale');
    expect(res.body.products.length).toBe(2);
    
    const productA = res.body.products.find(p => p.productId === testProduct1.id);
    expect(productA).toBeDefined();
    expect(parseFloat(productA.customPrice)).toBe(85.50);
    expect(parseFloat(productA.standardPrice)).toBe(100.00);
  });

  it('should update a price list and modify pricing entries', async () => {
    const res = await request(app)
      .put(`/api/price-lists/${priceListId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Standard Wholesale - Updated',
        currency: 'USD',
        isSelling: true,
        isBuying: false,
        status: 'ACTIVE',
        prices: [
          { productId: testProduct1.id, customPrice: 90.00 }, // Changed price
          // testProduct2 price removed (should be deleted)
        ]
      });

    expect(res.status).toBe(200);

    // Verify database changes
    const dbPrices = await prisma.priceListPrice.findMany({
      where: { priceListId }
    });
    expect(dbPrices.length).toBe(1);
    expect(parseFloat(dbPrices[0].price)).toBe(90.00);
  });

  it('should delete a price list and cascade delete prices', async () => {
    const res = await request(app)
      .delete(`/api/price-lists/${priceListId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    // Verify cleanup
    const pl = await prisma.priceList.findUnique({ where: { id: priceListId } });
    expect(pl).toBeNull();
    const prices = await prisma.priceListPrice.findMany({ where: { priceListId } });
    expect(prices.length).toBe(0);
  });
});
