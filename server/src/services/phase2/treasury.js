const { DocumentError } = require('../errors');
const { ensureGlMap, postJournal, reverseJournal } = require('../glService');
const { money, num, dec, rateOf } = require('../money');
const { generateDocumentNumber } = require('../../utils/codeGenerator');
const { writeAudit } = require('../auditService');
const { loadRule, levelsForAmount, submitForApproval, cancelOpenRequests } = require('../approvalService');

function requireReason(reason) {
  const text = String(reason || '').trim();
  if (text.length < 3) throw new DocumentError('A reason is required.', { reason: 'A reason is required.' });
  return text;
}

async function applySales(tx, invoiceId, delta) {
  const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === 'CANCELLED') throw new DocumentError('Invoice not found.', { invoiceId: 'Invoice not found.' });
  const paid = money(num(invoice.amountPaid) + delta);
  if (paid < -0.0001 || paid - num(invoice.total) > 0.0001) {
    throw new DocumentError('The amount does not fit the invoice balance.', { amount: 'The amount does not fit the invoice balance.' });
  }
  const status = paid <= 0.0001 ? 'UNPAID' : paid + 0.0001 >= num(invoice.total) ? 'PAID' : 'PARTIAL';
  await tx.salesInvoice.update({ where: { id: invoiceId }, data: { amountPaid: dec(Math.max(0, paid)), status } });
  return invoice;
}

async function applySupplier(tx, invoiceId, delta) {
  const invoice = await tx.supplierInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === 'CANCELLED') throw new DocumentError('Supplier invoice not found.', { supplierInvoiceId: 'Supplier invoice not found.' });
  const paid = money(num(invoice.amountPaid) + delta);
  if (paid < -0.0001 || paid - num(invoice.total) > 0.0001) {
    throw new DocumentError('The amount does not fit the invoice balance.', { amount: 'The amount does not fit the invoice balance.' });
  }
  const status = paid <= 0.0001 ? 'UNPAID' : paid + 0.0001 >= num(invoice.total) ? 'PAID' : 'PARTIAL';
  await tx.supplierInvoice.update({ where: { id: invoiceId }, data: { amountPaid: dec(Math.max(0, paid)), status } });
  return invoice;
}

async function noteOutstanding(tx, invoice, partyType) {
  const notes = await tx.partyNote.findMany({
    where: { tenantId: invoice.tenantId, invoiceId: invoice.id, status: 'POSTED', partyType }
  });
  const net = notes.reduce((sum, note) => sum + (note.kind === 'CREDIT' ? num(note.total) : -num(note.total)), 0);
  return money(num(invoice.total) - num(invoice.amountPaid) - net);
}

async function postPartyNote(tx, input) {
  const partyType = String(input.partyType || '').toUpperCase();
  const kind = String(input.kind || '').toUpperCase();
  if (!['CUSTOMER', 'SUPPLIER'].includes(partyType)) throw new DocumentError('Choose a customer or supplier note.', { partyType: 'Choose a customer or supplier note.' });
  if (!['CREDIT', 'DEBIT'].includes(kind)) throw new DocumentError('Choose a credit or debit note.', { kind: 'Choose a credit or debit note.' });
  if (!input.reasonCode || String(input.reasonCode).trim().length < 2) {
    throw new DocumentError('A reason code is required.', { reasonCode: 'A reason code is required.' });
  }
  const subtotal = money(input.subtotal);
  const taxAmount = money(input.taxAmount || 0);
  const total = money(subtotal + taxAmount);
  if (!(total > 0)) throw new DocumentError('Note total must be greater than zero.', { subtotal: 'Note total must be greater than zero.' });
  const rate = rateOf(input.exchangeRate);
  let invoiceNumber = input.invoiceNumber || null;
  if (partyType === 'CUSTOMER') {
    const customer = await tx.customer.findFirst({ where: { id: input.partyId, tenantId: input.tenantId } });
    if (!customer) throw new DocumentError('Customer is required.', { partyId: 'Customer is required.' });
    if (input.invoiceId) {
      const invoice = await tx.salesInvoice.findFirst({ where: { id: input.invoiceId, tenantId: input.tenantId } });
      if (!invoice || invoice.customerId !== customer.id) throw new DocumentError('Invoice not found for this customer.', { invoiceId: 'Invoice not found for this customer.' });
      invoiceNumber = invoice.invoiceNumber;
      if (kind === 'CREDIT') {
        const outstanding = await noteOutstanding(tx, invoice, 'CUSTOMER');
        if (total - outstanding > 0.0001) throw new DocumentError('Credit note exceeds the invoice balance.', { subtotal: 'Credit note exceeds the invoice balance.' });
      }
    }
  } else {
    const supplier = await tx.supplier.findFirst({ where: { id: input.partyId, tenantId: input.tenantId } });
    if (!supplier) throw new DocumentError('Supplier is required.', { partyId: 'Supplier is required.' });
    if (input.invoiceId) {
      const invoice = await tx.supplierInvoice.findFirst({ where: { id: input.invoiceId, tenantId: input.tenantId } });
      if (!invoice || invoice.supplierId !== supplier.id) throw new DocumentError('Invoice not found for this supplier.', { invoiceId: 'Invoice not found for this supplier.' });
      invoiceNumber = invoice.invoiceNumber;
      if (kind === 'CREDIT') {
        const outstanding = await noteOutstanding(tx, invoice, 'SUPPLIER');
        if (total - outstanding > 0.0001) throw new DocumentError('Credit note exceeds the invoice balance.', { subtotal: 'Credit note exceeds the invoice balance.' });
      }
    }
  }
  const prefix = partyType === 'CUSTOMER' ? (kind === 'CREDIT' ? 'CN' : 'DN') : (kind === 'CREDIT' ? 'SCN' : 'SDN');
  const noteNumber = await generateDocumentNumber(input.tenantId, 'partyNote', prefix, 'noteNumber', tx);
  const rule = await loadRule(tx, input.tenantId, 'PARTY_NOTE');
  const hold = Boolean(rule?.enabled && levelsForAmount(rule, total).length);
  const note = await tx.partyNote.create({
    data: {
      tenantId: input.tenantId,
      noteNumber,
      partyType,
      partyId: input.partyId,
      kind,
      date: new Date(input.date),
      invoiceId: input.invoiceId || null,
      invoiceNumber,
      reasonCode: String(input.reasonCode).trim(),
      subtotal: dec(subtotal),
      taxAmount: dec(taxAmount),
      total: dec(total),
      exchangeRate: dec(rate),
      costCenterId: input.costCenterId || null,
      profitCenterId: input.profitCenterId || null,
      status: hold ? 'PENDING_APPROVAL' : 'POSTED',
      createdBy: input.createdBy || null
    }
  });
  if (hold) {
    await submitForApproval(tx, {
      tenantId: input.tenantId,
      documentType: 'PARTY_NOTE',
      documentId: note.id,
      documentNumber: note.noteNumber,
      amount: total,
      userId: input.createdBy
    });
  } else {
    await postNoteJournal(tx, note, input.createdBy);
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: hold ? 'STATUS' : 'POST',
    entity: 'PARTY_NOTE',
    entityId: note.id,
    after: { status: note.status, noteNumber, total }
  });
  return note;
}

async function postNoteJournal(tx, note, createdBy) {
  const map = await ensureGlMap(tx, note.tenantId, createdBy);
  const rate = num(note.exchangeRate) || 1;
  const baseSub = money(num(note.subtotal) * rate);
  const baseTax = money(num(note.taxAmount) * rate);
  const baseTotal = money(num(note.total) * rate);
  const dims = { costCenterId: note.costCenterId || null, profitCenterId: note.profitCenterId || null };
  const partyType = note.partyType;
  const kind = note.kind;
  let lines;
  if (partyType === 'CUSTOMER' && kind === 'CREDIT') {
    lines = [
      { accountId: map.REVENUE, debit: baseSub, credit: 0, ...dims, description: note.noteNumber },
      { accountId: map.VAT_OUTPUT, debit: baseTax, credit: 0, ...dims, description: 'VAT adjustment' },
      { accountId: map.AR, debit: 0, credit: baseTotal, ...dims, description: note.noteNumber }
    ];
  } else if (partyType === 'CUSTOMER') {
    lines = [
      { accountId: map.AR, debit: baseTotal, credit: 0, ...dims, description: note.noteNumber },
      { accountId: map.REVENUE, debit: 0, credit: baseSub, ...dims, description: note.noteNumber },
      { accountId: map.VAT_OUTPUT, debit: 0, credit: baseTax, ...dims, description: 'VAT' }
    ];
  } else if (kind === 'CREDIT') {
    lines = [
      { accountId: map.AP, debit: baseTotal, credit: 0, ...dims, description: note.noteNumber },
      { accountId: map.VAT_INPUT, debit: 0, credit: baseTax, ...dims, description: 'VAT input reversal' },
      { accountId: map.PPV, debit: 0, credit: baseSub, ...dims, description: note.noteNumber }
    ];
  } else {
    lines = [
      { accountId: map.PPV, debit: baseSub, credit: 0, ...dims, description: note.noteNumber },
      { accountId: map.VAT_INPUT, debit: baseTax, credit: 0, ...dims, description: 'VAT input' },
      { accountId: map.AP, debit: 0, credit: baseTotal, ...dims, description: note.noteNumber }
    ];
  }
  await postJournal(tx, {
    tenantId: note.tenantId,
    date: note.date,
    createdBy,
    description: `${partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'} ${kind.toLowerCase()} note ${note.noteNumber}`,
    referenceType: 'PARTY_NOTE',
    referenceId: note.id,
    lines
  });
}

async function postHeldPartyNote(tx, { tenantId, id, createdBy }) {
  const note = await tx.partyNote.findFirst({ where: { id, tenantId } });
  if (!note || note.status === 'POSTED' || note.status === 'CANCELLED') return note;
  await postNoteJournal(tx, note, createdBy);
  const posted = await tx.partyNote.update({ where: { id: note.id }, data: { status: 'POSTED' } });
  await writeAudit(tx, {
    tenantId,
    userId: createdBy,
    action: 'POST',
    entity: 'PARTY_NOTE',
    entityId: note.id,
    before: { status: note.status },
    after: { status: 'POSTED' }
  });
  return posted;
}

async function cancelPartyNote(tx, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const note = await tx.partyNote.findFirst({ where: { id, tenantId } });
  if (!note) throw new DocumentError('Note not found.', { id: 'Note not found.' });
  if (note.status === 'CANCELLED') throw new DocumentError('This note is already cancelled.', { status: 'This note is already cancelled.' });
  if (note.status === 'POSTED') {
    await reverseJournal(tx, {
      tenantId,
      referenceType: 'PARTY_NOTE',
      referenceId: note.id,
      date: new Date(),
      createdBy,
      description: text
    });
  }
  await cancelOpenRequests(tx, { tenantId, documentId: note.id });
  const updated = await tx.partyNote.update({ where: { id: note.id }, data: { status: 'CANCELLED' } });
  await writeAudit(tx, {
    tenantId,
    userId: createdBy,
    action: note.status === 'POSTED' ? 'REVERSE' : 'STATUS',
    entity: 'PARTY_NOTE',
    entityId: note.id,
    before: { status: note.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function saveCollection(tx, input) {
  const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId: input.tenantId } });
  if (!customer) throw new DocumentError('Customer is required.', { customerId: 'Customer is required.' });
  const data = {
    disputeStatus: String(input.disputeStatus || 'NONE').toUpperCase(),
    promisedDate: input.promisedDate ? new Date(input.promisedDate) : null,
    lastContact: input.lastContact ? new Date(input.lastContact) : new Date(),
    notes: input.notes || null,
    collector: input.collector || null
  };
  const row = await tx.collectionCase.upsert({
    where: { tenantId_customerId: { tenantId: input.tenantId, customerId: input.customerId } },
    create: { tenantId: input.tenantId, customerId: input.customerId, ...data },
    update: data
  });
  if (input.body) {
    await tx.collectionActivity.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        date: data.lastContact || new Date(),
        body: String(input.body),
        promisedDate: data.promisedDate,
        createdBy: input.createdBy || null
      }
    });
  }
  return row;
}

async function createCheque(tx, input) {
  const direction = String(input.direction || '').toUpperCase();
  if (!['IN', 'OUT'].includes(direction)) throw new DocumentError('Choose an incoming or outgoing cheque.', { direction: 'Choose an incoming or outgoing cheque.' });
  if (!input.chequeNumber) throw new DocumentError('Cheque number is required.', { chequeNumber: 'Cheque number is required.' });
  if (!input.payee) throw new DocumentError('Payee is required.', { payee: 'Payee is required.' });
  const amount = money(input.amount);
  if (!(amount > 0)) throw new DocumentError('Cheque amount must be greater than zero.', { amount: 'Cheque amount must be greater than zero.' });
  const duplicate = await tx.cheque.findFirst({
    where: { tenantId: input.tenantId, chequeNumber: String(input.chequeNumber), direction, status: { not: 'CANCELLED' } }
  });
  if (duplicate) throw new DocumentError('That cheque number is already in the register.', { chequeNumber: 'That cheque number is already in the register.' });
  const rate = rateOf(input.exchangeRate);
  const base = money(amount * rate);
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const cheque = await tx.cheque.create({
    data: {
      tenantId: input.tenantId,
      chequeNumber: String(input.chequeNumber),
      chequeDate: new Date(input.chequeDate),
      payee: String(input.payee),
      direction,
      partyId: input.partyId || null,
      invoiceId: input.invoiceId || null,
      bankAccountId: input.bankAccountId || null,
      amount: dec(amount),
      exchangeRate: dec(rate),
      status: 'UNREALISED',
      isPdc: Boolean(input.isPdc),
      createdBy: input.createdBy || null
    }
  });
  if (direction === 'IN') {
    if (input.invoiceId) {
      const invoice = await tx.salesInvoice.findFirst({ where: { id: input.invoiceId, tenantId: input.tenantId } });
      if (!invoice || (input.partyId && invoice.customerId !== input.partyId)) {
        throw new DocumentError('Invoice not found for this customer.', { invoiceId: 'Invoice not found for this customer.' });
      }
      await applySales(tx, invoice.id, amount);
    }
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: cheque.chequeDate,
      createdBy: input.createdBy,
      description: `PDC receipt ${cheque.chequeNumber}`,
      referenceType: 'CHEQUE',
      referenceId: cheque.id,
      lines: [
        { accountId: map.CHEQUES_IN_HAND, debit: base, credit: 0, description: cheque.chequeNumber },
        { accountId: map.AR, debit: 0, credit: base, description: cheque.chequeNumber }
      ]
    });
  } else {
    if (input.invoiceId) {
      const invoice = await tx.supplierInvoice.findFirst({ where: { id: input.invoiceId, tenantId: input.tenantId } });
      if (!invoice || (input.partyId && invoice.supplierId !== input.partyId)) {
        throw new DocumentError('Invoice not found for this supplier.', { invoiceId: 'Invoice not found for this supplier.' });
      }
      await applySupplier(tx, invoice.id, amount);
    }
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: cheque.chequeDate,
      createdBy: input.createdBy,
      description: `Cheque issued ${cheque.chequeNumber}`,
      referenceType: 'CHEQUE',
      referenceId: cheque.id,
      lines: [
        { accountId: map.AP, debit: base, credit: 0, description: cheque.chequeNumber },
        { accountId: map.OUTSTANDING_CHEQUES, debit: 0, credit: base, description: cheque.chequeNumber }
      ]
    });
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'POST',
    entity: 'CHEQUE',
    entityId: cheque.id,
    after: { status: cheque.status, chequeNumber: cheque.chequeNumber, amount }
  });
  return cheque;
}

async function cancelCheque(tx, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const cheque = await tx.cheque.findFirst({ where: { id, tenantId } });
  if (!cheque) throw new DocumentError('Cheque not found.', { id: 'Cheque not found.' });
  if (cheque.status === 'CANCELLED') throw new DocumentError('This cheque is already cancelled.', { status: 'This cheque is already cancelled.' });
  if (['REALISED', 'BOUNCED'].includes(cheque.status)) {
    throw new DocumentError('A realised or bounced cheque is reversed with the bounce action.', { status: 'A realised or bounced cheque is reversed with the bounce action.' });
  }
  await reverseJournal(tx, {
    tenantId,
    referenceType: 'CHEQUE',
    referenceId: cheque.id,
    date: new Date(),
    createdBy,
    description: text
  });
  if (cheque.invoiceId) {
    if (cheque.direction === 'IN') await applySales(tx, cheque.invoiceId, -num(cheque.amount));
    else await applySupplier(tx, cheque.invoiceId, -num(cheque.amount));
  }
  const updated = await tx.cheque.update({ where: { id: cheque.id }, data: { status: 'CANCELLED' } });
  await writeAudit(tx, {
    tenantId,
    userId: createdBy,
    action: 'REVERSE',
    entity: 'CHEQUE',
    entityId: cheque.id,
    before: { status: cheque.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function setChequeStatus(tx, input, next) {
  const cheque = await tx.cheque.findFirst({ where: { id: input.chequeId, tenantId: input.tenantId } });
  if (!cheque) throw new DocumentError('Cheque not found.', { chequeId: 'Cheque not found.' });
  if (['BOUNCED', 'CANCELLED', 'REALISED'].includes(cheque.status) && next !== 'BOUNCED') {
    throw new DocumentError(`Cheque is already ${cheque.status.toLowerCase()}.`, { status: `Cheque is already ${cheque.status.toLowerCase()}.` });
  }
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const base = money(num(cheque.amount) * (num(cheque.exchangeRate) || 1));
  const bank = input.bankAccountId || cheque.bankAccountId || map.BANK;
  if (next === 'DEPOSITED') {
    if (cheque.direction !== 'IN') throw new DocumentError('Only incoming cheques are deposited.', { direction: 'Only incoming cheques are deposited.' });
    return tx.cheque.update({ where: { id: cheque.id }, data: { status: 'DEPOSITED', bankAccountId: bank } });
  }
  if (next === 'REALISED') {
    const lines = cheque.direction === 'IN'
      ? [
        { accountId: bank, debit: base, credit: 0, description: cheque.chequeNumber },
        { accountId: map.CHEQUES_IN_HAND, debit: 0, credit: base, description: cheque.chequeNumber }
      ]
      : [
        { accountId: map.OUTSTANDING_CHEQUES, debit: base, credit: 0, description: cheque.chequeNumber },
        { accountId: bank, debit: 0, credit: base, description: cheque.chequeNumber }
      ];
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: input.date || new Date(),
      createdBy: input.createdBy,
      description: `Realise cheque ${cheque.chequeNumber}`,
      referenceType: 'CHEQUE_REALISED',
      referenceId: cheque.id,
      lines
    });
    return tx.cheque.update({ where: { id: cheque.id }, data: { status: 'REALISED', realised: true, bankAccountId: bank } });
  }
  if (next === 'BOUNCED') {
    const lines = [];
    if (cheque.direction === 'IN') {
      lines.push(
        { accountId: map.AR, debit: base, credit: 0, description: 'Cheque bounced' },
        { accountId: cheque.realised ? bank : map.CHEQUES_IN_HAND, debit: 0, credit: base, description: 'Cheque bounced' }
      );
      if (cheque.invoiceId) await applySales(tx, cheque.invoiceId, -num(cheque.amount));
    } else {
      lines.push(
        { accountId: cheque.realised ? bank : map.OUTSTANDING_CHEQUES, debit: base, credit: 0, description: 'Cheque bounced' },
        { accountId: map.AP, debit: 0, credit: base, description: 'Cheque bounced' }
      );
      if (cheque.invoiceId) await applySupplier(tx, cheque.invoiceId, -num(cheque.amount));
    }
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: input.date || new Date(),
      createdBy: input.createdBy,
      description: `Bounce cheque ${cheque.chequeNumber}`,
      referenceType: 'CHEQUE_BOUNCE',
      referenceId: cheque.id,
      lines
    });
    return tx.cheque.update({ where: { id: cheque.id }, data: { status: 'BOUNCED' } });
  }
  throw new DocumentError('Unsupported cheque action.', { status: 'Unsupported cheque action.' });
}

async function openPettyCash(tx, input) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new DocumentError('Float amount must be greater than zero.', { amount: 'Float amount must be greater than zero.' });
  if (!input.name) throw new DocumentError('Name the petty cash fund.', { name: 'Name the petty cash fund.' });
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const fund = await tx.pettyCashFund.create({
    data: { tenantId: input.tenantId, name: input.name, custodian: input.custodian || null, balance: dec(amount) }
  });
  await postJournal(tx, {
    tenantId: input.tenantId,
    date: input.date || new Date(),
    createdBy: input.createdBy,
    description: `Petty cash float ${fund.name}`,
    referenceType: 'PETTY_CASH',
    referenceId: fund.id,
    lines: [
      { accountId: map.PETTY_CASH, debit: amount, credit: 0, description: fund.name },
      { accountId: map.BANK, debit: 0, credit: amount, description: fund.name }
    ]
  });
  return fund;
}

async function issueIou(tx, input) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new DocumentError('Advance amount must be greater than zero.', { amount: 'Advance amount must be greater than zero.' });
  if (!input.employeeName) throw new DocumentError('Employee name is required.', { employeeName: 'Employee name is required.' });
  const source = String(input.source || 'PETTY_CASH').toUpperCase();
  let fund = null;
  if (source === 'PETTY_CASH') {
    fund = await tx.pettyCashFund.findFirst({ where: { id: input.fundId, tenantId: input.tenantId } });
    if (!fund) throw new DocumentError('Choose a petty cash fund.', { fundId: 'Choose a petty cash fund.' });
    if (num(fund.balance) + 0.0001 < amount) throw new DocumentError('The petty cash fund does not have enough cash.', { amount: 'The petty cash fund does not have enough cash.' });
  }
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  const reference = await generateDocumentNumber(input.tenantId, 'iouAdvance', 'IOU', 'reference', tx);
  const iou = await tx.iouAdvance.create({
    data: {
      tenantId: input.tenantId,
      reference,
      date: new Date(input.date),
      employeeId: input.employeeId || null,
      employeeName: input.employeeName,
      department: input.department || null,
      amount: dec(amount),
      fundId: fund?.id || null,
      source,
      createdBy: input.createdBy || null
    }
  });
  if (fund) {
    await tx.pettyCashFund.update({ where: { id: fund.id }, data: { balance: dec(money(num(fund.balance) - amount)) } });
  }
  await postJournal(tx, {
    tenantId: input.tenantId,
    date: iou.date,
    createdBy: input.createdBy,
    description: `IOU ${reference}`,
    referenceType: 'IOU',
    referenceId: iou.id,
    lines: [
      { accountId: map.IOU_ADVANCES, debit: amount, credit: 0, description: input.employeeName },
      { accountId: source === 'PETTY_CASH' ? map.PETTY_CASH : map.BANK, debit: 0, credit: amount, description: input.employeeName }
    ]
  });
  await writeAudit(tx, {
    tenantId: input.tenantId,
    userId: input.createdBy,
    action: 'POST',
    entity: 'IOU',
    entityId: iou.id,
    after: { status: iou.status, reference, amount }
  });
  return iou;
}

async function cancelIou(tx, { tenantId, id, createdBy, reason }) {
  const text = requireReason(reason);
  const iou = await tx.iouAdvance.findFirst({ where: { id, tenantId }, include: { fund: true } });
  if (!iou) throw new DocumentError('IOU not found.', { id: 'IOU not found.' });
  if (iou.status === 'CANCELLED') throw new DocumentError('This IOU is already cancelled.', { status: 'This IOU is already cancelled.' });
  if (iou.status !== 'OPEN' || num(iou.settled) > 0.0001) {
    throw new DocumentError('Settle or reverse the open amount before cancelling this IOU.', { status: 'Settle or reverse the open amount before cancelling this IOU.' });
  }
  await reverseJournal(tx, {
    tenantId,
    referenceType: 'IOU',
    referenceId: iou.id,
    date: new Date(),
    createdBy,
    description: text
  });
  if (iou.fund) {
    await tx.pettyCashFund.update({
      where: { id: iou.fund.id },
      data: { balance: dec(money(num(iou.fund.balance) + num(iou.amount))) }
    });
  }
  const updated = await tx.iouAdvance.update({ where: { id: iou.id }, data: { status: 'CANCELLED' } });
  await writeAudit(tx, {
    tenantId,
    userId: createdBy,
    action: 'REVERSE',
    entity: 'IOU',
    entityId: iou.id,
    before: { status: iou.status },
    after: { status: 'CANCELLED', reason: text }
  });
  return updated;
}

async function settleIou(tx, input) {
  const iou = await tx.iouAdvance.findFirst({ where: { id: input.iouId, tenantId: input.tenantId }, include: { fund: true } });
  if (!iou || iou.status === 'CLOSED') throw new DocumentError('That IOU is not open.', { iouId: 'That IOU is not open.' });
  const amount = money(input.amount);
  const outstanding = money(num(iou.amount) - num(iou.settled));
  if (!(amount > 0) || amount - outstanding > 0.0001) {
    throw new DocumentError('Settlement exceeds the open IOU.', { amount: 'Settlement exceeds the open IOU.' });
  }
  const kind = String(input.kind || 'EXPENSE').toUpperCase();
  const map = await ensureGlMap(tx, input.tenantId, input.createdBy);
  if (kind === 'EXPENSE') {
    if (!input.expenseAccountId) throw new DocumentError('Choose the expense account.', { expenseAccountId: 'Choose the expense account.' });
    const account = await tx.account.findFirst({ where: { id: input.expenseAccountId, tenantId: input.tenantId } });
    if (!account) throw new DocumentError('Expense account not found.', { expenseAccountId: 'Expense account not found.' });
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: input.date,
      createdBy: input.createdBy,
      description: `Settle IOU ${iou.reference}`,
      referenceType: 'IOU_SETTLEMENT',
      referenceId: iou.id,
      lines: [
        { accountId: account.id, debit: amount, credit: 0, costCenterId: input.costCenterId || null, description: input.description || iou.employeeName },
        { accountId: map.IOU_ADVANCES, debit: 0, credit: amount, description: iou.reference }
      ]
    });
  } else {
    if (iou.fund) {
      await tx.pettyCashFund.update({ where: { id: iou.fund.id }, data: { balance: dec(money(num(iou.fund.balance) + amount)) } });
    }
    await postJournal(tx, {
      tenantId: input.tenantId,
      date: input.date,
      createdBy: input.createdBy,
      description: `IOU cash returned ${iou.reference}`,
      referenceType: 'IOU_SETTLEMENT',
      referenceId: iou.id,
      lines: [
        { accountId: map.PETTY_CASH, debit: amount, credit: 0, description: iou.reference },
        { accountId: map.IOU_ADVANCES, debit: 0, credit: amount, description: iou.reference }
      ]
    });
  }
  const settled = money(num(iou.settled) + amount);
  const status = settled + 0.0001 >= num(iou.amount) ? 'CLOSED' : 'PARTIAL';
  await tx.iouSettlement.create({
    data: {
      tenantId: input.tenantId,
      iouId: iou.id,
      date: new Date(input.date),
      amount: dec(amount),
      kind: kind === 'EXPENSE' ? 'EXPENSE' : 'RETURN',
      expenseAccountId: input.expenseAccountId || null,
      description: input.description || null,
      createdBy: input.createdBy || null
    }
  });
  return tx.iouAdvance.update({ where: { id: iou.id }, data: { settled: dec(settled), status }, include: { settlements: true } });
}

module.exports = {
  postPartyNote,
  postHeldPartyNote,
  cancelPartyNote,
  saveCollection,
  createCheque,
  cancelCheque,
  setChequeStatus,
  openPettyCash,
  issueIou,
  cancelIou,
  settleIou
};
