const { DEFAULT_BANK_COLUMNS } = require('./defaults');

async function getSettings(db, tenantId) {
  const existing = await db.dispatchSetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.dispatchSetting.create({
    data: { tenantId, bankColumns: DEFAULT_BANK_COLUMNS }
  });
}

function bankColumnsOf(settings) {
  const columns = settings?.bankColumns;
  if (Array.isArray(columns) && columns.length) return columns;
  return DEFAULT_BANK_COLUMNS;
}

async function saveSettings(db, tenantId, input) {
  await getSettings(db, tenantId);
  const data = {};
  const booleanKeys = [
    'blockCreditOverLimit', 'blockOverdue', 'sfaImportOrders', 'sfaImportCustomers',
    'sfaImportCollections', 'sfaExportItems', 'sfaExportPrices', 'sfaExportStock',
    'sfaExportBalances', 'gatePassRequired', 'invoiceBeforeDispatch', 'emailHookEnabled'
  ];
  for (const key of booleanKeys) {
    if (input[key] !== undefined) data[key] = Boolean(input[key]);
  }
  if (input.maxDiscountPercent !== undefined) data.maxDiscountPercent = input.maxDiscountPercent;
  if (input.sfaSyncMinutes !== undefined) data.sfaSyncMinutes = input.sfaSyncMinutes;
  if (input.shortagePolicy) data.shortagePolicy = input.shortagePolicy;
  if (input.sfaReservation) data.sfaReservation = input.sfaReservation;
  if (input.emailHookUrl !== undefined) data.emailHookUrl = input.emailHookUrl || null;
  if (input.bankColumns) data.bankColumns = input.bankColumns;
  return db.dispatchSetting.update({ where: { tenantId }, data });
}

module.exports = { getSettings, saveSettings, bankColumnsOf };
