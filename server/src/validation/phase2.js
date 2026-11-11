const { z } = require('zod');

function requiredText(message) {
  return z.string({ error: message }).trim().min(1, message);
}

function positive(label) {
  return z.any().superRefine((value, ctx) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      ctx.addIssue({ code: 'custom', message: `${label} must be greater than zero.` });
    }
  });
}

const date = requiredText('Date is required.');

module.exports = {
  center: z.object({
    code: requiredText('Code is required.'),
    name: requiredText('Name is required.'),
    kind: z.enum(['COST', 'PROFIT', 'BOTH']).optional()
  }).passthrough(),
  budget: z.object({
    kind: z.enum(['OPEX', 'CAPEX'], { error: 'Choose Opex or Capex.' }),
    year: positive('Year'),
    amount: positive('Amount')
  }).passthrough(),
  project: z.object({
    code: requiredText('Project code is required.'),
    name: requiredText('Project name is required.'),
    budgetAmount: positive('Budget')
  }).passthrough(),
  contract: z.object({
    supplierId: requiredText('Supplier is required.'),
    productId: requiredText('Product is required.'),
    unitPrice: positive('Agreed price'),
    validFrom: date
  }).passthrough(),
  rfq: z.object({
    date,
    lines: z.array(z.object({
      productId: requiredText('Product is required.'),
      quantity: positive('Quantity')
    }).passthrough()).min(1, 'Add at least one product.')
  }).passthrough(),
  quotation: z.object({
    supplierId: requiredText('Supplier is required.'),
    date,
    lines: z.array(z.object({
      productId: requiredText('Product is required.'),
      quantity: positive('Quantity'),
      unitPrice: positive('Price')
    }).passthrough()).min(1, 'Add at least one quoted price.')
  }).passthrough(),
  selection: z.object({
    quotationId: requiredText('Choose a quotation.'),
    reason: requiredText('Record why this supplier was selected.')
  }).passthrough(),
  landedCost: z.object({
    grnId: requiredText('Goods receipt is required.'),
    date,
    charges: z.array(z.object({
      kind: z.enum(['FREIGHT', 'DUTY', 'CLEARING', 'INSURANCE'], { error: 'Charge type must be freight, duty, clearing, or insurance.' }),
      amount: positive('Charge amount')
    }).passthrough()).min(1, 'Add freight, duty, clearing, or insurance.')
  }).passthrough(),
  assetClass: z.object({
    code: requiredText('Code is required.'),
    name: requiredText('Name is required.')
  }).passthrough(),
  capitalize: z.object({
    classId: requiredText('Choose an asset class.'),
    date
  }).passthrough(),
  depreciation: z.object({
    year: positive('Year'),
    month: positive('Month')
  }).passthrough(),
  dispose: z.object({ date }).passthrough(),
  impair: z.object({ date, amount: positive('Amount') }).passthrough(),
  partyNote: z.object({
    partyType: z.enum(['CUSTOMER', 'SUPPLIER'], { error: 'Choose a customer or supplier note.' }),
    partyId: requiredText('Party is required.'),
    kind: z.enum(['CREDIT', 'DEBIT'], { error: 'Choose a credit or debit note.' }),
    date,
    reasonCode: requiredText('A reason code is required.'),
    subtotal: positive('Amount')
  }).passthrough(),
  collection: z.object({
    customerId: requiredText('Customer is required.')
  }).passthrough(),
  cheque: z.object({
    chequeNumber: requiredText('Cheque number is required.'),
    chequeDate: date,
    payee: requiredText('Payee is required.'),
    direction: z.enum(['IN', 'OUT'], { error: 'Choose an incoming or outgoing cheque.' }),
    amount: positive('Amount')
  }).passthrough(),
  pettyCash: z.object({
    name: requiredText('Name the petty cash fund.'),
    amount: positive('Amount'),
    date
  }).passthrough(),
  iou: z.object({
    date,
    employeeName: requiredText('Employee name is required.'),
    amount: positive('Amount')
  }).passthrough(),
  iouSettle: z.object({
    date,
    amount: positive('Amount')
  }).passthrough(),
  period: z.object({
    year: positive('Year'),
    month: positive('Month')
  }).passthrough(),
  closeStep: z.object({
    status: z.enum(['DONE', 'EXCEPTION']).optional()
  }).passthrough(),
  allocation: z.object({
    name: requiredText('Name the allocation.'),
    sourceAccountId: requiredText('Choose the expense account.'),
    lines: z.array(z.object({
      targetCostCenterId: requiredText('Choose a cost center.'),
      percent: positive('Percent')
    }).passthrough()).min(1, 'Add at least one share.')
  }).passthrough(),
  recurring: z.object({
    name: requiredText('Name is required.'),
    lines: z.array(z.object({ accountId: requiredText('Account is required.') }).passthrough()).min(2, 'Add at least two lines.')
  }).passthrough(),
  dimension: z.object({
    documentType: requiredText('Document type is required.'),
    documentId: requiredText('Document is required.')
  }).passthrough(),
  settings: z.object({}).passthrough()
};
