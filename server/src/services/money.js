const { Prisma } = require('@prisma/client');

function num(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Math.round((num(value) + Number.EPSILON) * 10000) / 10000;
}

function dec(value) {
  return new Prisma.Decimal(money(value).toFixed(4));
}

function rateOf(value) {
  if (value === undefined || value === null || value === '') return 1;
  const rate = num(value);
  if (rate <= 0) {
    const { DocumentError } = require('./errors');
    throw new DocumentError('Exchange rate must be greater than zero.', {
      exchangeRate: 'Exchange rate must be greater than zero.'
    });
  }
  return rate;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + (parseInt(days, 10) || 0));
  return next;
}

module.exports = { num, money, dec, rateOf, addDays };
