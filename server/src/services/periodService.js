const { DocumentError } = require('./errors');
const { hasFullAccess } = require('../permissions/catalog');

function periodKey(date) {
  const when = new Date(date);
  if (Number.isNaN(when.getTime())) return null;
  return { year: when.getUTCFullYear(), month: when.getUTCMonth() + 1, when };
}

function label(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function userCanClose(db, userId) {
  if (!userId) return false;
  const user = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user?.role) return false;
  if (hasFullAccess(user.role)) return true;
  const permissions = user.role.permissions || {};
  return permissions.financeClose === true;
}

async function assertPeriodOpen(db, { tenantId, date, userId }) {
  const key = periodKey(date);
  if (!key) return;
  const period = await db.fiscalPeriod.findUnique({
    where: { tenantId_year_month: { tenantId, year: key.year, month: key.month } }
  });
  if (!period || period.status === 'OPEN') return;
  const name = label(key.year, key.month);
  if (period.status === 'CLOSED') {
    throw new DocumentError(`Period ${name} is closed. Posting is not allowed.`, {
      date: `Period ${name} is closed. Posting is not allowed.`
    });
  }
  if (period.status === 'SOFT_CLOSED') {
    const allowed = await userCanClose(db, userId);
    if (!allowed) {
      throw new DocumentError(`Period ${name} is soft-closed. Finance close permission is required.`, {
        date: `Period ${name} is soft-closed. Finance close permission is required.`
      });
    }
  }
}

async function ensureYear(db, tenantId, year) {
  const rows = [];
  for (let month = 1; month <= 12; month += 1) {
    const existing = await db.fiscalPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } }
    });
    if (existing) {
      rows.push(existing);
      continue;
    }
    rows.push(await db.fiscalPeriod.create({
      data: { tenantId, year, month, status: 'OPEN' }
    }));
  }
  return rows;
}

module.exports = { assertPeriodOpen, ensureYear, userCanClose, periodKey };
