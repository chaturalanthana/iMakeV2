const { DocumentError } = require('../errors');
const { num, money, dec } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { postIssueDocument, finalizeSalesInvoice, creditWarning } = require('../documentPosting');
const { assertPeriodOpen, submitApproval, assertStockCovered } = require('./bridges');
const { quoteDiscount } = require('./pricing');
const { getSettings } = require('./settings');
const {
  availableQty, reserveOrder, reservedForOrder, consumeOrder, releaseOrderHold, reduceHold
} = require('./reservations');
const { notify } = require('./notify');
const { postSalesReturn } = require('./returns');

const RELEASABLE = ['PENDING', 'DRAFT', 'CONFIRMED', 'PENDING_APPROVAL'];

function openQty(item) {
  return money(num(item.quantity) - num(item.cancelledQty));
}

async function qtyByProduct(db, model, where) {
  const rows = await db[model].findMany({ where, include: { items: true } });
  const map = {};
  for (const row of rows) {
    if (row.status === 'CANCELLED') continue;
    for (const item of row.items || []) {
      map[item.productId] = money((map[item.productId] || 0) + num(item.quantity));
    }
  }
  return map;
}

async function overdueBalance(db, tenantId, customer) {
  const invoices = await db.salesInvoice.findMany({
    where: { tenantId, customerId: customer.id, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } }
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let overdue = 0;
  for (const invoice of invoices) {
    const open = money(num(invoice.total) - num(invoice.amountPaid));
    if (open <= 0.0001) continue;
    const due = invoice.dueDate
      ? new Date(invoice.dueDate)
      : new Date(new Date(invoice.date).getTime() + (customer.creditPeriod || 0) * 86400000);
    if (due < today) overdue = money(overdue + open);
  }
  return overdue;
}

async function refreshOrderStatus(db, orderId) {
  const order = await db.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.status === 'CANCELLED') return order;
  const shipped = await qtyByProduct(db, 'salesDelivery', { orderId, status: 'DELIVERED' });
  let all = true;
  let any = false;
  let anyOpen = false;
  for (const item of order.items) {
    const open = openQty(item);
    if (open <= 0.0001) continue;
    anyOpen = true;
    const got = shipped[item.productId] || 0;
    if (got > 0) any = true;
    if (got + 0.0001 < open) all = false;
  }
  let status = order.status;
  if (!anyOpen) status = any ? order.status : 'CANCELLED';
  else if (all && any) status = 'DELIVERED';
  else if (any) status = 'PARTIALLY_DELIVERED';
  else if (['RELEASED', 'PARTIALLY_DELIVERED'].includes(order.status)) status = 'RELEASED';
  if (status !== order.status) {
    return db.salesOrder.update({ where: { id: orderId }, data: { status } });
  }
  return order;
}

async function releaseOrder(db, input) {
  const order = await db.salesOrder.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
    include: { items: true, customer: true }
  });
  if (!order) throw new DocumentError('Order not found.', { orderId: 'Order not found.' });
  if (!RELEASABLE.includes(String(order.status || '').toUpperCase())) {
    throw new DocumentError('This order cannot be released.', { status: 'This order cannot be released.' });
  }
  const customer = order.customer;
  if (customer.activeStatus && customer.activeStatus !== 'ACTIVE') {
    throw new DocumentError('Customer is not active.', { customerId: 'Customer is not active.' });
  }
  const channel = input.channel || order.channel || 'GENERAL_TRADE';
  if (['GENERAL_TRADE', 'MODERN_TRADE'].includes(channel) && customer.allowCreditSales === false) {
    throw new DocumentError('Customer is not approved for credit sales.', { customerId: 'Customer is not approved for credit sales.' });
  }
  const warehouseId = input.warehouseId || order.warehouseId;
  if (!warehouseId) throw new DocumentError('Warehouse is required.', { warehouseId: 'Warehouse is required.' });
  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, tenantId: input.tenantId } });
  if (!warehouse) throw new DocumentError('Warehouse is required.', { warehouseId: 'Unknown warehouse.' });
  await assertPeriodOpen(db, { tenantId: input.tenantId, date: order.date, userId: input.userId });

  const settings = await getSettings(db, input.tenantId);
  let maxDiscount = 0;
  for (const item of order.items) {
    if (!(openQty(item) > 0)) continue;
    const check = await quoteDiscount(db, {
      tenantId: input.tenantId,
      customerId: customer.id,
      productId: item.productId,
      channel,
      quantity: openQty(item),
      unitPrice: num(item.unitPrice),
      onDate: order.date
    });
    maxDiscount = Math.max(maxDiscount, check.discount);
    if (check.exceeded) {
      const approved = db.approvalRequest
        ? await db.approvalRequest.findFirst({
          where: { tenantId: input.tenantId, documentType: 'PRICE_DISCOUNT', documentId: order.id, status: 'APPROVED' }
        })
        : null;
      if (!approved) {
        const approval = await submitApproval(db, {
          tenantId: input.tenantId,
          documentType: 'PRICE_DISCOUNT',
          documentId: order.id,
          documentNumber: order.orderNumber,
          amount: check.discount,
          userId: input.userId
        });
        if (approval?.status === 'PENDING') {
          await db.salesOrder.update({ where: { id: order.id }, data: { status: 'PENDING_APPROVAL', channel } });
          return { order: await db.salesOrder.findUnique({ where: { id: order.id } }), pendingApproval: true };
        }
        throw new DocumentError(
          `Discount of ${check.discount}% is above the ${check.limit}% limit.`,
          { discount: `Discount of ${check.discount}% is above the ${check.limit}% limit.` }
        );
      }
    }
    if (num(item.listPrice) <= 0) {
      await db.salesOrderItem.update({
        where: { id: item.id },
        data: { listPrice: dec(check.quote.price), discountPercent: dec(check.discount) }
      });
    }
  }

  const baseTotal = money(order.items.reduce((sum, item) => sum + openQty(item) * num(item.unitPrice), 0) * (num(order.exchangeRate) || 1));
  if (settings.blockCreditOverLimit) {
    const warning = await creditWarning(db, { tenantId: input.tenantId, customerId: customer.id, documentBase: baseTotal });
    if (warning) throw new DocumentError(warning, { credit: warning });
  }
  if (settings.blockOverdue) {
    const overdue = await overdueBalance(db, input.tenantId, customer);
    if (overdue > 0.0001) {
      const message = `Customer has ${overdue.toFixed(2)} overdue.`;
      throw new DocumentError(message, { credit: message });
    }
  }

  const reserveLines = [];
  const shortages = [];
  for (const item of order.items) {
    const requested = openQty(item);
    if (!(requested > 0)) continue;
    const product = await db.product.findFirst({ where: { id: item.productId, tenantId: input.tenantId } });
    if (product?.type === 'SERVICE') continue;
    const available = await availableQty(db, {
      tenantId: input.tenantId,
      productId: item.productId,
      warehouseId,
      exceptSourceId: order.id
    });
    let reserve = requested;
    if (requested - available > 0.0001) {
      if (settings.shortagePolicy === 'BLOCK') {
        throw new DocumentError('Not enough stock to release this order.', {
          quantity: 'Not enough stock to release this order.'
        });
      }
      reserve = money(Math.max(0, available));
      shortages.push({ productId: item.productId, requested, reserved: reserve, short: money(requested - reserve) });
    }
    if (reserve > 0) reserveLines.push({ orderItemId: item.id, productId: item.productId, quantity: reserve });
  }
  const held = await reserveOrder(db, { tenantId: input.tenantId, orderId: order.id, warehouseId, lines: reserveLines });
  const updated = await db.salesOrder.update({
    where: { id: order.id },
    data: {
      status: 'RELEASED',
      channel,
      warehouseId,
      routeId: input.routeId || order.routeId,
      vehicleId: input.vehicleId || order.vehicleId,
      shipToId: input.shipToId || order.shipToId,
      discountPercent: dec(maxDiscount),
      releasedAt: new Date(),
      releasedBy: input.userId || null
    },
    include: { items: true, customer: true }
  });
  await notify(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'ORDER_RELEASED',
    title: `Order ${order.orderNumber} released`,
    body: shortages.length ? 'Released with a shortage on at least one line.' : 'Released for picking.',
    entityType: 'SALES_ORDER',
    entityId: order.id
  });
  return { order: updated, shortages, reservations: held.allocations || held };
}

async function cancelOpen(db, input) {
  if (!input.reason || String(input.reason).trim().length < 2) {
    throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  }
  const order = await db.salesOrder.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
    include: { items: true }
  });
  if (!order) throw new DocumentError('Order not found.', { orderId: 'Order not found.' });
  if (order.status === 'CANCELLED') throw new DocumentError('Order is already cancelled.', { status: 'Order is already cancelled.' });
  const shipped = await qtyByProduct(db, 'salesDelivery', { orderId: order.id, status: 'DELIVERED' });
  const billed = await qtyByProduct(db, 'salesInvoice', { orderId: order.id, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } });
  const requested = input.lines?.length
    ? input.lines
    : order.items.map((item) => ({ orderItemId: item.id }));
  const done = [];
  for (const row of requested) {
    const item = order.items.find((line) => line.id === row.orderItemId);
    if (!item) throw new DocumentError('Order line not found.', { orderItemId: 'Order line not found.' });
    const locked = Math.max(shipped[item.productId] || 0, billed[item.productId] || 0);
    const cancellable = money(openQty(item) - locked);
    const qty = row.quantity === undefined || row.quantity === null ? cancellable : money(row.quantity);
    if (!(qty > 0)) continue;
    if (qty - cancellable > 0.0001) {
      throw new DocumentError('Delivered or invoiced quantities need a return or credit note.', {
        quantity: 'Delivered or invoiced quantities need a return or credit note.'
      });
    }
    await db.salesOrderItem.update({
      where: { id: item.id },
      data: { cancelledQty: dec(money(num(item.cancelledQty) + qty)) }
    });
    await db.orderCancellation.create({
      data: {
        tenantId: input.tenantId,
        orderId: order.id,
        orderItemId: item.id,
        quantity: dec(qty),
        reason: String(input.reason).trim(),
        actorId: input.userId || null
      }
    });
    await reduceHold(db, { tenantId: input.tenantId, orderId: order.id, productId: item.productId, quantity: qty });
    item.cancelledQty = money(num(item.cancelledQty) + qty);
    done.push({ orderItemId: item.id, quantity: qty });
  }
  if (!done.length) {
    throw new DocumentError('Nothing is left to cancel.', { quantity: 'Nothing is left to cancel.' });
  }
  const refreshed = await db.salesOrder.findUnique({ where: { id: order.id }, include: { items: true } });
  const stillOpen = refreshed.items.some((item) => openQty(item) - Math.max(shipped[item.productId] || 0, billed[item.productId] || 0) > 0.0001);
  if (!stillOpen && Object.keys(shipped).length === 0 && Object.keys(billed).length === 0) {
    await releaseOrderHold(db, input.tenantId, order.id);
    await db.salesOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  }
  return db.salesOrder.findUnique({
    where: { id: order.id },
    include: { items: true, cancellations: true, customer: true }
  });
}

async function createRoutePick(db, input) {
  const orderIds = [...new Set(input.orderIds || [])];
  if (!orderIds.length) throw new DocumentError('Choose at least one order.', { orderIds: 'Choose at least one order.' });
  if (!input.warehouseId) throw new DocumentError('Warehouse is required.', { warehouseId: 'Warehouse is required.' });
  const orders = await db.salesOrder.findMany({
    where: { tenantId: input.tenantId, id: { in: orderIds } },
    include: { items: true }
  });
  if (orders.length !== orderIds.length) throw new DocumentError('Order not found.', { orderIds: 'Order not found.' });
  const lines = [];
  for (const order of orders) {
    if (!['RELEASED', 'PARTIALLY_DELIVERED'].includes(order.status)) {
      throw new DocumentError(`${order.orderNumber} is not released.`, { orderIds: `${order.orderNumber} is not released.` });
    }
    const shipped = await qtyByProduct(db, 'salesDelivery', { orderId: order.id, status: 'DELIVERED' });
    const held = await reservedForOrder(db, input.tenantId, order.id);
    for (const item of order.items) {
      const remaining = money(openQty(item) - (shipped[item.productId] || 0));
      if (!(remaining > 0)) continue;
      const hold = held.find((row) => row.orderItemId === item.id) || held.find((row) => row.productId === item.productId);
      const quantity = hold ? money(Math.min(remaining, hold.quantity)) : remaining;
      if (!(quantity > 0)) continue;
      lines.push({ orderItemId: item.id, productId: item.productId, quantity });
    }
  }
  if (!lines.length) throw new DocumentError('Nothing is left to pick.', { orderIds: 'Nothing is left to pick.' });
  const number = await generateDocumentNumber(input.tenantId, 'routePick', 'PK', 'number', db);
  const pick = await db.routePick.create({
    data: {
      tenantId: input.tenantId,
      number,
      routeId: input.routeId || null,
      vehicleId: input.vehicleId || null,
      warehouseId: input.warehouseId,
      date: new Date(input.date),
      status: 'OPEN',
      createdBy: input.userId || null,
      lines: {
        create: lines.map((line) => ({
          tenantId: input.tenantId,
          orderItemId: line.orderItemId,
          productId: line.productId,
          quantity: dec(line.quantity)
        }))
      },
      orders: { create: orderIds.map((orderId) => ({ tenantId: input.tenantId, orderId })) }
    },
    include: { lines: { include: { product: true, orderItem: true } }, orders: true, route: true, vehicle: true }
  });
  await notify(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'PICK_CREATED',
    title: `Pick ${number}`,
    body: 'Bulk pick list created for the route.',
    entityType: 'ROUTE_PICK',
    entityId: pick.id
  });
  return withSummary(pick);
}

function withSummary(pick) {
  const summary = new Map();
  for (const line of pick.lines || []) {
    const current = summary.get(line.productId) || {
      productId: line.productId,
      code: line.product?.code,
      name: line.product?.name,
      quantity: 0,
      pickedQty: 0,
      packedQty: 0
    };
    current.quantity = money(current.quantity + num(line.quantity));
    current.pickedQty = money(current.pickedQty + num(line.pickedQty));
    current.packedQty = money(current.packedQty + num(line.packedQty));
    summary.set(line.productId, current);
  }
  return { ...pick, summary: [...summary.values()] };
}

async function advancePick(db, input) {
  const pick = await db.routePick.findFirst({
    where: { id: input.pickId, tenantId: input.tenantId },
    include: { lines: true }
  });
  if (!pick) throw new DocumentError('Pick list not found.', { pickId: 'Pick list not found.' });
  const action = String(input.action || '').toUpperCase();
  if (action === 'PICK') {
    if (!['OPEN', 'PICKED'].includes(pick.status)) throw new DocumentError('This pick is not open.', { status: 'This pick is not open.' });
    for (const line of pick.lines) {
      const override = (input.lines || []).find((row) => row.id === line.id);
      const pickedQty = override ? money(override.pickedQty) : num(line.quantity);
      if (pickedQty - num(line.quantity) > 0.0001) {
        throw new DocumentError('Picked quantity is above the pick list.', { pickedQty: 'Picked quantity is above the pick list.' });
      }
      await db.routePickLine.update({ where: { id: line.id }, data: { pickedQty: dec(pickedQty) } });
    }
    return loadPick(db, input.tenantId, pick.id, 'PICKED');
  }
  if (action === 'PACK') {
    if (pick.status !== 'PICKED') throw new DocumentError('Pick the lines before packing.', { status: 'Pick the lines before packing.' });
    for (const line of pick.lines) {
      await db.routePickLine.update({ where: { id: line.id }, data: { packedQty: dec(line.pickedQty) } });
    }
    return loadPick(db, input.tenantId, pick.id, 'PACKED');
  }
  throw new DocumentError('Choose pick or pack.', { action: 'Choose pick or pack.' });
}

async function loadPick(db, tenantId, id, status) {
  const pick = await db.routePick.update({
    where: { id },
    data: { status },
    include: { lines: { include: { product: true, orderItem: true } }, orders: true, route: true, vehicle: true }
  });
  if (pick.tenantId !== tenantId) throw new DocumentError('Pick list not found.', { pickId: 'Pick list not found.' });
  return withSummary(pick);
}

async function createDeliveryNotes(db, input) {
  const pick = await db.routePick.findFirst({
    where: { id: input.pickId, tenantId: input.tenantId },
    include: { lines: { include: { orderItem: true } }, orders: true }
  });
  if (!pick) throw new DocumentError('Pick list not found.', { pickId: 'Pick list not found.' });
  if (pick.status !== 'PACKED') throw new DocumentError('Pack the pick list before the delivery note.', { status: 'Pack the pick list before the delivery note.' });
  const byOrder = new Map();
  for (const line of pick.lines) {
    if (!(num(line.packedQty) > 0)) continue;
    const orderId = line.orderItem.orderId;
    if (!byOrder.has(orderId)) byOrder.set(orderId, []);
    byOrder.get(orderId).push(line);
  }
  if (!byOrder.size) throw new DocumentError('Nothing was packed.', { pickId: 'Nothing was packed.' });
  const deliveries = [];
  for (const [orderId, lines] of byOrder) {
    const order = await db.salesOrder.findFirst({ where: { id: orderId, tenantId: input.tenantId } });
    const number = await generateDocumentNumber(input.tenantId, 'salesDelivery', 'DO', 'deliveryNumber', db);
    const created = await db.salesDelivery.create({
      data: {
        tenantId: input.tenantId,
        customerId: order.customerId,
        orderId,
        deliveryNumber: number,
        date: new Date(input.date || pick.date),
        warehouseId: pick.warehouseId,
        status: 'DELIVERED',
        createdBy: input.userId || null,
        items: {
          create: lines.map((line) => ({ productId: line.productId, quantity: dec(line.packedQty) }))
        }
      }
    });
    const saved = await db.salesDeliveryItem.findMany({ where: { deliveryId: created.id } });
    const posted = await postIssueDocument(db, {
      tenantId: input.tenantId,
      warehouseId: pick.warehouseId,
      items: saved,
      referenceType: 'SALES_DELIVERY',
      referenceId: created.id,
      date: input.date || pick.date,
      createdBy: input.userId,
      description: `Delivery ${number}`,
      quantitySign: -1
    });
    assertStockCovered(posted);
    for (const result of posted.results) {
      if (!result.itemId) continue;
      await db.salesDeliveryItem.update({
        where: { id: result.itemId },
        data: { unitCost: dec(result.unitCost), costValue: dec(result.value) }
      });
    }
    await consumeOrder(db, {
      tenantId: input.tenantId,
      orderId,
      lines: lines.map((line) => ({ productId: line.productId, quantity: num(line.packedQty) }))
    });
    await refreshOrderStatus(db, orderId);
    deliveries.push(created);
  }
  await db.routePick.update({ where: { id: pick.id }, data: { status: 'ISSUED' } });
  return deliveries;
}

async function invoiceDeliveries(db, input) {
  const ids = input.deliveryIds || [];
  if (input.tripId) {
    const links = await db.tripDelivery.findMany({ where: { tenantId: input.tenantId, tripId: input.tripId } });
    ids.push(...links.map((link) => link.deliveryId));
  }
  const unique = [...new Set(ids)];
  if (!unique.length) throw new DocumentError('Choose a delivery.', { deliveryId: 'Choose a delivery.' });
  const invoices = [];
  for (const deliveryId of unique) {
    const delivery = await db.salesDelivery.findFirst({
      where: { id: deliveryId, tenantId: input.tenantId },
      include: { items: true, order: { include: { items: true } }, invoices: true }
    });
    if (!delivery) throw new DocumentError('Delivery not found.', { deliveryId: 'Delivery not found.' });
    const existing = (delivery.invoices || []).find((invoice) => !['CANCELLED', 'DRAFT', 'PENDING'].includes(invoice.status));
    if (existing) {
      invoices.push(existing);
      continue;
    }
    const prepared = delivery.items.map((item) => {
      const source = delivery.order?.items.find((line) => line.productId === item.productId);
      const unitPrice = source ? num(source.unitPrice) : 0;
      return { productId: item.productId, quantity: num(item.quantity), unitPrice, total: money(num(item.quantity) * unitPrice) };
    });
    const number = await generateDocumentNumber(input.tenantId, 'salesInvoice', 'INV', 'invoiceNumber', db);
    const created = await db.salesInvoice.create({
      data: {
        tenantId: input.tenantId,
        customerId: delivery.customerId,
        orderId: delivery.orderId,
        deliveryId: delivery.id,
        invoiceNumber: number,
        date: new Date(input.date || delivery.date),
        status: 'UNPAID',
        total: dec(prepared.reduce((sum, item) => sum + item.total, 0)),
        subtotal: dec(prepared.reduce((sum, item) => sum + item.total, 0)),
        saleKind: 'CREDIT',
        channel: delivery.order?.channel || 'GENERAL_TRADE',
        stockPosted: false,
        createdBy: input.userId || null,
        items: {
          create: prepared.map((item) => ({
            productId: item.productId,
            quantity: dec(item.quantity),
            unitPrice: dec(item.unitPrice),
            total: dec(item.total)
          }))
        }
      }
    });
    invoices.push(await finalizeSalesInvoice(db, {
      tenantId: input.tenantId,
      invoiceId: created.id,
      createdBy: input.userId
    }));
  }
  return invoices;
}

async function createTrip(db, input) {
  if (!input.deliveryIds?.length) throw new DocumentError('Load at least one delivery.', { deliveryIds: 'Load at least one delivery.' });
  const deliveries = await db.salesDelivery.findMany({
    where: { tenantId: input.tenantId, id: { in: input.deliveryIds } }
  });
  if (deliveries.length !== input.deliveryIds.length) {
    throw new DocumentError('Delivery not found.', { deliveryIds: 'Delivery not found.' });
  }
  const number = await generateDocumentNumber(input.tenantId, 'tripSheet', 'TS', 'number', db);
  return db.tripSheet.create({
    data: {
      tenantId: input.tenantId,
      number,
      routeId: input.routeId || null,
      vehicleId: input.vehicleId || null,
      pickId: input.pickId || null,
      driverName: input.driverName || null,
      date: new Date(input.date),
      status: 'LOADED',
      createdBy: input.userId || null,
      deliveries: {
        create: input.deliveryIds.map((deliveryId) => ({ tenantId: input.tenantId, deliveryId }))
      }
    },
    include: { deliveries: { include: { delivery: true } }, vehicle: true, route: true, gatePass: true }
  });
}

async function tripDeliveries(db, tenantId, tripId) {
  const trip = await db.tripSheet.findFirst({
    where: { id: tripId, tenantId },
    include: {
      deliveries: { include: { delivery: { include: { invoices: true } } } },
      gatePass: true,
      vehicle: true,
      route: true
    }
  });
  if (!trip) throw new DocumentError('Trip not found.', { tripId: 'Trip not found.' });
  return trip;
}

async function issueGatePass(db, input) {
  const trip = await tripDeliveries(db, input.tenantId, input.tripId);
  const settings = await getSettings(db, input.tenantId);
  if (!trip.deliveries.length) throw new DocumentError('Load the vehicle before the gate pass.', { tripId: 'Load the vehicle before the gate pass.' });
  if (settings.invoiceBeforeDispatch) {
    const missing = trip.deliveries.filter((link) => !(link.delivery.invoices || []).some((invoice) => !['CANCELLED', 'DRAFT', 'PENDING'].includes(invoice.status)));
    if (missing.length) {
      throw new DocumentError('Issue the tax invoice before the gate pass.', { invoice: 'Issue the tax invoice before the gate pass.' });
    }
  }
  if (trip.gatePass?.status === 'ISSUED') return trip.gatePass;
  const number = trip.gatePass?.number || await generateDocumentNumber(input.tenantId, 'gatePass', 'GP', 'number', db);
  const pass = trip.gatePass
    ? await db.gatePass.update({
      where: { id: trip.gatePass.id },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
        issuedBy: input.userId || null,
        securityName: input.securityName || trip.gatePass.securityName,
        loadNote: input.loadNote || trip.gatePass.loadNote,
        driverName: input.driverName || trip.driverName,
        vehicleId: trip.vehicleId
      }
    })
    : await db.gatePass.create({
      data: {
        tenantId: input.tenantId,
        number,
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        driverName: input.driverName || trip.driverName,
        securityName: input.securityName || null,
        loadNote: input.loadNote || null,
        status: 'ISSUED',
        issuedAt: new Date(),
        issuedBy: input.userId || null
      }
    });
  await notify(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'GATE_PASS',
    title: `Gate pass ${pass.number}`,
    body: 'Gate pass issued for the loaded vehicle.',
    entityType: 'GATE_PASS',
    entityId: pass.id
  });
  return pass;
}

async function departTrip(db, input) {
  const trip = await tripDeliveries(db, input.tenantId, input.tripId);
  const settings = await getSettings(db, input.tenantId);
  if (settings.gatePassRequired && trip.gatePass?.status !== 'ISSUED') {
    throw new DocumentError('Issue the gate pass before the vehicle leaves.', { gatePass: 'Issue the gate pass before the vehicle leaves.' });
  }
  if (settings.invoiceBeforeDispatch) {
    const missing = trip.deliveries.some((link) => !(link.delivery.invoices || []).some((invoice) => !['CANCELLED', 'DRAFT', 'PENDING'].includes(invoice.status)));
    if (missing) throw new DocumentError('Issue the tax invoice before departure.', { invoice: 'Issue the tax invoice before departure.' });
  }
  const updated = await db.tripSheet.update({ where: { id: trip.id }, data: { status: 'DEPARTED' } });
  await notify(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'TRIP_DEPARTED',
    title: `Trip ${trip.number} departed`,
    body: 'Vehicle left with the invoice and gate pass.',
    entityType: 'TRIP',
    entityId: trip.id
  });
  return updated;
}

async function returnTrip(db, input) {
  const trip = await tripDeliveries(db, input.tenantId, input.tripId);
  if (trip.status !== 'DEPARTED') throw new DocumentError('The vehicle has not left.', { status: 'The vehicle has not left.' });
  return db.tripSheet.update({ where: { id: trip.id }, data: { status: 'RETURNED' } });
}

async function recordProof(db, input) {
  if (!input.receivedBy || !String(input.receivedBy).trim()) {
    throw new DocumentError('Who received the goods?', { receivedBy: 'Who received the goods?' });
  }
  const delivery = await db.salesDelivery.findFirst({
    where: { id: input.deliveryId, tenantId: input.tenantId },
    include: { items: true }
  });
  if (!delivery) throw new DocumentError('Delivery not found.', { deliveryId: 'Delivery not found.' });
  const existing = await db.proofOfDelivery.findUnique({ where: { deliveryId: delivery.id } });
  if (existing) throw new DocumentError('Proof of delivery is already recorded.', { deliveryId: 'Proof of delivery is already recorded.' });
  const lines = delivery.items.map((item) => {
    const stated = (input.lines || []).find((line) => line.productId === item.productId);
    const rejectedQty = money(stated?.rejectedQty || 0);
    if (rejectedQty - num(item.quantity) > 0.0001) {
      throw new DocumentError('Rejected quantity is above the delivery.', { rejectedQty: 'Rejected quantity is above the delivery.' });
    }
    if (rejectedQty > 0 && !(stated?.reason || input.note)) {
      throw new DocumentError('A reason is required for rejected goods.', { reason: 'A reason is required for rejected goods.' });
    }
    return {
      tenantId: input.tenantId,
      productId: item.productId,
      deliveredQty: dec(num(item.quantity)),
      rejectedQty: dec(rejectedQty),
      reason: stated?.reason || null
    };
  });
  const rejected = lines.reduce((sum, line) => sum + num(line.rejectedQty), 0);
  const delivered = lines.reduce((sum, line) => sum + num(line.deliveredQty), 0);
  const status = rejected <= 0 ? 'DELIVERED' : rejected + 0.0001 >= delivered ? 'REJECTED' : 'PARTIAL';
  const proof = await db.proofOfDelivery.create({
    data: {
      tenantId: input.tenantId,
      deliveryId: delivery.id,
      tripId: input.tripId || null,
      receivedBy: String(input.receivedBy).trim(),
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      note: input.note || null,
      status,
      createdBy: input.userId || null,
      lines: { create: lines }
    },
    include: { lines: { include: { product: true } }, delivery: true }
  });
  await notify(db, {
    tenantId: input.tenantId,
    userId: input.userId,
    kind: 'PROOF_OF_DELIVERY',
    title: `Proof for ${delivery.deliveryNumber}`,
    body: status === 'DELIVERED' ? 'Customer accepted the delivery.' : 'Rejected quantities are waiting for a credit note.',
    entityType: 'PROOF',
    entityId: proof.id
  });
  return proof;
}

async function creditRejected(db, input) {
  const proof = await db.proofOfDelivery.findFirst({
    where: { id: input.proofId, tenantId: input.tenantId },
    include: { lines: true, delivery: { include: { invoices: true } } }
  });
  if (!proof) throw new DocumentError('Proof of delivery not found.', { proofId: 'Proof of delivery not found.' });
  const invoice = (proof.delivery.invoices || []).find((row) => !['CANCELLED', 'DRAFT', 'PENDING'].includes(row.status));
  if (!invoice) throw new DocumentError('Invoice the delivery before the credit note.', { invoiceId: 'Invoice the delivery before the credit note.' });
  const items = proof.lines.filter((line) => num(line.rejectedQty) > 0).map((line) => ({
    productId: line.productId,
    quantity: num(line.rejectedQty),
    reason: line.reason || proof.note
  }));
  if (!items.length) throw new DocumentError('Nothing was rejected.', { quantity: 'Nothing was rejected.' });
  return postSalesReturn(db, {
    tenantId: input.tenantId,
    invoiceId: invoice.id,
    date: input.date || new Date(),
    kind: input.kind || 'GRA',
    reason: input.reason || proof.note || 'Rejected on delivery',
    warehouseId: proof.delivery.warehouseId,
    items,
    createdBy: input.userId
  });
}

async function board(db, tenantId) {
  const orders = await db.salesOrder.findMany({
    where: { tenantId },
    include: { customer: true, items: true, route: true },
    orderBy: { date: 'desc' }
  });
  const rows = [];
  for (const order of orders) {
    const shipped = await qtyByProduct(db, 'salesDelivery', { orderId: order.id, status: 'DELIVERED' });
    const billed = await qtyByProduct(db, 'salesInvoice', { orderId: order.id, status: { notIn: ['CANCELLED', 'DRAFT', 'PENDING'] } });
    const ordered = order.items.reduce((sum, item) => sum + num(item.quantity), 0);
    const cancelled = order.items.reduce((sum, item) => sum + num(item.cancelledQty), 0);
    const delivered = Object.values(shipped).reduce((sum, qty) => sum + qty, 0);
    const invoiced = Object.values(billed).reduce((sum, qty) => sum + qty, 0);
    rows.push({
      ...order,
      customerName: order.customer?.name,
      routeName: order.route?.name || '',
      orderedQty: money(ordered),
      cancelledQty: money(cancelled),
      deliveredQty: money(delivered),
      invoicedQty: money(invoiced),
      pendingQty: money(Math.max(0, ordered - cancelled - delivered))
    });
  }
  const [picks, trips, returns] = await Promise.all([
    db.routePick.findMany({ where: { tenantId }, include: { route: true, vehicle: true }, orderBy: { date: 'desc' } }),
    db.tripSheet.findMany({ where: { tenantId }, include: { vehicle: true, route: true, gatePass: true }, orderBy: { date: 'desc' } }),
    db.salesReturn.findMany({ where: { tenantId }, include: { customer: true, invoice: true }, orderBy: { date: 'desc' } })
  ]);
  return { orders: rows, picks, trips, returns };
}

module.exports = {
  releaseOrder,
  cancelOpen,
  createRoutePick,
  advancePick,
  createDeliveryNotes,
  invoiceDeliveries,
  createTrip,
  issueGatePass,
  departTrip,
  returnTrip,
  recordProof,
  creditRejected,
  board,
  refreshOrderStatus,
  withSummary
};
