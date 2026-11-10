const { z } = require('zod');

function requiredText(message) {
  return z.string({ error: message }).trim().min(1, message);
}

function optionalNumber(label) {
  return z.any().optional().superRefine((value, ctx) => {
    if (value === undefined || value === null || value === '') return;
    const numeric = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN);
    const notANumber = (typeof value !== 'number' && typeof value !== 'string') || Number.isNaN(numeric);
    if (notANumber) {
      ctx.addIssue({ code: 'custom', message: `${label} must be a number.` });
      return;
    }
    if (numeric < 0) {
      ctx.addIssue({ code: 'custom', message: `${label} cannot be negative` });
    }
  });
}

function named(message) {
  return z.object({ name: requiredText(message) }).passthrough();
}

function codeAndName(message) {
  return z.object({
    code: requiredText(message),
    name: requiredText(message)
  }).passthrough();
}

const line = z.object({
  productId: requiredText('Product is required.')
}).passthrough();

const productFields = {
  type: z.enum(['PRODUCT', 'SERVICE'], { error: 'Invalid product type. Must be PRODUCT or SERVICE' }).optional(),
  costingMethod: z.enum(['FIFO', 'LIFO', 'Moving Average', 'Standard Cost'], { error: 'Invalid costing method' }).optional(),
  activeStatus: z.enum(['ACTIVE', 'INACTIVE'], { error: 'Invalid active status. Must be ACTIVE or INACTIVE' }).optional(),
  costPrice: optionalNumber('Cost price'),
  sellingPrice: optionalNumber('Selling price'),
  standardCost: optionalNumber('Standard cost')
};

const productCreate = z.object({
  code: requiredText('Product code is required'),
  name: requiredText('Product name is required'),
  ...productFields
}).passthrough();

const productUpdate = z.object({
  code: z.string().trim().min(1, 'Product code is required').optional(),
  name: z.string().trim().min(1, 'Product name is required').optional(),
  ...productFields
}).passthrough();

const productDuplicate = z.object({
  newCode: requiredText('New product code is required for duplication')
}).passthrough();

const productBatch = z.object({
  ids: z.array(z.string(), { error: 'Select at least one product' }).min(1, 'Select at least one product'),
  changes: z.record(z.string(), z.any(), { error: 'Select a parameter to update' })
}).passthrough();

const customerCreate = z.object({
  name: requiredText('Customer name is required.')
}).passthrough();

const partialNamed = z.object({
  code: z.string().trim().min(1, 'Code and Name are required.').optional(),
  name: z.string().trim().min(1, 'Code and Name are required.').optional()
}).passthrough();

const customerUpdate = z.object({
  name: z.string().min(1, 'Customer name cannot be empty.').optional()
}).passthrough();

const salesCreate = z.object({
  customerId: requiredText('Customer is required.'),
  date: requiredText('Date is required.'),
  items: z.array(line, { error: 'Add at least one product.' }).min(1, 'Add at least one product.')
}).passthrough();

const deliveryCreate = salesCreate.extend({
  warehouseId: requiredText('Warehouse is required')
});

const documentUpdate = z.object({
  items: z.array(line).optional()
}).passthrough();

const supplier = z.object({
  name: requiredText('Name is required')
}).passthrough();

const purchaseOrder = z.object({
  supplierId: requiredText('Supplier is required.'),
  date: requiredText('Date is required.'),
  items: z.array(line).optional()
}).passthrough();

const purchaseRequisition = z.object({
  date: requiredText('Date is required.'),
  items: z.array(line).optional()
}).passthrough();

const goodsReceipt = z.object({
  supplierId: requiredText('Supplier is required.'),
  date: requiredText('Date is required.'),
  warehouseId: requiredText('Warehouse is required'),
  items: z.array(z.object({
    productId: requiredText('Product is required.'),
    quantityReceived: optionalNumber('Quantity received')
  }).passthrough(), { error: 'Add at least one product.' }).min(1, 'Add at least one product.')
}).passthrough();

const stockLines = z.object({
  items: z.array(line).optional()
}).passthrough();

const stockMovement = z.object({
  type: z.enum(['GI', 'ADJ', 'GR'], { error: 'Invalid movement type.' }),
  items: z.array(z.object({
    productId: requiredText('Product is required.'),
    quantity: optionalNumber('Quantity')
  }).passthrough()).min(1, 'Add at least one product.')
}).passthrough();

const paymentTerm = z.object({
  code: requiredText('Payment term code is required.'),
  name: requiredText('Payment term name is required.')
}).passthrough();

module.exports = {
  brand: named('Brand name is required.'),
  category: named('Category name is required.'),
  productGroup: named('Product Group name is required.'),
  productType: named('Product type name is required.'),
  uom: named('UOM name is required.'),
  priceList: named('Price list name is required'),
  discountGroup: named('Discount group name is required'),
  taxGroup: named('Tax group name is required'),
  purchaseTaxGroup: named('Purchase tax group name is required'),
  purchaseWithholdingTaxGroup: named('Purchase withholding tax group name is required'),
  customerCategory: codeAndName('Code and Name are required.'),
  customerCategoryUpdate: partialNamed,
  currency: codeAndName('Code and Name are required.'),
  warehouse: codeAndName('Code and Name are required'),
  paymentTerm,
  productCreate,
  productUpdate,
  productDuplicate,
  productBatch,
  customerCreate,
  customerUpdate,
  supplier,
  salesCreate,
  deliveryCreate,
  documentUpdate,
  purchaseOrder,
  purchaseRequisition,
  goodsReceipt,
  stockLines,
  stockMovement
};
