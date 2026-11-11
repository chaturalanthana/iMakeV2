const crypto = require('crypto');
const prisma = require('../lib/prisma');

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

async function sfaAuth(req, res, next) {
  const key = req.get('x-api-key');
  if (!key) return res.status(401).json({ error: 'API key is missing' });
  const row = await prisma.sfaApiKey.findUnique({ where: { keyHash: hashKey(key) } });
  if (!row || !row.active) return res.status(401).json({ error: 'API key is invalid' });
  req.tenantId = row.tenantId;
  req.sfaKey = row;
  next();
}

module.exports = { sfaAuth, hashKey };
