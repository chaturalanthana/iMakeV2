const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

describe('stock posting transactions', () => {
  let tenant;
  let token;
  let product;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Stock Tx Tenant', slug: `stock-tx-${Date.now()}` }
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `stock-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id }
    });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
    product = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'STK-1', name: 'Stock Item' }
    });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.role.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  test('a failed movement line rolls back the whole post', async () => {
    const res = await request(app)
      .post('/api/warehouse/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'GR',
        items: [
          { productId: product.id, quantity: 4 },
          { productId: '11111111-1111-1111-1111-111111111111', quantity: 1 }
        ]
      });

    expect(res.status).toBe(500);
    const count = await prisma.stockMovement.count({ where: { tenantId: tenant.id, productId: product.id } });
    expect(count).toBe(0);
  });

  test('a valid movement is stored', async () => {
    const res = await request(app)
      .post('/api/warehouse/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'GR',
        items: [{ productId: product.id, quantity: 2 }]
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
  });
});
