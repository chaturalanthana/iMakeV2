/**
 * Optional demo tenant for a small Sri Lankan furniture workshop.
 *
 *   npm run seed:demo
 *
 * Uses DATABASE_URL. Refuses to run when NODE_ENV is test or the database
 * name looks like a test database. Re-running replaces the demo tenant.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const { seedTenantRoles } = require('../src/permissions/catalog');
const { seedTenantFinance } = require('../src/services/glService');
const { postReceiptDocument } = require('../src/services/documentPosting');
const { syncRoutingForBom } = require('../src/services/production/routing');
const { ensureReasonCodes } = require('../src/services/production/workOrders');
const { ensureProductTypes } = require('../src/services/productTypes');

const SLUG = 'ceylon-woodworks';
const EMAIL = 'nimal@ceylonwood.lk';
const PASSWORD = 'Ceylon-demo-2026';

function refuseUnsafeDatabase() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.error('DATABASE_URL is required. See server/.env.example.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'test' || /[_-]test\b/i.test(url)) {
    console.error('Refusing to seed a test database.');
    process.exit(1);
  }
}

async function wipe(tenantId) {
  const where = { tenantId };
  await prisma.batchGenealogy.deleteMany({ where });
  await prisma.machineCapture.deleteMany({ where });
  await prisma.abnormalLoss.deleteMany({ where });
  await prisma.contractIssue.deleteMany({ where });
  await prisma.contractOrder.deleteMany({ where });
  await prisma.plannedProductionOrder.deleteMany({ where });
  await prisma.mpsBucket.deleteMany({ where });
  await prisma.mpsRun.deleteMany({ where });
  await prisma.demandForecast.deleteMany({ where });
  await prisma.bomAlternate.deleteMany({ where });
  await prisma.payrollImport.deleteMany({ where });
  await prisma.overheadReconciliation.deleteMany({ where });
  await prisma.replenishmentLine.deleteMany({ where });
  await prisma.replenishmentRun.deleteMany({ where });
  await prisma.itemWarehousePolicy.deleteMany({ where });
  await prisma.operationsSetting.deleteMany({ where });
  await prisma.statutorySetting.deleteMany({ where });
  await prisma.whtCertificate.deleteMany({ where });
  const runs = await prisma.salaryRun.findMany({ where, select: { id: true } });
  if (runs.length) {
    const lines = await prisma.salaryRunLine.findMany({
      where: { runId: { in: runs.map((run) => run.id) } },
      select: { id: true }
    });
    const lineIds = lines.map((line) => line.id);
    if (lineIds.length) {
      await prisma.salaryRunAddition.deleteMany({ where: { lineId: { in: lineIds } } });
      await prisma.salaryRunDeduction.deleteMany({ where: { lineId: { in: lineIds } } });
      await prisma.salaryRunLine.deleteMany({ where: { id: { in: lineIds } } });
    }
    await prisma.salaryRun.deleteMany({ where });
  }
  await prisma.loanInstallment.deleteMany({ where: { loan: { tenantId } } });
  await prisma.employeeLoan.deleteMany({ where });
  await prisma.leaveApplication.deleteMany({ where });
  await prisma.employeeLeaveBalance.deleteMany({ where: { employee: { tenantId } } });
  await prisma.employee.deleteMany({ where });
  await prisma.journalLine.deleteMany({ where: { journalEntry: where } });
  await prisma.journalEntry.deleteMany({ where });
  await prisma.glAccountMap.deleteMany({ where });
  await prisma.workOrderIssue.deleteMany({ where });
  await prisma.workOrderConfirmation.deleteMany({ where });
  await prisma.materialReservation.deleteMany({ where });
  await prisma.operationTimeLog.deleteMany({ where });
  await prisma.workOrderOperation.deleteMany({ where });
  await prisma.workOrderComponent.deleteMany({ where });
  await prisma.workOrder.deleteMany({ where });
  await prisma.routingOperation.deleteMany({ where });
  await prisma.routing.deleteMany({ where });
  await prisma.bOMItem.deleteMany({ where });
  await prisma.bOM.deleteMany({ where });
  await prisma.productionJob.deleteMany({ where });
  await prisma.productionOrder.deleteMany({ where });
  await prisma.productionCalendarEvent.deleteMany({ where });
  await prisma.shiftPattern.deleteMany({ where });
  await prisma.reasonCode.deleteMany({ where });
  await prisma.productionSetting.deleteMany({ where });
  await prisma.costLayer.deleteMany({ where });
  await prisma.stockMovement.deleteMany({ where });
  await prisma.supplierPaymentAllocation.deleteMany({ where });
  await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoice: where } });
  await prisma.supplierInvoice.deleteMany({ where });
  await prisma.paymentVoucherLine.deleteMany({ where: { voucher: where } });
  await prisma.paymentVoucher.deleteMany({ where });
  await prisma.paymentReceiptLine.deleteMany({ where: { receipt: where } });
  await prisma.paymentReceipt.deleteMany({ where });
  await prisma.salesInvoiceItem.deleteMany({ where: { invoice: where } });
  await prisma.salesInvoice.deleteMany({ where });
  await prisma.salesDeliveryItem.deleteMany({ where: { delivery: where } });
  await prisma.salesDelivery.deleteMany({ where });
  await prisma.salesOrderItem.deleteMany({ where: { order: where } });
  await prisma.salesOrder.deleteMany({ where });
  await prisma.salesQuotationItem.deleteMany({ where: { quotation: where } });
  await prisma.salesQuotation.deleteMany({ where });
  await prisma.gRNItem.deleteMany({ where: { grn: where } });
  await prisma.gRN.deleteMany({ where });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: where } });
  await prisma.purchaseOrder.deleteMany({ where });
  await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisition: where } });
  await prisma.purchaseRequisition.deleteMany({ where });
  await prisma.stockReceiptItem.deleteMany({ where: { stockReceipt: where } });
  await prisma.stockReceipt.deleteMany({ where });
  await prisma.stockTransferItem.deleteMany({ where: { stockTransfer: where } });
  await prisma.stockTransfer.deleteMany({ where });
  await prisma.stockAdjustmentItem.deleteMany({ where: { stockAdjustment: where } });
  await prisma.stockAdjustment.deleteMany({ where });
  await prisma.goodsIssueItem.deleteMany({ where: { goodsIssue: where } });
  await prisma.goodsIssue.deleteMany({ where });
  await prisma.purchaseWithholdingTaxSlab.deleteMany({ where });
  await prisma.purchaseWithholdingTaxGroup.deleteMany({ where });
  await prisma.purchaseTaxSlab.deleteMany({ where });
  await prisma.purchaseTaxGroup.deleteMany({ where });
  await prisma.taxSlab.deleteMany({ where });
  await prisma.taxGroup.deleteMany({ where });
  await prisma.account.deleteMany({ where });
  await prisma.product.deleteMany({ where });
  await prisma.workstation.deleteMany({ where });
  await prisma.machine.deleteMany({ where });
  await prisma.customer.deleteMany({ where });
  await prisma.supplier.deleteMany({ where });
  await prisma.warehouse.deleteMany({ where });
  await prisma.unitOfMeasure.deleteMany({ where });
  await prisma.productType.deleteMany({ where });
  await prisma.currency.deleteMany({ where });
  await prisma.userPreference.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.role.deleteMany({ where });
  await prisma.companyHoliday.deleteMany({ where });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

async function main() {
  refuseUnsafeDatabase();
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    await wipe(existing.id);
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name: 'Ceylon Woodworks (Pvt) Ltd',
        slug: SLUG,
        address: '42 Kaduwela Road, Malabe',
        phone: '0112345678',
        email: 'office@ceylonwood.lk',
        currency: 'LKR'
      }
    });
    await seedTenantRoles(tx, created.id);
    await seedTenantFinance(tx, created.id, 'LKR');
    const role = await tx.role.findUnique({
      where: { tenantId_name: { tenantId: created.id, name: 'Super Admin' } }
    });
    await tx.user.create({
      data: {
        tenantId: created.id,
        email: EMAIL,
        passwordHash,
        firstName: 'Nimal',
        lastName: 'Perera',
        roleId: role.id
      }
    });
    await ensureProductTypes(tx, created.id);
    return created;
  });

  const tenantId = tenant.id;
  const nos = await prisma.unitOfMeasure.create({ data: { tenantId, name: 'Nos' } });
  const warehouse = await prisma.warehouse.create({
    data: { tenantId, code: 'MAIN', name: 'Malabe stores', address: '42 Kaduwela Road, Malabe' }
  });
  const subcontractor = await prisma.supplier.create({
    data: {
      tenantId, code: 'SUP-CM', name: 'Elakanda Contract Packers',
      address: 'Factory sub-location, Peliyagoda', phone: '0112340000',
      leadTime: 5, currency: 'LKR', creditPeriod: 30
    }
  });
  await prisma.warehouse.create({
    data: {
      tenantId, code: 'SUB-01', name: 'Contract packing floor',
      locationRole: 'VIRTUAL', supplierId: subcontractor.id
    }
  });

  const stations = {};
  for (const station of [
    { code: 'SAW', name: 'Saw bench', hourlyRate: 850 },
    { code: 'ASM', name: 'Assembly', hourlyRate: 650 },
    { code: 'FIN', name: 'Finishing', hourlyRate: 700 }
  ]) {
    stations[station.code] = await prisma.workstation.create({
      data: { tenantId, ...station, capacity: 1, efficiency: 1, status: 'ACTIVE' }
    });
  }
  for (const machine of [
    { code: 'SOYA-2', name: 'Soya Machine 2', workstationId: stations.ASM.id },
    { code: 'PACK-2', name: 'Packeting 2', workstationId: stations.FIN.id },
    { code: 'PASTA-1', name: 'Pasta 1', workstationId: stations.SAW.id },
    { code: 'SACHET-1', name: 'Sachet Packet Machine 1', workstationId: stations.FIN.id }
  ]) {
    await prisma.machine.create({ data: { tenantId, ...machine } });
  }
  await prisma.shiftPattern.create({
    data: {
      tenantId,
      name: 'Day shift',
      startTime: '08:00',
      endTime: '17:00',
      workDays: [1, 2, 3, 4, 5],
      description: 'Monday to Friday, Malabe workshop'
    }
  });
  await prisma.productionSetting.create({
    data: {
      tenantId,
      materialCheck: 'WARN',
      issueMode: 'BACKFLUSH',
      overheadPercent: 10,
      labourRatePerHour: 650,
      hoursPerDay: 8,
      workDays: [1, 2, 3, 4, 5],
      closeGraceDays: 3,
      planningHorizonWeeks: 8,
      labourAbsorptionBase: 'PER_LABOUR_HOUR',
      overheadAbsorptionBase: 'PERCENT_OF_CONVERSION',
      abnormalLossThreshold: 2,
      defaultYieldPercent: 98,
      defaultScrapPercent: 2
    }
  });
  await ensureReasonCodes(prisma, tenantId);

  const timber = await prisma.supplier.create({
    data: {
      tenantId, code: 'SUP-TEAK', name: 'Kelani Timber',
      address: 'Avissawella Road, Homagama', phone: '0112981100',
      leadTime: 7, currency: 'LKR', taxGroup: 'VAT', withholdingTaxGroup: 'WHT', creditPeriod: 30
    }
  });
  const hardware = await prisma.supplier.create({
    data: {
      tenantId, code: 'SUP-HARD', name: 'Colombo Hardware',
      address: 'Panchikawatta, Colombo 10', phone: '0112432200',
      leadTime: 3, currency: 'LKR', taxGroup: 'VAT', creditPeriod: 14
    }
  });
  await prisma.customer.create({
    data: {
      tenantId, code: 'CUS-HOTEL', name: 'Galle Heritage Hotel',
      address: 'Lighthouse Street, Galle Fort', phone: '0912241180',
      creditLimit: 500000, creditPeriod: 30, taxGroup: 'VAT + SSCL', allowCreditSales: true
    }
  });
  await prisma.customer.create({
    data: {
      tenantId, code: 'CUS-CAFE', name: 'Kandy Cafe Co',
      address: 'Temple Street, Kandy', phone: '0812234455',
      creditLimit: 20000, creditPeriod: 14, taxGroup: 'VAT', allowCreditSales: true
    }
  });

  const rawType = await prisma.productType.findFirst({ where: { tenantId, kind: 'RAW_MATERIAL' } });
  const fgType = await prisma.productType.findFirst({ where: { tenantId, kind: 'FINISHED_GOOD' } });
  const material = async (data) => prisma.product.create({
    data: {
      tenantId,
      currency: 'LKR',
      uomId: nos.id,
      stockUomId: nos.id,
      productTypeId: rawType.id,
      type: 'PRODUCT',
      costingMethod: 'FIFO',
      ...data,
      standardCost: data.costPrice
    }
  });
  const teak = await material({ code: 'TEAK', name: 'Teak plank', costPrice: 4500, supplierId: timber.id, reorderLevel: 15 });
  const screw = await material({ code: 'SCREW', name: 'Wood screw', costPrice: 12, supplierId: hardware.id, reorderLevel: 200 });
  const varnish = await material({ code: 'VARN', name: 'Varnish, 1L', costPrice: 1800, supplierId: hardware.id, reorderLevel: 5 });
  const fabric = await material({ code: 'FAB', name: 'Upholstery fabric', costPrice: 950, supplierId: hardware.id, reorderLevel: 8 });
  const glue = await material({ code: 'GLUE', name: 'Wood glue', costPrice: 420, supplierId: hardware.id, reorderLevel: 4 });

  const furniture = await prisma.productGroup.create({
    data: { tenantId, name: 'Furniture', standardYieldPercent: 98, standardScrapPercent: 2, abnormalLossThreshold: 2 }
  });
  await prisma.productGroup.create({
    data: { tenantId, name: 'Soya', standardYieldPercent: 97, standardScrapPercent: 2, abnormalLossThreshold: 2 }
  });
  await prisma.productGroup.create({
    data: { tenantId, name: 'Pasta', standardYieldPercent: 96, standardScrapPercent: 3, abnormalLossThreshold: 2 }
  });
  await prisma.productGroup.create({
    data: { tenantId, name: 'Sauce', standardYieldPercent: 98, standardScrapPercent: 1.5, abnormalLossThreshold: 2 }
  });
  const chair = await prisma.product.create({
    data: {
      tenantId, code: 'CHAIR', name: 'Dining chair', currency: 'LKR', type: 'PRODUCT', costingMethod: 'FIFO',
      costPrice: 9000, standardCost: 9000, sellingPrice: 18500, bomApplicable: true,
      uomId: nos.id, stockUomId: nos.id, productTypeId: fgType.id, reorderLevel: 2,
      productGroupId: furniture.id, planningPolicy: 'MAKE_TO_STOCK', safetyStock: 2, stockTarget: 8,
      manufacturingLeadDays: 5, lotPolicy: 'FIXED', fixedLotQty: 2
    }
  });
  const table = await prisma.product.create({
    data: {
      tenantId, code: 'TABLE', name: 'Side table', currency: 'LKR', type: 'PRODUCT', costingMethod: 'FIFO',
      costPrice: 12000, standardCost: 12000, sellingPrice: 24000, bomApplicable: true,
      uomId: nos.id, stockUomId: nos.id, productTypeId: fgType.id, reorderLevel: 1,
      planningPolicy: 'MAKE_TO_ORDER'
    }
  });

  const chairRoute = [
    { sequence: 10, operation: 'Cut blanks', workCenter: 'SAW', setupMin: 15, runMin: 8, noOfWorkers: 1 },
    { sequence: 20, operation: 'Assemble', workCenter: 'ASM', setupMin: 10, runMin: 18, noOfWorkers: 2 },
    { sequence: 30, operation: 'Finish', workCenter: 'FIN', setupMin: 5, runMin: 12, noOfWorkers: 1 }
  ];
  const tableRoute = [
    { sequence: 10, operation: 'Cut top and legs', workCenter: 'SAW', setupMin: 15, runMin: 12, noOfWorkers: 1 },
    { sequence: 20, operation: 'Assemble', workCenter: 'ASM', setupMin: 10, runMin: 16, noOfWorkers: 1 },
    { sequence: 30, operation: 'Finish', workCenter: 'FIN', setupMin: 5, runMin: 10, noOfWorkers: 1 }
  ];
  const chairBom = await prisma.bOM.create({
    data: {
      tenantId, productId: chair.id, code: '1', name: 'Dining chair', version: '1',
      status: 'ACTIVE', isDefault: true, routingSteps: chairRoute,
      items: {
        create: [
          { tenantId, productId: teak.id, quantity: 1, type: 'Raw Material' },
          { tenantId, productId: screw.id, quantity: 8, type: 'Raw Material' },
          { tenantId, productId: varnish.id, quantity: 0.2, type: 'Raw Material' },
          { tenantId, productId: fabric.id, quantity: 0.5, type: 'Raw Material' },
          { tenantId, productId: glue.id, quantity: 0.1, type: 'Raw Material' }
        ]
      }
    }
  });
  const tableBom = await prisma.bOM.create({
    data: {
      tenantId, productId: table.id, code: '1', name: 'Side table', version: '1',
      status: 'ACTIVE', isDefault: true, routingSteps: tableRoute,
      items: {
        create: [
          { tenantId, productId: teak.id, quantity: 2, type: 'Raw Material' },
          { tenantId, productId: screw.id, quantity: 6, type: 'Raw Material' },
          { tenantId, productId: varnish.id, quantity: 0.3, type: 'Raw Material' },
          { tenantId, productId: glue.id, quantity: 0.1, type: 'Raw Material' }
        ]
      }
    }
  });
  await syncRoutingForBom(chairBom.id);
  await syncRoutingForBom(tableBom.id);
  const screwLine = await prisma.bOMItem.findFirst({ where: { tenantId, bomId: chairBom.id, productId: screw.id } });
  const altScrew = await material({ code: 'SCREW-B', name: 'Wood screw, alternate', costPrice: 14, supplierId: hardware.id });
  await prisma.bomAlternate.create({
    data: { tenantId, bomItemId: screwLine.id, productId: altScrew.id, ratio: 1, approved: true }
  });
  const { weekStart } = require('../src/services/production/productionMath');
  await prisma.demandForecast.create({
    data: { tenantId, productId: chair.id, weekStart: weekStart(new Date()), quantity: 4, notes: 'Weekly chair forecast' }
  });

  await prisma.$transaction(async (tx) => {
    await postReceiptDocument(tx, {
      tenantId,
      warehouseId: warehouse.id,
      referenceType: 'OPENING',
      referenceId: tenantId,
      date: new Date(),
      description: 'Opening stock',
      creditKey: 'OPENING_EQUITY',
      items: [
        { productId: teak.id, quantity: 8, unitPrice: 4500, lotNumber: 'TEAK-OPEN' },
        { productId: screw.id, quantity: 80, unitPrice: 12, lotNumber: 'SCREW-OPEN' },
        { productId: varnish.id, quantity: 12, unitPrice: 1800 },
        { productId: fabric.id, quantity: 20, unitPrice: 950 },
        { productId: glue.id, quantity: 10, unitPrice: 420 }
      ]
    });
  });

  // Replenishment buys stocked materials. Chairs and tables are made from sales orders and MRP.
  for (const policy of [
    { productId: teak.id, reorderPoint: 15, minQty: 10, maxQty: 40 },
    { productId: screw.id, reorderPoint: 200, minQty: 100, maxQty: 1000 }
  ]) {
    await prisma.itemWarehousePolicy.create({
      data: { tenantId, warehouseId: warehouse.id, ...policy }
    });
  }

  await prisma.employee.create({
    data: {
      tenantId, empCode: 'E-01', firstName: 'Kumari', lastName: 'Silva',
      department: 'Assembly', designation: 'Assembler', dateOfJoining: new Date('2022-03-01'), basicSalary: 85000
    }
  });
  await prisma.employee.create({
    data: {
      tenantId, empCode: 'E-02', firstName: 'Sunil', lastName: 'Fernando',
      department: 'Finishing', designation: 'Finisher', dateOfJoining: new Date('2021-08-15'), basicSalary: 78000
    }
  });

  console.log('Demo tenant ready.');
  console.log('  Company   Ceylon Woodworks (Pvt) Ltd');
  console.log(`  Sign in   ${EMAIL}`);
  console.log(`  Password  ${PASSWORD}`);
  console.log('  Stores    MAIN — teak, screws, varnish, fabric, glue');
  console.log('  Buy       reorder teak and screws. Chairs and tables are planned in MRP.');
  console.log('  Make      CHAIR is make-to-stock on the weekly MPS. TABLE is make-to-order.');
  console.log('  Machines  Soya Machine 2, Packeting 2, Pasta 1, Sachet Packet Machine 1');
  console.log('  Contract  SUB-01 virtual warehouse for Elakanda Contract Packers');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
