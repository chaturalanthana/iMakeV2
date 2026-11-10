const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let rawMaterialProduct;
let semiFGProduct;
let finishedGoodProduct;
let standardProduct;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test BOM Validations Tenant',
      slug: `test-bom-val-${Date.now()}`
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
      email: `testbom_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      roleId: testRole.id
    }
  });

  authToken = jwt.sign(
    { userId: testUser.id, email: testUser.email, tenantId: testTenant.id },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // Create products
  rawMaterialProduct = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'RAW-001',
      name: 'Copper Pipe',
      standardCost: 15.0,
      bomApplicable: false
    }
  });

  semiFGProduct = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'SFG-001',
      name: 'Coil Core Assembly',
      standardCost: 50.0,
      bomApplicable: true
    }
  });

  finishedGoodProduct = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'FG-001',
      name: 'AC Evaporator Unit',
      standardCost: 150.0,
      bomApplicable: true
    }
  });

  standardProduct = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'STD-999',
      name: 'Standard Retail Box',
      standardCost: 5.0,
      bomApplicable: false
    }
  });
});

afterAll(async () => {
  // Cleanup
  await prisma.bOMItem.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.bOM.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
});

describe('BOM Registry Operations & Multi-level Tree Checks', () => {
  let sfgBOMId;
  let fgBOMId;

  test('POST /api/boms - Rejects creating BOM for product that does not have bomApplicable=true', async () => {
    const res = await request(app)
      .post('/api/boms')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: standardProduct.id,
        code: 'BOM-STD-999',
        name: 'Standard BOM',
        items: [{ productId: rawMaterialProduct.id, quantity: 1 }]
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not configured as BOM applicable');
  });

  test('POST /api/boms - Successfully creates a BOM for a Semi-FG product', async () => {
    const res = await request(app)
      .post('/api/boms')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: semiFGProduct.id,
        code: 'BOM-SFG-V1',
        name: 'Coil Core BOM v1',
        version: '1.0',
        status: 'ACTIVE',
        isDefault: true,
        items: [
          { productId: rawMaterialProduct.id, quantity: 3, scrapPercent: 5, instruction: 'Bend tube' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('BOM-SFG-V1');
    expect(res.body.items).toHaveLength(1);
    sfgBOMId = res.body.id;
  });

  test('POST /api/boms - Rejects creating duplicate code or version BOM', async () => {
    // Duplicate version
    const res1 = await request(app)
      .post('/api/boms')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: semiFGProduct.id,
        code: 'BOM-SFG-V1-DIFF',
        name: 'Coil Core BOM v1.1',
        version: '1.0',
        items: [{ productId: rawMaterialProduct.id, quantity: 2 }]
      });

    expect(res1.status).toBe(400);
    expect(res1.body.error).toContain('version "1.0" already exists');
  });

  test('POST /api/boms - Successfully creates a BOM for a Finished Good using the Semi-FG', async () => {
    const res = await request(app)
      .post('/api/boms')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: finishedGoodProduct.id,
        code: 'BOM-FG-V1',
        name: 'AC Evaporator BOM v1',
        version: '1.0',
        status: 'ACTIVE',
        isDefault: true,
        items: [
          { productId: semiFGProduct.id, quantity: 2, scrapPercent: 0, instruction: 'Assemble core' },
          { productId: standardProduct.id, quantity: 1, scrapPercent: 2, instruction: 'Pack unit' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('BOM-FG-V1');
    expect(res.body.items).toHaveLength(2);
    fgBOMId = res.body.id;
  });

  test('GET /api/boms/tree/:productId - Resolves multi-level hierarchy & calculates rolled up costs', async () => {
    const res = await request(app)
      .get(`/api/boms/tree/${finishedGoodProduct.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(200);
    
    const tree = res.body;
    expect(tree.productId).toBe(finishedGoodProduct.id);
    expect(tree.children).toHaveLength(2);

    // Find the Coil Core Assembly child node (Semi-FG)
    const coilCoreNode = tree.children.find(c => c.productId === semiFGProduct.id);
    expect(coilCoreNode).toBeDefined();
    expect(coilCoreNode.quantity).toBe(2); // Should be 2 units needed
    expect(coilCoreNode.children).toHaveLength(1); // Should have Copper Pipe nested

    // Copper Pipe child should have its quantity scaled by parent qty (3 * 2 = 6)
    const copperPipeNode = coilCoreNode.children[0];
    expect(copperPipeNode.productId).toBe(rawMaterialProduct.id);
    expect(copperPipeNode.quantity).toBe(6);

    // Total rolled up cost calculation check:
    // Raw material cost = 15.0. 15.0 * 3 = 45.0 for 1 Coil Core.
    // Finished good uses 2 Coil Cores (45.0 * 2 = 90.0) + 1 Standard Box (5.0 * 1 = 5.0).
    // Total rolled up cost = 95.0.
    expect(tree.totalCost).toBe(95.0);
  });

  test('POST /api/boms/:id/activate - Correctly updates default status versions', async () => {
    // Create version 2 (Draft)
    const resDraft = await request(app)
      .post('/api/boms')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: finishedGoodProduct.id,
        code: 'BOM-FG-V2',
        name: 'AC Evaporator BOM v2',
        version: '2.0',
        status: 'DRAFT',
        isDefault: false,
        items: [
          { productId: semiFGProduct.id, quantity: 1.5, scrapPercent: 0, instruction: 'Assemble core v2' }
        ]
      });
    expect(resDraft.status).toBe(201);
    const v2BOMId = resDraft.body.id;

    // Activate v2
    const resActivate = await request(app)
      .post(`/api/boms/${v2BOMId}/activate`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(resActivate.status).toBe(200);

    // Verify v1 is now status=SUPERSEDED and isDefault=false
    const getV1 = await request(app)
      .get(`/api/boms/${fgBOMId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);
    expect(getV1.body.status).toBe('SUPERSEDED');
    expect(getV1.body.isDefault).toBe(false);

    // Verify v2 is default and ACTIVE
    const getV2 = await request(app)
      .get(`/api/boms/${v2BOMId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);
    expect(getV2.body.status).toBe('ACTIVE');
    expect(getV2.body.isDefault).toBe(true);
  });

  test('DELETE /api/boms/:id - Rejects deleting active default BOMs, accepts deleting Draft', async () => {
    // Try delete active default
    const resDeleteActive = await request(app)
      .delete(`/api/boms/${fgBOMId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);
    expect(resDeleteActive.status).toBe(400);

    // Create a new draft
    const resDraft = await request(app)
      .post('/api/boms')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: finishedGoodProduct.id,
        code: 'BOM-FG-TEMP',
        name: 'AC Evaporator Temp',
        version: '99.0',
        status: 'DRAFT',
        items: []
      });
    expect(resDraft.status).toBe(201);
    const tempBOMId = resDraft.body.id;

    // Delete draft
    const resDeleteDraft = await request(app)
      .delete(`/api/boms/${tempBOMId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);
    expect(resDeleteDraft.status).toBe(200);
  });
});
