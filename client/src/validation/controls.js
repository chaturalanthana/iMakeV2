import { z } from 'zod';

export const supplierInvoiceSchema = z.object({
  supplierId: z.string().trim().min(1, 'Supplier is required.'),
  date: z.string().trim().min(1, 'Date is required.'),
  supplierReference: z.string().optional(),
  poId: z.string().optional().nullable(),
  grnId: z.string().optional().nullable()
}).refine((data) => data.poId || data.grnId, {
  message: 'Link a goods receipt or a purchase order.',
  path: ['grnId']
});

export const approvalDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  reason: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.action !== 'APPROVE' && !String(value.reason || '').trim()) {
    ctx.addIssue({ code: 'custom', message: 'A reason is required.', path: ['reason'] });
  }
});

export function firstZodError(error) {
  const issue = error.issues?.[0];
  return issue?.message || 'Check the highlighted fields.';
}
