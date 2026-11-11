const { z } = require('zod');

function requiredText(message) {
  return z.string({ error: message }).trim().min(1, message);
}

const line = z.object({
  productId: requiredText('Product is required.'),
  quantity: z.coerce.number({ error: 'Quantity must be a number.' }).positive('Quantity must be greater than zero.')
}).passthrough();

const priceRule = z.object({
  scope: z.enum(['CUSTOMER', 'GROUP', 'CHANNEL', 'DEFAULT'], { error: 'Choose customer, group, channel or default.' }),
  productId: requiredText('Product is required.'),
  price: z.coerce.number({ error: 'Price must be a number.' }).min(0, 'Price cannot be negative.')
}).passthrough();

const route = z.object({
  code: requiredText('Code is required.'),
  name: requiredText('Name is required.')
}).passthrough();

const vehicle = z.object({
  code: requiredText('Code is required.'),
  registration: requiredText('Registration is required.'),
  kind: z.enum(['TRUCK', 'VAN'], { error: 'Choose a truck or a van.' }).optional()
}).passthrough();

const shipTo = z.object({
  customerId: requiredText('Customer is required.'),
  code: requiredText('Code is required.'),
  name: requiredText('Name is required.')
}).passthrough();

const release = z.object({
  warehouseId: requiredText('Warehouse is required.')
}).passthrough();

const cancel = z.object({
  reason: requiredText('A reason is required.')
}).passthrough();

const pick = z.object({
  warehouseId: requiredText('Warehouse is required.'),
  date: requiredText('Date is required.'),
  orderIds: z.array(z.string(), { error: 'Choose at least one order.' }).min(1, 'Choose at least one order.')
}).passthrough();

const advance = z.object({
  action: z.enum(['PICK', 'PACK'], { error: 'Choose pick or pack.' })
}).passthrough();

const trip = z.object({
  date: requiredText('Date is required.'),
  deliveryIds: z.array(z.string(), { error: 'Load at least one delivery.' }).min(1, 'Load at least one delivery.')
}).passthrough();

const proof = z.object({
  deliveryId: requiredText('Delivery is required.'),
  receivedBy: requiredText('Who received the goods?')
}).passthrough();

const salesReturn = z.object({
  invoiceId: requiredText('Invoice is required.'),
  date: requiredText('Date is required.'),
  kind: z.enum(['MARKET', 'DAMAGE', 'GRA'], { error: 'Choose a market, damage or dissatisfaction return.' }),
  reason: requiredText('A reason is required.'),
  items: z.array(line, { error: 'Add at least one product.' }).min(1, 'Add at least one product.')
}).passthrough();

const cashSale = z.object({
  customerId: requiredText('Customer is required.'),
  warehouseId: requiredText('Choose the van or factory location.'),
  date: requiredText('Date is required.'),
  saleKind: z.enum(['VAN_CASH', 'FACTORY_CASH'], { error: 'Choose van sales or factory cash sales.' }),
  items: z.array(line, { error: 'Add at least one product.' }).min(1, 'Add at least one product.')
}).passthrough();

const settings = z.object({
  maxDiscountPercent: z.coerce.number().min(0, 'Discount limit cannot be negative.').max(100, 'Discount limit cannot exceed 100.').optional(),
  shortagePolicy: z.enum(['ALLOW_PARTIAL', 'BLOCK']).optional(),
  emailHookUrl: z.string().trim().optional()
}).passthrough();

const bankColumns = z.object({
  columns: z.array(z.object({
    key: requiredText('Each column needs a key and a header.'),
    header: requiredText('Each column needs a key and a header.')
  })).min(1, 'Add at least one column.')
}).passthrough();

module.exports = {
  priceRule, route, vehicle, shipTo, release, cancel, pick, advance, trip, proof,
  salesReturn, cashSale, settings, bankColumns
};
