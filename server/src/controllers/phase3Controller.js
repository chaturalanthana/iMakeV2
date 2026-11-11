const prisma = require('../lib/prisma');
const { sendError } = require('../services/errors');
const { deliverPending } = require('../services/phase3/notify');
const { CONFIRMED_DEFAULTS } = require('../services/phase3/defaults');
const { getSettings, saveSettings } = require('../services/phase3/settings');
const { resolvePrice, savePriceRule } = require('../services/phase3/pricing');
const dispatch = require('../services/phase3/dispatch');
const { postCashSale, cancelCashSale } = require('../services/phase3/cashSale');
const { postSalesReturn, cancelSalesReturn } = require('../services/phase3/returns');
const bank = require('../services/phase3/bankFile');

async function finish(req, res, status, result) {
  await deliverPending(prisma, req.tenantId);
  return res.status(status).json(result);
}

function tx(req, res, work, fallback, status = 201) {
  return prisma.$transaction((client) => work(client))
    .then((result) => finish(req, res, status, result))
    .catch((error) => sendError(res, error, fallback));
}

const actor = (req) => req.user?.userId || null;

const getDefaults = (req, res) => res.json(CONFIRMED_DEFAULTS);
const getSettingsRow = async (req, res) => {
  try { res.json(await getSettings(prisma, req.tenantId)); }
  catch (error) { sendError(res, error, 'Failed to load dispatch settings'); }
};
const putSettings = (req, res) => tx(req, res, (db) => saveSettings(db, req.tenantId, req.body), 'Failed to save dispatch settings', 200);

const listRoutes = async (req, res) => {
  const rows = await prisma.deliveryRoute.findMany({ where: { tenantId: req.tenantId }, include: { warehouse: true }, orderBy: { code: 'asc' } });
  res.json(rows);
};
const createRoute = (req, res) => tx(req, res, (db) => db.deliveryRoute.create({
  data: { tenantId: req.tenantId, code: req.body.code, name: req.body.name, warehouseId: req.body.warehouseId || null }
}), 'Failed to save route');

const listVehicles = async (req, res) => {
  res.json(await prisma.vehicle.findMany({ where: { tenantId: req.tenantId }, include: { warehouse: true, route: true }, orderBy: { code: 'asc' } }));
};
const createVehicle = (req, res) => tx(req, res, (db) => db.vehicle.create({
  data: {
    tenantId: req.tenantId,
    code: req.body.code,
    registration: req.body.registration,
    driverName: req.body.driverName || null,
    kind: req.body.kind || 'TRUCK',
    warehouseId: req.body.warehouseId || null,
    routeId: req.body.routeId || null
  }
}), 'Failed to save vehicle');

const listShipTos = async (req, res) => {
  res.json(await prisma.shipTo.findMany({
    where: { tenantId: req.tenantId, ...(req.query.customerId ? { customerId: req.query.customerId } : {}) },
    include: { customer: true },
    orderBy: { code: 'asc' }
  }));
};
const createShipTo = (req, res) => tx(req, res, (db) => db.shipTo.create({
  data: {
    tenantId: req.tenantId,
    customerId: req.body.customerId,
    code: req.body.code,
    name: req.body.name,
    address: req.body.address || null,
    isDefault: Boolean(req.body.isDefault)
  }
}), 'Failed to save ship-to');

const listPrices = async (req, res) => {
  res.json(await prisma.customerPrice.findMany({
    where: { tenantId: req.tenantId },
    include: { product: true, customer: true, category: true },
    orderBy: { createdAt: 'desc' }
  }));
};
const createPrice = (req, res) => tx(req, res, (db) => savePriceRule(db, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) }), 'Failed to save price');

const quote = async (req, res) => {
  try {
    const price = await resolvePrice(prisma, {
      tenantId: req.tenantId,
      customerId: req.query.customerId,
      productId: req.query.productId,
      channel: req.query.channel,
      quantity: Number(req.query.quantity || 1),
      currency: req.query.currency
    });
    res.json(price);
  } catch (error) {
    sendError(res, error, 'Failed to resolve price');
  }
};

const getBoard = async (req, res) => {
  try { res.json(await dispatch.board(prisma, req.tenantId)); }
  catch (error) { sendError(res, error, 'Failed to load dispatch'); }
};

const release = (req, res) => tx(req, res, (db) => dispatch.releaseOrder(db, {
  tenantId: req.tenantId, orderId: req.params.id, userId: actor(req), ...req.body
}), 'Failed to release order', 200);

const cancel = (req, res) => tx(req, res, (db) => dispatch.cancelOpen(db, {
  tenantId: req.tenantId, orderId: req.params.id, userId: actor(req), ...req.body
}), 'Failed to cancel order', 200);

const listPicks = async (req, res) => {
  const picks = await prisma.routePick.findMany({
    where: { tenantId: req.tenantId },
    include: { lines: { include: { product: true } }, route: true, vehicle: true },
    orderBy: { date: 'desc' }
  });
  res.json(picks.map((pick) => dispatch.withSummary(pick)));
};
const createPick = (req, res) => tx(req, res, (db) => dispatch.createRoutePick(db, {
  tenantId: req.tenantId, userId: actor(req), ...req.body
}), 'Failed to create pick list');
const advance = (req, res) => tx(req, res, (db) => dispatch.advancePick(db, {
  tenantId: req.tenantId, pickId: req.params.id, ...req.body
}), 'Failed to update pick list', 200);
const deliver = (req, res) => tx(req, res, (db) => dispatch.createDeliveryNotes(db, {
  tenantId: req.tenantId, pickId: req.params.id, userId: actor(req), date: req.body.date
}), 'Failed to create delivery notes');

const listTrips = async (req, res) => {
  res.json(await prisma.tripSheet.findMany({
    where: { tenantId: req.tenantId },
    include: { vehicle: true, route: true, gatePass: true, deliveries: { include: { delivery: true } } },
    orderBy: { date: 'desc' }
  }));
};
const createTrip = (req, res) => tx(req, res, (db) => dispatch.createTrip(db, {
  tenantId: req.tenantId, userId: actor(req), ...req.body
}), 'Failed to create trip sheet');
const invoiceTrip = (req, res) => tx(req, res, (db) => dispatch.invoiceDeliveries(db, {
  tenantId: req.tenantId, tripId: req.params.id, userId: actor(req), date: req.body.date
}), 'Failed to issue invoices');
const gatePass = (req, res) => tx(req, res, (db) => dispatch.issueGatePass(db, {
  tenantId: req.tenantId, tripId: req.params.id, userId: actor(req), ...req.body
}), 'Failed to issue gate pass');
const cancelTrip = (req, res) => tx(req, res, (db) => dispatch.cancelTrip(db, {
  tenantId: req.tenantId, tripId: req.params.id, userId: actor(req), reason: req.body.reason
}), 'Failed to cancel the trip', 200);
const depart = (req, res) => tx(req, res, (db) => dispatch.departTrip(db, {
  tenantId: req.tenantId, tripId: req.params.id, userId: actor(req)
}), 'Failed to depart', 200);
const returnTrip = (req, res) => tx(req, res, (db) => dispatch.returnTrip(db, {
  tenantId: req.tenantId, tripId: req.params.id
}), 'Failed to record the return', 200);

const recordProof = (req, res) => tx(req, res, (db) => dispatch.recordProof(db, {
  tenantId: req.tenantId, userId: actor(req), ...req.body
}), 'Failed to record proof of delivery');
const creditProof = async (req, res) => {
  try {
    const created = await dispatch.creditRejected(prisma, {
      tenantId: req.tenantId, proofId: req.params.id, userId: actor(req), ...req.body
    });
    return finish(req, res, 201, created);
  } catch (error) {
    return sendError(res, error, 'Failed to credit the rejection');
  }
};

const listReturns = async (req, res) => {
  res.json(await prisma.salesReturn.findMany({
    where: { tenantId: req.tenantId },
    include: { customer: true, invoice: true, lines: { include: { product: true } } },
    orderBy: { date: 'desc' }
  }));
};
const createReturn = async (req, res) => {
  try {
    const created = await postSalesReturn(prisma, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) });
    return finish(req, res, 201, created);
  } catch (error) {
    return sendError(res, error, 'Failed to post the return');
  }
};

const cancelCash = async (req, res) => {
  try {
    const invoice = await cancelCashSale(prisma, {
      tenantId: req.tenantId, invoiceId: req.params.id, userId: actor(req), reason: req.body.reason
    });
    return finish(req, res, 200, invoice);
  } catch (error) {
    return sendError(res, error, 'Failed to cancel the cash sale');
  }
};
const cancelReturn = async (req, res) => {
  try {
    const row = await cancelSalesReturn(prisma, {
      tenantId: req.tenantId, id: req.params.id, userId: actor(req), reason: req.body.reason
    });
    return finish(req, res, 200, row);
  } catch (error) {
    return sendError(res, error, 'Failed to cancel the return');
  }
};
const cashSale = async (req, res) => {
  try {
    const invoice = await postCashSale(prisma, { ...req.body, tenantId: req.tenantId, createdBy: actor(req) });
    return finish(req, res, 201, invoice);
  } catch (error) {
    return sendError(res, error, 'Failed to post the cash sale');
  }
};

const listNotes = async (req, res) => {
  res.json(await prisma.appNotification.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100
  }));
};
const readNote = async (req, res) => {
  const note = await prisma.appNotification.updateMany({
    where: { id: req.params.id, tenantId: req.tenantId },
    data: { readAt: new Date() }
  });
  res.json({ updated: note.count });
};

const getBank = async (req, res) => {
  try { res.json(await bank.templateFor(prisma, req.tenantId)); }
  catch (error) { sendError(res, error, 'Failed to load the bank file'); }
};
const putBank = (req, res) => tx(req, res, (db) => bank.saveTemplate(db, req.tenantId, req.body), 'Failed to save the bank file', 200);
const exportBank = async (req, res) => {
  try {
    const file = await bank.exportCollections(prisma, { tenantId: req.tenantId, userId: actor(req), ...req.body });
    res.status(201).json(file);
  } catch (error) {
    sendError(res, error, 'Failed to export the bank file');
  }
};

module.exports = {
  getDefaults, getSettingsRow, putSettings,
  listRoutes, createRoute, listVehicles, createVehicle, listShipTos, createShipTo,
  listPrices, createPrice, quote, getBoard, release, cancel,
  listPicks, createPick, advance, deliver,
  listTrips, createTrip, invoiceTrip, gatePass, depart, returnTrip, cancelTrip,
  recordProof, creditProof, listReturns, createReturn, cancelReturn, cashSale, cancelCash,
  listNotes, readNote,
  getBank, putBank, exportBank
};
