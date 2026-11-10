const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let shiftPattern;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Production Calendar Tenant',
      slug: `test-prod-cal-${Date.now()}`
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
      email: `testcal_${Date.now()}@test.com`,
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
  await prisma.productionCalendarEvent.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.shiftPattern.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });
});

describe('Production Calendar API Operations', () => {
  test('POST /api/production-calendar/shifts - Successfully creates a shift pattern', async () => {
    const res = await request(app)
      .post('/api/production-calendar/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        name: 'Day Shift 1',
        startTime: '08:00',
        endTime: '16:00',
        workDays: [1, 2, 3, 4, 5],
        description: 'Standard work days Mon-Fri'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Day Shift 1');
    shiftPattern = res.body;
  });

  test('POST /api/production-calendar/shifts - Rejects duplicate shift pattern name', async () => {
    const res = await request(app)
      .post('/api/production-calendar/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        name: 'Day Shift 1',
        startTime: '09:00',
        endTime: '17:00'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });

  test('POST /api/production-calendar/events - Creates calendar event (Holiday)', async () => {
    const res = await request(app)
      .post('/api/production-calendar/events')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        type: 'HOLIDAY',
        date: '2026-12-25T00:00:00.000Z',
        name: 'Christmas Day',
        description: 'Public holiday closure'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Christmas Day');
    expect(res.body.type).toBe('HOLIDAY');
  });

  test('POST /api/production-calendar/events - Creates calendar event (Maintenance) with metadata', async () => {
    const res = await request(app)
      .post('/api/production-calendar/events')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        type: 'MAINTENANCE',
        date: '2026-06-15T00:00:00.000Z',
        name: 'CNC Machine Maintenance',
        description: 'CNC Line A scheduled overhaul',
        workCenterId: 'LINE_A',
        metadata: { cost: 1500, technician: 'Alex' }
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('MAINTENANCE');
    expect(res.body.metadata.cost).toBe(1500);
  });

  test('POST /api/production-calendar/events - Creates calendar event (Overtime) linking to Shift Pattern', async () => {
    const res = await request(app)
      .post('/api/production-calendar/events')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .send({
        type: 'OVERTIME',
        date: '2026-06-20T00:00:00.000Z',
        name: 'Saturday Special Shift',
        shiftPatternId: shiftPattern.id
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('OVERTIME');
    expect(res.body.shiftPatternId).toBe(shiftPattern.id);
  });

  test('GET /api/production-calendar/events - Returns filtered list of events', async () => {
    const res = await request(app)
      .get('/api/production-calendar/events')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id)
      .query({ year: 2026, month: 5 }); // 0-indexed month, 5 = June

    expect(res.status).toBe(200);
    // Should return CNC maintenance and Overtime Saturday shift, but not Christmas Day
    expect(res.body).toHaveLength(2);
    expect(res.body.some(e => e.name === 'Christmas Day')).toBe(false);
  });

  test('DELETE /api/production-calendar/shifts - Rejects deletion when referenced in an event', async () => {
    const res = await request(app)
      .delete(`/api/production-calendar/shifts/${shiftPattern.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', testTenant.id);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('referenced in calendar events');
  });
});
