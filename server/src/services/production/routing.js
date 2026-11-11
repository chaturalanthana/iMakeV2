const prisma = require('../../lib/prisma');
const { num } = require('./costing');

const stepNumber = (step, index) => {
  const sequence = Number(step.sequence || step.stepNumber || (index + 1) * 10);
  return Number.isFinite(sequence) ? sequence : (index + 1) * 10;
};

async function syncRoutingForBom(bomId, db = prisma) {
  const bom = await db.bOM.findUnique({ where: { id: bomId } });
  if (!bom) return null;
  const steps = Array.isArray(bom.routingSteps) ? bom.routingSteps : [];
  const workstations = await db.workstation.findMany({ where: { tenantId: bom.tenantId } });
  const byCode = new Map(workstations.map((row) => [String(row.code || '').trim().toLowerCase(), row]));
  const byId = new Map(workstations.map((row) => [row.id, row]));

  const operations = steps.map((step, index) => {
    const code = String(step.workCenter || step.workstationCode || '').trim().toLowerCase();
    const workstation = (step.workstationId && byId.get(step.workstationId)) || (code ? byCode.get(code) : null);
    return {
      tenantId: bom.tenantId,
      sequence: stepNumber(step, index),
      name: step.operation || step.name || `Operation ${index + 1}`,
      workstationId: workstation?.id || null,
      setupMinutes: num(step.setupMin ?? step.setupMinutes ?? 0),
      runMinutesPerUnit: num(step.runMin ?? step.runMinutesPerUnit ?? step.durationMinutes ?? 0),
      noOfWorkers: Math.max(1, parseInt(step.noOfWorkers, 10) || 1),
      isSubcontract: Boolean(step.isSubcontract || step.subcontract),
      subcontractCostPerUnit: num(step.subcontractCostPerUnit || 0),
      milestoneWeight: num(step.milestoneWeight || step.weight || 0),
      instructions: step.instructions || null
    };
  });

  const existing = await db.routing.findUnique({ where: { bomId } });
  if (!existing) {
    return db.routing.create({
      data: {
        tenantId: bom.tenantId,
        bomId,
        code: bom.code,
        version: bom.version,
        operations: { create: operations }
      },
      include: { operations: true }
    });
  }

  await db.routingOperation.deleteMany({ where: { routingId: existing.id } });
  return db.routing.update({
    where: { id: existing.id },
    data: {
      code: bom.code,
      version: bom.version,
      operations: { create: operations }
    },
    include: { operations: true }
  });
}

module.exports = {
  syncRoutingForBom
};
