const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');
const { ensureProductTypes } = require('../src/services/productTypes');

describe('phase 1 inventory and warehouse', () => {
  let tenant;
  let other;
  let token;
  let otherToken;
  let warehouse;
  let otherWarehouse;
  let supplier;
  let customer;
  let rawType;
  let finishedType;
  const auth = (value = token) => ({ Authorization: `Bearer ${value}` });

  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: 'Phase 1', slug: `phase1-${Date.now()}` } });
    other = await prisma.tenant.create({ data: { name: 'Other', slug: `phase1-other-${Date.now()}` } });
    await ensureProductTypes(prisma, tenant.id);
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin', permissions: { all: true }, isSystem: true } });
    const user = await prisma.user.create({ data: { tenantId: tenant.id, email: `p1-${Date.now()}@test.com`, passwordHash: 'x', roleId: role.id } });
    token = jwt.sign({ userId: user.id, tenantId: tenant.id }, jwtSecret, { expiresIn: '2h' });
    const otherRole = await prisma.role.create({ data: { tenantId: other.id, name: 'Admin', permissions: { all: true }, isSystem: true } });
    const otherUser = await prisma.user.create({ data: { tenantId: other.id, email: `p1b-${Date.now()}@test.com`, passwordHash: 'x', roleId: otherRole.id } });
    otherToken = jwt.sign({ userId: otherUser.id, tenantId: other.id }, jwtSecret, { expiresIn: '2h' });
    rawType = await prisma.productType.findFirst({ where: { tenantId: tenant.id, kind: 'RAW_MATERIAL' } });
    finishedType = await prisma.productType.findFirst({ where: { tenantId: tenant.id, kind: 'FINISHED_GOOD' } });
    supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, code: 'SUP', name: 'Mill' } });
    customer = await prisma.customer.create({ data: { tenantId: tenant.id, code: 'CUS', name: 'Shop' } });
  });

  afterAll(async () => {
    for (const id of [tenant.id, other.id]) {
      const where = { tenantId: id };
      await prisma.qaRetest.deleteMany({ where });
      await prisma.cycleCountLine.deleteMany({ where });
      await prisma.cycleCount.deleteMany({ where });
      await prisma.stockReturnItem.deleteMany({ where });
      await prisma.stockReturn.deleteMany({ where });
      await prisma.inventoryTransferLeg.deleteMany({ where });
      await prisma.inventoryTransferItem.deleteMany({ where });
      await prisma.inventoryTransfer.deleteMany({ where });
      await prisma.pickListLine.deleteMany({ where });
      await prisma.pickList.deleteMany({ where });
      await prisma.materialRequestItem.deleteMany({ where });
      await prisma.materialRequest.deleteMany({ where });
      await prisma.stockAllocation.deleteMany({ where });
      await prisma.costLayer.deleteMany({ where });
      await prisma.stockMovement.deleteMany({ where });
      await prisma.stockBatch.deleteMany({ where });
      await prisma.pallet.deleteMany({ where });
      await prisma.journalLine.deleteMany({ where: { journalEntry: where } });
      await prisma.journalEntry.deleteMany({ where });
      await prisma.glAccountMap.deleteMany({ where });
      await prisma.gRNItem.deleteMany({ where: { grn: where } });
      await prisma.gRN.deleteMany({ where });
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } });
      await prisma.purchaseOrder.deleteMany({ where });
      await prisma.replenishmentLine.deleteMany({ where });
      await prisma.replenishmentRun.deleteMany({ where });
      await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } });
      await prisma.purchaseRequisition.deleteMany({ where });
      await prisma.itemSupplier.deleteMany({ where });
      await prisma.product.deleteMany({ where });
      await prisma.bin.deleteMany({ where });
      await prisma.warehouse.deleteMany({ where });
      await prisma.branch.deleteMany({ where });
      await prisma.uomTemplateLine.deleteMany({ where });
      await prisma.uomTemplate.deleteMany({ where });
      await prisma.unitOfMeasure.deleteMany({ where });
      await prisma.productType.deleteMany({ where });
      await prisma.customer.deleteMany({ where });
      await prisma.supplier.deleteMany({ where });
      await prisma.account.deleteMany({ where });
      await prisma.auditLog.deleteMany({ where });
      await prisma.approvalAction.deleteMany({ where });
      await prisma.approvalRequest.deleteMany({ where });
      await prisma.user.deleteMany({ where });
      await prisma.role.deleteMany({ where });
      await prisma.tenant.delete({ where: { id } }).catch(() => {});
    }
  });

  test('locations, conversions, batches, documents, and reports', async () => {
    const locations = await request(app).post('/api/inventory/locations/ensure').set(auth()).send({});
    expect(locations.status).toBe(200);
    expect(locations.body.created).toEqual(expect.arrayContaining(['WH-PEL-RM', 'WH-ELK-DW', 'WH-PEL-CM']));
    const branches = await request(app).get('/api/inventory/branches').set(auth());
    expect(branches.body.find((row) => row.code === 'PELI').warehouses.length).toBeGreaterThan(1);
    const virtual = branches.body.flatMap((row) => row.warehouses).find((row) => row.code === 'WH-PEL-CM');
    expect(virtual.isVirtual).toBe(true);
    expect(virtual.warehouseType).toBe('VIRTUAL_FACTORY');

    warehouse = (await request(app).post('/api/warehouses').set(auth()).send({ code: 'MAIN', name: 'Main' })).body;
    otherWarehouse = (await request(app).post('/api/warehouses').set(auth()).send({ code: 'DIST', name: 'Distribution', warehouseType: 'DISTRIBUTION', tracksPallets: true })).body;
    const bin = await request(app).post('/api/inventory/bins').set(auth()).send({ warehouseId: warehouse.id, code: 'QA-HOLD', name: 'Quarantine', binType: 'QUARANTINE' });
    expect(bin.status).toBe(201);
    const badBin = await request(app).post('/api/inventory/bins').set(auth()).send({ warehouseId: 'nope', code: 'X', name: 'X' });
    expect(badBin.status).toBe(400);

    const templates = await request(app).post('/api/inventory/uom-templates/ensure').set(auth()).send({});
    expect(templates.body.map((row) => row.code).sort()).toEqual(['COUNT', 'MASS', 'VOLUME']);
    const each = templates.body.find((row) => row.code === 'COUNT').lines.find((line) => line.uomCode === 'Carton');
    expect(Number(each.factorToBase)).toBe(12);

    const nos = await prisma.unitOfMeasure.create({ data: { tenantId: tenant.id, name: 'Nos' } });
    const carton = await prisma.unitOfMeasure.create({ data: { tenantId: tenant.id, name: 'Carton' } });
    const category = await prisma.productCategory.create({ data: { tenantId: tenant.id, name: 'Soya' } });
    const brand = await prisma.productBrand.create({ data: { tenantId: tenant.id, name: 'Nawaloka' } });

    const item = await request(app).post('/api/products').set(auth()).send({
      code: 'RM-01',
      name: 'Soya flour',
      productTypeId: rawType.id,
      categoryId: category.id,
      brandId: brand.id,
      variant: 'Fine',
      sizeLabel: '25kg',
      stockUomId: nos.id,
      purchaseUomId: carton.id,
      conversionFactor: 12,
      uomConversions: [{ uomId: carton.id, uomName: 'Carton', factor: 12 }],
      safetyStock: 4,
      dailyDemand: 2,
      leadTimeDays: 5,
      batchTracked: true,
      expiryTracked: true,
      costPrice: 10,
      supplierId: supplier.id
    });
    expect(item.status).toBe(201);
    expect(item.body.standardDescription).toBe('Soya Nawaloka Fine 25kg');
    expect(item.body.reorderLevel).toBe(14);

    const duplicate = await request(app).post('/api/products').set(auth()).send({
      code: 'RM-02',
      name: 'Soya flour copy',
      categoryId: category.id,
      brandId: brand.id,
      variant: 'Fine',
      sizeLabel: '25kg',
      barcode: '123'
    });
    expect(duplicate.status).toBe(400);

    const barcoded = await request(app).post('/api/products').set(auth()).send({ code: 'FG-01', name: 'Bottle', productTypeId: finishedType.id, barcode: '555', pickRule: 'FEFO', expiryTracked: true, costPrice: 8 });
    expect(barcoded.status).toBe(201);
    const sameBarcode = await request(app).post('/api/products').set(auth()).send({ code: 'FG-02', name: 'Bottle 2', barcode: '555' });
    expect(sameBarcode.status).toBe(400);

    const bulk = await request(app).post('/api/products/batch').set(auth()).send({ ids: [barcoded.body.id], changes: { description: 'Shop note' } });
    expect(bulk.status).toBe(200);
    const blockedBulk = await request(app).post('/api/products/batch').set(auth()).send({ ids: [barcoded.body.id], changes: { safetyStock: 3 } });
    expect(blockedBulk.status).toBe(400);
    const allowedBulk = await request(app).post('/api/products/batch').set(auth()).send({ ids: [barcoded.body.id], changes: { safetyStock: 3 }, authorizedUpdate: true });
    expect(allowedBulk.status).toBe(200);

    const po = await request(app).post('/api/procurement/purchase-orders').set(auth()).send({
      supplierId: supplier.id,
      date: '2026-11-11',
      items: [{ productId: item.body.id, quantity: 2, unitPrice: 100, total: 200 }]
    });
    expect(po.status).toBe(201);
    expect(Number(po.body.items[0].conversionFactor)).toBe(12);
    expect(Number(po.body.items[0].baseQuantity)).toBe(24);
    expect(po.body.items[0].uomId).toBe(carton.id);

    const search = await request(app).get('/api/products?q=555').set(auth());
    expect(search.body.map((row) => row.code)).toEqual(['FG-01']);

    const pallet = await request(app).post('/api/inventory/pallets').set(auth()).send({ warehouseId: otherWarehouse.id, code: 'PLT-1' });
    expect(pallet.status).toBe(201);
    const receipt = await request(app).post('/api/inventory/receipts').set(auth()).send({
      warehouseId: otherWarehouse.id,
      supplierId: supplier.id,
      items: [
        { productId: item.body.id, quantity: 10, unitCost: 10, lotNumber: 'LOT-A', expiryDate: '2026-01-01', palletId: pallet.body.id },
        { productId: item.body.id, quantity: 6, unitCost: 12, lotNumber: 'LOT-B', expiryDate: '2026-12-01', damagedQty: 1 }
      ]
    });
    expect(receipt.status).toBe(201);
    const batches = await request(app).get('/api/inventory/batches').set(auth());
    const lotA = batches.body.find((row) => row.lotNumber === 'LOT-A');
    expect(lotA.originalExpiryDate.slice(0, 10)).toBe('2026-01-01');
    const hidden = await request(app).get('/api/inventory/batches').set(auth(otherToken));
    expect(hidden.body).toEqual([]);

    const picks = await request(app).get(`/api/inventory/suggestions?productId=${item.body.id}&warehouseId=${otherWarehouse.id}&quantity=8`).set(auth());
    expect(picks.body.suggestions.every((row) => row.lotNumber !== 'LOT-A')).toBe(true);

    const retest = await request(app).post(`/api/inventory/batches/${lotA.id}/retest`).set(auth()).send({ proposedExpiry: '2027-06-01', evidence: 'Lab sheet 14' });
    expect(retest.status).toBe(201);
    const stillOld = await prisma.stockBatch.findUnique({ where: { id: lotA.id } });
    expect(stillOld.expiryDate.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(stillOld.originalExpiryDate.toISOString().slice(0, 10)).toBe('2026-01-01');
    const approved = await request(app).post(`/api/inventory/batches/${lotA.id}/retest/decide`).set(auth()).send({ decision: 'APPROVED' });
    expect(approved.body.expiryDate.slice(0, 10)).toBe('2027-06-01');
    expect(approved.body.originalExpiryDate.slice(0, 10)).toBe('2026-01-01');

    const deactivate = await request(app).post(`/api/inventory/pallets/${pallet.body.id}/deactivate`).set(auth()).send({});
    expect(deactivate.status).toBe(400);
    const renumber = await request(app).post(`/api/inventory/pallets/${pallet.body.id}/renumber`).set(auth()).send({ code: 'PLT-2' });
    expect(renumber.status).toBe(201);
    const oldPallet = await prisma.pallet.findUnique({ where: { id: pallet.body.id } });
    expect(oldPallet.status).toBe('SUPERSEDED');
    expect(oldPallet.supersededById).toBe(renumber.body.id);

    const fgReceipt = await request(app).post('/api/inventory/receipts').set(auth()).send({
      warehouseId: warehouse.id,
      items: [
        { productId: barcoded.body.id, quantity: 4, unitCost: 8, lotNumber: 'FG-LATE', expiryDate: '2027-08-01' },
        { productId: barcoded.body.id, quantity: 3, unitCost: 9, lotNumber: 'FG-SOON', expiryDate: '2026-12-01' }
      ]
    });
    expect(fgReceipt.status).toBe(201);
    const fefo = await request(app).get(`/api/inventory/suggestions?productId=${barcoded.body.id}&warehouseId=${warehouse.id}&quantity=5`).set(auth());
    expect(fefo.body.rule).toBe('FEFO');
    expect(fefo.body.suggestions[0].lotNumber).toBe('FG-SOON');

    const mr = await request(app).post('/api/inventory/material-requests').set(auth()).send({
      date: '2026-11-11',
      requestingParty: 'Packing',
      purpose: 'Line issue',
      sourceWarehouseId: warehouse.id,
      kind: 'ISSUE',
      items: [{ productId: barcoded.body.id, quantity: 4 }]
    });
    expect(mr.status).toBe(201);
    expect(mr.body.approvalStatus).toBe('PENDING');
    const approvedMr = await request(app).post(`/api/inventory/material-requests/${mr.body.id}/approve`).set(auth()).send({});
    expect(approvedMr.body.status).toBe('APPROVED');
    const reserved = await request(app).get('/api/inventory/allocations?status=OPEN').set(auth());
    expect(reserved.body.some((row) => row.sourceType === 'MATERIAL_REQUEST' && row.kind === 'HARD')).toBe(true);
    const pick = await request(app).post(`/api/inventory/material-requests/${mr.body.id}/pick`).set(auth()).send({});
    expect(pick.body.lines[0].lotNumber || pick.body.lines.length).toBeTruthy();
    const fulfil = await request(app).post(`/api/inventory/material-requests/${mr.body.id}/fulfil`).set(auth()).send({
      lines: [{ productId: barcoded.body.id, quantity: 2, batchId: pick.body.lines[0].batchId }]
    });
    expect(fulfil.body.status).toBe('PARTIAL');

    const transfer = await request(app).post('/api/inventory/transfers').set(auth()).send({
      date: '2026-11-11',
      fromWarehouseId: otherWarehouse.id,
      toWarehouseId: warehouse.id,
      mode: 'IN_TRANSIT',
      post: true,
      items: [{ productId: item.body.id, quantity: 2, batchId: (await prisma.stockBatch.findFirst({ where: { lotNumber: 'LOT-B' } })).id }]
    });
    expect(transfer.status).toBe(201);
    expect(transfer.body.status).toBe('IN_TRANSIT');
    const before = await request(app).get(`/api/inventory/positions?warehouseId=${warehouse.id}`).set(auth());
    expect(before.body.find((row) => row.code === 'RM-01')).toBeUndefined();
    const received = await request(app).post(`/api/inventory/transfers/${transfer.body.id}/receive`).set(auth()).send({});
    expect(received.body.status).toBe('RECEIVED');
    const after = await request(app).get(`/api/inventory/positions?warehouseId=${warehouse.id}`).set(auth());
    expect(after.body.find((row) => row.code === 'RM-01').onHand).toBeGreaterThan(0);

    const customerReturn = await request(app).post('/api/inventory/returns').set(auth()).send({
      date: '2026-11-11',
      kind: 'MARKET',
      customerId: customer.id,
      warehouseId: warehouse.id,
      reference: 'INV-1',
      post: true,
      items: [{ productId: barcoded.body.id, quantity: 1, reason: 'Expired on shelf', unitCost: 8 }]
    });
    expect(customerReturn.status).toBe(201);
    expect(customerReturn.body.items[0].disposition).toBe('QUARANTINE');
    const supplierReturn = await request(app).post('/api/inventory/returns').set(auth()).send({
      date: '2026-11-11',
      kind: 'SUPPLIER',
      supplierId: supplier.id,
      warehouseId: otherWarehouse.id,
      post: true,
      items: [{ productId: item.body.id, quantity: 1, reason: 'Quality' }]
    });
    expect(supplierReturn.status).toBe(201);

    const count = await request(app).post('/api/inventory/cycle-counts').set(auth()).send({
      date: '2026-11-11',
      warehouseId: warehouse.id,
      kind: 'CYCLE',
      lines: [{ productId: barcoded.body.id, countQty: 100, reason: 'Found a carton' }]
    });
    expect(count.status).toBe(201);
    const early = await request(app).post(`/api/inventory/cycle-counts/${count.body.id}/post`).set(auth()).send({});
    expect(early.status).toBe(400);
    const finance = await request(app).post(`/api/inventory/cycle-counts/${count.body.id}/finance`).set(auth()).send({ decision: 'APPROVED' });
    expect(finance.body.financeStatus).toBe('APPROVED');
    const posted = await request(app).post(`/api/inventory/cycle-counts/${count.body.id}/post`).set(auth()).send({});
    expect(posted.body.status).toBe('POSTED');

    const trace = await request(app).get('/api/inventory/trace?lotNumber=LOT-B').set(auth());
    expect(trace.body.whereFrom.length).toBeGreaterThan(0);
    expect(trace.body.batch.lotNumber).toBe('LOT-B');

    const movement = await request(app).get('/api/inventory/reports/movement').set(auth());
    expect(movement.body.find((row) => row.code === 'RM-01').received).toBeGreaterThan(0);
    const aging = await request(app).get('/api/inventory/reports/aging').set(auth());
    expect(aging.body.find((row) => row.code === 'FG-01').qty).toBeGreaterThan(0);
    const variance = await request(app).get(`/api/inventory/reports/variance?countId=${count.body.id}`).set(auth());
    expect(Number(variance.body.lines[0].varianceQty)).not.toBe(0);

    const bought = await request(app).post('/api/products').set(auth()).send({
      code: 'BUY-1',
      name: 'Glue',
      safetyStock: 1,
      dailyDemand: 2,
      leadTimeDays: 5,
      costPrice: 3
    });
    const run = await request(app).post('/api/replenishment/run').set(auth()).send({});
    const rop = run.body.lines.find((line) => line.code === 'BUY-1');
    expect(rop.kind).toBe('BUY');
    expect(rop.reason).toBe('ROP');
    expect(rop.quantity).toBe(11);
    const made = run.body.lines.find((line) => line.kind === 'MAKE');
    expect(made).toBeUndefined();

    await request(app).post('/api/inventory/receipts').set(auth()).send({
      warehouseId: warehouse.id,
      items: [{ productId: bought.body.id, quantity: 1, unitCost: 3, lotNumber: 'GLUE-1' }]
    });
    const locked = await request(app).put(`/api/products/${bought.body.id}`).set(auth()).send({ costingMethod: 'AVERAGE' });
    expect(locked.status).toBe(400);
    expect(locked.body.error).toMatch(/locked/i);
  });
});
