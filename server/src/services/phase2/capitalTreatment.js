const { dec } = require('../money');

async function classificationForPo(tx, tenantId, poId) {
  if (!poId) return null;
  const po = await tx.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    select: { id: true, prId: true }
  });
  if (!po) return null;
  const onPo = await tx.purchaseClassification.findFirst({
    where: { tenantId, documentType: 'PO', documentId: po.id }
  });
  if (onPo) return onPo;
  if (!po.prId) return null;
  return tx.purchaseClassification.findFirst({
    where: { tenantId, documentType: 'PR', documentId: po.prId }
  });
}

async function capitalDebitKey(tx, tenantId, poId) {
  const row = await classificationForPo(tx, tenantId, poId);
  return row && row.treatment === 'CWIP' ? 'CWIP' : 'INVENTORY';
}

async function recordCwipReceipt(tx, { tenantId, grn, amount, createdBy }) {
  const existing = await tx.fixedAsset.findFirst({ where: { tenantId, sourceGrnId: grn.id } });
  if (existing) return existing;
  const row = await classificationForPo(tx, tenantId, grn.poId);
  const code = `CWIP-${String(grn.grnNumber || grn.id).replace(/[^\w]+/g, '-')}`;
  return tx.fixedAsset.create({
    data: {
      tenantId,
      code,
      name: `CWIP ${grn.grnNumber}`,
      status: 'CWIP',
      acquiredOn: grn.date,
      cost: dec(amount),
      cwipBalance: dec(amount),
      accountingNbv: dec(amount),
      taxNbv: dec(amount),
      costCenterId: row?.costCenterId || null,
      profitCenterId: row?.profitCenterId || null,
      capitalProjectId: row?.capitalProjectId || null,
      sourceGrnId: grn.id,
      createdBy: createdBy || null
    }
  });
}

module.exports = { classificationForPo, capitalDebitKey, recordCwipReceipt };
