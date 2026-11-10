const { materialUnitCost, rollupCost, splitIssueCost, varianceReport } = require('../src/services/production/costing');
const { buildLoadProfile } = require('../src/services/production/capacity');

describe('Production costing math', () => {
  const operations = [{
    sequence: 10,
    name: 'Assemble',
    setupMinutes: 0,
    runMinutesPerUnit: 15,
    noOfWorkers: 1,
    isSubcontract: false,
    subcontractCostPerUnit: 0,
    machineRatePerHour: 60
  }];
  const components = [{
    productId: 'rm',
    quantityPer: 1,
    scrapPercent: 0,
    unitCost: 4,
    costSource: 'STANDARD'
  }];

  test('standard cost is used before FIFO and cost price', () => {
    expect(materialUnitCost({ standardCost: 4, fifoUnitCost: 9, costPrice: 2 })).toEqual({
      unitCost: 4,
      costSource: 'STANDARD'
    });
    expect(materialUnitCost({ standardCost: 0, fifoUnitCost: 9, lastReceiptCost: 3, costPrice: 2 })).toEqual({
      unitCost: 9,
      costSource: 'FIFO'
    });
    expect(materialUnitCost({ standardCost: 0, fifoUnitCost: 0, lastReceiptCost: 3, costPrice: 2 })).toEqual({
      unitCost: 3,
      costSource: 'LAST_RECEIPT'
    });
  });

  test('rolls BOM material and routing time into a quote sheet', () => {
    const sheet = rollupCost({
      quantity: 4,
      components,
      operations,
      labourRatePerHour: 30,
      overheadPercent: 0
    });
    expect(sheet.material).toBe(16);
    expect(sheet.scrap).toBe(0);
    expect(sheet.labour).toBe(30);
    expect(sheet.machine).toBe(60);
    expect(sheet.overhead).toBe(0);
    expect(sheet.total).toBe(106);
    expect(sheet.unitCost).toBe(26.5);
    expect(sheet.components[0].requiredQty).toBe(4);
  });

  test('splits an issue between good material and scrap', () => {
    const split = splitIssueCost(16, 0, 3, 1);
    expect(split.material).toBe(12);
    expect(split.scrap).toBe(4);

    const allowance = splitIssueCost(110, 10, 10, 0);
    expect(allowance.material).toBe(100);
    expect(allowance.scrap).toBe(10);
  });

  test('variance buckets put machine with labour', () => {
    const planned = rollupCost({
      quantity: 4,
      components,
      operations,
      labourRatePerHour: 30,
      overheadPercent: 0
    });
    const actual = {
      material: 12,
      scrap: 4,
      labour: 30,
      machine: 60,
      subcontract: 0,
      overhead: 0
    };
    const variance = varianceReport(planned, actual);
    expect(variance.buckets.material.variance).toBe(-4);
    expect(variance.buckets.scrap.variance).toBe(4);
    expect(variance.buckets.labour.variance).toBe(0);
    expect(variance.buckets.overhead.variance).toBe(0);
    expect(variance.variance).toBe(0);
  });
});

describe('Infinite capacity load', () => {
  const settings = { hoursPerDay: 8, workDays: [1, 2, 3, 4, 5] };
  const workstations = [{ id: 'ws', code: 'CUT', name: 'Cut', capacity: 1, efficiency: 1 }];

  test('flags a day when released load exceeds available hours', () => {
    const profile = buildLoadProfile({
      from: '2026-11-10',
      to: '2026-11-10',
      settings,
      workstations,
      shifts: [],
      events: [],
      loads: [{ workstationId: 'ws', hours: 10, startDate: '2026-11-10', endDate: '2026-11-10' }]
    });
    expect(profile.method).toBe('INFINITE');
    expect(profile.workstations[0].days[0].availableHours).toBe(8);
    expect(profile.workstations[0].days[0].loadHours).toBe(10);
    expect(profile.overloads).toHaveLength(1);
  });

  test('a holiday removes available hours', () => {
    const profile = buildLoadProfile({
      from: '2026-11-10',
      to: '2026-11-10',
      settings,
      workstations,
      shifts: [],
      events: [{ type: 'HOLIDAY', date: '2026-11-10T00:00:00.000Z', workCenterId: null }],
      loads: [{ workstationId: 'ws', hours: 1, startDate: '2026-11-10', endDate: '2026-11-10' }]
    });
    expect(profile.workstations[0].days[0].availableHours).toBe(0);
    expect(profile.overloads).toHaveLength(1);
  });

  test('efficiency reduces available hours', () => {
    const profile = buildLoadProfile({
      from: '2026-11-10',
      to: '2026-11-10',
      settings,
      workstations: [{ ...workstations[0], efficiency: 0.5 }],
      shifts: [],
      events: [],
      loads: []
    });
    expect(profile.workstations[0].days[0].availableHours).toBe(4);
  });
});
