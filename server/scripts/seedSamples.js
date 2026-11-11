const { generateDocumentNumber } = require('../src/utils/codeGenerator');
const { postReceiptDocument, postIssueDocument, postGrn, createSupplierInvoice, finalizeSalesInvoice, allocateCustomerReceipt } = require('../src/services/documentPosting');
const { postLandedCost } = require('../src/services/phase2/landedCost');
const { postJournal, ensureGlMap } = require('../src/services/glService');
const { submitForApproval } = require('../src/services/approvalService');
const { postPartyNote, createCheque } = require('../src/services/phase2/treasury');
const { capitalizeAsset, runDepreciation } = require('../src/services/phase2/assets');
const {
  createMaterialRequest,
  approveMaterialRequest,
  buildPickList,
  fulfilMaterialRequest,
  createTransfer,
  shipTransfer,
  createReturn,
  postReturn,
  createCycleCount,
  postApprovedCycleCount
} = require('../src/services/inventory/ops');
const { runMps, createContract } = require('../src/services/production/phase4');
const dispatch = require('../src/services/phase3/dispatch');
const { postCashSale } = require('../src/services/phase3/cashSale');
const { createWorkOrder, createDraftsForSalesOrder } = require('../src/services/production/workOrders');

const TODAY = '2026-11-11';
const APPROVER_EMAIL = 'kamani@ceylonwood.lk';

async function seedControls(prisma, tenantId, makerId, passwordHash) {
  const finance = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'Finance' } }
  });
  await prisma.user.create({
    data: {
      tenantId,
      email: APPROVER_EMAIL,
      passwordHash,
      firstName: 'Kamani',
      lastName: 'Dias',
      roleId: finance.id
    }
  });
  await prisma.approvalRule.updateMany({
    where: { tenantId },
    data: { enabled: true, allowSelfApprove: false }
  });
  const approver = await prisma.user.findFirst({ where: { tenantId, email: APPROVER_EMAIL } });
  await prisma.approvalLevel.updateMany({
    where: { tenantId },
    data: { approverUserId: approver.id }
  });
  await prisma.operationsSetting.upsert({
    where: { tenantId },
    update: { allowNegativeStock: false },
    create: { tenantId, allowNegativeStock: false }
  });
  await prisma.fiscalPeriod.upsert({
    where: { tenantId_year_month: { tenantId, year: 2026, month: 10 } },
    update: { status: 'CLOSED', updatedBy: makerId },
    create: { tenantId, year: 2026, month: 10, status: 'CLOSED', updatedBy: makerId }
  });

  const prNumber = await generateDocumentNumber(tenantId, 'purchaseRequisition', 'PR', 'prNumber');
  const pending = await prisma.purchaseRequisition.create({
    data: {
      tenantId,
      prNumber,
      date: new Date(TODAY),
      status: 'PENDING_APPROVAL',
      total: 9000,
      createdBy: makerId,
      notes: 'Waiting for Kamani to approve the extra teak',
      items: { create: [{ productId: (await prisma.product.findFirst({ where: { tenantId, code: 'TEAK' } })).id, quantity: 2, unitPrice: 4500, total: 9000 }] }
    }
  });
  await submitForApproval(prisma, {
    tenantId,
    documentType: 'PR',
    documentId: pending.id,
    documentNumber: prNumber,
    amount: 9000,
    userId: makerId
  });

  const workOrder = await prisma.workOrder.findFirst({ where: { tenantId, product: { code: 'CHAIR' }, status: 'CREATED' } });
  if (workOrder) {
    const loss = await prisma.abnormalLoss.create({
      data: {
        tenantId,
        workOrderId: workOrder.id,
        productLine: 'Furniture',
        actualScrapPercent: 25,
        standardScrapPercent: 2,
        threshold: 2,
        excessQty: 0.46,
        amount: 4140,
        reason: 'Power cut spoiled a finishing batch',
        status: 'PENDING'
      }
    });
    await submitForApproval(prisma, {
      tenantId,
      documentType: 'ABNORMAL_LOSS',
      documentId: loss.id,
      documentNumber: workOrder.orderNumber,
      amount: 4140,
      userId: makerId
    });
  }
}

async function seedDispatch(db, { tenantId, userId, hotel, chair, finished, van, today }) {
  await db.$transaction((tx) => postReceiptDocument(tx, {
    tenantId, warehouseId: finished.id, referenceType: 'OPENING', referenceId: `${finished.id}-extra`,
    date: today, description: 'Chairs for the Galle run', creditKey: 'OPENING_EQUITY',
    items: [{ productId: chair.id, quantity: 2, unitPrice: 9000, lotNumber: 'CHAIR-RUN' }]
  }));
  await db.$transaction((tx) => postReceiptDocument(tx, {
    tenantId, warehouseId: van.id, referenceType: 'OPENING', referenceId: `${van.id}-load`,
    date: today, description: 'Van load', creditKey: 'OPENING_EQUITY',
    items: [{ productId: chair.id, quantity: 2, unitPrice: 9000, lotNumber: 'CHAIR-VAN' }]
  }));
  const route = await db.deliveryRoute.create({
    data: { tenantId, code: 'GALLE', name: 'Galle fort run', warehouseId: finished.id }
  });
  const vehicle = await db.vehicle.create({
    data: { tenantId, code: 'WP-8841', registration: 'WP CAA-8841', driverName: 'Ranjith Silva', kind: 'TRUCK', routeId: route.id, warehouseId: finished.id }
  });
  const orderNumber = await generateDocumentNumber(tenantId, 'salesOrder', 'SO', 'orderNumber');
  const order = await db.salesOrder.create({
    data: {
      tenantId, customerId: hotel.id, orderNumber, date: today, status: 'PENDING', total: 18500, createdBy: userId,
      channel: 'GENERAL_TRADE', warehouseId: finished.id,
      items: { create: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }] }
    }
  });
  await dispatch.releaseOrder(db, { tenantId, userId, orderId: order.id, warehouseId: finished.id, routeId: route.id, channel: 'GENERAL_TRADE' });
  const pick = await dispatch.createRoutePick(db, {
    tenantId, userId, date: TODAY, warehouseId: finished.id, routeId: route.id, vehicleId: vehicle.id, orderIds: [order.id]
  });
  await dispatch.advancePick(db, { tenantId, pickId: pick.id, action: 'PICK' });
  await dispatch.advancePick(db, { tenantId, pickId: pick.id, action: 'PACK' });
  const notes = await dispatch.createDeliveryNotes(db, { tenantId, userId, pickId: pick.id, date: TODAY });
  const trip = await dispatch.createTrip(db, {
    tenantId, userId, date: TODAY, deliveryIds: notes.map((row) => row.id), vehicleId: vehicle.id, routeId: route.id, driverName: 'Ranjith Silva', pickId: pick.id
  });
  await dispatch.invoiceDeliveries(db, { tenantId, userId, tripId: trip.id, date: TODAY });
  await dispatch.issueGatePass(db, { tenantId, userId, tripId: trip.id, securityName: 'Gate office', loadNote: 'One dining chair' });
  await dispatch.departTrip(db, { tenantId, userId, tripId: trip.id });
  await dispatch.recordProof(db, {
    tenantId, userId, deliveryId: notes[0].id, tripId: trip.id, receivedBy: 'Front desk, Galle Heritage', lines: []
  });
  const openNumber = await generateDocumentNumber(tenantId, 'salesOrder', 'SO', 'orderNumber');
  await db.salesOrder.create({
    data: {
      tenantId, customerId: hotel.id, orderNumber: openNumber, date: today, status: 'PENDING', total: 18500, createdBy: userId,
      channel: 'GENERAL_TRADE',
      items: { create: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }] }
    }
  });
  await postCashSale(db, {
    tenantId, createdBy: userId, customerId: hotel.id, warehouseId: van.id, date: TODAY, saleKind: 'VAN_CASH',
    items: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }]
  });
}

async function seedSamples(prisma, ctx) {
  const { tenantId, userId, warehouse, timber, chair, screw, varnish, table, centers } = ctx;
  const hotel = await prisma.customer.findFirst({ where: { tenantId, code: 'CUS-HOTEL' } });
  const today = new Date(TODAY);

  await prisma.productBrand.create({ data: { tenantId, name: 'Ceylon Teak' } });
  await prisma.productCategory.create({ data: { tenantId, name: 'Furniture' } });
  await prisma.paymentTerm.create({ data: { tenantId, code: 'NET30', name: 'Net 30 days', days: 30, createdBy: userId } });
  await prisma.customerCategory.create({
    data: { tenantId, code: 'HOTEL', name: 'Hotels', creditLimit: 500000, creditPeriod: 30, allowCreditSales: true }
  });
  await prisma.priceList.create({
    data: {
      tenantId, name: 'Trade', currency: 'LKR', isSelling: true, createdBy: userId,
      prices: { create: [{ tenantId, productId: chair.id, price: 18500, createdBy: userId }] }
    }
  });
  await prisma.discountGroup.create({
    data: {
      tenantId, name: 'Trade 5', createdBy: userId,
      discounts: { create: [{ tenantId, productId: chair.id, discountType: 'PERCENTAGE', discountValue: 5, createdBy: userId }] }
    }
  });
  const branch = await prisma.branch.create({ data: { tenantId, code: 'MLB', name: 'Malabe workshop', address: '42 Kaduwela Road, Malabe' } });
  await prisma.unitOfMeasure.create({ data: { tenantId, name: 'Kg' } });
  const finished = await prisma.warehouse.create({
    data: { tenantId, code: 'FG-01', name: 'Finished goods', branchId: branch.id, locationRole: 'STORE' }
  });
  const van = await prisma.warehouse.create({
    data: { tenantId, code: 'VAN-02', name: 'Second van stock', branchId: branch.id, locationRole: 'VIRTUAL', isVirtual: true }
  });
  const cashCustomer = await prisma.customer.create({
    data: { tenantId, code: 'CUS-CASH', name: 'Factory cash counter', creditLimit: 0, creditPeriod: 0, allowCreditSales: false }
  });
  await prisma.companyHoliday.create({
    data: { tenantId, name: 'Independence Day', date: new Date('2026-02-04'), type: 'PUBLIC' }
  });

  await prisma.$transaction(async (tx) => {
    await postReceiptDocument(tx, {
      tenantId,
      warehouseId: finished.id,
      referenceType: 'OPENING',
      referenceId: finished.id,
      date: today,
      description: 'Finished chairs on hand',
      creditKey: 'OPENING_EQUITY',
      items: [{ productId: chair.id, quantity: 3, unitPrice: 9000, lotNumber: 'CHAIR-NOV' }]
    });
  });

  const quoNumber = await generateDocumentNumber(tenantId, 'salesQuotation', 'QUO', 'quotationNumber');
  const quotation = await prisma.salesQuotation.create({
    data: {
      tenantId, customerId: hotel.id, quotationNumber: quoNumber, date: today, status: 'APPROVED', total: 18500, createdBy: userId,
      items: { create: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }] }
    }
  });
  const orderNumber = await generateDocumentNumber(tenantId, 'salesOrder', 'SO', 'orderNumber');
  const order = await prisma.salesOrder.create({
    data: {
      tenantId, customerId: hotel.id, quotationId: quotation.id, orderNumber, date: today, status: 'PENDING', total: 18500, createdBy: userId,
      items: { create: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }] }
    }
  });
  const deliveryNumber = await generateDocumentNumber(tenantId, 'salesDelivery', 'DO', 'deliveryNumber');
  await prisma.$transaction(async (tx) => {
    const delivery = await tx.salesDelivery.create({
      data: {
        tenantId, customerId: hotel.id, orderId: order.id, deliveryNumber, date: today, warehouseId: finished.id, status: 'DELIVERED', createdBy: userId,
        items: { create: [{ productId: chair.id, quantity: 1 }] }
      }
    });
    const saved = await tx.salesDeliveryItem.findMany({ where: { deliveryId: delivery.id } });
    await postIssueDocument(tx, {
      tenantId, warehouseId: finished.id, items: saved, referenceType: 'SALES_DELIVERY', referenceId: delivery.id,
      date: today, createdBy: userId, description: `Delivery ${deliveryNumber}`, quantitySign: -1
    });
    await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'DELIVERED' } });
    const invoiceNumber = await generateDocumentNumber(tenantId, 'salesInvoice', 'INV', 'invoiceNumber', tx);
    const invoice = await tx.salesInvoice.create({
      data: {
        tenantId, customerId: hotel.id, orderId: order.id, deliveryId: delivery.id, invoiceNumber,
        date: today, status: 'UNPAID', total: 18500, subtotal: 18500, createdBy: userId,
        items: { create: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }] }
      }
    });
    await finalizeSalesInvoice(tx, { tenantId, invoiceId: invoice.id, createdBy: userId });
  });

  const cashInvoiceNumber = await generateDocumentNumber(tenantId, 'salesInvoice', 'INV', 'invoiceNumber');
  await prisma.$transaction(async (tx) => {
    await postIssueDocument(tx, {
      tenantId, warehouseId: finished.id, items: [{ productId: chair.id, quantity: 1 }],
      referenceType: 'CASH_SALE', referenceId: cashCustomer.id, date: today, createdBy: userId,
      description: `Cash sale ${cashInvoiceNumber}`, quantitySign: -1
    });
    const invoice = await tx.salesInvoice.create({
      data: {
        tenantId, customerId: cashCustomer.id, invoiceNumber: cashInvoiceNumber, date: today,
        status: 'UNPAID', total: 18500, subtotal: 18500, createdBy: userId,
        items: { create: [{ productId: chair.id, quantity: 1, unitPrice: 18500, total: 18500 }] }
      }
    });
    await finalizeSalesInvoice(tx, { tenantId, invoiceId: invoice.id, createdBy: userId });
    const cash = await tx.account.findFirst({ where: { tenantId, code: '1000' } });
    const receiptNumber = await generateDocumentNumber(tenantId, 'paymentReceipt', 'REC', 'receiptNumber', tx);
    const receipt = await tx.paymentReceipt.create({
      data: {
        tenantId, customerId: cashCustomer.id, receiptNumber, date: today, method: 'CASH', amount: 18500,
        accountId: cash.id, status: 'POSTED', createdBy: userId, invoiceId: invoice.id
      }
    });
    await allocateCustomerReceipt(tx, {
      tenantId, receipt, createdBy: userId, allocations: [{ invoiceId: invoice.id, amount: 18500 }]
    });
  });

  const poNumber = await generateDocumentNumber(tenantId, 'purchaseOrder', 'PO', 'poNumber');
  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId, supplierId: timber.id, poNumber, date: today, status: 'APPROVED', total: 9000, createdBy: userId,
      items: { create: [{ productId: varnish.id, quantity: 2, unitPrice: 1800, total: 3600 }] }
    }
  });
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { total: 3600 } });
  const grnNumber = await generateDocumentNumber(tenantId, 'gRN', 'GRN', 'grnNumber');
  await prisma.$transaction(async (tx) => {
    const grn = await tx.gRN.create({
      data: {
        tenantId, supplierId: timber.id, poId: po.id, grnNumber, date: today, warehouseId: warehouse.id,
        status: 'RECEIVED', createdBy: userId,
        items: { create: [{ productId: varnish.id, quantityReceived: 2, quantityOrdered: 2, unitPrice: 1800, lotNumber: 'VARN-NOV' }] }
      },
      include: { items: true }
    });
    await postGrn(tx, { tenantId, grn, items: grn.items, createdBy: userId });
    await postLandedCost(tx, {
      tenantId, grnId: grn.id, date: TODAY, basis: 'VALUE', createdBy: userId,
      charges: [{ kind: 'FREIGHT', amount: 400, reference: 'Homagama lorry' }]
    });
    await createSupplierInvoice(tx, {
      tenantId, supplierId: timber.id, poId: po.id, grnId: grn.id, date: TODAY,
      supplierReference: 'KT-2201', createdBy: userId,
      items: [{ productId: varnish.id, quantity: 2, unitPrice: 1800 }]
    });
  });

  const mr = await prisma.$transaction((tx) => createMaterialRequest(tx, {
    tenantId, date: TODAY, requestingParty: 'Assembly', sourceWarehouseId: warehouse.id, kind: 'ISSUE',
    purpose: 'Screws for the dining chair', requiredDate: TODAY, createdBy: userId,
    items: [{ productId: screw.id, quantity: 8 }]
  }));
  await prisma.$transaction(async (tx) => {
    await approveMaterialRequest(tx, { tenantId, id: mr.id, userId });
    await buildPickList(tx, { tenantId, id: mr.id });
    await fulfilMaterialRequest(tx, { tenantId, id: mr.id, userId, lines: [{ productId: screw.id, quantity: 8 }] });
  });

  await prisma.$transaction(async (tx) => {
    const transfer = await createTransfer(tx, {
      tenantId, date: TODAY, fromWarehouseId: warehouse.id, toWarehouseId: finished.id, mode: 'IN_TRANSIT',
      createdBy: userId, items: [{ productId: varnish.id, quantity: 1 }]
    });
    await shipTransfer(tx, { tenantId, id: transfer.id, createdBy: userId, mode: 'IN_TRANSIT' });
  });

  await prisma.$transaction(async (tx) => {
    const customerReturn = await createReturn(tx, {
      tenantId, date: TODAY, kind: 'GRA', warehouseId: finished.id, customerId: hotel.id, createdBy: userId,
      items: [{ productId: chair.id, quantity: 1, reason: 'Finish not accepted', unitCost: 9000 }]
    });
    await postReturn(tx, { tenantId, id: customerReturn.id, createdBy: userId });
    const supplierReturn = await createReturn(tx, {
      tenantId, date: TODAY, kind: 'SUPPLIER', warehouseId: warehouse.id, supplierId: timber.id, createdBy: userId,
      items: [{ productId: varnish.id, quantity: 1, reason: 'Tin leaked', unitCost: 1800 }]
    });
    await postReturn(tx, { tenantId, id: supplierReturn.id, createdBy: userId });
  });

  const count = await prisma.$transaction((tx) => createCycleCount(tx, {
    tenantId, warehouseId: warehouse.id, date: TODAY, kind: 'CYCLE', createdBy: userId,
    lines: [{ productId: screw.id, countQty: 70, reason: 'Two boxes short on the rack' }]
  }));
  await prisma.$transaction((tx) => postApprovedCycleCount(tx, { tenantId, id: count.id, createdBy: userId }));

  await runMps({ tenantId, userId, horizonWeeks: 4 });
  await createWorkOrder(tenantId, userId, {
    productId: chair.id, quantity: 2, warehouseId: warehouse.id, status: 'CREATED', issueMode: 'MANUAL', startDate: TODAY,
    costCenterId: centers.SOYA.id, notes: 'Weekly chair batch'
  });
  const mtoNumber = await generateDocumentNumber(tenantId, 'salesOrder', 'SO', 'orderNumber');
  const mto = await prisma.salesOrder.create({
    data: {
      tenantId, customerId: hotel.id, orderNumber: mtoNumber, date: today, status: 'PENDING', total: 24000, createdBy: userId,
      items: { create: [{ productId: table.id, quantity: 1, unitPrice: 24000, total: 24000 }] }
    },
    include: { items: true }
  });
  await createDraftsForSalesOrder({ tenantId, userId, salesOrderId: mto.id });

  const packer = await prisma.supplier.findFirst({ where: { tenantId, code: 'SUP-CM' } });
  const virtual = await prisma.warehouse.findFirst({ where: { tenantId, code: 'SUB-01' } });
  await createContract(tenantId, userId, {
    supplierId: packer.id, virtualWarehouseId: virtual.id, fgWarehouseId: finished.id,
    productId: chair.id, quantity: 2, serviceCharge: 1500, costCenterId: centers.CONTRACT.id
  });

  await prisma.$transaction((tx) => postPartyNote(tx, {
    tenantId, partyType: 'CUSTOMER', partyId: hotel.id, kind: 'CREDIT', date: TODAY,
    reasonCode: 'RETURN', subtotal: 1000, taxAmount: 0, createdBy: userId
  }));
  await prisma.$transaction((tx) => createCheque(tx, {
    tenantId, direction: 'IN', chequeNumber: 'CHQ-4401', chequeDate: TODAY, payee: 'Ceylon Woodworks',
    amount: 18500, createdBy: userId, customerId: hotel.id
  }));

  const project = await prisma.capitalProject.findFirst({ where: { tenantId, code: 'PACK-1' } });
  const bank = await prisma.account.findFirst({ where: { tenantId, code: '1010' } });
  const map = await ensureGlMap(prisma, tenantId, userId);
  await prisma.$transaction(async (tx) => {
    await postJournal(tx, {
      tenantId, date: today, createdBy: userId, description: 'Packing line deposit to CWIP',
      referenceType: 'CWIP', referenceId: project.id,
      lines: [
        { accountId: map.CWIP, debit: 180000, credit: 0, costCenterId: centers.SOYA.id, description: 'PACK-1' },
        { accountId: bank.id, debit: 0, credit: 180000, description: 'PACK-1' }
      ]
    });
    const asset = await tx.fixedAsset.create({
      data: {
        tenantId, code: 'CWIP-PACK', name: 'Packing line', status: 'CWIP', acquiredOn: today,
        cost: 180000, cwipBalance: 180000, accountingNbv: 180000, taxNbv: 180000,
        costCenterId: centers.SOYA.id, capitalProjectId: project.id, createdBy: userId
      }
    });
    const assetClass = await tx.fixedAssetClass.findFirst({ where: { tenantId, code: 'PLANT' } });
    await capitalizeAsset(tx, { tenantId, assetId: asset.id, classId: assetClass.id, date: TODAY, createdBy: userId, name: 'Packing line' });
    await runDepreciation(tx, { tenantId, year: 2026, month: 11, createdBy: userId });
  });

  await seedDispatch(prisma, { tenantId, userId, hotel, chair, finished, van, today });

  await prisma.bankReconciliation.create({
    data: {
      tenantId, accountId: bank.id, startDate: new Date('2026-11-01'), endDate: today,
      statementClosingBalance: 0, ledgerClosingBalance: 0, status: 'DRAFT', createdBy: userId,
      statementLines: {
        create: [{ tenantId, accountId: bank.id, date: today, description: 'Packing line transfer', amount: -180000, reference: 'PACK-1' }]
      }
    }
  });
}

module.exports = { seedControls, seedSamples, APPROVER_EMAIL };
