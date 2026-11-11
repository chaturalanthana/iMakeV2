const { DocumentError } = require('../errors');
const { num, money } = require('../money');
const { getSettings } = require('./settings');
const { PRICE_SCOPES } = require('./defaults');

function discountOf(listPrice, unitPrice) {
  const list = num(listPrice);
  if (list <= 0) return 0;
  return money(((list - num(unitPrice)) / list) * 100);
}

function inForce(row, when) {
  if (row.validFrom && new Date(row.validFrom) > when) return false;
  if (row.validTo && new Date(row.validTo) < when) return false;
  return true;
}

function bestBreak(rows, qty) {
  const eligible = rows.filter((row) => num(row.minQty) <= qty + 0.0001);
  eligible.sort((a, b) => num(b.minQty) - num(a.minQty));
  return eligible[0] || null;
}

async function resolvePrice(db, { tenantId, customerId, productId, channel, currency, quantity, onDate }) {
  const product = await db.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new DocumentError('Product is required.', { productId: 'Product is required.' });
  const customer = customerId
    ? await db.customer.findFirst({ where: { id: customerId, tenantId } })
    : null;
  const qty = quantity > 0 ? quantity : 1;
  const when = onDate ? new Date(onDate) : new Date();
  const cur = (currency || 'LKR').toUpperCase();
  const rules = await db.customerPrice.findMany({
    where: { tenantId, productId, status: 'ACTIVE', currency: cur }
  });
  const valid = rules.filter((row) => inForce(row, when));
  const pack = (row, source) => ({
    price: num(row.price),
    source,
    listPrice: num(row.price),
    minQty: num(row.minQty),
    currency: row.currency,
    uom: row.uom || null
  });

  const customerHit = bestBreak(valid.filter((row) => row.scope === 'CUSTOMER' && row.customerId === customerId), qty);
  if (customerHit) return pack(customerHit, 'CUSTOMER');
  const groupHit = bestBreak(valid.filter((row) => row.scope === 'GROUP' && row.customerCategoryId && row.customerCategoryId === customer?.customerCategoryId), qty);
  if (groupHit) return pack(groupHit, 'GROUP');
  const useChannel = channel || customer?.channel || 'GENERAL_TRADE';
  const channelHit = bestBreak(valid.filter((row) => row.scope === 'CHANNEL' && row.channel === useChannel), qty);
  if (channelHit) return pack(channelHit, 'CHANNEL');
  const defaultHit = bestBreak(valid.filter((row) => row.scope === 'DEFAULT'), qty);
  if (defaultHit) return pack(defaultHit, 'DEFAULT');

  if (customer?.priceList) {
    const list = await db.priceList.findFirst({
      where: { tenantId, name: customer.priceList, status: 'ACTIVE' },
      include: { prices: true }
    });
    const row = list?.prices.find((price) => price.productId === productId);
    if (row) {
      return { price: num(row.price), source: 'PRICE_LIST', listPrice: num(row.price), currency: list.currency, uom: null };
    }
  }
  return {
    price: num(product.sellingPrice),
    source: 'SELLING_PRICE',
    listPrice: num(product.sellingPrice),
    currency: product.currency || 'LKR',
    uom: null
  };
}

async function quoteDiscount(db, input) {
  const quote = await resolvePrice(db, input);
  const settings = await getSettings(db, input.tenantId);
  const discount = discountOf(quote.price, input.unitPrice);
  const limit = num(settings.maxDiscountPercent);
  return { quote, discount, limit, exceeded: discount - limit > 0.0001, settings };
}

async function savePriceRule(db, input) {
  if (!PRICE_SCOPES.includes(input.scope)) {
    throw new DocumentError('Choose a price level.', { scope: 'Choose customer, group, channel or default.' });
  }
  if (!(num(input.price) >= 0)) throw new DocumentError('Price is required.', { price: 'Price is required.' });
  if (input.scope === 'CUSTOMER' && !input.customerId) {
    throw new DocumentError('Customer is required.', { customerId: 'Customer is required.' });
  }
  if (input.scope === 'GROUP' && !input.customerCategoryId) {
    throw new DocumentError('Customer group is required.', { customerCategoryId: 'Customer group is required.' });
  }
  if (input.scope === 'CHANNEL' && !input.channel) {
    throw new DocumentError('Channel is required.', { channel: 'Channel is required.' });
  }
  const product = await db.product.findFirst({ where: { id: input.productId, tenantId: input.tenantId } });
  if (!product) throw new DocumentError('Product is required.', { productId: 'Product is required.' });
  return db.customerPrice.create({
    data: {
      tenantId: input.tenantId,
      scope: input.scope,
      customerId: input.scope === 'CUSTOMER' ? input.customerId : null,
      customerCategoryId: input.scope === 'GROUP' ? input.customerCategoryId : null,
      channel: input.scope === 'CHANNEL' ? input.channel : null,
      productId: input.productId,
      currency: (input.currency || 'LKR').toUpperCase(),
      uom: input.uom || null,
      minQty: num(input.minQty) > 0 ? input.minQty : 1,
      price: input.price,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validTo: input.validTo ? new Date(input.validTo) : null,
      status: 'ACTIVE',
      createdBy: input.createdBy || null
    },
    include: { product: true, customer: true, category: true }
  });
}

module.exports = { resolvePrice, quoteDiscount, savePriceRule, discountOf };
