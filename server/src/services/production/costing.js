const round4 = (value) => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;

const num = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Standard cost wins when it is set. Otherwise use the next FIFO layer (oldest open
// layer), then the latest receipt, then the product cost price.
function materialUnitCost({ standardCost = 0, fifoUnitCost = 0, lastReceiptCost = 0, costPrice = 0 }) {
  if (num(standardCost) > 0) return { unitCost: round4(standardCost), costSource: 'STANDARD' };
  if (num(fifoUnitCost) > 0) return { unitCost: round4(fifoUnitCost), costSource: 'FIFO' };
  if (num(lastReceiptCost) > 0) return { unitCost: round4(lastReceiptCost), costSource: 'LAST_RECEIPT' };
  return { unitCost: round4(Math.max(0, num(costPrice))), costSource: 'COST_PRICE' };
}

function rollupCost({ quantity, components = [], operations = [], labourRatePerHour = 0, overheadPercent = 0 }) {
  const qty = Math.max(0, num(quantity));
  let material = 0;
  let scrap = 0;
  const componentLines = components.map((component) => {
    const per = num(component.quantityPer);
    const scrapPct = Math.max(0, num(component.scrapPercent));
    const unit = num(component.unitCost);
    const netQty = round4(per * qty);
    const scrapQty = round4(per * qty * (scrapPct / 100));
    const materialCost = round4(netQty * unit);
    const scrapCost = round4(scrapQty * unit);
    material += materialCost;
    scrap += scrapCost;
    return {
      productId: component.productId,
      quantityPer: per,
      scrapPercent: scrapPct,
      unitCost: unit,
      costSource: component.costSource || null,
      netQty,
      scrapQty,
      requiredQty: round4(netQty + scrapQty),
      materialCost,
      scrapCost
    };
  });

  let labour = 0;
  let machine = 0;
  let subcontract = 0;
  const operationLines = operations.map((operation) => {
    const setupHours = num(operation.setupMinutes) / 60;
    const runHours = (num(operation.runMinutesPerUnit) * qty) / 60;
    const workers = num(operation.noOfWorkers) > 0 ? num(operation.noOfWorkers) : 1;
    const machineCost = round4((setupHours + runHours) * num(operation.machineRatePerHour));
    const labourCost = round4((setupHours + runHours) * workers * num(labourRatePerHour));
    const subcontractCost = operation.isSubcontract
      ? round4(num(operation.subcontractCostPerUnit) * qty)
      : 0;
    labour += labourCost;
    machine += machineCost;
    subcontract += subcontractCost;
    return {
      sequence: operation.sequence,
      name: operation.name,
      setupHours: round4(setupHours),
      runHours: round4(runHours),
      machineCost,
      labourCost,
      subcontractCost
    };
  });

  const overhead = round4((labour + machine + subcontract) * num(overheadPercent) / 100);
  const total = round4(material + scrap + labour + machine + subcontract + overhead);
  return {
    quantity: qty,
    material: round4(material),
    scrap: round4(scrap),
    labour: round4(labour),
    machine: round4(machine),
    subcontract: round4(subcontract),
    overhead,
    total,
    unitCost: qty > 0 ? round4(total / qty) : 0,
    components: componentLines,
    operations: operationLines
  };
}

// BOM scrap allowance is the scrap% share of the issue. Confirmed scrap takes that
// same share of the remaining (good) component cost. The rest is material.
function splitIssueCost(issueCost, scrapPercent, yieldQty, scrapQty) {
  const cost = round4(issueCost);
  const allowanceShare = num(scrapPercent) > 0 ? num(scrapPercent) / (100 + num(scrapPercent)) : 0;
  const allowance = round4(cost * allowanceShare);
  const base = round4(cost - allowance);
  const denom = num(yieldQty) + num(scrapQty);
  const fgScrapShare = denom > 0 ? num(scrapQty) / denom : 0;
  const fgScrap = round4(base * fgScrapShare);
  return {
    material: round4(base - fgScrap),
    scrap: round4(allowance + fgScrap)
  };
}

function labourBucket(sheet) {
  return round4(num(sheet.labour) + num(sheet.machine) + num(sheet.subcontract));
}

function prorateSheet(sheet, factor) {
  const ratio = Number.isFinite(factor) ? factor : 0;
  const next = { ...sheet };
  ['material', 'scrap', 'labour', 'machine', 'subcontract', 'overhead', 'total'].forEach((key) => {
    next[key] = round4(num(sheet[key]) * ratio);
  });
  if (num(next.total) > 0 && ratio > 0 && num(sheet.quantity) > 0) {
    next.quantity = round4(num(sheet.quantity) * ratio);
    next.unitCost = next.quantity > 0 ? round4(next.total / next.quantity) : 0;
  }
  return next;
}

function varianceReport(planned, actual) {
  const rows = {
    material: { planned: round4(planned.material), actual: round4(actual.material) },
    labour: { planned: labourBucket(planned), actual: labourBucket(actual) },
    overhead: { planned: round4(planned.overhead), actual: round4(actual.overhead) },
    scrap: { planned: round4(planned.scrap), actual: round4(actual.scrap) }
  };
  let plannedTotal = 0;
  let actualTotal = 0;
  Object.keys(rows).forEach((key) => {
    rows[key].variance = round4(rows[key].actual - rows[key].planned);
    plannedTotal += rows[key].planned;
    actualTotal += rows[key].actual;
  });
  return {
    buckets: rows,
    planned: round4(plannedTotal),
    actual: round4(actualTotal),
    variance: round4(actualTotal - plannedTotal)
  };
}

function addSheets(sheets) {
  return sheets.reduce((total, sheet) => {
    ['material', 'scrap', 'labour', 'machine', 'subcontract', 'overhead', 'total'].forEach((key) => {
      total[key] = round4(num(total[key]) + num(sheet[key]));
    });
    return total;
  }, { material: 0, scrap: 0, labour: 0, machine: 0, subcontract: 0, overhead: 0, total: 0 });
}

module.exports = {
  round4,
  num,
  materialUnitCost,
  rollupCost,
  prorateSheet,
  splitIssueCost,
  varianceReport,
  addSheets,
  labourBucket
};
