/**
 * Optional demo tenant for a small Sri Lankan furniture workshop.
 *
 *   npm run seed:demo
 *
 * Uses DATABASE_URL. Refuses to run when NODE_ENV is test or the database
 * name looks like a test database. Re-running replaces the demo tenant.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const { seedTenantRoles } = require('../src/permissions/catalog');
const { seedTenantFinance } = require('../src/services/glService');
const { ensureDefaultRules } = require('../src/services/approvalService');
const { postReceiptDocument } = require('../src/services/documentPosting');
const { syncRoutingForBom } = require('../src/services/production/routing');
const { ensureReasonCodes } = require('../src/services/production/workOrders');
const { ensureProductTypes } = require('../src/services/productTypes');
const { createContract, createRfq, addQuotation, selectQuotation } = require('../src/services/phase2/procurement');
const { openPeriod } = require('../src/services/phase2/close');
const { openPettyCash, issueIou } = require('../src/services/phase2/treasury');

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
  await prisma.proofLine.deleteMany({ where });
  await prisma.proofOfDelivery.deleteMany({ where });
  await prisma.salesReturnLine.deleteMany({ where });
  await prisma.salesReturn.deleteMany({ where });
  await prisma.gatePass.deleteMany({ where });
  await prisma.tripDelivery.deleteMany({ where });
  await prisma.tripSheet.deleteMany({ where });
  await prisma.routePickLine.deleteMany({ where });
  await prisma.routePickOrder.deleteMany({ where });
  await prisma.routePick.deleteMany({ where });
  await prisma.salesReservation.deleteMany({ where });
  await prisma.orderCancellation.deleteMany({ where });
  await prisma.customerPrice.deleteMany({ where });
  await prisma.sfaMessage.deleteMany({ where });
  await prisma.sfaApiKey.deleteMany({ where });
  await prisma.appNotification.deleteMany({ where });
  await prisma.bankFileExport.deleteMany({ where });
  await prisma.bankFileTemplate.deleteMany({ where });
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
  await prisma.overheadReconciliation.deleteMany({ where });  await prisma.depreciationLine.deleteMany({ where });
  await prisma.assetEvent.deleteMany({ where });
  await prisma.depreciationRun.deleteMany({ where });
  await prisma.fixedAsset.deleteMany({ where });
  await prisma.fixedAssetClass.deleteMany({ where });
  await prisma.landedCostAllocation.deleteMany({ where });
  await prisma.landedCostCharge.deleteMany({ where });
  await prisma.landedCost.deleteMany({ where });
  await prisma.iouSettlement.deleteMany({ where });
  await prisma.iouAdvance.deleteMany({ where });
  await prisma.pettyCashFund.deleteMany({ where });
  await prisma.cheque.deleteMany({ where });
  await prisma.collectionActivity.deleteMany({ where });
  await prisma.collectionCase.deleteMany({ where });
  await prisma.partyNote.deleteMany({ where });
  await prisma.quotationSelection.deleteMany({ where });
  await prisma.supplierQuotationLine.deleteMany({ where });
  await prisma.supplierQuotation.deleteMany({ where });
  await prisma.rfqInvitation.deleteMany({ where });
  await prisma.rfqLine.deleteMany({ where });
  await prisma.requestForQuotation.deleteMany({ where });
  await prisma.priceException.deleteMany({ where });
  await prisma.contractPrice.deleteMany({ where });
  await prisma.approvedSupplierItem.deleteMany({ where });
  await prisma.tradeProfile.deleteMany({ where });
  await prisma.purchaseClassification.deleteMany({ where });
  await prisma.documentDimension.deleteMany({ where });
  await prisma.itemMeasure.deleteMany({ where });
  await prisma.allocationRuleLine.deleteMany({ where });
  await prisma.allocationRule.deleteMany({ where });
  await prisma.budget.deleteMany({ where });
  await prisma.capitalProject.deleteMany({ where });
  await prisma.orgCenter.deleteMany({ where });
  await prisma.financeSetting.deleteMany({ where });
  await prisma.periodCloseStep.deleteMany({ where });
  await prisma.periodClose.deleteMany({ where });
  await prisma.recurringJournal.deleteMany({ where });
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
  await prisma.stockBatch.deleteMany({ where });
  await prisma.pallet.deleteMany({ where });
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
  await prisma.vehicle.deleteMany({ where });
  await prisma.shipTo.deleteMany({ where });
  await prisma.deliveryRoute.deleteMany({ where });
  await prisma.dispatchSetting.deleteMany({ where });
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
  await prisma.itemSupplier.deleteMany({ where });
  await prisma.product.deleteMany({ where });
  await prisma.bin.deleteMany({ where });
  await prisma.workstation.deleteMany({ where });
  await prisma.machine.deleteMany({ where });
  await prisma.customer.deleteMany({ where });
  await prisma.supplier.deleteMany({ where });
  await prisma.warehouse.deleteMany({ where });
  await prisma.branch.deleteMany({ where });
  await prisma.uomTemplateLine.deleteMany({ where });
  await prisma.uomTemplate.deleteMany({ where });
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
    await ensureDefaultRules(tx, created.id);
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
      locationRole: 'VIRTUAL', isVirtual: true, supplierId: subcontractor.id
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
  const teak = await material({
    code: 'TEAK', name: 'Teak plank', costPrice: 4500, supplierId: timber.id, reorderLevel: 15,
    batchTracked: true, expiryTracked: false, pickRule: 'FIFO', leadTimeDays: 7, dailyDemand: 1, safetyStock: 8
  });
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

  const bins = {};
  for (const bin of [
    { code: 'BIN-A1', name: 'Bulk rack', binType: 'STORAGE' },
    { code: 'QA-HOLD', name: 'Quarantine', binType: 'QUARANTINE' },
    { code: 'DMG-01', name: 'Damaged', binType: 'DAMAGED' }
  ]) {
    bins[bin.code] = await prisma.bin.create({ data: { tenantId, warehouseId: warehouse.id, ...bin } });
  }
  const pallet = await prisma.pallet.create({
    data: { tenantId, warehouseId: warehouse.id, code: 'PLT-TEAK-1', status: 'ACTIVE' }
  });
  const teakBatch = await prisma.stockBatch.create({
    data: {
      tenantId, productId: teak.id, lotNumber: 'TEAK-OPEN', status: 'UNRESTRICTED',
      supplierId: timber.id, receiptDate: new Date()
    }
  });
  const screwBatch = await prisma.stockBatch.create({
    data: {
      tenantId, productId: screw.id, lotNumber: 'SCREW-OPEN', status: 'UNRESTRICTED',
      supplierId: hardware.id, receiptDate: new Date()
    }
  });
  await prisma.costLayer.updateMany({
    where: { tenantId, lotNumber: 'TEAK-OPEN' },
    data: { batchId: teakBatch.id, binId: bins['BIN-A1'].id, palletId: pallet.id, stockStatus: 'UNRESTRICTED' }
  });
  await prisma.costLayer.updateMany({
    where: { tenantId, lotNumber: 'SCREW-OPEN' },
    data: { batchId: screwBatch.id, binId: bins['BIN-A1'].id, stockStatus: 'UNRESTRICTED' }
  });
  await prisma.stockMovement.updateMany({
    where: { tenantId, lotNumber: 'TEAK-OPEN' },
    data: { batchId: teakBatch.id, binId: bins['BIN-A1'].id, palletId: pallet.id, stockStatus: 'UNRESTRICTED' }
  });
  await prisma.stockMovement.updateMany({
    where: { tenantId, lotNumber: 'SCREW-OPEN' },
    data: { batchId: screwBatch.id, binId: bins['BIN-A1'].id, stockStatus: 'UNRESTRICTED' }
  });

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

  const elakanda = await prisma.warehouse.create({
    data: { tenantId, code: 'ELK', name: 'Elakanda distribution', address: 'Elakanda, Wattala' }
  });
  const vanStore = await prisma.warehouse.create({
    data: { tenantId, code: 'VAN-01', name: 'Van 01 stock', address: 'Mobile' }
  });
  const factory = await prisma.warehouse.create({
    data: { tenantId, code: 'FAC-CASH', name: 'Factory cash counter', address: 'Peliyagoda' }
  });
  const route = await prisma.deliveryRoute.create({
    data: { tenantId, code: 'GT-NORTH', name: 'General trade north', warehouseId: elakanda.id }
  });
  await prisma.vehicle.create({
    data: {
      tenantId, code: 'TRUCK-1', registration: 'WP-LD-2041', driverName: 'Ranjith',
      kind: 'TRUCK', routeId: route.id
    }
  });
  await prisma.vehicle.create({
    data: {
      tenantId, code: 'VAN-01', registration: 'WP-CAB-1188', driverName: 'Nadeesha',
      kind: 'VAN', warehouseId: vanStore.id, routeId: route.id
    }
  });
  const hotel = await prisma.customer.findFirst({ where: { tenantId, code: 'CUS-HOTEL' } });
  const cafe = await prisma.customer.findFirst({ where: { tenantId, code: 'CUS-CAFE' } });
  await prisma.customer.update({ where: { id: hotel.id }, data: { channel: 'GENERAL_TRADE' } });
  await prisma.customer.update({ where: { id: cafe.id }, data: { channel: 'MODERN_TRADE' } });
  const group = await prisma.customerCategory.create({
    data: { tenantId, code: 'GT', name: 'General trade', allowCreditSales: true, creditLimit: 500000, creditPeriod: 30 }
  });
  await prisma.customer.update({ where: { id: hotel.id }, data: { customerCategoryId: group.id } });
  await prisma.shipTo.create({
    data: { tenantId, customerId: hotel.id, code: 'FORT', name: 'Galle Fort', address: 'Lighthouse Street, Galle Fort', isDefault: true }
  });
  await prisma.customerPrice.create({
    data: { tenantId, scope: 'CUSTOMER', customerId: hotel.id, productId: chair.id, currency: 'LKR', minQty: 1, price: 17500 }
  });
  await prisma.customerPrice.create({
    data: { tenantId, scope: 'GROUP', customerCategoryId: group.id, productId: table.id, currency: 'LKR', minQty: 1, price: 22000 }
  });
  await prisma.customerPrice.create({
    data: { tenantId, scope: 'CHANNEL', channel: 'MODERN_TRADE', productId: chair.id, currency: 'LKR', minQty: 1, price: 18000 }
  });
  await prisma.dispatchSetting.create({ data: { tenantId } });
  const demoKey = 'ncc-demo-sfa-key';
  await prisma.sfaApiKey.create({
    data: {
      tenantId,
      name: 'iForce demo',
      prefix: demoKey.slice(0, 8),
      keyHash: crypto.createHash('sha256').update(demoKey).digest('hex')
    }
  });
  await prisma.$transaction(async (tx) => {
    await postReceiptDocument(tx, {
      tenantId,
      warehouseId: elakanda.id,
      referenceType: 'OPENING',
      referenceId: `${tenantId}-fg`,
      date: new Date(),
      description: 'Finished goods for dispatch',
      creditKey: 'OPENING_EQUITY',
      items: [
        { productId: chair.id, quantity: 12, unitPrice: 9000 },
        { productId: table.id, quantity: 6, unitPrice: 12000 }
      ]
    });
    await postReceiptDocument(tx, {
      tenantId,
      warehouseId: vanStore.id,
      referenceType: 'OPENING',
      referenceId: `${tenantId}-van`,
      date: new Date(),
      description: 'Van stock',
      creditKey: 'OPENING_EQUITY',
      items: [{ productId: chair.id, quantity: 4, unitPrice: 9000 }]
    });
    await postReceiptDocument(tx, {
      tenantId,
      warehouseId: factory.id,
      referenceType: 'OPENING',
      referenceId: `${tenantId}-factory`,
      date: new Date(),
      description: 'Factory cash counter stock',
      creditKey: 'OPENING_EQUITY',
      items: [{ productId: table.id, quantity: 3, unitPrice: 12000 }]
    });
  });
  await prisma.salesOrder.create({
    data: {
      tenantId,
      customerId: hotel.id,
      orderNumber: 'SO/DEMO/00001',
      date: new Date(),
      status: 'PENDING',
      total: 35000,
      channel: 'GENERAL_TRADE',
      routeId: route.id,
      warehouseId: elakanda.id,
      items: {
        create: [{ productId: chair.id, quantity: 2, unitPrice: 17500, total: 35000, listPrice: 17500 }]
      }
    }
  });

  const centers = {};
  for (const [code, name, admin] of [
    ['SOYA', 'Soya Manufacturing', false],
    ['PASTA', 'Pasta Manufacturing', false],
    ['SAUCE', 'Sauce Manufacturing', false],
    ['TURKEY', 'Turkey Import', false],
    ['CONTRACT', 'Contract Manufacturing', false],
    ['ADMIN', 'Administration', true]
  ]) {
    centers[code] = await prisma.orgCenter.create({
      data: { tenantId, code, name, kind: 'BOTH', isAdministration: admin }
    });
  }
  await prisma.financeSetting.create({ data: { tenantId } });
  await prisma.currency.create({
    data: { tenantId, code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 305, isBase: false }
  });
  const adminExpense = await prisma.account.findFirst({ where: { tenantId, code: '5600' } });
  await prisma.allocationRule.create({
    data: {
      tenantId,
      name: 'Administration to operations',
      sourceAccountId: adminExpense.id,
      sourceCenterId: centers.ADMIN.id,
      lines: {
        create: ['SOYA', 'PASTA', 'SAUCE', 'TURKEY', 'CONTRACT'].map((code) => ({
          tenantId, targetCostCenterId: centers[code].id, percent: 20
        }))
      }
    }
  });
  await prisma.capitalProject.create({
    data: { tenantId, code: 'PACK-1', name: 'Packing line', budgetAmount: 2500000, costCenterId: centers.SOYA.id }
  });
  await prisma.budget.create({
    data: { tenantId, kind: 'OPEX', year: new Date().getFullYear(), month: 0, accountId: adminExpense.id, costCenterId: centers.ADMIN.id, amount: 480000 }
  });
  await createContract(prisma, {
    tenantId, supplierId: timber.id, productId: teak.id, unitPrice: 4500, currencyCode: 'LKR', validFrom: '2026-01-01', tolerancePercent: 2
  });
  const rfq = await createRfq(prisma, {
    tenantId, date: new Date(), supplierIds: [timber.id, hardware.id],
    lines: [{ productId: teak.id, quantity: 20 }]
  });
  const low = await addQuotation(prisma, {
    tenantId, rfqId: rfq.id, supplierId: timber.id, date: new Date(), currencyCode: 'LKR', exchangeRate: 1, leadTimeDays: 7,
    lines: [{ productId: teak.id, quantity: 20, unitPrice: 4500 }]
  });
  await addQuotation(prisma, {
    tenantId, rfqId: rfq.id, supplierId: hardware.id, date: new Date(), currencyCode: 'LKR', exchangeRate: 1, leadTimeDays: 10,
    lines: [{ productId: teak.id, quantity: 20, unitPrice: 4900 }]
  });
  await selectQuotation(prisma, { tenantId, rfqId: rfq.id, quotationId: low.id, reason: 'Lower price and the agreed lead time' });
  await prisma.collectionCase.create({
    data: { tenantId, customerId: hotel.id, disputeStatus: 'NONE', promisedDate: new Date('2026-11-20'), notes: 'Will pay after the Galle function', collector: 'Nimal' }
  });
  await prisma.fixedAssetClass.create({
    data: { tenantId, code: 'PLANT', name: 'Plant and machinery', accountingMethod: 'SL', accountingLifeMonths: 60, taxMethod: 'RB', taxRate: 20 }
  });
  await openPeriod(prisma, { tenantId, year: 2026, month: 11 });
  const fund = await openPettyCash(prisma, { tenantId, name: 'Malabe tin', amount: 15000, date: new Date(), custodian: 'Nimal Perera' });
  await issueIou(prisma, { tenantId, date: new Date(), employeeName: 'Kumari Silva', department: 'Assembly', amount: 2500, fundId: fund.id });

  console.log('Demo tenant ready.');
  console.log('  Company   Ceylon Woodworks (Pvt) Ltd');
  console.log(`  Sign in   ${EMAIL}`);
  console.log(`  Password  ${PASSWORD}`);
  console.log('  Stores    MAIN — teak, screws, varnish, fabric, glue');
  console.log('  Buy       reorder teak and screws. Chairs and tables are planned in MRP.');
  console.log('  Make      CHAIR and TABLE, routed across SAW, ASM, and FIN');
  console.log('  Dispatch  Elakanda stock, GT-NORTH, pending hotel order for 2 chairs');
  console.log('  SFA key   ncc-demo-sfa-key');
  console.log('  Make      CHAIR is make-to-stock on the weekly MPS. TABLE is make-to-order.');
  console.log('  Machines  Soya Machine 2, Packeting 2, Pasta 1, Sachet Packet Machine 1');
  console.log('  Contract  SUB-01 virtual warehouse for Elakanda Contract Packers');}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
