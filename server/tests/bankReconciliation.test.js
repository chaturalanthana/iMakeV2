const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config');

let testTenant;
let testUser;
let authToken;
let bankAccount;
let contraAccount;

beforeAll(async () => {
  // Create test tenant
  testTenant = await prisma.tenant.create({
    data: {
      name: 'Reconcile Test Tenant',
      slug: `reconcile-test-${Date.now()}`
    }
  });

  // Create admin role
  const testRole = await prisma.role.create({
    data: {
      tenantId: testTenant.id,
      name: 'Admin'
    }
  });

  // Create user
  testUser = await prisma.user.create({
    data: {
      tenantId: testTenant.id,
      email: `recon_${Date.now()}@test.com`,
      passwordHash: 'dummyhash',
      firstName: 'Finance',
      lastName: 'Manager',
      roleId: testRole.id
    }
  });

  // Create bank account and contra account
  bankAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '1010_test',
      name: 'Main Bank Account',
      type: 'ASSET'
    }
  });

  contraAccount = await prisma.account.create({
    data: {
      tenantId: testTenant.id,
      code: '6100_test',
      name: 'Bank Charges Expense',
      type: 'EXPENSE'
    }
  });

  // Generate JWT Token
  authToken = jwt.sign(
    { userId: testUser.id, tenantId: testTenant.id, email: testUser.email },
    jwtSecret,
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  // Cleanup test data in reverse dependencies order
  await prisma.bankReconciliationMatch.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.bankStatementLine.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.bankReconciliation.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.journalLine.deleteMany({
    where: {
      accountId: { in: [bankAccount.id, contraAccount.id] }
    }
  });
  await prisma.journalEntry.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.account.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });

  await prisma.$disconnect();
});

describe('Bank Reconciliation Module', () => {
  let reconciliationId;
  let statementLines = [];
  let journalLineId;

  it('should start a bank reconciliation period and calculate balances', async () => {
    const res = await request(app)
      .post('/api/finance/reconciliation/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        accountId: bankAccount.id,
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        statementClosingBalance: 5000.0
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('DRAFT');
    expect(parseFloat(res.body.statementClosingBalance)).toBe(5000.0);
    reconciliationId = res.body.id;
  });

  it('should import bank statement lines with duplicate prevention', async () => {
    const lines = [
      { date: '2026-06-10', amount: 1200.0, reference: 'REF-001', chequeNumber: 'CHQ-101', description: 'Customer payment' },
      { date: '2026-06-12', amount: -150.0, reference: 'REF-002', chequeNumber: '', description: 'Office supplies' },
      { date: '2026-06-15', amount: -50.0, reference: 'REF-003', chequeNumber: '', description: 'Monthly charges' }
    ];

    // First import
    const res1 = await request(app)
      .post('/api/finance/reconciliation/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        accountId: bankAccount.id,
        lines
      });

    expect(res1.status).toBe(200);
    expect(res1.body.importedCount).toBe(3);
    expect(res1.body.duplicateCount).toBe(0);

    // Duplicate check import
    const res2 = await request(app)
      .post('/api/finance/reconciliation/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        accountId: bankAccount.id,
        lines: [
          { date: '2026-06-10', amount: 1200.0, reference: 'REF-001', chequeNumber: 'CHQ-101', description: 'Customer payment' }, // Dup
          { date: '2026-06-20', amount: 800.0, reference: 'REF-004', chequeNumber: '', description: 'New Sales payment' } // New
        ]
      });

    expect(res2.status).toBe(200);
    expect(res2.body.importedCount).toBe(1);
    expect(res2.body.duplicateCount).toBe(1);
  });

  it('should run auto-matching engine and suggest matches based on rules', async () => {
    // Let's create an unmatched journal line in ERP ledger
    const journalEntry = await prisma.journalEntry.create({
      data: {
        tenantId: testTenant.id,
        entryNumber: 'JE-001',
        date: new Date('2026-06-10'),
        description: 'Deposit CHQ-101',
        isPosted: true,
        createdBy: testUser.id,
        lines: {
          create: [
            { accountId: bankAccount.id, debit: 1200.0, credit: 0.0, description: 'Ref REF-001 CHQ-101' },
            { accountId: contraAccount.id, debit: 0.0, credit: 1200.0, description: 'Sales Revenue' }
          ]
        }
      },
      include: { lines: true }
    });

    const bankLine = journalEntry.lines.find(l => l.accountId === bankAccount.id);
    journalLineId = bankLine.id;

    // Run auto matching
    const res = await request(app)
      .post('/api/finance/reconciliation/auto-match')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reconciliationId
      });

    expect(res.status).toBe(200);
    expect(res.body.matchesCount).toBe(1); // Statement REF-001 (1200) should match JE-001 line exactly
  });

  it('should fetch workspace dataset including unmatched/matched entries', async () => {
    const res = await request(app)
      .get(`/api/finance/reconciliation/workspace/${reconciliationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('statementLines');
    expect(res.body).toHaveProperty('ledgerLines');
    expect(res.body).toHaveProperty('matches');
    expect(res.body.matches.length).toBe(1);
  });

  it('should allow manual match pairing', async () => {
    // First, let's unmatch the auto-matched item
    const wsBefore = await request(app)
      .get(`/api/finance/reconciliation/workspace/${reconciliationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const matchId = wsBefore.body.matches[0].id;
    const stmtLineId = wsBefore.body.matches[0].statementLineId;

    const unmatchRes = await request(app)
      .post('/api/finance/reconciliation/unmatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reconciliationId,
        matchId
      });

    expect(unmatchRes.status).toBe(200);

    // Pair manually
    const manualRes = await request(app)
      .post('/api/finance/reconciliation/manual-match')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reconciliationId,
        statementLineIds: [stmtLineId],
        journalLineIds: [journalLineId]
      });

    expect(manualRes.status).toBe(200);
  });

  it('should allow adjustment journal posting directly from workspace', async () => {
    // Find unmatched statement line for Monthly charges of -50
    const ws = await request(app)
      .get(`/api/finance/reconciliation/workspace/${reconciliationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const chargesStmt = ws.body.statementLines.find(s => parseFloat(s.amount) === -50.0);
    expect(chargesStmt).toBeDefined();

    const adjRes = await request(app)
      .post('/api/finance/reconciliation/adjustment')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reconciliationId,
        statementLineId: chargesStmt.id,
        adjustmentType: 'BANK_CHARGES',
        contraAccountId: contraAccount.id,
        amount: 50.0,
        date: '2026-06-15',
        description: 'Auto Posted June Bank Charges'
      });

    expect(adjRes.status).toBe(201);
    expect(adjRes.body).toHaveProperty('id');
  });
});
