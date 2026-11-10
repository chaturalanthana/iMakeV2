const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { UPLOAD_ROOT } = require('../src/controllers/uploadController');

describe('authenticated uploads', () => {
  let tenant;
  let otherTenant;
  let token;
  let otherToken;
  let deniedToken;
  let filePath;
  let publicPath;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Upload Tenant', slug: `upload-${Date.now()}` }
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Upload Tenant', slug: `upload-b-${Date.now()}` }
    });
    const admin = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const otherAdmin = await prisma.role.create({
      data: { tenantId: otherTenant.id, name: 'Admin', permissions: { all: true }, isSystem: true }
    });
    const sales = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Sales Only', permissions: { sales: ['read', 'write'] } }
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `up-${Date.now()}@test.com`, passwordHash: 'x', roleId: admin.id }
    });
    const otherUser = await prisma.user.create({
      data: { tenantId: otherTenant.id, email: `upb-${Date.now()}@test.com`, passwordHash: 'x', roleId: otherAdmin.id }
    });
    const salesUser = await prisma.user.create({
      data: { tenantId: tenant.id, email: `ups-${Date.now()}@test.com`, passwordHash: 'x', roleId: sales.id }
    });
    const sign = (record, tenantId) => jwt.sign({ userId: record.id, tenantId }, jwtSecret, { expiresIn: '1h' });
    token = sign(user, tenant.id);
    otherToken = sign(otherUser, otherTenant.id);
    deniedToken = sign(salesUser, tenant.id);

    const product = await prisma.product.create({
      data: { tenantId: tenant.id, code: 'UP-1', name: 'Upload Product', bomApplicable: true }
    });
    const bom = await prisma.bOM.create({
      data: { tenantId: tenant.id, productId: product.id, code: 'BOM-1', name: 'Upload BOM', version: '1.0' }
    });
    const filename = `note-${Date.now()}.txt`;
    const dir = path.join(UPLOAD_ROOT, 'boms', bom.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), 'private drawing');
    publicPath = `/uploads/boms/${bom.id}/${filename}`;
    filePath = publicPath;
    await prisma.bOMResource.create({
      data: {
        tenantId: tenant.id,
        bomId: bom.id,
        fileName: 'note.txt',
        filePath: publicPath,
        fileType: 'txt',
        fileSize: 16
      }
    });
  });

  afterAll(async () => {
    await prisma.bOMResource.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.bOM.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenant.id, otherTenant.id] } } });
    if (filePath) {
      const absolute = path.join(UPLOAD_ROOT, filePath.replace(/^\/uploads\//, ''));
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    }
  });

  test('public /uploads is not served', async () => {
    const res = await request(app).get(filePath);
    expect(res.status).not.toBe(200);
  });

  test('the file requires authentication and the owning tenant', async () => {
    const apiPath = `/api${filePath}`;
    const missing = await request(app).get(apiPath);
    expect(missing.status).toBe(401);

    const denied = await request(app).get(apiPath).set('Authorization', `Bearer ${deniedToken}`);
    expect(denied.status).toBe(403);

    const other = await request(app).get(apiPath).set('Authorization', `Bearer ${otherToken}`);
    expect(other.status).toBe(404);

    const ok = await request(app).get(apiPath).set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('private drawing');
  });

  test('path traversal is rejected', async () => {
    const res = await request(app)
      .get('/api/uploads/../../package.json')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
    expect(res.text).not.toContain('dependencies');
  });
});
