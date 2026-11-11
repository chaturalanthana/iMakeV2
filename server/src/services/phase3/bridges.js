const { DocumentError } = require('../errors');

function optional(path) {
  try {
    return require(path);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }
}

async function assertPeriodOpen(db, args) {
  const period = optional('../periodService');
  if (period?.assertPeriodOpen) await period.assertPeriodOpen(db, args);
}

async function submitApproval(db, args) {
  const approval = optional('../approvalService');
  if (!approval?.submitForApproval || !db.approvalRequest) return null;
  return approval.submitForApproval(db, args);
}

function allocationApi() {
  return optional('../inventory/allocations');
}

function positionApi() {
  return optional('../inventory/positions');
}

function inventoryOps() {
  return optional('../inventory/ops');
}

function treasuryApi() {
  return optional('../phase2/treasury');
}

function assertStockCovered(posted) {
  for (const result of posted?.results || []) {
    if ((result.consumptions || []).some((row) => row.unlayered)) {
      throw new DocumentError('Not enough stock for this quantity.', {
        quantity: 'Not enough stock for this quantity.'
      });
    }
  }
}

module.exports = {
  assertPeriodOpen,
  submitApproval,
  allocationApi,
  positionApi,
  inventoryOps,
  treasuryApi,
  assertStockCovered
};
