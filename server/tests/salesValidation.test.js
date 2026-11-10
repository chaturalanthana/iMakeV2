const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let tenantA, userA, tokenA;
let tenantB, userB, tokenB;
let customerA, productA, warehouseA;
let customerB, productB, warehouseB;
let testStockUom;

beforeAll(async () => {
  // Setup Tenant A
  tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A', slug: `tenant-a-${Date.now()}` }
  });
  const roleA = await prisma.role.create({
    data: { tenantId: tenantA.id, name: 'Admin' }
  });
  userA = await prisma.user.create({
    data: {
      tenantId: tenantA.id,
      email: `usera_${Date.now()}@test.com`,
      passwordHash: 'hash',
      roleId: roleA.id
    }
  });
  tokenA = jwt.sign(
    { userId: userA.id, tenantId: tenantA.id, email: userA.email },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // Setup Tenant B
  tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B', slug: `tenant-b-${Date.now()}` }
  });
  const roleB = await prisma.role.create({
    data: { tenantId: tenantB.id, name: 'Admin' }
  });
  userB = await prisma.user.create({
    data: {
      tenantId: tenantB.id,
      email: `userb_${Date.now()}@test.com`,
      passwordHash: 'hash',
      roleId: roleB.id
    }
  });
  tokenB = jwt.sign(
    { userId: userB.id, tenantId: tenantB.id, email: userB.email },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // Shared test helper setup inside Tenant A
  testStockUom = await prisma.unitOfMeasure.create({
    data: { tenantId: tenantA.id, name: 'NOS' }
  });
  customerA = await prisma.customer.create({
    data: { tenantId: tenantA.id, code: 'CUS-A', name: 'Customer A' }
  });
  productA = await prisma.product.create({
    data: { tenantId: tenantA.id, code: 'PROD-A', name: 'Product A', stockUomId: testStockUom.id }
  });
  warehouseA = await prisma.warehouse.create({
    data: { tenantId: tenantA.id, code: 'WH-A', name: 'Warehouse A' }
  });

  // Shared test helper setup inside Tenant B
  await prisma.unitOfMeasure.create({
    data: { tenantId: tenantB.id, name: 'NOS' }
  }).catch(() => {});
  const testStockUomB = await prisma.unitOfMeasure.findFirst({ where: { tenantId: tenantB.id } });

  customerB = await prisma.customer.create({
    data: { tenantId: tenantB.id, code: 'CUS-B', name: 'Customer B' }
  });
  productB = await prisma.product.create({
    data: { tenantId: tenantB.id, code: 'PROD-B', name: 'Product B', stockUomId: testStockUomB.id }
  });
  warehouseB = await prisma.warehouse.create({
    data: { tenantId: tenantB.id, code: 'WH-B', name: 'Warehouse B' }
  });
});

afterAll(async () => {
  // Cleanup Tenant A
  await prisma.salesInvoiceItem.deleteMany({ where: { invoice: { tenantId: tenantA.id } } });
  await prisma.salesInvoice.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.salesDeliveryItem.deleteMany({ where: { delivery: { tenantId: tenantA.id } } });
  await prisma.stockMovement.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.salesDelivery.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.salesOrderItem.deleteMany({ where: { order: { tenantId: tenantA.id } } });
  await prisma.salesOrder.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.salesQuotationItem.deleteMany({ where: { quotation: { tenantId: tenantA.id } } });
  await prisma.salesQuotation.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.warehouse.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.unitOfMeasure.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.role.deleteMany({ where: { tenantId: tenantA.id } });
  await prisma.tenant.delete({ where: { id: tenantA.id } });

  // Cleanup Tenant B
  await prisma.salesInvoiceItem.deleteMany({ where: { invoice: { tenantId: tenantB.id } } });
  await prisma.salesInvoice.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.salesDeliveryItem.deleteMany({ where: { delivery: { tenantId: tenantB.id } } });
  await prisma.stockMovement.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.salesDelivery.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.salesOrderItem.deleteMany({ where: { order: { tenantId: tenantB.id } } });
  await prisma.salesOrder.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.salesQuotationItem.deleteMany({ where: { quotation: { tenantId: tenantB.id } } });
  await prisma.salesQuotation.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.warehouse.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.unitOfMeasure.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.role.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.tenant.delete({ where: { id: tenantB.id } });

  await prisma.$disconnect();
});

describe('Sales Operations Integration Test Suite', () => {

  describe('Quotations API Operations', () => {
    let qId;

    it('should create a new quotation (happy path)', async () => {
      const res = await request(app)
        .post('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'DRAFT',
          items: [
            { productId: productA.id, quantity: 5, unitPrice: 100, total: 500 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(parseFloat(res.body.total)).toBe(500);
      qId = res.body.id;
    });

    it('should fetch quotations list', async () => {
      const res = await request(app)
        .get('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should update a quotation', async () => {
      const res = await request(app)
        .put(`/api/sales/quotations/${qId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-09',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 10, unitPrice: 90, total: 900 }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(parseFloat(res.body.total)).toBe(900);
    });

    it('should prevent editing a finalized quotation', async () => {
      await prisma.salesQuotation.update({
        where: { id: qId },
        data: { status: 'ACCEPTED' }
      });

      const res = await request(app)
        .put(`/api/sales/quotations/${qId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ customerId: customerA.id, status: 'ACCEPTED' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });

    it('should prevent deleting a finalized quotation', async () => {
      const res = await request(app)
        .delete(`/api/sales/quotations/${qId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });

    it('should prevent Tenant B from updating Tenant A quotation (fraud prevention)', async () => {
      const res = await request(app)
        .put(`/api/sales/quotations/${qId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          customerId: customerB.id,
          status: 'ACCEPTED'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('Sales Orders API Operations', () => {
    let oId;

    it('should create an order (happy path)', async () => {
      const res = await request(app)
        .post('/api/sales/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 5, unitPrice: 100, total: 500 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      oId = res.body.id;
    });

    it('should reject editing a finalized order', async () => {
      // Finalize order status
      await prisma.salesOrder.update({
        where: { id: oId },
        data: { status: 'DELIVERED' }
      });

      const res = await request(app)
        .put(`/api/sales/orders/${oId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-10',
          status: 'DELIVERED',
          items: [
            { productId: productA.id, quantity: 8, unitPrice: 100, total: 800 }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });

    it('should prevent deleting finalized orders', async () => {
      const res = await request(app)
        .delete(`/api/sales/orders/${oId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });

    it('should prevent Tenant B from deleting Tenant A order (fraud prevention)', async () => {
      const res = await request(app)
        .delete(`/api/sales/orders/${oId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Deliveries API Operations', () => {
    let dId;

    it('should reject delivery creation if warehouseId is missing (validation)', async () => {
      const res = await request(app)
        .post('/api/sales/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'PENDING',
          items: [{ productId: productA.id, quantity: 2 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/warehouse is required/i);
    });

    it('should create a delivery with warehouse and decrement inventory stock (happy path)', async () => {
      const res = await request(app)
        .post('/api/sales/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'DELIVERED',
          warehouseId: warehouseA.id,
          items: [{ productId: productA.id, quantity: 3 }]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      dId = res.body.id;

      // Verify stock movement was registered
      const movement = await prisma.stockMovement.findFirst({
        where: { referenceId: dId, referenceType: 'SALES_DELIVERY' }
      });
      expect(movement).toBeDefined();
      expect(parseFloat(movement.quantity)).toBe(-3);
    });

    it('should prevent updating a finalized delivery docket', async () => {
      const res = await request(app)
        .put(`/api/sales/deliveries/${dId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          status: 'DELIVERED',
          items: [{ productId: productA.id, quantity: 1 }]
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });

    it('should prevent deleting a finalized delivery docket', async () => {
      const res = await request(app)
        .delete(`/api/sales/deliveries/${dId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });
  });

  describe('Invoices API Operations', () => {
    let iId;

    it('should create a new invoice (happy path)', async () => {
      const res = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 5, unitPrice: 100, total: 500 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      iId = res.body.id;
    });

    it('should reject editing non-pending/non-draft invoices', async () => {
      // Update status to UNPAID (finalized)
      await prisma.salesInvoice.update({
        where: { id: iId },
        data: { status: 'UNPAID' }
      });

      const res = await request(app)
        .put(`/api/sales/invoices/${iId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          status: 'PAID'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });

    it('should prevent deleting non-pending/non-draft invoices', async () => {
      const res = await request(app)
        .delete(`/api/sales/invoices/${iId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/finalized/i);
    });
  });

  describe('Sales Process Boundary Controls (Prevent Adding Products In-Between)', () => {
    let qId, oId, dId;
    let extraProduct;

    beforeAll(async () => {
      // Create a quotation with productA
      const qRes = await request(app)
        .post('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'COMPLETED',
          items: [{ productId: productA.id, quantity: 10, unitPrice: 100, total: 1000 }]
        });
      qId = qRes.body.id;

      // Seed an extra product that is NOT in the quotation
      extraProduct = await prisma.product.create({
        data: { tenantId: tenantA.id, code: 'EXTRA-PROD', name: 'Extra Product', stockUomId: testStockUom.id }
      });
    });

    afterAll(async () => {
      await prisma.product.delete({ where: { id: extraProduct.id } });
    });

    it('should reject creating an order from a quotation if it adds a new product in-between', async () => {
      const res = await request(app)
        .post('/api/sales/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          quotationId: qId,
          date: '2026-06-08',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 10, unitPrice: 100, total: 1000 },
            { productId: extraProduct.id, quantity: 5, unitPrice: 50, total: 250 } // Mismatch product
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot add new products/i);
    });

    it('should allow creating an order from a quotation with the exact or subset of products', async () => {
      const res = await request(app)
        .post('/api/sales/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          quotationId: qId,
          date: '2026-06-08',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 8, unitPrice: 100, total: 800 } // Subset quantity / product matches
          ]
        });

      expect(res.status).toBe(201);
      oId = res.body.id;
    });

    it('should reject creating a delivery from an order if it adds a new product in-between', async () => {
      const res = await request(app)
        .post('/api/sales/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: oId,
          date: '2026-06-08',
          warehouseId: warehouseA.id,
          status: 'DELIVERED',
          items: [
            { productId: productA.id, quantity: 8 },
            { productId: extraProduct.id, quantity: 2 } // Extra mismatch
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot add new products/i);
    });

    it('should reject creating an invoice from an order/delivery if it adds a new product in-between', async () => {
      const res = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: oId,
          date: '2026-06-08',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 8, unitPrice: 100, total: 800 },
            { productId: extraProduct.id, quantity: 2, unitPrice: 50, total: 100 } // Extra mismatch
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot add new products/i);
    });
  });

  describe('Partial Deliveries and Multiple Invoice Operations', () => {
    let orderId;
    let delivery1Id, delivery2Id;

    it('should create an order with 10 units', async () => {
      const res = await request(app)
        .post('/api/sales/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          date: '2026-06-08',
          status: 'PENDING',
          items: [
            { productId: productA.id, quantity: 10, unitPrice: 100, total: 1000 }
          ]
        });

      expect(res.status).toBe(201);
      orderId = res.body.id;
    });

    it('should process a partial delivery of 4 units and transition status to PARTIALLY_DELIVERED', async () => {
      const res = await request(app)
        .post('/api/sales/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          warehouseId: warehouseA.id,
          status: 'DELIVERED',
          items: [
            { productId: productA.id, quantity: 4 }
          ]
        });

      expect(res.status).toBe(201);
      delivery1Id = res.body.id;

      // Verify Sales Order status is PARTIALLY_DELIVERED
      const orderRes = await prisma.salesOrder.findUnique({
        where: { id: orderId }
      });
      expect(orderRes.status).toBe('PARTIALLY_DELIVERED');
    });

    it('should reject a second delivery if it exceeds the remaining ordered quantity (over-delivery validation)', async () => {
      const res = await request(app)
        .post('/api/sales/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          warehouseId: warehouseA.id,
          status: 'DELIVERED',
          items: [
            { productId: productA.id, quantity: 7 } // 4 + 7 = 11 > 10
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds the remaining ordered quantity/i);
    });

    it('should process a second partial delivery of 6 units and transition status to DELIVERED', async () => {
      const res = await request(app)
        .post('/api/sales/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          warehouseId: warehouseA.id,
          status: 'DELIVERED',
          items: [
            { productId: productA.id, quantity: 6 } // 4 + 6 = 10 (fully delivered)
          ]
        });

      expect(res.status).toBe(201);
      delivery2Id = res.body.id;

      // Verify Sales Order status is DELIVERED
      const orderRes = await prisma.salesOrder.findUnique({
        where: { id: orderId }
      });
      expect(orderRes.status).toBe('DELIVERED');
    });

    it('should reject invoicing more than ordered quantity against the Sales Order', async () => {
      const res = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          status: 'UNPAID',
          items: [
            { productId: productA.id, quantity: 12, unitPrice: 100, total: 1200 }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds the remaining ordered quantity/i);
    });

    it('should allow multiple invoices to be processed against the Sales Order (partial invoicing)', async () => {
      // First invoice: 4 units
      const res1 = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          status: 'UNPAID',
          items: [
            { productId: productA.id, quantity: 4, unitPrice: 100, total: 400 }
          ]
        });
      expect(res1.status).toBe(201);

      // Second invoice: 6 units
      const res2 = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          status: 'UNPAID',
          items: [
            { productId: productA.id, quantity: 6, unitPrice: 100, total: 600 }
          ]
        });
      expect(res2.status).toBe(201);
    });

    it('should reject further invoicing against the order since it is fully invoiced', async () => {
      const res = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerA.id,
          orderId: orderId,
          date: '2026-06-08',
          status: 'UNPAID',
          items: [
            { productId: productA.id, quantity: 1, unitPrice: 100, total: 100 }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds the remaining ordered quantity/i);
    });
  });
});
