const prisma = require('../lib/prisma');
const { template, importFile, MODULES } = require('../services/bulkImport');
const { loadActor } = require('../middlewares/rbacMiddleware');
const { hasFullAccess, allows, actionForMethod } = require('../permissions/catalog');

async function authorize(req, res) {
  const moduleName = MODULES[req.params.entity];
  if (!moduleName) {
    res.status(404).json({ error: 'Unknown import.' });
    return null;
  }
  const user = await loadActor(req);
  if (!user?.role) {
    res.status(403).json({ error: 'No role assigned to user' });
    return null;
  }
  if (hasFullAccess(user.role) || allows(user.role.permissions, moduleName, actionForMethod(req.method))) return moduleName;
  res.status(403).json({ error: `Forbidden: Requires ${actionForMethod(req.method)} permission for ${moduleName}` });
  return null;
}

const downloadTemplate = async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const format = String(req.query.format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
    const file = template(req.params.entity, format);
    if (!file) return res.status(404).json({ error: 'Unknown import.' });
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.body);
  } catch (error) {
    console.error('Template download failed', error);
    res.status(500).json({ error: 'Failed to build the template' });
  }
};

const upload = async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const result = await importFile(prisma, req.tenantId, req.user.userId, req.params.entity, req.file);
    res.status(201).json({ created: result.created, errors: [] });
  } catch (error) {
    if (error.errors) {
      return res.status(400).json({ error: error.message, errors: error.errors, created: 0 });
    }
    const status = error.status || 500;
    if (status >= 500) console.error('Import failed', error);
    res.status(status).json({ error: status >= 500 ? 'Import failed' : error.message, errors: [] });
  }
};

module.exports = { downloadTemplate, upload };
