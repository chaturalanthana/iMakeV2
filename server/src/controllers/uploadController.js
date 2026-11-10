const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

function relativeUploadPath(req) {
  const raw = decodeURIComponent((req.path || '').split('?')[0]);
  const marker = '/uploads/';
  const index = raw.indexOf(marker);
  return (index >= 0 ? raw.slice(index + marker.length) : raw.replace(/^\/+/, '')).replace(/\\/g, '/');
}

const serveUpload = async (req, res) => {
  try {
    const relative = relativeUploadPath(req);
    if (!relative || relative.includes('\0') || relative.split('/').includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const publicPath = `/uploads/${relative}`.replace(/\/{2,}/g, '/');
    const resource = await prisma.bOMResource.findFirst({
      where: { tenantId: req.tenantId, filePath: publicPath }
    });
    if (!resource) return res.status(404).json({ error: 'File not found' });

    const absolute = path.resolve(UPLOAD_ROOT, relative);
    const rootWithSep = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep;
    if (absolute !== UPLOAD_ROOT && !absolute.startsWith(rootWithSep)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filename = String(resource.fileName || 'file').replace(/["\r\n]/g, '');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.sendFile(absolute);
  } catch (error) {
    console.error('Serve upload error:', error);
    return res.status(500).json({ error: 'Failed to read file' });
  }
};

module.exports = { serveUpload, UPLOAD_ROOT };
