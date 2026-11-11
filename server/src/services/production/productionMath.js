const round4 = (value) => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;

const num = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function weekStart(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc;
}

function addDays(value, days) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weekKey(value) {
  const start = weekStart(value);
  return start ? start.toISOString().slice(0, 10) : '';
}

function applyLot(raw, policy, fixedLotQty, minLotQty) {
  const qty = round4(Math.max(0, num(raw)));
  if (!(qty > 0)) return 0;
  if (policy === 'FIXED') {
    const lot = num(fixedLotQty);
    if (!(lot > 0)) return qty;
    return round4(Math.ceil((qty - 1e-9) / lot) * lot);
  }
  if (policy === 'MINIMUM') return round4(Math.max(qty, num(minLotQty)));
  return qty;
}

// Projected on-hand is the prior balance plus receipts minus the greater of
// forecast and booked orders. A planned order is raised when that balance
// falls below zero or the safety-stock threshold, sized up to the stock target.
function planItem({
  opening,
  buckets,
  safetyStock = 0,
  stockTarget = 0,
  lotPolicy = 'LOT_FOR_LOT',
  fixedLotQty = 0,
  minLotQty = 0,
  leadDays = 0
}) {
  let prior = round4(num(opening));
  const safety = Math.max(0, num(safetyStock));
  const targetLevel = Math.max(safety, num(stockTarget), 0);
  const plannedOrders = [];
  const rows = (buckets || []).map((bucket) => {
    const forecast = round4(Math.max(0, num(bucket.forecast)));
    const orders = round4(Math.max(0, num(bucket.orders)));
    const demand = round4(Math.max(forecast, orders));
    const receipts = round4(Math.max(0, num(bucket.receipts)));
    let projected = round4(prior + receipts - demand);
    let plannedQty = 0;
    if (projected < safety - 0.0000001) {
      plannedQty = applyLot(targetLevel - projected, lotPolicy, fixedLotQty, minLotQty);
      projected = round4(projected + plannedQty);
      const due = new Date(bucket.weekStart);
      plannedOrders.push({
        weekStart: due,
        quantity: plannedQty,
        dueDate: due,
        startDate: addDays(due, -Math.max(0, parseInt(leadDays, 10) || 0))
      });
    }
    const row = {
      weekStart: bucket.weekStart,
      opening: prior,
      forecast,
      orders,
      demand,
      receipts,
      safetyStock: safety,
      stockTarget: round4(num(stockTarget)),
      plannedQty,
      projected
    };
    prior = projected;
    return row;
  });
  return { buckets: rows, plannedOrders };
}

function lineStandard(product = {}, group = null, settings = {}) {
  const scrap = num(product.scrapPercent) > 0
    ? num(product.scrapPercent)
    : num(group?.standardScrapPercent ?? settings.defaultScrapPercent ?? 2);
  const yieldPercent = num(product.standardYieldPercent) > 0 && num(product.standardYieldPercent) !== 100
    ? num(product.standardYieldPercent)
    : num(group?.standardYieldPercent ?? settings.defaultYieldPercent ?? 98);
  const productThreshold = num(product.abnormalLossThreshold);
  const settingsThreshold = num(settings.abnormalLossThreshold ?? 2);
  const threshold = group && Math.abs(productThreshold - settingsThreshold) < 0.0001
    ? num(group.abnormalLossThreshold)
    : productThreshold || settingsThreshold;
  return {
    scrapPercent: round4(scrap),
    yieldPercent: round4(yieldPercent || 100),
    threshold: round4(threshold)
  };
}

function abnormalLoss({ good, scrap, standardScrapPercent, threshold }) {
  const throughput = round4(num(good) + num(scrap));
  if (!(throughput > 0)) return null;
  const actual = round4(num(scrap) / throughput * 100);
  const standard = round4(num(standardScrapPercent));
  const limit = round4(num(threshold));
  const excessPoints = round4(actual - standard);
  if (excessPoints <= limit + 0.0000001) return null;
  return {
    actualScrapPercent: actual,
    standardScrapPercent: standard,
    threshold: limit,
    excessQty: round4((excessPoints / 100) * throughput)
  };
}

function yieldPercents({ input, output, wastage }) {
  const base = num(input);
  return {
    yieldPercent: base > 0 ? round4(num(output) / base * 100) : 0,
    wastagePercent: base > 0 ? round4(num(wastage) / base * 100) : 0
  };
}

function substitutionDelta({ actualCost, standardUnitCost, componentQty }) {
  return round4(num(actualCost) - num(standardUnitCost) * num(componentQty));
}

function stageCompletion(operations) {
  const ops = [...(operations || [])].sort((a, b) => num(a.sequence) - num(b.sequence));
  if (!ops.length) return { percent: 0, stage: 'Not started' };
  const explicit = ops.some((op) => num(op.milestoneWeight) > 0);
  const weights = ops.map((op) => (explicit ? num(op.milestoneWeight) : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let done = 0;
  ops.forEach((op, index) => {
    if (op.status === 'COMPLETE') done += weights[index];
  });
  const open = ops.find((op) => op.status !== 'COMPLETE');
  return {
    percent: round4(done / total * 100),
    stage: open ? open.name : ops[ops.length - 1].name
  };
}

function absorbCosts({
  labourMinutes = 0,
  machineMinutes = 0,
  units = 0,
  labourRatePerHour = 0,
  machineRatePerHour = 0,
  subcontractCost = 0,
  overheadPercent = 0,
  overheadRate = 0,
  labourBase = 'PER_LABOUR_HOUR',
  overheadBase = 'PERCENT_OF_CONVERSION'
}) {
  const labourHours = num(labourMinutes) / 60;
  const machineHours = num(machineMinutes) / 60;
  const labourCost = labourBase === 'PER_UNIT'
    ? round4(num(units) * num(labourRatePerHour))
    : round4(labourHours * num(labourRatePerHour));
  const machineCost = round4(machineHours * num(machineRatePerHour));
  const conversion = round4(labourCost + machineCost + num(subcontractCost));
  let overheadCost = round4(conversion * num(overheadPercent) / 100);
  if (overheadBase === 'PER_LABOUR_HOUR') overheadCost = round4(labourHours * num(overheadRate));
  if (overheadBase === 'PER_MACHINE_HOUR') overheadCost = round4(machineHours * num(overheadRate));
  if (overheadBase === 'PER_UNIT') overheadCost = round4(num(units) * num(overheadRate));
  return { labourCost, machineCost, overheadCost };
}

function absorptionVariance(absorbed, actual) {
  return round4(num(actual) - num(absorbed));
}

const CONFIRMED_DEFAULTS = [
  { id: 'PD-02-bucket', name: 'MPS bucket', value: 'Calendar week starting Monday' },
  { id: 'PD-02-netting', name: 'Demand netting', value: 'Greater of forecast and booked sales orders' },
  { id: 'PD-02-trigger', name: 'Planned order trigger', value: 'Projected on-hand below zero or safety stock' },
  { id: 'PD-02-target', name: 'Stock target', value: 'Planned quantity refills up to the stock target, or safety stock when the target is lower' },
  { id: 'PD-02-lot', name: 'Lot policy', value: 'Lot for lot' },
  { id: 'PD-02-lead', name: 'Manufacturing lead time', value: '1 day, subtracted from the bucket start' },
  { id: 'PD-02-horizon', name: 'Planning horizon', value: '8 weeks' },
  { id: 'PD-01-policy', name: 'Planning policy', value: 'Make to order, so each short sales line still raises a draft work order' },
  { id: 'D-07-yield', name: 'Standard yield', value: '98% on the product line; the item yield is used when it is not 100%' },
  { id: 'D-07-scrap', name: 'Standard scrap', value: '2% on the product line; the item scrap % is used when it is set' },
  { id: 'D-07-loss', name: 'Abnormal loss threshold', value: '2 percentage points above standard scrap' },
  { id: 'D-07-weights', name: 'Milestone weights', value: 'Equal weight per operation until a weight is entered' },
  { id: 'D-07-labour', name: 'Labour absorption base', value: 'Per labour hour at the tenant labour rate' },
  { id: 'D-07-overhead', name: 'Overhead absorption base', value: 'Percent of labour, machine and subcontract (tenant overhead percent, default 10)' },
  { id: 'PD-05-grace', name: 'Auto-close grace', value: '3 days after technical completion' },
  { id: 'PD-06-payroll', name: 'Payroll actuals', value: 'Imported payroll journal, because payroll is outside NCC scope' }
];

module.exports = {
  round4,
  num,
  weekStart,
  addDays,
  weekKey,
  applyLot,
  planItem,
  lineStandard,
  abnormalLoss,
  yieldPercents,
  substitutionDelta,
  stageCompletion,
  absorbCosts,
  absorptionVariance,
  CONFIRMED_DEFAULTS
};
