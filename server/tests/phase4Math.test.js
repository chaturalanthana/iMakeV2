const {
  planItem, applyLot, weekStart, abnormalLoss, lineStandard, yieldPercents,
  substitutionDelta, stageCompletion, absorbCosts, absorptionVariance
} = require('../src/services/production/productionMath');

describe('Phase 4 planning math', () => {
  test('weekly MPS uses the greater of forecast and orders, then safety stock and the stock target', () => {
    const start = weekStart('2026-11-11');
    const next = new Date(start);
    next.setUTCDate(next.getUTCDate() + 7);
    const result = planItem({
      opening: 4,
      safetyStock: 5,
      stockTarget: 12,
      lotPolicy: 'FIXED',
      fixedLotQty: 4,
      leadDays: 3,
      buckets: [
        { weekStart: start, forecast: 3, orders: 6, receipts: 1 },
        { weekStart: next, forecast: 9, orders: 2, receipts: 0 }
      ]
    });
    expect(result.buckets[0].demand).toBe(6);
    expect(result.buckets[0].plannedQty).toBe(16);
    expect(result.buckets[0].projected).toBe(15);
    expect(result.plannedOrders[0].startDate.toISOString().slice(0, 10))
      .toBe(new Date(start.getTime() - 3 * 86400000).toISOString().slice(0, 10));
    expect(result.buckets[1].opening).toBe(15);
    expect(result.buckets[1].demand).toBe(9);
    expect(result.buckets[1].plannedQty).toBe(0);
    expect(result.buckets[1].projected).toBe(6);
  });

  test('lot for lot below zero orders just enough, and a minimum lot is honoured', () => {
    expect(applyLot(2.5, 'LOT_FOR_LOT', 10, 4)).toBe(2.5);
    expect(applyLot(2.5, 'MINIMUM', 0, 4)).toBe(4);
    expect(applyLot(0, 'FIXED', 5, 0)).toBe(0);
  });

  test('abnormal loss, yield, substitution and milestone weights stay separate', () => {
    expect(abnormalLoss({ good: 8, scrap: 2, standardScrapPercent: 2, threshold: 2 })).toMatchObject({
      actualScrapPercent: 20,
      excessQty: 1.8
    });
    expect(abnormalLoss({ good: 98, scrap: 2, standardScrapPercent: 2, threshold: 2 })).toBeNull();
    expect(lineStandard(
      { scrapPercent: 0, standardYieldPercent: 100, abnormalLossThreshold: 2 },
      { standardScrapPercent: 3, standardYieldPercent: 96, abnormalLossThreshold: 1.5 },
      { abnormalLossThreshold: 2, defaultScrapPercent: 2, defaultYieldPercent: 98 }
    )).toMatchObject({ scrapPercent: 3, yieldPercent: 96, threshold: 1.5 });
    expect(yieldPercents({ input: 10, output: 8, wastage: 1 })).toEqual({ yieldPercent: 80, wastagePercent: 10 });
    expect(substitutionDelta({ actualCost: 14, standardUnitCost: 5, componentQty: 2 })).toBe(4);
    expect(stageCompletion([
      { sequence: 10, name: 'Mixing', status: 'COMPLETE', milestoneWeight: 40 },
      { sequence: 20, name: 'Extruding', status: 'RUNNING', milestoneWeight: 35 },
      { sequence: 30, name: 'Packaging', status: 'PENDING', milestoneWeight: 25 }
    ])).toEqual({ percent: 40, stage: 'Extruding' });
  });

  test('absorption bases and under/over absorption', () => {
    expect(absorbCosts({
      labourMinutes: 60,
      machineMinutes: 30,
      labourRatePerHour: 30,
      machineRatePerHour: 60,
      subcontractCost: 0,
      overheadPercent: 10
    })).toMatchObject({ labourCost: 30, machineCost: 30, overheadCost: 6 });
    expect(absorbCosts({
      labourMinutes: 60,
      units: 4,
      labourRatePerHour: 5,
      overheadRate: 8,
      labourBase: 'PER_UNIT',
      overheadBase: 'PER_LABOUR_HOUR'
    })).toMatchObject({ labourCost: 20, overheadCost: 8 });
    expect(absorptionVariance(10, 14)).toBe(4);
    expect(absorptionVariance(10, 7)).toBe(-3);
  });
});
