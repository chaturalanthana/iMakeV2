function scalarValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof value.toFixed === 'function') return value.toString();
  return value;
}

function scalars(row) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value) || value instanceof Date) {
      out[key] = scalarValue(value);
    } else if (typeof value === 'object' && typeof value.toFixed === 'function') {
      out[key] = value.toString();
    }
  }
  return out;
}

function changed(before, after) {
  const left = scalars(before);
  const right = scalars(after);
  if (!left) return { before: null, after: right };
  if (!right) return { before: left, after: null };
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const prev = {};
  const next = {};
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) {
      prev[key] = left[key];
      next[key] = right[key];
    }
  }
  return { before: prev, after: next };
}

async function writeAudit(db, { tenantId, userId, action, entity, entityId, before, after }) {
  if (!tenantId || !entity || !entityId) return null;
  const diff = changed(before, after);
  return db.auditLog.create({
    data: {
      tenantId,
      userId: userId || null,
      action,
      entity,
      entityId: String(entityId),
      before: diff.before,
      after: diff.after
    }
  });
}

module.exports = { writeAudit, scalars, changed };
