const prisma = require('../lib/prisma');
const { syncLegacy } = require('../services/production/workOrders');

const mirrorJob = async (job, { receiptOnComplete = false, userId = null, db = prisma } = {}) => {
  if (!job) return null;
  return syncLegacy(db, {
    tenantId: job.tenantId,
    userId: userId || job.createdBy || null,
    legacy: job,
    kind: 'job',
    sourceType: job.notes === 'MRP' ? 'MRP' : 'MIGRATED_JOB',
    receiptOnComplete
  });
};

const getProductionJobs = async (req, res) => {
  try {
    const jobs = await prisma.productionJob.findMany({
      where: { tenantId: req.tenantId },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            standardCost: true,
            stockUom: { select: { name: true } },
            uom: { select: { name: true } }
          }
        },
        bom: {
          select: { id: true, code: true, name: true, version: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    console.error('Fetch production jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch production jobs' });
  }
};

const createProductionJob = async (req, res) => {
  try {
    const { productId, bomId, quantity, status, priority, startDate, endDate, assignedTo, workCenterId, notes } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product is required' });
    }
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });
    if (!product) {
      return res.status(400).json({ error: 'Product not found' });
    }
    if (product.activeStatus === 'INACTIVE') {
      return res.status(400).json({ error: 'Inactive products cannot be planned' });
    }
    if (status && status !== 'QUEUED') {
      return res.status(400).json({ error: 'New jobs start as scheduled' });
    }

    // Resolve default active BOM if none provided
    let finalBomId = bomId;
    if (!finalBomId) {
      const activeBom = await prisma.bOM.findFirst({
        where: {
          tenantId: req.tenantId,
          productId,
          status: 'ACTIVE',
          isDefault: true
        }
      });
      if (activeBom) {
        finalBomId = activeBom.id;
      }
    }

    const jobNumber = await nextJobNumber(req.tenantId);

    const job = await prisma.productionJob.create({
      data: {
        tenantId: req.tenantId,
        jobNumber,
        productId,
        bomId: finalBomId || null,
        quantity: parsedQty,
        status: status || 'QUEUED',
        priority: priority || 'MEDIUM',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        assignedTo,
        workCenterId,
        notes,
        createdBy: req.user.userId
      },
      include: {
        product: true,
        bom: true
      }
    });

    await mirrorJob(job, { userId: req.user?.userId || null });
    res.status(201).json(job);
  } catch (error) {
    console.error('Create production job error:', error);
    res.status(500).json({ error: 'Failed to create production job' });
  }
};

const updateProductionJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, bomId, quantity, status, priority, startDate, endDate, assignedTo, workCenterId, notes } = req.body;

    const job = await prisma.productionJob.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!job) {
      return res.status(404).json({ error: 'Production job not found' });
    }

    if (quantity !== undefined) {
      const parsedQty = parseFloat(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than zero' });
      }
    }

    if (status && !['QUEUED', 'WIP', 'QC', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid job status' });
    }
    if (status && status !== job.status) {
      const transitionError = jobTransitionError(job.status, status);
      if (transitionError) return res.status(400).json({ error: transitionError });
    }
    if (productId && productId !== job.productId) {
      const nextProduct = await prisma.product.findFirst({
        where: { id: productId, tenantId: req.tenantId }
      });
      if (!nextProduct) return res.status(400).json({ error: 'Product not found' });
      if (nextProduct.activeStatus === 'INACTIVE') {
        return res.status(400).json({ error: 'Inactive products cannot be planned' });
      }
    }

    if (priority && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid job priority' });
    }
    const samePlanDay = (incoming, current) => {
      if (incoming === undefined) return true;
      if (!incoming && !current) return true;
      if (!incoming || !current) return false;
      const next = new Date(incoming);
      const prev = new Date(current);
      if (Number.isNaN(next.getTime()) || Number.isNaN(prev.getTime())) return false;
      return Math.abs(next.getTime() - prev.getTime()) < 12 * 60 * 60 * 1000;
    };
    if (['WIP', 'QC', 'COMPLETED', 'CANCELLED'].includes(job.status)
      && (!samePlanDay(startDate, job.startDate) || !samePlanDay(endDate, job.endDate))) {
      return res.status(400).json({ error: 'Completed and in-progress jobs keep their plan dates' });
    }

    const updated = await prisma.productionJob.update({
      where: { id },
      data: {
        productId: productId !== undefined ? productId : job.productId,
        bomId: bomId !== undefined ? (bomId || null) : job.bomId,
        quantity: quantity !== undefined ? parseFloat(quantity) : job.quantity,
        status: status !== undefined ? status : job.status,
        priority: priority !== undefined ? priority : job.priority,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : job.startDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : job.endDate,
        assignedTo: assignedTo !== undefined ? assignedTo : job.assignedTo,
        workCenterId: workCenterId !== undefined ? workCenterId : job.workCenterId,
        notes: notes !== undefined ? notes : job.notes
      },
      include: {
        product: true,
        bom: true
      }
    });

    await mirrorJob(updated, {
      userId: req.user?.userId || null,
      receiptOnComplete: status === 'COMPLETED' && job.status !== 'COMPLETED'
    });
    res.json(updated);
  } catch (error) {
    console.error('Update production job error:', error);
    res.status(500).json({ error: 'Failed to update production job' });
  }
};

const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['QUEUED', 'WIP', 'QC', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid job status provided' });
    }

    const job = await prisma.productionJob.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!job) {
      return res.status(404).json({ error: 'Production job not found' });
    }
    if (status !== job.status) {
      const transitionError = jobTransitionError(job.status, status);
      if (transitionError) return res.status(400).json({ error: transitionError });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.productionJob.update({
        where: { id },
        data: { status },
        include: { product: true, bom: true }
      });
      await mirrorJob(row, {
        userId: req.user?.userId || null,
        db: tx,
        receiptOnComplete: status === 'COMPLETED'
      });
      return row;
    });

    res.json(updated);
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
};

const JOB_NEXT = {
  QUEUED: ['WIP', 'CANCELLED'],
  WIP: ['QC', 'CANCELLED'],
  QC: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const jobTransitionError = (current, next) => {
  if (current === next) return null;
  if ((JOB_NEXT[current] || []).includes(next)) return null;
  return 'Move the job one step at a time: Scheduled, In Progress, Inspection, then Completed';
};

const parsePlanDay = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const nextJobNumber = async (tenantId, db = prisma) => {
  const date = new Date();
  const prefix = `JOB-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const existing = await db.productionJob.findMany({
    where: { tenantId, jobNumber: { startsWith: prefix } },
    select: { jobNumber: true }
  });
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  existing.forEach((row) => {
    const match = pattern.exec(row.jobNumber || '');
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};

const splitProductionJob = async (req, res) => {
  try {
    const { id } = req.params;
    const splitQty = parseFloat(req.body.quantity);
    const cut = parsePlanDay(req.body.splitDate);

    const job = await prisma.productionJob.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!job) {
      return res.status(404).json({ error: 'Production job not found' });
    }
    if (job.status !== 'QUEUED') {
      return res.status(400).json({ error: 'Only scheduled jobs can be split' });
    }
    if (!job.startDate || !job.endDate) {
      return res.status(400).json({ error: 'This job has no schedule to split' });
    }

    const originalQty = parseFloat(job.quantity);
    if (!(splitQty > 0) || splitQty >= originalQty) {
      return res.status(400).json({ error: 'Split quantity must be less than the job quantity' });
    }

    const start = parsePlanDay(job.startDate);
    const end = parsePlanDay(job.endDate);
    if (!cut || cut <= start || cut > end) {
      return res.status(400).json({ error: 'Split date must fall inside the job' });
    }

    const originalEnd = new Date(cut);
    originalEnd.setDate(originalEnd.getDate() - 1);

    const created = await prisma.$transaction(async (tx) => {
      await tx.productionJob.update({
        where: { id: job.id },
        data: {
          quantity: originalQty - splitQty,
          endDate: originalEnd
        }
      });
      const createdJob = await tx.productionJob.create({
        data: {
          tenantId: req.tenantId,
          jobNumber: await nextJobNumber(req.tenantId, tx),
          productId: job.productId,
          bomId: job.bomId,
          quantity: splitQty,
          status: 'QUEUED',
          priority: job.priority,
          startDate: cut,
          endDate: end,
          assignedTo: job.assignedTo,
          workCenterId: job.workCenterId,
          notes: job.notes,
          createdBy: req.user.userId
        }
      });
      const shortened = await tx.productionJob.findUnique({ where: { id: job.id } });
      await mirrorJob(shortened, { userId: req.user.userId, db: tx });
      await mirrorJob(createdJob, { userId: req.user.userId, db: tx });
      return createdJob;
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Split production job error:', error);
    res.status(500).json({ error: 'Failed to split production job' });
  }
};

const mergeProductionJobs = async (req, res) => {
  try {
    const jobIds = Array.isArray(req.body.jobIds) ? [...new Set(req.body.jobIds)] : [];
    if (jobIds.length < 2) {
      return res.status(400).json({ error: 'Select at least two jobs' });
    }

    const jobs = await prisma.productionJob.findMany({
      where: { id: { in: jobIds }, tenantId: req.tenantId }
    });
    if (jobs.length !== jobIds.length) {
      return res.status(404).json({ error: 'Production job not found' });
    }
    if (new Set(jobs.map((job) => job.productId)).size !== 1) {
      return res.status(400).json({ error: 'Only jobs for the same product can be merged' });
    }
    if (jobs.some((job) => job.status !== 'QUEUED')) {
      return res.status(400).json({ error: 'Only scheduled jobs can be merged' });
    }

    const keeper = [...jobs].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0))[0];
    const quantity = jobs.reduce((sum, job) => sum + parseFloat(job.quantity), 0);
    const starts = jobs.map((job) => job.startDate).filter(Boolean).map((value) => new Date(value));
    const ends = jobs.map((job) => job.endDate).filter(Boolean).map((value) => new Date(value));
    const removeIds = jobs.filter((job) => job.id !== keeper.id).map((job) => job.id);

    const updated = await prisma.$transaction(async (tx) => {
      const merged = await tx.productionJob.update({
        where: { id: keeper.id },
        data: {
          quantity,
          startDate: starts.length ? new Date(Math.min(...starts.map((date) => date.getTime()))) : null,
          endDate: ends.length ? new Date(Math.max(...ends.map((date) => date.getTime()))) : null
        }
      });
      await tx.productionJob.deleteMany({ where: { id: { in: removeIds }, tenantId: req.tenantId } });
      await mirrorJob(merged, { userId: req.user?.userId || null, db: tx });
      return merged;
    });

    res.json(updated);
  } catch (error) {
    console.error('Merge production jobs error:', error);
    res.status(500).json({ error: 'Failed to merge production jobs' });
  }
};

const deleteProductionJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.productionJob.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!job) {
      return res.status(404).json({ error: 'Production job not found' });
    }

    // Safety rule for planners
    if (!['QUEUED', 'CANCELLED'].includes(job.status)) {
      return res.status(400).json({ error: 'Cannot delete jobs that are currently in progress or completed' });
    }

    await prisma.productionJob.delete({
      where: { id }
    });

    res.json({ message: 'Production job deleted successfully' });
  } catch (error) {
    console.error('Delete production job error:', error);
    res.status(500).json({ error: 'Failed to delete production job' });
  }
};

module.exports = {
  getProductionJobs,
  createProductionJob,
  updateProductionJob,
  updateJobStatus,
  splitProductionJob,
  mergeProductionJobs,
  deleteProductionJob
};
