const { getSettings } = require('./settings');

async function notify(db, { tenantId, userId, kind, title, body, entityType, entityId }) {
  const settings = await getSettings(db, tenantId);
  const emailStatus = settings.emailHookEnabled && settings.emailHookUrl ? 'PENDING' : 'SKIPPED';
  return db.appNotification.create({
    data: {
      tenantId,
      userId: userId || null,
      kind,
      title,
      body,
      entityType: entityType || null,
      entityId: entityId || null,
      emailStatus
    }
  });
}

async function deliverPending(db, tenantId) {
  const settings = await getSettings(db, tenantId);
  if (!settings.emailHookEnabled || !settings.emailHookUrl) return [];
  const rows = await db.appNotification.findMany({
    where: { tenantId, emailStatus: 'PENDING' },
    take: 25,
    orderBy: { createdAt: 'asc' }
  });
  const sent = [];
  for (const row of rows) {
    try {
      const response = await fetch(settings.emailHookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: row.kind,
          title: row.title,
          body: row.body,
          entityType: row.entityType,
          entityId: row.entityId
        }),
        signal: AbortSignal.timeout(2500)
      });
      const updated = await db.appNotification.update({
        where: { id: row.id },
        data: {
          emailStatus: response.ok ? 'SENT' : 'FAILED',
          emailError: response.ok ? null : `HTTP ${response.status}`
        }
      });
      sent.push(updated);
    } catch (error) {
      sent.push(await db.appNotification.update({
        where: { id: row.id },
        data: { emailStatus: 'FAILED', emailError: error.message }
      }));
    }
  }
  return sent;
}

module.exports = { notify, deliverPending };
