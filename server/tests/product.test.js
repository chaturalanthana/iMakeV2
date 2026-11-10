const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let testCategory;
let testStockUom;
let testPurchaseUom;

beforeAll(async () => {
  // Create a dedicated test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Tenant API',
      slug: `test-tenant-${Date.now()}`
    }
  });

  // Create a test role
  const testRole = await prisma.role.create({
    data: {
      tenantId: testTenant.id,
      name: 'Admin'
    }
  });

  // Create a test user
  testUser = await prisma.user.create({
    data: {
      tenantId: testTenant.id,
      email: `testuser_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Test',
      lastName: 'User',
      roleId: testRole.id
    }
  });

  // Create base UOMs
  testStockUom = await prisma.unitOfMeasure.create({
    data: { tenantId: testTenant.id, name: 'NOS' }
  });
  
  testPurchaseUom = await prisma.unitOfMeasure.create({
    data: { tenantId: testTenant.id, name: 'BOX' }
  });

  // Generate JWT Token
  authToken = jwt.sign(
    { userId: testUser.id, tenantId: testTenant.id, email: testUser.email },
    jwtSecret,
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  // Cleanup test data inside this tenant
  await prisma.product.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.productCategory.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.productBrand.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.unitOfMeasure.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Product API', () => {
  let createdProductId;

  it('should create a new product and relevant category master data', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'TEST-PROD-01',
        name: 'Test Product 1',
        description: 'A product for testing',
        categoryName: 'New Test Category',
        costPrice: 10,
        sellingPrice: 15,
        stockUomId: testStockUom.id,
        purchaseUomId: testStockUom.id,
        conversionFactor: 1.0
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toBe('TEST-PROD-01');
    expect(res.body.category).toBeDefined();
    expect(res.body.category.name).toBe('New Test Category');

    createdProductId = res.body.id;
    testCategory = res.body.category;
  });

  it('should update the product', async () => {
    const res = await request(app)
      .put(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Product 1 Updated',
        sellingPrice: 20
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Product 1 Updated');
    expect(parseFloat(res.body.sellingPrice)).toBe(20);
  });

  it('should reject wrong UOM conversion (zero or negative)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'TEST-PROD-02',
        name: 'Test Product 2',
        categoryId: testCategory.id,
        stockUomId: testStockUom.id,
        purchaseUomId: testPurchaseUom.id,
        conversionFactor: -5 // Invalid
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/greater than zero/);
  });

  it('should reject wrong UOM conversion (factor not 1 for same UOMs)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'TEST-PROD-03',
        name: 'Test Product 3',
        categoryId: testCategory.id,
        stockUomId: testStockUom.id,
        purchaseUomId: testStockUom.id, // Same UOM
        conversionFactor: 2.0 // Should be 1.0
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be 1/);
  });

  it('should create product with valid array of perfectly matched UOM conversions', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'TEST-PROD-04',
        name: 'Test Product 4',
        categoryId: testCategory.id,
        stockUomId: testStockUom.id,
        purchaseUomId: testPurchaseUom.id,
        conversionFactor: 10,
        uomConversions: [
          { fromUomId: testPurchaseUom.id, toUomId: testStockUom.id, factor: 10 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('TEST-PROD-04');
    expect(res.body.uomConversions).toBeDefined();
    expect(res.body.uomConversions.length).toBe(1);
    expect(res.body.uomConversions[0].factor).toBe(10);
  });

  it('should reject product with invalid UOM conversions array (negative factor)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'TEST-PROD-05',
        name: 'Test Product 5',
        categoryId: testCategory.id,
        stockUomId: testStockUom.id,
        uomConversions: [
          { fromUomId: testPurchaseUom.id, toUomId: testStockUom.id, factor: -2 }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/perfectly matched/);
  });

  it('should delete the product', async () => {
    const res = await request(app)
      .delete(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    // Verify it's deleted
    const getRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${authToken}`);
    
    const productExists = getRes.body.find(p => p.id === createdProductId);
    expect(productExists).toBeUndefined();
  });
});
