const { DocumentError } = require('../errors');
const { writeAudit } = require('../auditService');
const { money, num, dec, rateOf } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');

const CONFIGURABLE_DEFAULTS = [
  { key: 'capitalizationThreshold', value: '100000 LKR', note: 'Capex at or above this amount is held in CWIP until capitalization.' },
  { key: 'priceTolerancePercent', value: '2', note: 'PO price may differ from the agreed contract price by this percent before a reason is required.' },
  { key: 'defaultAllocationBasis', value: 'VALUE', note: 'Landed cost is split by FOB value unless a document chooses quantity or weight.' },
  { key: 'whtStage', value: 'PAYMENT', note: 'Supplier WHT stays on the existing payment-stage calculation.' },
  { key: 'svatEnabled', value: 'false', note: 'SVAT stays off.' },
  { key: 'blockMissingSupplierTax', value: 'false', note: 'A missing supplier tax group does not block a PO until Finance turns this on.' },
  { key: 'currencies', value: 'LKR, USD', note: 'Functional currency is LKR. Import documents use USD.' },
  { key: 'depreciation', value: 'Accounting straight line, tax reducing balance', note: 'New classes default to 60 months straight line and a 20% tax reducing-balance rate. Partial months use exact days.' },
  { key: 'allocation', value: 'Equal split of administration', note: 'The demo rule sends administration expense to the five operating centers at 20% each until Finance edits it.' },
  { key: 'unbudgetedCapex', value: 'Blocked', note: 'Capex over the project budget needs executiveOverride and a reason. The approval workflow itself belongs to Phase 0.' }
];

async function ensureSettings(db, tenantId) {
  const existing = await db.financeSetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return db.financeSetting.create({ data: { tenantId } });
}

async function updateSettings(db, tenantId, input) {
  await ensureSettings(db, tenantId);
  const data = {};
  if (input.capitalizationThreshold != null) data.capitalizationThreshold = dec(input.capitalizationThreshold);
  if (input.priceTolerancePercent != null) data.priceTolerancePercent = dec(input.priceTolerancePercent);
  if (input.defaultAllocationBasis) data.defaultAllocationBasis = String(input.defaultAllocationBasis).toUpperCase();
  if (input.whtStage) data.whtStage = String(input.whtStage).toUpperCase();
  if (input.svatEnabled != null) data.svatEnabled = Boolean(input.svatEnabled);
  if (input.blockMissingSupplierTax != null) data.blockMissingSupplierTax = Boolean(input.blockMissingSupplierTax);
  if (input.baseCurrency) data.baseCurrency = String(input.baseCurrency).toUpperCase();
  if (input.foreignCurrency) data.foreignCurrency = String(input.foreignCurrency).toUpperCase();
  return db.financeSetting.update({ where: { tenantId }, data });
}

function monthWindow(date) {
  const when = new Date(date);
  return { year: when.getUTCFullYear(), month: when.getUTCMonth() + 1 };
}

async function classifyPurchase(tx, input) {
  const settings = await ensureSettings(tx, input.tenantId);
  const spendClass = String(input.spendClass || 'OPEX').toUpperCase();
  const amountBase = money(input.amountBase);
  if (!(amountBase > 0)) {
    throw new DocumentError('Enter a purchase amount before the budget check.', { total: 'Enter a purchase amount before the budget check.' });
  }
  let treatment = 'INVENTORY';
  let budgetStatus = 'WITHIN';
  let projectId = input.capitalProjectId || null;
  if (spendClass === 'CAPEX') {
    if (!projectId) {
      throw new DocumentError('Capex requires a capital project code.', { capitalProjectId: 'Capex requires a capital project code.' });
    }
    const project = await tx.capitalProject.findFirst({ where: { id: projectId, tenantId: input.tenantId } });
    if (!project) throw new DocumentError('Capital project not found.', { capitalProjectId: 'Capital project not found.' });
    const threshold = num(settings.capitalizationThreshold);
    treatment = amountBase + 0.0001 >= threshold ? 'CWIP' : 'INVENTORY';
    if (treatment === 'INVENTORY') budgetStatus = 'BELOW_THRESHOLD';
    const budgetRows = await tx.budget.findMany({
      where: { tenantId: input.tenantId, kind: 'CAPEX', capitalProjectId: projectId }
    });
    const budget = budgetRows.length
      ? budgetRows.reduce((sum, row) => sum + num(row.amount), 0)
      : num(project.budgetAmount);
    const prior = await tx.purchaseClassification.findMany({
      where: { tenantId: input.tenantId, documentType: 'PR', capitalProjectId: projectId, spendClass: 'CAPEX' }
    });
    const used = prior
      .filter((row) => row.documentId !== input.documentId)
      .reduce((sum, row) => sum + num(row.amountBase), 0);
    if (money(used + amountBase) > money(budget) + 0.0001) {
      if (!input.executiveOverride) {
        throw new DocumentError('Capex exceeds the project budget. An executive override is required.', {
          capitalProjectId: 'Capex exceeds the project budget. An executive override is required.'
        });
      }
      if (!input.overrideReason || String(input.overrideReason).trim().length < 3) {
        throw new DocumentError('Record the reason for the budget override.', { overrideReason: 'Record the reason for the budget override.' });
      }
      budgetStatus = 'OVERRIDE';
    }
  } else if (input.glAccountId && input.costCenterId) {
    const { year, month } = monthWindow(input.date || new Date());
    const rows = await tx.budget.findMany({
      where: {
        tenantId: input.tenantId,
        kind: 'OPEX',
        accountId: input.glAccountId,
        costCenterId: input.costCenterId,
        year
      }
    });
    const monthRow = rows.find((row) => row.month === month);
    const annual = rows.find((row) => row.month === 0);
    const budgetRow = monthRow || annual;
    if (budgetRow) {
      const start = new Date(Date.UTC(year, monthRow ? month - 1 : 0, 1));
      const end = new Date(Date.UTC(year, monthRow ? month : 12, 1));
      const actualLines = await tx.journalLine.findMany({
        where: {
          accountId: input.glAccountId,
          costCenterId: input.costCenterId,
          journalEntry: { tenantId: input.tenantId, isPosted: true, date: { gte: start, lt: end } }
        }
      });
      const actual = actualLines.reduce((sum, line) => sum + num(line.debit) - num(line.credit), 0);
      if (money(actual + amountBase) > num(budgetRow.amount) + 0.0001) {
        if (!input.executiveOverride) {
          throw new DocumentError('This expense exceeds the cost center budget.', { glAccountId: 'This expense exceeds the cost center budget.' });
        }
        if (!input.overrideReason || String(input.overrideReason).trim().length < 3) {
          throw new DocumentError('Record the reason for the budget override.', { overrideReason: 'Record the reason for the budget override.' });
        }
        budgetStatus = 'OVERRIDE';
      }
    }
  }

  const data = {
    spendClass,
    glAccountId: input.glAccountId || null,
    costCenterId: input.costCenterId || null,
    profitCenterId: input.profitCenterId || null,
    capitalProjectId: projectId,
    treatment,
    budgetStatus,
    overrideReason: input.overrideReason || null,
    amountBase: dec(amountBase)
  };
  return tx.purchaseClassification.upsert({
    where: {
      tenantId_documentType_documentId: {
        tenantId: input.tenantId,
        documentType: input.documentType,
        documentId: input.documentId
      }
    },
    create: { tenantId: input.tenantId, documentType: input.documentType, documentId: input.documentId, ...data },
    update: data
  });
}

async function copyClassification(tx, tenantId, prId, poId) {
  const source = await tx.purchaseClassification.findFirst({
    where: { tenantId, documentType: 'PR', documentId: prId }
  });
  if (!source) return null;
  return tx.purchaseClassification.upsert({
    where: { tenantId_documentType_documentId: { tenantId, documentType: 'PO', documentId: poId } },
    create: {
      tenantId,
      documentType: 'PO',
      documentId: poId,
      spendClass: source.spendClass,
      glAccountId: source.glAccountId,
      costCenterId: source.costCenterId,
      profitCenterId: source.profitCenterId,
      capitalProjectId: source.capitalProjectId,
      treatment: source.treatment,
      budgetStatus: source.budgetStatus,
      overrideReason: source.overrideReason,
      amountBase: source.amountBase
    },
    update: {
      spendClass: source.spendClass,
      treatment: source.treatment,
      capitalProjectId: source.capitalProjectId,
      costCenterId: source.costCenterId,
      profitCenterId: source.profitCenterId,
      budgetStatus: source.budgetStatus
    }
  });
}

async function assertPoGuards(tx, input) {
  const settings = await ensureSettings(tx, input.tenantId);
  const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
  if (!supplier) throw new DocumentError('Supplier is required.', { supplierId: 'Supplier is required.' });
  if (settings.blockMissingSupplierTax && !supplier.taxGroup) {
    throw new DocumentError('This supplier has no tax registration.', { supplierId: 'This supplier has no tax registration.' });
  }
  if (input.tradeType === 'IMPORT') {
    rateOf(input.exchangeRate);
    if (input.currencyId) {
      const currency = await tx.currency.findFirst({ where: { id: input.currencyId, tenantId: input.tenantId } });
      const code = currency?.code || '';
      if (code && code !== settings.foreignCurrency && code !== 'USD') {
        throw new DocumentError('Import orders use USD.', { currencyId: 'Import orders use USD.' });
      }
    }
  }
  if (input.tradeType === 'LOCAL' && input.currencyId) {
    const currency = await tx.currency.findFirst({ where: { id: input.currencyId, tenantId: input.tenantId } });
    if (currency && currency.code !== settings.baseCurrency && currency.code !== 'LKR') {
      throw new DocumentError('Local orders use LKR.', { currencyId: 'Local orders use LKR.' });
    }
  }
  const when = new Date(input.date);
  const toleranceDefault = num(settings.priceTolerancePercent) / 100;
  const exceptions = [];
  for (const item of input.items || []) {
    if (!item.productId) continue;
    const mappings = await tx.approvedSupplierItem.findMany({
      where: { tenantId: input.tenantId, productId: item.productId, active: true }
    });
    if (mappings.length && !mappings.some((row) => row.supplierId === input.supplierId)) {
      throw new DocumentError('This product is not approved for the selected supplier.', {
        supplierId: 'This product is not approved for the selected supplier.'
      });
    }
    const contracts = await tx.contractPrice.findMany({
      where: {
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        productId: item.productId,
        active: true,
        validFrom: { lte: when },
        OR: [{ validTo: null }, { validTo: { gte: when } }]
      },
      orderBy: { validFrom: 'desc' }
    });
    if (!contracts.length) continue;
    const contract = contracts[0];
    if (num(contract.minimumOrderQty) > 0 && num(item.quantity) + 0.0001 < num(contract.minimumOrderQty)) {
      throw new DocumentError(`Quantity is below the agreed minimum of ${num(contract.minimumOrderQty)}.`, {
        quantity: `Quantity is below the agreed minimum of ${num(contract.minimumOrderQty)}.`
      });
    }
    const tolerance = contract.tolerancePercent != null ? num(contract.tolerancePercent) / 100 : toleranceDefault;
    const agreed = num(contract.unitPrice);
    const price = num(item.unitPrice);
    if (agreed > 0 && Math.abs(price - agreed) / agreed > tolerance + 0.0000001) {
      if (!input.acknowledgeVariance) {
        throw new DocumentError(`Price ${price} is outside the agreed price ${agreed}.`, {
          unitPrice: `Price ${price} is outside the agreed price ${agreed}.`
        });
      }
      if (!input.varianceReason || String(input.varianceReason).trim().length < 3) {
        throw new DocumentError('Record why the price differs from the contract.', { varianceReason: 'Record why the price differs from the contract.' });
      }
      exceptions.push({ productId: item.productId, agreedPrice: dec(agreed), actualPrice: dec(price), reason: String(input.varianceReason).trim() });
    }
  }
  return { exceptions };
}

async function saveTradeProfile(tx, input) {
  const tradeType = input.tradeType === 'IMPORT' ? 'IMPORT' : 'LOCAL';
  const data = {
    tradeType,
    shipmentRef: input.shipmentRef || null,
    approvalPath: tradeType === 'IMPORT' ? 'IMPORT_PO' : 'LOCAL_PO',
    currencyCode: input.currencyCode || (tradeType === 'IMPORT' ? 'USD' : 'LKR'),
    exchangeRate: dec(rateOf(input.exchangeRate))
  };
  return tx.tradeProfile.upsert({
    where: {
      tenantId_documentType_documentId: {
        tenantId: input.tenantId,
        documentType: input.documentType,
        documentId: input.documentId
      }
    },
    create: { tenantId: input.tenantId, documentType: input.documentType, documentId: input.documentId, ...data },
    update: data
  });
}

async function createRfq(tx, input) {
  if (!input.lines || !input.lines.length) {
    throw new DocumentError('Add at least one product.', { lines: 'Add at least one product.' });
  }
  const rfqNumber = await generateDocumentNumber(input.tenantId, 'requestForQuotation', 'RFQ', 'rfqNumber', tx);
  const created = await tx.requestForQuotation.create({
    data: {
      tenantId: input.tenantId,
      rfqNumber,
      prId: input.prId || null,
      date: new Date(input.date),
      notes: input.notes || null,
      costCenterId: input.costCenterId || null,
      createdBy: input.createdBy || null,
      lines: {
        create: input.lines.map((line) => ({
          tenantId: input.tenantId,
          productId: line.productId,
          quantity: dec(line.quantity)
        }))
      },
      invitations: input.supplierIds && input.supplierIds.length ? {
        create: input.supplierIds.map((supplierId) => ({ tenantId: input.tenantId, supplierId }))
      } : undefined
    },
    include: { lines: true, invitations: true }
  });
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'CREATE',
    entity: 'RFQ',
    entityId: created.id,
    after: { rfqNumber, status: created.status }
  });
  return created;
}

async function cancelRfq(tx, input) {
  const text = String(input.reason || '').trim();
  if (text.length < 3) throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  const rfq = await tx.requestForQuotation.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!rfq) throw new DocumentError('RFQ not found.', { id: 'RFQ not found.' });
  if (rfq.status === 'CANCELLED') throw new DocumentError('This RFQ is already cancelled.', { status: 'This RFQ is already cancelled.' });
  if (rfq.status === 'CLOSED') throw new DocumentError('A closed RFQ is kept. It cannot be deleted.', { status: 'A closed RFQ is kept. It cannot be deleted.' });
  const updated = await tx.requestForQuotation.update({ where: { id: rfq.id }, data: { status: 'CANCELLED' } });
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'STATUS',
    entity: 'RFQ',
    entityId: rfq.id,
    before: { status: rfq.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function addQuotation(tx, input) {
  const rfq = input.rfqId
    ? await tx.requestForQuotation.findFirst({ where: { id: input.rfqId, tenantId: input.tenantId }, include: { lines: true, invitations: true } })
    : null;
  if (input.rfqId && !rfq) throw new DocumentError('RFQ not found.', { rfqId: 'RFQ not found.' });
  if (rfq && rfq.status === 'CLOSED') throw new DocumentError('This RFQ is already closed.', { rfqId: 'This RFQ is already closed.' });
  if (rfq && rfq.invitations.length && !rfq.invitations.some((row) => row.supplierId === input.supplierId)) {
    throw new DocumentError('This supplier was not invited.', { supplierId: 'This supplier was not invited.' });
  }
  const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
  if (!supplier) throw new DocumentError('Supplier is required.', { supplierId: 'Supplier is required.' });
  if (!input.lines || !input.lines.length) throw new DocumentError('Add at least one quoted price.', { lines: 'Add at least one quoted price.' });
  if (rfq) {
    const allowed = new Set(rfq.lines.map((line) => line.productId));
    for (const line of input.lines) {
      if (!allowed.has(line.productId)) {
        throw new DocumentError('Quote only the products on the RFQ.', { productId: 'Quote only the products on the RFQ.' });
      }
    }
  }
  const quoteNumber = await generateDocumentNumber(input.tenantId, 'supplierQuotation', 'SQ', 'quoteNumber', tx);
  const rate = rateOf(input.exchangeRate);
  return tx.supplierQuotation.create({
    data: {
      tenantId: input.tenantId,
      quoteNumber,
      rfqId: rfq?.id || null,
      supplierId: input.supplierId,
      date: new Date(input.date),
      currencyCode: input.currencyCode || 'LKR',
      exchangeRate: dec(rate),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      leadTimeDays: parseInt(input.leadTimeDays, 10) || 0,
      qualityNote: input.qualityNote || null,
      terms: input.terms || null,
      lines: {
        create: input.lines.map((line) => ({
          tenantId: input.tenantId,
          productId: line.productId,
          quantity: dec(line.quantity),
          unitPrice: dec(line.unitPrice),
          total: dec(money(num(line.quantity) * num(line.unitPrice)))
        }))
      }
    },
    include: { lines: true }
  });
}

async function selectQuotation(tx, input) {
  const rfq = await tx.requestForQuotation.findFirst({
    where: { id: input.rfqId, tenantId: input.tenantId },
    include: { quotations: true }
  });
  if (!rfq) throw new DocumentError('RFQ not found.', { rfqId: 'RFQ not found.' });
  const quote = rfq.quotations.find((row) => row.id === input.quotationId);
  if (!quote) throw new DocumentError('Quotation not found on this RFQ.', { quotationId: 'Quotation not found on this RFQ.' });
  if (!input.reason || String(input.reason).trim().length < 3) {
    throw new DocumentError('Record why this supplier was selected.', { reason: 'Record why this supplier was selected.' });
  }
  await tx.supplierQuotation.updateMany({
    where: { tenantId: input.tenantId, rfqId: rfq.id, id: { not: quote.id } },
    data: { status: 'REJECTED' }
  });
  await tx.supplierQuotation.update({ where: { id: quote.id }, data: { status: 'SELECTED' } });
  await tx.requestForQuotation.update({ where: { id: rfq.id }, data: { status: 'CLOSED' } });
  const selection = await tx.quotationSelection.upsert({
    where: { rfqId: rfq.id },
    create: {
      tenantId: input.tenantId,
      rfqId: rfq.id,
      quotationId: quote.id,
      reason: String(input.reason).trim(),
      date: new Date(input.date || new Date()),
      createdBy: input.createdBy || null
    },
    update: { quotationId: quote.id, reason: String(input.reason).trim(), createdBy: input.createdBy || null }
  });
  if (input.savePrices) {
    const lines = await tx.supplierQuotationLine.findMany({ where: { quotationId: quote.id } });
    const from = quote.date;
    const until = quote.validUntil || new Date(from.getTime() + 90 * 86400000);
    for (const line of lines) {
      await tx.contractPrice.create({
        data: {
          tenantId: input.tenantId,
          supplierId: quote.supplierId,
          productId: line.productId,
          currencyCode: quote.currencyCode,
          unitPrice: line.unitPrice,
          validFrom: from,
          validTo: until
        }
      });
      await tx.approvedSupplierItem.upsert({
        where: {
          tenantId_supplierId_productId: {
            tenantId: input.tenantId,
            supplierId: quote.supplierId,
            productId: line.productId
          }
        },
        create: { tenantId: input.tenantId, supplierId: quote.supplierId, productId: line.productId },
        update: { active: true }
      });
    }
  }
  return selection;
}

async function comparison(db, tenantId, rfqId) {
  const rfq = await db.requestForQuotation.findFirst({
    where: { id: rfqId, tenantId },
    include: {
      lines: true,
      invitations: true,
      quotations: { include: { lines: true } },
      selection: true
    }
  });
  if (!rfq) throw new DocumentError('RFQ not found.', { rfqId: 'RFQ not found.' });
  const supplierIds = [...new Set(rfq.quotations.map((row) => row.supplierId).concat(rfq.invitations.map((row) => row.supplierId)))];
  const suppliers = supplierIds.length
    ? await db.supplier.findMany({ where: { tenantId, id: { in: supplierIds } } })
    : [];
  const bySupplier = new Map(suppliers.map((row) => [row.id, row]));
  const quotes = rfq.quotations.map((quote) => {
    const total = quote.lines.reduce((sum, line) => sum + num(line.total), 0);
    return {
      ...quote,
      supplierName: bySupplier.get(quote.supplierId)?.name || '',
      total,
      totalBase: money(total * (num(quote.exchangeRate) || 1))
    };
  }).sort((a, b) => a.totalBase - b.totalBase);
  quotes.forEach((quote, index) => { quote.rank = index + 1; });
  return { rfq, quotes };
}

async function createContract(tx, input) {
  const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
  if (!supplier) throw new DocumentError('Supplier is required.', { supplierId: 'Supplier is required.' });
  const product = await tx.product.findFirst({ where: { id: input.productId, tenantId: input.tenantId } });
  if (!product) throw new DocumentError('Product is required.', { productId: 'Product is required.' });
  if (!(num(input.unitPrice) > 0)) throw new DocumentError('Agreed price must be greater than zero.', { unitPrice: 'Agreed price must be greater than zero.' });
  const currencyCode = String(input.currencyCode || 'LKR').toUpperCase();
  if (!['LKR', 'USD'].includes(currencyCode)) {
    throw new DocumentError('Contract currency must be LKR or USD.', { currencyCode: 'Contract currency must be LKR or USD.' });
  }
  const row = await tx.contractPrice.create({
    data: {
      tenantId: input.tenantId,
      supplierId: input.supplierId,
      productId: input.productId,
      currencyCode,
      unitPrice: dec(input.unitPrice),
      validFrom: new Date(input.validFrom),
      validTo: input.validTo ? new Date(input.validTo) : null,
      tolerancePercent: input.tolerancePercent == null || input.tolerancePercent === '' ? null : dec(input.tolerancePercent),
      minimumOrderQty: dec(input.minimumOrderQty || 0)
    }
  });
  await tx.approvedSupplierItem.upsert({
    where: { tenantId_supplierId_productId: { tenantId: input.tenantId, supplierId: input.supplierId, productId: input.productId } },
    create: { tenantId: input.tenantId, supplierId: input.supplierId, productId: input.productId },
    update: { active: true }
  });
  return row;
}

async function supplierScorecard(db, tenantId, supplierId) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new DocumentError('Supplier not found.', { supplierId: 'Supplier not found.' });
  const pos = await db.purchaseOrder.findMany({
    where: { tenantId, supplierId, status: { not: 'CANCELLED' } },
    include: { items: true, grns: { where: { status: { not: 'CANCELLED' } }, include: { items: true } } }
  });
  const lead = supplier.leadTime || 0;
  let onTime = 0;
  let receivedPos = 0;
  let leadDays = 0;
  let partial = 0;
  let overdue = 0;
  let commitment = 0;
  const now = new Date();
  for (const po of pos) {
    const got = {};
    let first = null;
    for (const grn of po.grns) {
      if (!first || new Date(grn.date) < first) first = new Date(grn.date);
      for (const item of grn.items) got[item.productId] = (got[item.productId] || 0) + num(item.quantityReceived);
    }
    let complete = po.items.length > 0;
    for (const item of po.items) {
      const remain = Math.max(0, num(item.quantity) - (got[item.productId] || 0));
      if (remain > 0.0001) complete = false;
      commitment += remain * num(item.unitPrice) * (num(po.exchangeRate) || 1);
    }
    if (po.grns.length && !complete) partial += 1;
    const due = new Date(po.date);
    due.setDate(due.getDate() + lead);
    if (!complete && due < now) overdue += 1;
    if (first) {
      receivedPos += 1;
      if (first <= due) onTime += 1;
      leadDays += Math.max(0, Math.round((first - new Date(po.date)) / 86400000));
    }
  }
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, supplierId, status: { not: 'CANCELLED' } },
    include: { items: true }
  });
  let variance = 0;
  let varianceCount = 0;
  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const expected = num(item.poUnitPrice);
      if (expected > 0) {
        variance += Math.abs(num(item.unitPrice) - expected) / expected;
        varianceCount += 1;
      }
    }
  }
  const contracts = await db.contractPrice.findMany({ where: { tenantId, supplierId, active: true } });
  let moqHits = 0;
  let moqChecks = 0;
  for (const po of pos) {
    for (const item of po.items) {
      const contract = contracts.find((row) => row.productId === item.productId);
      if (contract && num(contract.minimumOrderQty) > 0) {
        moqChecks += 1;
        if (num(item.quantity) + 0.0001 >= num(contract.minimumOrderQty)) moqHits += 1;
      }
    }
  }
  const returns = await db.goodsIssue.count({ where: { tenantId, supplierId, status: { not: 'CANCELLED' } } });
  return {
    supplierId,
    supplierName: supplier.name,
    onTimeDelivery: receivedPos ? money((onTime / receivedPos) * 100) : null,
    rejectionRate: pos.length ? money((returns / pos.length) * 100) : 0,
    averageLeadTimeDays: receivedPos ? money(leadDays / receivedPos) : null,
    priceVariancePercent: varianceCount ? money((variance / varianceCount) * 100) : 0,
    moqCompliance: moqChecks ? money((moqHits / moqChecks) * 100) : null,
    openCommitment: money(commitment),
    overdueOrders: overdue,
    partialReceipts: partial,
    returns
  };
}

async function commitments(db, tenantId) {
  const pos = await db.purchaseOrder.findMany({
    where: { tenantId, status: { notIn: ['CANCELLED', 'RECEIVED'] } },
    include: { supplier: true, items: true, grns: { where: { status: { not: 'CANCELLED' } }, include: { items: true } } }
  });
  const rows = [];
  for (const po of pos) {
    const got = {};
    for (const grn of po.grns) {
      for (const item of grn.items) got[item.productId] = (got[item.productId] || 0) + num(item.quantityReceived);
    }
    for (const item of po.items) {
      const remain = money(Math.max(0, num(item.quantity) - (got[item.productId] || 0)));
      if (remain <= 0) continue;
      rows.push({
        poNumber: po.poNumber,
        supplier: po.supplier?.name || '',
        productId: item.productId,
        quantityOpen: remain,
        valueBase: money(remain * num(item.unitPrice) * (num(po.exchangeRate) || 1)),
        status: po.status
      });
    }
  }
  return rows;
}

module.exports = {
  CONFIGURABLE_DEFAULTS,
  ensureSettings,
  updateSettings,
  classifyPurchase,
  copyClassification,
  assertPoGuards,
  saveTradeProfile,
  createRfq,
  cancelRfq,
  addQuotation,
  selectQuotation,
  comparison,
  createContract,
  supplierScorecard,
  commitments
};
