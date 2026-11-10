const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const { scanWorkOrder, ProductionError } = require('./production/workOrders');

const CODE39 = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
};

function code39Svg(value) {
  const text = String(value || '').toUpperCase();
  if (![...text].every((char) => CODE39[char])) return '';
  const encoded = `*${text}*`;
  let x = 0;
  const bars = [];
  const narrow = 2;
  const wide = 5;
  [...encoded].forEach((char, index) => {
    const pattern = CODE39[char];
    [...pattern].forEach((width, element) => {
      const size = width === 'w' ? wide : narrow;
      if (element % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${size}" height="70" fill="#000"/>`);
      x += size;
    });
    if (index < encoded.length - 1) x += narrow;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 70" width="${x}" height="70">${bars.join('')}</svg>`;
}

async function qrSvg(value) {
  const svg = await QRCode.toString(String(value), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', width: 180 });
  return svg.replace(/<\?xml[^>]*>/, '').trim();
}

async function labelFor(payload, title, subtitle) {
  return {
    title,
    subtitle,
    payload,
    qrSvg: await qrSvg(payload),
    barcodeSvg: code39Svg(payload)
  };
}

async function renderLabels(tenantId, body) {
  const type = String(body.type || 'item');
  const codes = [...new Set((Array.isArray(body.codes) ? body.codes : [body.code]).map((code) => String(code || '').trim()).filter(Boolean))];
  if (!codes.length) {
    const error = new Error('Choose at least one label.');
    error.status = 400;
    throw error;
  }
  const labels = [];
  if (type === 'work-order') {
    for (const code of codes) {
      const order = await scanWorkOrder(tenantId, code);
      labels.push(await labelFor(order.orderNumber, order.orderNumber, order.product ? `${order.product.code} — ${order.product.name}` : 'Work order'));
    }
    return { labels };
  }
  if (type === 'lot') {
    for (const code of codes) {
      const parts = code.split(':');
      const productCode = parts[0] === 'LOT' ? parts[1] : parts[0];
      const lotNumber = parts[0] === 'LOT' ? parts.slice(2).join(':') : parts.slice(1).join(':');
      const product = await prisma.product.findFirst({
        where: { tenantId, code: { equals: productCode, mode: 'insensitive' } }
      });
      if (!product || !lotNumber) {
        const error = new ProductionError(`Lot ${code} was not found`, 404);
        throw error;
      }
      labels.push(await labelFor(`LOT:${product.code}:${lotNumber}`, product.code, `Lot ${lotNumber}`));
    }
    return { labels };
  }
  for (const code of codes) {
    const product = await prisma.product.findFirst({
      where: { tenantId, code: { equals: code, mode: 'insensitive' } }
    });
    if (!product) {
      const error = new ProductionError(`Item ${code} was not found`, 404);
      throw error;
    }
    labels.push(await labelFor(product.code, product.code, product.name));
  }
  return { labels };
}

async function resolveCode(tenantId, raw) {
  const code = String(raw || '').trim();
  if (!code) {
    const error = new ProductionError('Scan a code');
    throw error;
  }
  if (/^LOT:/i.test(code)) {
    const [, productCode, ...rest] = code.split(':');
    const lotNumber = rest.join(':');
    const product = await prisma.product.findFirst({
      where: { tenantId, code: { equals: productCode, mode: 'insensitive' } }
    });
    if (!product) throw new ProductionError('Item not found', 404);
    return { kind: 'lot', lotNumber, product: publicProduct(product) };
  }
  try {
    const order = await scanWorkOrder(tenantId, code.replace(/^WO:/i, ''));
    return {
      kind: 'workOrder',
      workOrder: { id: order.id, orderNumber: order.orderNumber, status: order.status, product: order.product ? publicProduct(order.product) : null }
    };
  } catch (error) {
    if (error.status && error.status !== 404) throw error;
  }
  const product = await prisma.product.findFirst({
    where: { tenantId, code: { equals: code.replace(/^ITEM:/i, ''), mode: 'insensitive' } }
  });
  if (product) return { kind: 'item', product: publicProduct(product) };
  const layer = await prisma.costLayer.findFirst({
    where: { tenantId, lotNumber: { equals: code, mode: 'insensitive' } },
    include: { product: true }
  });
  if (layer?.product) return { kind: 'lot', lotNumber: layer.lotNumber, product: publicProduct(layer.product) };
  throw new ProductionError('Nothing matched that scan', 404);
}

function publicProduct(product) {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    costPrice: Number(product.costPrice || 0),
    sellingPrice: Number(product.sellingPrice || 0)
  };
}

async function catalog(tenantId) {
  const [products, layers, orders] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, activeStatus: { not: 'INACTIVE' } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 300
    }),
    prisma.costLayer.findMany({
      where: { tenantId, lotNumber: { not: null } },
      include: { product: { select: { code: true, name: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 200
    }),
    prisma.workOrder.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      select: { id: true, orderNumber: true, status: true, product: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  ]);
  const lots = [];
  const seen = new Set();
  layers.forEach((layer) => {
    if (!layer.lotNumber || !layer.product) return;
    const key = `${layer.product.code}:${layer.lotNumber}`;
    if (seen.has(key)) return;
    seen.add(key);
    lots.push({ code: `LOT:${layer.product.code}:${layer.lotNumber}`, productCode: layer.product.code, name: layer.product.name, lotNumber: layer.lotNumber });
  });
  return { products, lots, workOrders: orders };
}

module.exports = {
  renderLabels,
  resolveCode,
  catalog,
  code39Svg
};
