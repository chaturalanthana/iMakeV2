const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let testProduct;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Production Planning Tenant',
      slug: `test-prod-plan-${Date.now()}`
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
      email: `testplanner_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      roleId: testRole.id
    }
  });

  authToken = jwt.sign(
    { userId: testUser.id, email: testUser.email, tenantId: testTenant.id },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // Create product
  testProduct = await prisma.product.create({
    data: {
      tenantId: testTenant.id,
      code: 'FG-AC-10',
      name: 'AC Unit Core assembly',
      standardCost: 120.0,
      bomApplicable: true
    }
  });
});

afterAll(async () => {
  // Cleanup
  await prisma.productionJob.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
});

describe('Production Job Cards & Planning board Operations', () => {
  let createdJob;

  test('POST /api/production-jobs - Rejects job creation with invalid/negative quantity', async () => {
    const res = await request(app)
      .post('/api/production-jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: testProduct.id,
        quantity: -10
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('greater than zero');
  });

  test('POST /api/production-jobs - Successfully creates a production job and auto-generates number', async () => {
    const res = await request(app)
      .post('/api/production-jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        productId: testProduct.id,
        quantity: 50,
        priority: 'HIGH',
        status: 'QUEUED',
        assignedTo: 'Assembly Team A',
        notes: 'Planners schedule job'
      });

    expect(res.status).toBe(201);
    expect(res.body.jobNumber).toBeDefined();
    expect(res.body.jobNumber).toContain('JOB-');
    expect(res.body.priority).toBe('HIGH');
    createdJob = res.body;
  });

  test('PATCH /api/production-jobs/:id/status - Correctly updates status (drag on board)', async () => {
    const res = await request(app)
      .patch(`/api/production-jobs/${createdJob.id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        status: 'WIP'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WIP');
  });

  test('DELETE /api/production-jobs/:id - Rejects deleting active WIP job', async () => {
    const res = await request(app)
      .delete(`/api/production-jobs/${createdJob.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('currently in progress or completed');
  });

  test('PATCH /api/production-jobs/:id/status - Update to CANCELLED status', async () => {
    const res = await request(app)
      .patch(`/api/production-jobs/${createdJob.id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        status: 'CANCELLED'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  test('DELETE /api/production-jobs/:id - Accepts deleting CANCELLED job', async () => {
    const res = await request(app)
      .delete(`/api/production-jobs/${createdJob.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(200);
  });
});
