const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let finishedProduct;
let rawComponent;
let testBom;
let testWarehouse;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Advanced Manufacturing Tenant',
      slug: `test-adv-mfg-${Date.now()}`
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
      email: `testmfg_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      roleId: testRole.id
    }
  });

  authToken = jwt.sign(
    { userId: testUser.id, email: testUser.email, tenantId: testTenant.id },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // Create products (Finished product & component product)
  finishedProduct = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'FG-CHAIR-01',
      name: 'Ergonomic Office Chair',
      costPrice: 45.0,
      standardCost: 45.0,
      bomApplicable: true
    }
  });

  rawComponent = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'RM-WHEEL-01',
      name: 'Heavy Duty Caster Wheel',
      costPrice: 5.0,
      standardCost: 5.0,
      bomApplicable: false
    }
  });

  // Create BOM for Finished product containing 5 units of Raw component
  testBom = await prisma.bOM.create({
    data: {
      tenantId: testTenant.id,
      productId: finishedProduct.id,
      code: 'BOM-CHAIR-V1',
      name: 'BOM for Ergonomic Chair',
      version: '1.0',
      status: 'ACTIVE',
      isDefault: true,
      items: {
        create: [
          {
            tenantId: testTenant.id,
            productId: rawComponent.id,
            quantity: 5
          }
        ]
      }
    }
  });

  // Create Warehouse
  testWarehouse = await prisma.warehouse.create({
    data: {
      tenantId: testTenant.id,
      code: 'WH-MAIN-01',
      name: 'Main Assembly Warehouse'
    }
  });

  // Initialize raw component stock to 10 wheels
  await prisma.stockMovement.create({
    data: {
      tenantId: testTenant.id,
      productId: rawComponent.id,
      type: 'GR',
      quantity: 10,
      warehouseId: testWarehouse.id,
      referenceType: 'ADJ',
      referenceId: 'INITIAL-STOCK'
    }
  });
});

afterAll(async () => {
  // Cleanup
  await prisma.stockMovement.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: { tenantId: testTenant.id } } });
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.productionOrder.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.bOMItem.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.bOM.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.warehouse.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
});

describe('Advanced Manufacturing Module Operations', () => {
  let createdOrder;

  test('POST /api/production-orders - Rejects creation with invalid product', async () => {
    const res = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: 'non-existent-id',
        quantity: 10
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Product not found');
  });

  test('POST /api/production-orders - Successfully creates production order', async () => {
    const res = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: finishedProduct.id,
        bomId: testBom.id,
        quantity: 4, // Needs 4 chairs * 5 wheels = 20 wheels. Stock is only 10 -> MRP shortage of 10 wheels!
        status: 'RELEASED',
        startDate: new Date(),
        endDate: new Date(),
        assignedTo: 'Line 01 Supervisor'
      });

    expect(res.status).toBe(201);
    expect(res.body.orderNumber).toBeDefined();
    expect(parseFloat(res.body.quantity)).toBe(4);
    expect(res.body.status).toBe('RELEASED');
    createdOrder = res.body;
  });

  test('POST /api/mrp/plan - Computes shortage and outputs correct suggestions', async () => {
    const res = await request(app)
      .post('/api/mrp/plan')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(200);
    expect(res.body.purchaseSuggestions).toBeDefined();
    expect(res.body.purchaseSuggestions.length).toBe(1);
    
    const wheelShortage = res.body.purchaseSuggestions[0];
    expect(wheelShortage.productId).toBe(rawComponent.id);
    expect(parseFloat(wheelShortage.grossDemand)).toBe(20);
    expect(parseFloat(wheelShortage.currentStock)).toBe(10);
    expect(parseFloat(wheelShortage.shortage)).toBe(10);
  });

  test('POST /api/mrp/convert-purchase - Auto-generates PR from suggestion shortage', async () => {
    const res = await request(app)
      .post('/api/mrp/convert-purchase')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: rawComponent.id,
        quantity: 10
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Successfully created Requisition');
    expect(res.body.pr).toBeDefined();
  });
});
