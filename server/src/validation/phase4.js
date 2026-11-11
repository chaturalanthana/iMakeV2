const { z } = require('zod');

const text = (message) => z.string({ error: message }).trim().min(1, message);

const quantity = z.any().superRefine((value, ctx) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(numeric) || numeric <= 0) {
    ctx.addIssue({ code: 'custom', message: 'Quantity must be greater than zero' });
  }
});

const nonNegative = z.any().optional().superRefine((value, ctx) => {
  if (value === undefined || value === null || value === '') return;
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0) {
    ctx.addIssue({ code: 'custom', message: 'Quantity cannot be negative' });
  }
});

const forecast = z.object({
  productId: text('Product is required'),
  quantity: nonNegative
}).passthrough();

const alternate = z.object({
  bomItemId: text('BOM component is required'),
  productId: text('Alternate product is required')
}).passthrough();

const capture = z.object({
  workOrderId: text('Work order is required'),
  machineId: text('Machine is required')
}).passthrough();

const lossApproval = z.object({
  reason: text('A reason is required to approve an abnormal loss')
}).passthrough();

const payroll = z.object({
  lines: z.array(z.object({}).passthrough(), { error: 'Add at least one payroll line' }).min(1, 'Add at least one payroll line')
}).passthrough();

const reconcile = z.object({}).passthrough();

const contract = z.object({
  supplierId: text('Supplier is required'),
  virtualWarehouseId: text('Choose a factory sub-location virtual warehouse'),
  fgWarehouseId: text('Finished goods warehouse is required'),
  productId: text('Product is required'),
  quantity
}).passthrough();

const contractIssue = z.object({
  warehouseId: text('Source warehouse is required'),
  productId: text('Component is required'),
  quantity
}).passthrough();

const contractReceive = z.object({
  quantity
}).passthrough();

const contractCharge = z.object({}).passthrough();

const lineStandard = z.object({}).passthrough();

const milestone = z.object({
  milestoneWeight: nonNegative
}).passthrough();

const firm = z.object({}).passthrough();

module.exports = {
  forecast,
  alternate,
  capture,
  lossApproval,
  payroll,
  reconcile,
  contract,
  contractIssue,
  contractReceive,
  contractCharge,
  lineStandard,
  milestone,
  firm
};
