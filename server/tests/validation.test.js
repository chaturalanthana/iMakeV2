const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

describe('request validation', () => {
  let tenant;
  let token;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Validation Tenant', slug: `val-${Date.now()}` }
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `val-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id }
    });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.role.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  const post = (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

  test('customer name is a field error', async () => {
    const res = await post('/api/customers', { code: 'C-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Customer name is required.');
    expect(res.body.fields.name).toBe('Customer name is required.');
  });

  test('product prices reject non-numeric values with a field message', async () => {
    const res = await post('/api/products', {
      code: 'BAD-PRICE',
      name: 'Bad Price',
      costPrice: { amount: 1 }
    });
    expect(res.status).toBe(400);
    expect(res.body.fields.costPrice).toMatch(/number/i);
  });

  test('a sales document reports each missing header field', async () => {
    const res = await post('/api/sales/quotations', {});
    expect(res.status).toBe(400);
    expect(res.body.fields.customerId).toBe('Customer is required.');
    expect(res.body.fields.date).toBe('Date is required.');
    expect(res.body.fields.items).toBe('Add at least one product.');
  });

  test('a goods receipt requires the warehouse', async () => {
    const res = await post('/api/procurement/grn', {
      supplierId: 'supplier',
      date: '2026-01-01',
      items: [{ productId: 'product', quantityReceived: 1 }]
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/warehouse is required/i);
    expect(res.body.fields.warehouseId).toMatch(/warehouse is required/i);
  });
});
