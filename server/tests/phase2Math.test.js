const { allocateShares, depreciationAmount, daysInUse } = require('../src/services/phase2/math');

describe('phase 2 costing math', () => {
  test('allocation puts the rounding remainder on the last line', () => {
    const shares = allocateShares([1, 1, 1], 10);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(10, 4);
    expect(shares[2]).toBeCloseTo(10 - shares[0] - shares[1], 4);
  });

  test('straight line uses exact days and reducing balance uses the year length', () => {
    const full = depreciationAmount({
      method: 'SL', cost: 12000, residual: 0, lifeMonths: 12, nbv: 12000, days: 30, year: 2026, month: 11
    });
    expect(full).toBeCloseTo(1000, 4);
    const half = depreciationAmount({
      method: 'SL', cost: 12000, residual: 0, lifeMonths: 12, nbv: 12000, days: 15, year: 2026, month: 11
    });
    expect(half).toBeCloseTo(500, 4);
    expect(daysInUse('2026-11-16', null, 2026, 11)).toBe(15);
    const reducing = depreciationAmount({
      method: 'RB', cost: 10000, residual: 0, nbv: 10000, annualRate: 20, days: 30, year: 2026, month: 11
    });
    expect(reducing).toBeCloseTo(10000 * 0.2 * 30 / 365, 4);
  });
});
