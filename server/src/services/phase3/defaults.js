/**
 * Configurable defaults for SRS items that say "confirm" (D-06 and section 7).
 * Dispatch settings override these per tenant. The sales settings screen lists them.
 */
const CHANNELS = ['GENERAL_TRADE', 'MODERN_TRADE', 'VAN_SALES', 'FACTORY_CASH'];
const CASH_KINDS = ['VAN_CASH', 'FACTORY_CASH'];
const RETURN_KINDS = ['MARKET', 'DAMAGE', 'GRA'];
const PRICE_SCOPES = ['CUSTOMER', 'GROUP', 'CHANNEL', 'DEFAULT'];

const DEFAULT_BANK_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'reference', header: 'Reference' },
  { key: 'customer', header: 'Customer' },
  { key: 'amount', header: 'Amount' },
  { key: 'method', header: 'Method' },
  { key: 'invoice', header: 'Invoice' }
];

const CONFIRMED_DEFAULTS = [
  { key: 'pricingHierarchy', value: 'customer > group > channel > default selling price' },
  { key: 'maxDiscountPercent', value: '10' },
  { key: 'blockCreditOverLimit', value: 'true' },
  { key: 'blockOverdue', value: 'true' },
  { key: 'shortagePolicy', value: 'ALLOW_PARTIAL' },
  { key: 'warehouseFlow', value: 'General Trade and Modern Trade: reserve on release, stock and COGS on the delivery note, revenue and tax on the tax invoice before the truck leaves.' },
  { key: 'cashFlow', value: 'Van sales and factory cash sales post cash, revenue, tax, COGS and stock in one transaction.' },
  { key: 'gatePass', value: 'Physical dispatch is blocked until the gate pass is issued and the tax invoice exists.' },
  { key: 'returns', value: 'Market returns go to quarantine, damage to quarantine or scrap, GRA keeps the customer reason. Revenue is reversed with a credit note.' },
  { key: 'promotions', value: 'Section 7 does not ask for a free-issue engine. Quantity breaks are the price-rule minimum quantity.' },
  { key: 'email', value: 'In-app notifications always. Email is an HTTP hook and stays off until a URL is saved.' }
];

module.exports = {
  CHANNELS,
  CASH_KINDS,
  RETURN_KINDS,
  PRICE_SCOPES,
  DEFAULT_BANK_COLUMNS,
  CONFIRMED_DEFAULTS
};
