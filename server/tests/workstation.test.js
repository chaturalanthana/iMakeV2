const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Workstation Tenant',
      slug: `test-workstation-${Date.now()}`
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
      email: `testws_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      roleId: testRole.id
    }
  });

  authToken = jwt.sign(
    { userId: testUser.id, email: testUser.email, tenantId: testTenant.id },
    jwtSecret,
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  // Cleanup
  await prisma.workstation.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
});

describe('Workstation Registry CRUD Operations', () => {
  let createdWorkstation;

  test('POST /api/workstations - Rejects creation with missing fields', async () => {
    const res = await request(app)
      .post('/api/workstations')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        description: 'No code or name'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Code and Name are required');
  });

  test('POST /api/workstations - Rejects negative hourlyRate', async () => {
    const res = await request(app)
      .post('/api/workstations')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        code: 'WS-01',
        name: 'Workstation 01',
        hourlyRate: -10.0
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Hourly rate cannot be negative');
  });

  test('POST /api/workstations - Successfully creates workstation', async () => {
    const res = await request(app)
      .post('/api/workstations')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        code: 'WS-CUT-01',
        name: 'Cutting Workstation 01',
        description: 'Primary cutting station',
        hourlyRate: 25.0,
        status: 'ACTIVE'
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.code).toBe('WS-CUT-01');
    expect(parseFloat(res.body.hourlyRate)).toBe(25.0);
    expect(res.body.efficiency).toBeUndefined();
    expect(res.body.capacity).toBeUndefined();
    expect(res.body.status).toBe('ACTIVE');
    createdWorkstation = res.body;
  });

  test('POST /api/workstations - Rejects duplicate code inside tenant', async () => {
    const res = await request(app)
      .post('/api/workstations')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        code: 'WS-CUT-01',
        name: 'Another Cutting Workstation',
        hourlyRate: 15.0
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Workstation code already exists');
  });

  test('GET /api/workstations - Lists workstations', async () => {
    const res = await request(app)
      .get('/api/workstations')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].code).toBe('WS-CUT-01');
  });

  test('PUT /api/workstations/:id - Successfully updates workstation', async () => {
    const res = await request(app)
      .put(`/api/workstations/${createdWorkstation.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        code: 'WS-CUT-01-MOD',
        name: 'Cutting Workstation 01 Modified',
        description: 'Updated description',
        hourlyRate: 30.0,
        status: 'UNDER_MAINTENANCE'
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('WS-CUT-01-MOD');
    expect(parseFloat(res.body.hourlyRate)).toBe(30.0);
    expect(res.body.efficiency).toBeUndefined();
    expect(res.body.capacity).toBeUndefined();
    expect(res.body.status).toBe('UNDER_MAINTENANCE');
  });

  test('DELETE /api/workstations/:id - Successfully deletes workstation', async () => {
    const res = await request(app)
      .delete(`/api/workstations/${createdWorkstation.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    const check = await prisma.workstation.findFirst({
      where: { id: createdWorkstation.id }
    });
    expect(check).toBeNull();
  });
});
