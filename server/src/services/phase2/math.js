const { money, num } = require('../money');

function isLeap(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function utcDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysInUse(acquired, disposed, year, month) {
  if (!acquired) return 0;
  const dim = daysInMonth(year, month);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, dim);
  const from = Math.max(monthStart, utcDay(acquired));
  const to = disposed ? Math.min(monthEnd, utcDay(disposed)) : monthEnd;
  if (to < from) return 0;
  return Math.round((to - from) / 86400000) + 1;
}

function depreciationAmount({ method, cost, residual, lifeMonths, nbv, annualRate, days, year, month }) {
  const room = Math.max(0, num(nbv) - num(residual));
  if (!(days > 0) || !(room > 0)) return 0;
  const style = String(method || 'SL').toUpperCase();
  let raw = 0;
  if (style === 'RB' || style === 'REDUCING' || style === 'REDUCING_BALANCE') {
    const yearDays = isLeap(year) ? 366 : 365;
    raw = num(nbv) * (num(annualRate) / 100) * days / yearDays;
  } else {
    if (!(num(lifeMonths) > 0)) return 0;
    const dim = daysInMonth(year, month);
    raw = Math.max(0, num(cost) - num(residual)) / num(lifeMonths) * days / dim;
  }
  return money(Math.min(room, Math.max(0, raw)));
}

function allocateShares(weights, amount) {
  const clean = weights.map((weight) => Math.max(0, num(weight)));
  const total = clean.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) {
    throw new Error('Allocation basis is zero.');
  }
  const shares = [];
  let used = 0;
  clean.forEach((weight, index) => {
    if (index === clean.length - 1) {
      shares.push(money(num(amount) - used));
      return;
    }
    const share = money(num(amount) * weight / total);
    shares.push(share);
    used = money(used + share);
  });
  return shares;
}

module.exports = {
  isLeap,
  daysInMonth,
  daysInUse,
  depreciationAmount,
  allocateShares
};
