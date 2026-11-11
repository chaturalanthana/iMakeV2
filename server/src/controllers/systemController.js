const prisma = require('../lib/prisma');
const { hasFullAccess, seedTenantRoles } = require('../permissions/catalog');
const { seedTenantFinance } = require('../services/glService');
const { ensureDefaultRules } = require('../services/approvalService');
const { ensureProductTypes } = require('../services/productTypes');
const { ensureReasonCodes } = require('../services/production/workOrders');

const safeDelete = async (model, query) => {
  if (model && typeof model.deleteMany === 'function') {
    try {
      await model.deleteMany({ where: query });
    } catch (e) {
      console.warn('Safe delete warning:', e.message);
    }
  }
};

const flushSystemData = async (req, res) => {
  try {
    const { tenantId, userId } = req.user;

    // Verify requesting user
    const caller = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { role: true }
    });

    if (!caller) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Only Admin or Super Admin user can perform System Data Flush
    const isSuperAdmin = caller.role && (caller.role.name === 'Super Admin' || hasFullAccess(caller.role));
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: Only an Admin user can perform a System Data Flush.' });
    }

    const where = { tenantId };

    // 1. Flush delivery, dispatch, sales routes & tracking
    await safeDelete(prisma.proofLine, where);
    await safeDelete(prisma.proofOfDelivery, where);
    await safeDelete(prisma.salesReturnLine, where);
    await safeDelete(prisma.salesReturn, where);
    await safeDelete(prisma.gatePass, where);
    await safeDelete(prisma.tripDelivery, where);
    await safeDelete(prisma.tripSheet, where);
    await safeDelete(prisma.routePickLine, where);
    await safeDelete(prisma.routePickOrder, where);
    await safeDelete(prisma.routePick, where);
    await safeDelete(prisma.salesReservation, where);
    await safeDelete(prisma.orderCancellation, where);
    await safeDelete(prisma.customerPrice, where);
    await safeDelete(prisma.appNotification, where);
    await safeDelete(prisma.bankFileExport, where);
    await safeDelete(prisma.bankFileTemplate, where);
    await safeDelete(prisma.batchGenealogy, where);
    await safeDelete(prisma.machineCapture, where);
    await safeDelete(prisma.abnormalLoss, where);
    await safeDelete(prisma.contractIssue, where);
    await safeDelete(prisma.contractOrder, where);
    await safeDelete(prisma.plannedProductionOrder, where);
    await safeDelete(prisma.mpsBucket, where);
    await safeDelete(prisma.mpsRun, where);
    await safeDelete(prisma.demandForecast, where);
    await safeDelete(prisma.bomAlternate, where);
    await safeDelete(prisma.payrollImport, where);
    await safeDelete(prisma.overheadReconciliation, where);
    await safeDelete(prisma.depreciationLine, where);
    await safeDelete(prisma.assetEvent, where);
    await safeDelete(prisma.depreciationRun, where);
    await safeDelete(prisma.fixedAsset, where);
    await safeDelete(prisma.fixedAssetClass, where);
    await safeDelete(prisma.landedCostAllocation, where);
    await safeDelete(prisma.landedCostCharge, where);
    await safeDelete(prisma.landedCost, where);
    await safeDelete(prisma.iouSettlement, where);
    await safeDelete(prisma.iouAdvance, where);
    await safeDelete(prisma.pettyCashFund, where);
    await safeDelete(prisma.cheque, where);
    await safeDelete(prisma.collectionActivity, where);
    await safeDelete(prisma.collectionCase, where);
    await safeDelete(prisma.partyNote, where);
    await safeDelete(prisma.quotationSelection, where);
    await safeDelete(prisma.supplierQuotationLine, where);
    await safeDelete(prisma.supplierQuotation, where);
    await safeDelete(prisma.rfqInvitation, where);
    await safeDelete(prisma.rfqLine, where);
    await safeDelete(prisma.requestForQuotation, where);
    await safeDelete(prisma.priceException, where);
    await safeDelete(prisma.contractPrice, where);
    await safeDelete(prisma.approvedSupplierItem, where);
    await safeDelete(prisma.tradeProfile, where);
    await safeDelete(prisma.purchaseClassification, where);
    await safeDelete(prisma.documentDimension, where);
    await safeDelete(prisma.itemMeasure, where);
    await safeDelete(prisma.allocationRuleLine, where);
    await safeDelete(prisma.allocationRule, where);
    await safeDelete(prisma.budget, where);
    await safeDelete(prisma.capitalProject, where);
    await safeDelete(prisma.orgCenter, where);
    await safeDelete(prisma.financeSetting, where);
    await safeDelete(prisma.periodCloseStep, where);
    await safeDelete(prisma.periodClose, where);
    await safeDelete(prisma.recurringJournal, where);
    await safeDelete(prisma.qaRetest, where);
    await safeDelete(prisma.cycleCountLine, where);
    await safeDelete(prisma.cycleCount, where);
    await safeDelete(prisma.stockReturnItem, where);
    await safeDelete(prisma.stockReturn, where);
    await safeDelete(prisma.inventoryTransferLeg, where);
    await safeDelete(prisma.inventoryTransferItem, where);
    await safeDelete(prisma.inventoryTransfer, where);
    await safeDelete(prisma.pickListLine, where);
    await safeDelete(prisma.pickList, where);
    await safeDelete(prisma.materialRequestItem, where);
    await safeDelete(prisma.materialRequest, where);
    await safeDelete(prisma.stockAllocation, where);
    await safeDelete(prisma.replenishmentLine, where);
    await safeDelete(prisma.replenishmentRun, where);
    await safeDelete(prisma.itemWarehousePolicy, where);
    await safeDelete(prisma.operationsSetting, where);
    await safeDelete(prisma.statutorySetting, where);
    await safeDelete(prisma.whtCertificate, where);

    // Salary runs and lines
    try {
      const runs = await prisma.salaryRun.findMany({ where, select: { id: true } });
      if (runs.length) {
        const lines = await prisma.salaryRunLine.findMany({
          where: { runId: { in: runs.map((r) => r.id) } },
          select: { id: true }
        });
        const lineIds = lines.map((l) => l.id);
        if (lineIds.length) {
          await safeDelete(prisma.salaryRunAddition, { lineId: { in: lineIds } });
          await safeDelete(prisma.salaryRunDeduction, { lineId: { in: lineIds } });
          await safeDelete(prisma.salaryRunLine, { id: { in: lineIds } });
        }
        await safeDelete(prisma.salaryRun, where);
      }
    } catch (e) {
      console.warn('Salary flush warning:', e.message);
    }

    // HR & Employee balances
    await safeDelete(prisma.loanInstallment, { loan: { tenantId } });
    await safeDelete(prisma.employeeLoan, where);
    await safeDelete(prisma.leaveApplication, where);
    await safeDelete(prisma.employeeLeaveBalance, { employee: { tenantId } });
    await safeDelete(prisma.employee, where);
    await safeDelete(prisma.leaveType, where);
    await safeDelete(prisma.hrAddition, where);
    await safeDelete(prisma.hrDeduction, where);

    // Approvals & Audit logs
    await safeDelete(prisma.approvalAction, where);
    await safeDelete(prisma.approvalRequest, where);
    await safeDelete(prisma.approvalLevel, where);
    await safeDelete(prisma.approvalRule, where);
    await safeDelete(prisma.auditLog, where);

    // Finance & General Ledger
    await safeDelete(prisma.journalLine, { journalEntry: where });
    await safeDelete(prisma.journalEntry, where);
    await safeDelete(prisma.glAccountMap, where);

    // Manufacturing / Work Orders
    await safeDelete(prisma.workOrderIssue, where);
    await safeDelete(prisma.workOrderConfirmation, where);
    await safeDelete(prisma.materialReservation, where);
    await safeDelete(prisma.operationTimeLog, where);
    await safeDelete(prisma.workOrderOperation, where);
    await safeDelete(prisma.workOrderComponent, where);
    await safeDelete(prisma.workOrder, where);
    await safeDelete(prisma.routingOperation, where);
    await safeDelete(prisma.routing, where);
    await safeDelete(prisma.bOMItem, where);
    await safeDelete(prisma.bOMResource, where);
    await safeDelete(prisma.bOM, where);
    await safeDelete(prisma.productionJob, where);
    await safeDelete(prisma.productionOrder, where);
    await safeDelete(prisma.productionCalendarEvent, where);
    await safeDelete(prisma.shiftPattern, where);
    await safeDelete(prisma.reasonCode, where);
    await safeDelete(prisma.productionSetting, where);

    // Inventory & Warehousing
    await safeDelete(prisma.costLayer, where);
    await safeDelete(prisma.stockMovement, where);
    await safeDelete(prisma.stockBatch, where);
    await safeDelete(prisma.pallet, where);

    // Purchasing & Invoicing
    await safeDelete(prisma.supplierPaymentAllocation, where);
    await safeDelete(prisma.supplierInvoiceItem, { supplierInvoice: where });
    await safeDelete(prisma.supplierInvoice, where);
    await safeDelete(prisma.paymentVoucherLine, { voucher: where });
    await safeDelete(prisma.paymentVoucher, where);
    await safeDelete(prisma.paymentReceiptLine, { receipt: where });
    await safeDelete(prisma.paymentReceipt, where);
    await safeDelete(prisma.salesInvoiceItem, { invoice: where });
    await safeDelete(prisma.salesInvoice, where);
    await safeDelete(prisma.salesDeliveryItem, { delivery: where });
    await safeDelete(prisma.salesDelivery, where);
    await safeDelete(prisma.salesOrderItem, { order: where });
    await safeDelete(prisma.salesOrder, where);
    await safeDelete(prisma.vehicle, where);
    await safeDelete(prisma.shipTo, where);
    await safeDelete(prisma.deliveryRoute, where);
    await safeDelete(prisma.dispatchSetting, where);
    await safeDelete(prisma.salesQuotationItem, { quotation: where });
    await safeDelete(prisma.salesQuotation, where);
    await safeDelete(prisma.gRNItem, { grn: where });
    await safeDelete(prisma.gRN, where);
    await safeDelete(prisma.purchaseOrderItem, { purchaseOrder: where });
    await safeDelete(prisma.purchaseOrder, where);
    await safeDelete(prisma.purchaseRequisitionItem, { purchaseRequisition: where });
    await safeDelete(prisma.purchaseRequisition, where);
    await safeDelete(prisma.stockReceiptItem, { stockReceipt: where });
    await safeDelete(prisma.stockReceipt, where);
    await safeDelete(prisma.stockTransferItem, { stockTransfer: where });
    await safeDelete(prisma.stockTransfer, where);
    await safeDelete(prisma.stockAdjustmentItem, { stockAdjustment: where });
    await safeDelete(prisma.stockAdjustment, where);
    await safeDelete(prisma.goodsIssueItem, { goodsIssue: where });
    await safeDelete(prisma.goodsIssue, where);

    // Taxes
    await safeDelete(prisma.purchaseWithholdingTaxSlab, where);
    await safeDelete(prisma.purchaseWithholdingTaxGroup, where);
    await safeDelete(prisma.purchaseTaxSlab, where);
    await safeDelete(prisma.purchaseTaxGroup, where);
    await safeDelete(prisma.taxSlab, where);
    await safeDelete(prisma.taxGroup, where);

    // Bank Reconciliations
    await safeDelete(prisma.bankReconciliationMatch, where);
    await safeDelete(prisma.bankStatementLine, where);
    await safeDelete(prisma.bankReconciliation, where);

    // Accounts
    await safeDelete(prisma.account, where);

    // Master Registries
    await safeDelete(prisma.itemSupplier, where);
    await safeDelete(prisma.product, where);
    await safeDelete(prisma.productGroup, where);
    await safeDelete(prisma.priceListPrice, where);
    await safeDelete(prisma.priceList, where);
    await safeDelete(prisma.discountGroupProduct, where);
    await safeDelete(prisma.discountGroup, where);
    await safeDelete(prisma.customerCategory, where);
    await safeDelete(prisma.paymentTerm, where);
    await safeDelete(prisma.productBrand, where);
    await safeDelete(prisma.productCategory, where);
    await safeDelete(prisma.bin, where);
    await safeDelete(prisma.machineThroughput, where);
    await safeDelete(prisma.workstation, where);
    await safeDelete(prisma.machine, where);
    await safeDelete(prisma.customer, where);
    await safeDelete(prisma.supplier, where);
    await safeDelete(prisma.warehouse, where);
    await safeDelete(prisma.branch, where);
    await safeDelete(prisma.uomTemplateLine, where);
    await safeDelete(prisma.uomTemplate, where);
    await safeDelete(prisma.unitOfMeasure, where);
    await safeDelete(prisma.productType, where);
    await safeDelete(prisma.currency, where);
    await safeDelete(prisma.companyHoliday, where);
    await safeDelete(prisma.fiscalPeriod, where);

    // 2. USERS: Keep only the caller's Admin user account!
    // Delete preferences of all other users
    await safeDelete(prisma.userPreference, {
      tenantId,
      userId: { not: caller.id }
    });

    // Delete all other users
    await safeDelete(prisma.user, {
      tenantId,
      id: { not: caller.id }
    });

    // 3. Ensure baseline roles & ensure Admin user is attached to Super Admin
    await seedTenantRoles(prisma, tenantId);
    const superAdminRole = await prisma.role.findFirst({
      where: { tenantId, name: 'Super Admin' }
    });

    if (superAdminRole) {
      await prisma.user.update({
        where: { id: caller.id },
        data: { roleId: superAdminRole.id, status: 'ACTIVE' }
      });
    }

    // Clean up any extra custom unused roles that aren't the standard roles or caller's role
    const standardRoleNames = ['Super Admin', 'Sales', 'Procurement', 'Warehouse', 'Production', 'Finance', 'Human Resources'];
    await safeDelete(prisma.role, {
      tenantId,
      name: { notIn: standardRoleNames },
      id: { not: caller.roleId }
    });

    // 4. Re-seed essential defaults so the system is ready and fresh
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const baseCurrency = tenant?.currency || 'LKR';
    await seedTenantFinance(prisma, tenantId, baseCurrency);
    await ensureReasonCodes(prisma, tenantId);
    await ensureProductTypes(prisma, tenantId);
    await ensureDefaultRules(prisma, tenantId);

    // 5. Create audit record for the flush
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: caller.id,
        action: 'SYSTEM_DATA_FLUSH',
        entity: 'SYSTEM',
        entityId: tenantId,
        after: {
          message: 'System data flush completed. Only admin account retained.',
          keptUser: {
            id: caller.id,
            email: caller.email,
            name: `${caller.firstName || ''} ${caller.lastName || ''}`.trim() || caller.email
          },
          flushedAt: new Date().toISOString()
        }
      }
    });

    return res.json({
      success: true,
      message: 'System data flushed successfully. All demo and operational data removed. Retained only the Admin user account.',
      keptUser: {
        id: caller.id,
        email: caller.email
      }
    });
  } catch (error) {
    console.error('System Data Flush Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to flush system data' });
  }
};

module.exports = {
  flushSystemData
};
