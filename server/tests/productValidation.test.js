const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let testStockUom;

beforeAll(async () => {
  // Create a dedicated test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Tenant Validation API',
      slug: `test-tenant-val-${Date.now()}`
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
      email: `valuser_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Validation',
      lastName: 'User',
      roleId: testRole.id
    }
  });

  // Create a base UOM
  testStockUom = await prisma.unitOfMeasure.create({
    data: { tenantId: testTenant.id, name: 'NOS' }
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
  await prisma.unitOfMeasure.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
  
  await prisma.$disconnect();
});

describe('Product Validation and Edge Case API', () => {

  describe('Duplicate Product Code', () => {
    it('should reject creating a product with an already existing code', async () => {
      // Create first product
      const res1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'DUP-CODE-01',
          name: 'First Product',
          stockUomId: testStockUom.id
        });
      expect(res1.status).toBe(201);

      // Attempt to create second product with same code
      const res2 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'DUP-CODE-01',
          name: 'Second Product',
          stockUomId: testStockUom.id
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/already exists/i);
    });

    it('should reject updating a product to a code already in use by another product', async () => {
      // Create another product
      const res1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'DUP-CODE-02',
          name: 'Third Product',
          stockUomId: testStockUom.id
        });
      expect(res1.status).toBe(201);
      const thirdProductId = res1.body.id;

      // Update third product to use 'DUP-CODE-01' (which is already in use)
      const res2 = await request(app)
        .put(`/api/products/${thirdProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'DUP-CODE-01'
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/already exists/i);
    });
  });

  describe('Wrong / Missing Parameters', () => {
    it('should reject creation if code is missing or empty', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'No Code Product',
          stockUomId: testStockUom.id
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/code is required/i);
    });

    it('should reject creation if name is missing or empty', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NO-NAME-PROD',
          stockUomId: testStockUom.id
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name is required/i);
    });

    it('should reject creation if product type is invalid', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'INVALID-TYPE-PROD',
          name: 'Invalid Type Product',
          type: 'DIGITAL_ITEM' // Only PRODUCT or SERVICE allowed
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/type/i);
    });

    it('should reject creation if costing method is invalid', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'INVALID-COST-PROD',
          name: 'Invalid Costing Product',
          costingMethod: 'AVERAGE_WEIGHTED' // Invalid
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/costing method/i);
    });

    it('should reject creation if active status is invalid', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'INVALID-STATUS-PROD',
          name: 'Invalid Status Product',
          activeStatus: 'SUSPENDED' // Only ACTIVE or INACTIVE
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/active status/i);
    });

    it('should reject creation if category ID does not exist', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'BAD-CAT-PROD',
          name: 'Bad Category Product',
          categoryId: '00000000-0000-0000-0000-000000000000'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid category/i);
    });
  });

  describe('Unrealistic Data Entries', () => {
    it('should reject negative cost price', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NEG-COST-PROD',
          name: 'Negative Cost Product',
          costPrice: -10.50
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cost price cannot be negative/i);
    });

    it('should reject negative selling price', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NEG-SELL-PROD',
          name: 'Negative Sell Product',
          sellingPrice: -15.00
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/selling price cannot be negative/i);
    });

    it('should reject negative standard cost', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NEG-STD-PROD',
          name: 'Negative Standard Cost Product',
          standardCost: -5.00
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/standard cost cannot be negative/i);
    });

    it('should reject scrap percentage outside 0-100 range', async () => {
      const res1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'BAD-SCRAP-PROD-1',
          name: 'Bad Scrap Product 1',
          scrapPercent: -1.5
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/scrap percentage must be between 0 and 100/i);

      const res2 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'BAD-SCRAP-PROD-2',
          name: 'Bad Scrap Product 2',
          scrapPercent: 100.5
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/scrap percentage must be between 0 and 100/i);
    });

    it('should reject negative reorder levels and negative safety stock levels', async () => {
      const res1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NEG-REORDER-PROD',
          name: 'Negative Reorder Product',
          reorderLevel: -5
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/reorder level cannot be negative/i);

      const res2 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NEG-SAFETY-PROD',
          name: 'Negative Safety Product',
          safetyStock: -2
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/safety stock cannot be negative/i);
    });
  });

  describe('Product Duplication', () => {
    let sourceProductId;

    beforeAll(async () => {
      // Create a base product to duplicate
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'SRC-PROD-99',
          name: 'Source Product 99',
          description: 'Original description',
          costPrice: 50.00,
          sellingPrice: 75.00,
          stockUomId: testStockUom.id
        });
      expect(res.status).toBe(201);
      sourceProductId = res.body.id;
    });

    it('should successfully duplicate a product with a new code', async () => {
      const res = await request(app)
        .post(`/api/products/${sourceProductId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newCode: 'DUP-PROD-99'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.code).toBe('DUP-PROD-99');
      expect(res.body.name).toBe('Source Product 99 (Copy)');
      expect(res.body.description).toBe('Original description');
      expect(parseFloat(res.body.costPrice)).toBe(50.00);
      expect(parseFloat(res.body.sellingPrice)).toBe(75.00);
      expect(res.body.stockUomId).toBe(testStockUom.id);
    });

    it('should reject duplication if newCode is missing', async () => {
      const res = await request(app)
        .post(`/api/products/${sourceProductId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/new product code is required/i);
    });

    it('should reject duplication if newCode is already in use', async () => {
      const res = await request(app)
        .post(`/api/products/${sourceProductId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newCode: 'SRC-PROD-99' // original code
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('should return 404 if source product to duplicate does not exist', async () => {
      const res = await request(app)
        .post('/api/products/00000000-0000-0000-0000-000000000000/duplicate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newCode: 'SOME-NEW-CODE'
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/source product.*not found/i);
    });
  });
});
