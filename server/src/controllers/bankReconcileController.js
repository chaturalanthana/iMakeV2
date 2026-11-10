const prisma = require('../lib/prisma');

// Fetch reconciliations for a bank account
const getReconciliations = async (req, res) => {
  try {
    const { accountId } = req.params;
    const reconciliations = await prisma.bankReconciliation.findMany({
      where: {
        tenantId: req.tenantId,
        accountId
      },
      orderBy: { endDate: 'desc' }
    });
    res.json(reconciliations);
  } catch (error) {
    console.error('Fetch reconciliations error:', error);
    res.status(500).json({ error: 'Failed to fetch reconciliations' });
  }
};

// Start a new reconciliation or retrieve draft
const startReconciliation = async (req, res) => {
  try {
    const { accountId, startDate, endDate, statementClosingBalance } = req.body;

    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Account, start date, and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate ERP ledger closing balance as of end date
    // Ledger balance is sum of debits - credits of all posted journal entries for this account
    const journalLines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: end }
        }
      }
    });

    let ledgerClosingBalance = 0;
    for (const line of journalLines) {
      ledgerClosingBalance += parseFloat(line.debit || 0) - parseFloat(line.credit || 0);
    }

    // Check if there is an existing DRAFT reconciliation for this account
    let recon = await prisma.bankReconciliation.findFirst({
      where: {
        tenantId: req.tenantId,
        accountId,
        status: 'DRAFT'
      }
    });

    if (recon) {
      // Update existing draft reconciliation
      recon = await prisma.bankReconciliation.update({
        where: { id: recon.id },
        data: {
          startDate: start,
          endDate: end,
          statementClosingBalance: parseFloat(statementClosingBalance || 0),
          ledgerClosingBalance
        }
      });
    } else {
      // Check if there is a completed reconciliation overlapping this period
      const overlap = await prisma.bankReconciliation.findFirst({
        where: {
          tenantId: req.tenantId,
          accountId,
          status: 'COMPLETED',
          endDate: { gte: start }
        }
      });

      if (overlap) {
        return res.status(400).json({ error: 'A completed reconciliation already exists for an overlapping or later period.' });
      }

      recon = await prisma.bankReconciliation.create({
        data: {
          tenantId: req.tenantId,
          accountId,
          startDate: start,
          endDate: end,
          statementClosingBalance: parseFloat(statementClosingBalance || 0),
          ledgerClosingBalance,
          status: 'DRAFT',
          createdBy: req.user.userId
        }
      });
    }

    res.status(201).json(recon);
  } catch (error) {
    console.error('Start reconciliation error:', error);
    res.status(500).json({ error: 'Failed to start reconciliation' });
  }
};

// Import Statement lines
const importStatement = async (req, res) => {
  try {
    const { accountId, lines } = req.body; // array of { date, amount, reference, chequeNumber, description }
    if (!accountId || !lines || !Array.isArray(lines)) {
      return res.status(400).json({ error: 'Account ID and statement lines are required' });
    }

    let importedCount = 0;
    let duplicateCount = 0;

    const newLinesData = [];

    for (const line of lines) {
      const lineDate = new Date(line.date);
      const amount = parseFloat(line.amount);

      if (isNaN(lineDate.getTime()) || isNaN(amount)) {
        continue;
      }

      // De-duplication check: check if the exact same line was already imported
      const duplicate = await prisma.bankStatementLine.findFirst({
        where: {
          tenantId: req.tenantId,
          accountId,
          date: lineDate,
          amount,
          reference: line.reference || null,
          chequeNumber: line.chequeNumber || null,
          description: line.description || null
        }
      });

      if (duplicate) {
        duplicateCount++;
        continue;
      }

      newLinesData.push({
        tenantId: req.tenantId,
        accountId,
        date: lineDate,
        amount,
        reference: line.reference || '',
        chequeNumber: line.chequeNumber || '',
        description: line.description || '',
        isMatched: false
      });
    }

    if (newLinesData.length > 0) {
      await prisma.bankStatementLine.createMany({
        data: newLinesData
      });
      importedCount = newLinesData.length;
    }

    res.json({
      message: `Statement imported successfully.`,
      importedCount,
      duplicateCount
    });
  } catch (error) {
    console.error('Import statement error:', error);
    res.status(500).json({ error: 'Failed to import statement lines' });
  }
};

// Fetch workspace data for active draft reconciliation
const getWorkspaceData = async (req, res) => {
  try {
    const { reconciliationId } = req.params;

    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: {
        id: reconciliationId,
        tenantId: req.tenantId
      }
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation period not found' });
    }

    const { accountId, endDate, startDate } = reconciliation;

    // 1. Fetch ALL unmatched statement lines for this account (where isMatched = false)
    // plus any statement lines that are matched to THIS reconciliation
    const statementLines = await prisma.bankStatementLine.findMany({
      where: {
        tenantId: req.tenantId,
        accountId,
        OR: [
          { isMatched: false },
          { bankReconciliationId: reconciliationId }
        ]
      },
      orderBy: { date: 'asc' }
    });

    // 2. Fetch unmatched Ledger journal lines up to endDate
    // A ledger line is a JournalLine under this account, which is posted, and is not matched to any OTHER completed reconciliation.
    // That means it either has no matches, or its matches are linked to THIS draft reconciliation.
    const ledgerLines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: endDate }
        },
        OR: [
          {
            bankReconciliationMatches: {
              none: {}
            }
          },
          {
            bankReconciliationMatches: {
              some: {
                reconciliationId: reconciliationId
              }
            }
          }
        ]
      },
      include: {
        journalEntry: true,
        bankReconciliationMatches: true
      },
      orderBy: {
        journalEntry: {
          date: 'asc'
        }
      }
    });

    // 3. Fetch matched pairs in this reconciliation
    const matches = await prisma.bankReconciliationMatch.findMany({
      where: {
        reconciliationId,
        tenantId: req.tenantId
      },
      include: {
        statementLine: true,
        journalLine: {
          include: { journalEntry: true }
        }
      }
    });

    res.json({
      reconciliation,
      statementLines,
      ledgerLines: ledgerLines.map(line => ({
        id: line.id,
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.entryNumber,
        reference: line.journalEntry.referenceId || '',
        description: line.description || line.journalEntry.description,
        debit: parseFloat(line.debit),
        credit: parseFloat(line.credit),
        amount: parseFloat(line.debit) - parseFloat(line.credit) // Net amount
      })),
      matches
    });
  } catch (error) {
    console.error('Workspace data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch workspace data' });
  }
};

// Auto Match Engine
const autoMatchEngine = async (req, res) => {
  try {
    const { reconciliationId } = req.body;

    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: {
        id: reconciliationId,
        tenantId: req.tenantId,
        status: 'DRAFT'
      }
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation draft not found' });
    }

    const { accountId, endDate } = reconciliation;

    // Fetch unmatched statement lines
    const unmatchedStatements = await prisma.bankStatementLine.findMany({
      where: {
        tenantId: req.tenantId,
        accountId,
        isMatched: false
      }
    });

    // Fetch unmatched ledger lines
    const unmatchedLedgersRaw = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: endDate }
        },
        bankReconciliationMatches: {
          none: {}
        }
      },
      include: { journalEntry: true }
    });

    let unmatchedLedgers = unmatchedLedgersRaw.map(line => ({
      id: line.id,
      date: new Date(line.journalEntry.date),
      entryNumber: line.journalEntry.entryNumber,
      description: line.description || line.journalEntry.description || '',
      amount: parseFloat(line.debit) - parseFloat(line.credit),
      used: false
    }));

    const suggestedMatches = [];

    // Loop through statement lines to find matches
    for (const stmt of unmatchedStatements) {
      const stmtAmount = parseFloat(stmt.amount);
      const stmtDate = new Date(stmt.date);

      let bestMatch = null;
      let highestConfidence = 0;

      for (const ledger of unmatchedLedgers) {
        if (ledger.used) continue;

        // The amount must be equal
        if (Math.abs(ledger.amount - stmtAmount) > 0.01) continue;

        const dayDiff = Math.abs(stmtDate.getTime() - ledger.date.getTime()) / (1000 * 60 * 60 * 24);

        // 1. 100% Match: Date matches exactly AND (cheque number or reference matches)
        const chequeMatch = stmt.chequeNumber && ledger.description && ledger.description.includes(stmt.chequeNumber);
        const refMatch = stmt.reference && ledger.entryNumber && ledger.entryNumber.includes(stmt.reference);

        if (dayDiff === 0 && (chequeMatch || refMatch)) {
          bestMatch = ledger;
          highestConfidence = 100;
          break; // Perfect match, stop searching
        }

        // 2. 80% Match: Date within 3 days and description keyword overlap
        const descMatch = stmt.description && ledger.description &&
          stmt.description.toLowerCase().split(' ').some(word => word.length > 3 && ledger.description.toLowerCase().includes(word));

        if (dayDiff <= 3 && descMatch && highestConfidence < 80) {
          bestMatch = ledger;
          highestConfidence = 80;
        }

        // 3. 50% Match: Date within 7 days
        if (dayDiff <= 7 && highestConfidence < 50) {
          bestMatch = ledger;
          highestConfidence = 50;
        }
      }

      if (bestMatch && highestConfidence >= 50) {
        bestMatch.used = true; // Mark as mapped so it is not mapped again
        suggestedMatches.push({
          statementLineId: stmt.id,
          journalLineId: bestMatch.id,
          confidenceScore: highestConfidence
        });
      }
    }

    // Save suggested matches to the DB
    if (suggestedMatches.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const sugg of suggestedMatches) {
          // Create match record
          await tx.bankReconciliationMatch.create({
            data: {
              tenantId: req.tenantId,
              reconciliationId,
              statementLineId: sugg.statementLineId,
              journalLineId: sugg.journalLineId,
              matchType: 'AUTO',
              confidenceScore: sugg.confidenceScore
            }
          });

          // Mark statement line as matched
          await tx.bankStatementLine.update({
            where: { id: sugg.statementLineId },
            data: {
              isMatched: true,
              bankReconciliationId: reconciliationId
            }
          });
        }
      });
    }

    res.json({
      message: `Auto-match complete. Suggested and applied ${suggestedMatches.length} matches.`,
      matchesCount: suggestedMatches.length
    });
  } catch (error) {
    console.error('Auto match error:', error);
    res.status(500).json({ error: 'Failed to run auto-match engine' });
  }
};

// Manual Match
const manualMatch = async (req, res) => {
  try {
    const { reconciliationId, statementLineIds, journalLineIds } = req.body;

    if (!reconciliationId || !statementLineIds || !journalLineIds || !Array.isArray(statementLineIds) || !Array.isArray(journalLineIds)) {
      return res.status(400).json({ error: 'Invalid parameters. reconciliationId, statementLineIds, and journalLineIds are required' });
    }

    // Verify reconciliation is in draft status
    const recon = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId: req.tenantId }
    });

    if (!recon || recon.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Reconciliation is not in DRAFT status' });
    }

    // Sum matching amounts to ensure they match or allow mismatch for manual pairing
    // Usually, sum of statements should equal sum of ledgers.
    const statements = await prisma.bankStatementLine.findMany({
      where: { id: { in: statementLineIds }, tenantId: req.tenantId }
    });

    const ledgers = await prisma.journalLine.findMany({
      where: { id: { in: journalLineIds } }
    });

    const stmtTotal = statements.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const ledgerTotal = ledgers.reduce((sum, l) => sum + (parseFloat(l.debit) - parseFloat(l.credit)), 0);

    if (Math.abs(stmtTotal - ledgerTotal) > 0.01) {
      return res.status(400).json({ error: `Amounts do not balance. Statement: ${stmtTotal.toFixed(2)}, Ledger: ${ledgerTotal.toFixed(2)}` });
    }

    // Perform transaction to link all statement lines and create match records
    await prisma.$transaction(async (tx) => {
      // In a manual N-to-M, we can map every statement line to every journal line
      for (const stmtId of statementLineIds) {
        for (const ledgerId of journalLineIds) {
          // Check if match already exists
          const existing = await tx.bankReconciliationMatch.findFirst({
            where: { statementLineId: stmtId, journalLineId: ledgerId }
          });
          if (!existing) {
            await tx.bankReconciliationMatch.create({
              data: {
                tenantId: req.tenantId,
                reconciliationId,
                statementLineId: stmtId,
                journalLineId: ledgerId,
                matchType: 'MANUAL',
                confidenceScore: 100
              }
            });
          }
        }

        // Mark statement line as matched
        await tx.bankStatementLine.update({
          where: { id: stmtId },
          data: {
            isMatched: true,
            bankReconciliationId: reconciliationId
          }
        });
      }
    });

    res.json({ message: 'Manual match recorded successfully.' });
  } catch (error) {
    console.error('Manual match error:', error);
    res.status(500).json({ error: 'Failed to record manual match' });
  }
};

// Unmatch
const unmatch = async (req, res) => {
  try {
    const { reconciliationId, matchId } = req.body;

    const match = await prisma.bankReconciliationMatch.findFirst({
      where: { id: matchId, reconciliationId, tenantId: req.tenantId },
      include: { statementLine: true }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match record not found' });
    }

    // Verify reconciliation is in draft status
    const recon = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId: req.tenantId }
    });

    if (!recon || recon.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Reconciliation is not in DRAFT status' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete match record
      await tx.bankReconciliationMatch.delete({
        where: { id: matchId }
      });

      // Check if there are other matches for this statement line. If none, set isMatched = false
      const otherMatches = await tx.bankReconciliationMatch.findFirst({
        where: { statementLineId: match.statementLineId }
      });

      if (!otherMatches) {
        await tx.bankStatementLine.update({
          where: { id: match.statementLineId },
          data: {
            isMatched: false,
            bankReconciliationId: null
          }
        });
      }
    });

    res.json({ message: 'Match unlinked successfully.' });
  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ error: 'Failed to unlink matched items' });
  }
};

// Create Journal Adjustment Entry
const createAdjustment = async (req, res) => {
  try {
    const { reconciliationId, statementLineId, adjustmentType, contraAccountId, amount, date, description } = req.body;

    if (!reconciliationId || !statementLineId || !contraAccountId || !amount || !date) {
      return res.status(400).json({ error: 'Reconciliation ID, statement line, contra account, amount, and date are required' });
    }

    const recon = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId: req.tenantId }
    });

    if (!recon || recon.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Reconciliation is not in DRAFT status' });
    }

    const entryNumber = `ADJ-${Date.now()}`;
    const adjAmount = parseFloat(amount);
    const bankAccountId = recon.accountId;

    // Determine debit/credit for bank account and contra account
    // For BANK_CHARGES/DIRECT_DEBITS: Bank is CREDITED (reduced), Charges is DEBITED (increased)
    // For INTEREST_INCOME/DIRECT_DEPOSITS: Bank is DEBITED (increased), Income is CREDITED (increased)
    let bankDebit = 0;
    let bankCredit = 0;
    let contraDebit = 0;
    let contraCredit = 0;

    if (adjustmentType === 'BANK_CHARGES' || adjustmentType === 'DIRECT_DEBITS' || adjustmentType === 'MISC_DEBITS') {
      bankCredit = adjAmount;
      contraDebit = adjAmount;
    } else {
      bankDebit = adjAmount;
      contraCredit = adjAmount;
    }

    const journalEntry = await prisma.$transaction(async (tx) => {
      // Create journal entry
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: req.tenantId,
          entryNumber,
          date: new Date(date),
          description: description || `Adjustment: ${adjustmentType}`,
          isPosted: true,
          createdBy: req.user.userId,
          lines: {
            create: [
              {
                accountId: bankAccountId,
                debit: bankDebit,
                credit: bankCredit,
                description: description || `Adjustment: ${adjustmentType}`
              },
              {
                accountId: contraAccountId,
                debit: contraDebit,
                credit: contraCredit,
                description: description || `Adjustment: ${adjustmentType}`
              }
            ]
          }
        },
        include: { lines: true }
      });

      // Find the journal line for the bank account
      const bankLine = entry.lines.find(l => l.accountId === bankAccountId);

      // Create Match record linking statement line to the new bank journal line
      await tx.bankReconciliationMatch.create({
        data: {
          tenantId: req.tenantId,
          reconciliationId,
          statementLineId,
          journalLineId: bankLine.id,
          matchType: 'MANUAL',
          confidenceScore: 100
        }
      });

      // Mark statement line as matched
      await tx.bankStatementLine.update({
        where: { id: statementLineId },
        data: {
          isMatched: true,
          bankReconciliationId: reconciliationId
        }
      });

      return entry;
    });

    res.status(201).json(journalEntry);
  } catch (error) {
    console.error('Create adjustment error:', error);
    res.status(500).json({ error: 'Failed to create adjustment entry' });
  }
};

// Finalize/Complete Reconciliation
const finalizeReconciliation = async (req, res) => {
  try {
    const { reconciliationId } = req.body;

    const recon = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId: req.tenantId }
    });

    if (!recon) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (recon.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Reconciliation is already finalized and locked' });
    }

    // Verify reconciliation math
    // ERP Ledger balance:
    const ledgerLines = await prisma.journalLine.findMany({
      where: {
        accountId: recon.accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: recon.endDate }
        }
      }
    });

    let currentLedgerBalance = 0;
    for (const line of ledgerLines) {
      currentLedgerBalance += parseFloat(line.debit || 0) - parseFloat(line.credit || 0);
    }

    // Reconciled Statement Balance should be:
    // Ledger Balance + Outstanding Deposits - Unpresented Cheques
    // Outstanding Deposits = unmatched credit lines (debit to bank account) in ERP up to period end
    // Unpresented Cheques = unmatched debit lines (credit to bank account) in ERP up to period end
    const matches = await prisma.bankReconciliationMatch.findMany({
      where: { reconciliationId, tenantId: req.tenantId },
      include: { statementLine: true }
    });

    // Sum of matched items
    const matchedStatementTotal = matches.reduce((sum, m) => sum + parseFloat(m.statementLine.amount), 0);

    // Let's check unresolved difference
    // Reconciled Balance = ERP Balance + Unmatched statement lines?
    // No, standard math:
    // Statement Closing Balance must match:
    // ERP Closing Balance + (Unmatched Statement Credits - Unmatched Statement Debits) ?
    // Actually, Reconciled Balance = ERP Balance - (Unmatched ledger bank credits - Unmatched ledger bank debits) etc.
    // Let's simplify:
    // A reconciliation is resolved if:
    // Statement Balance - Ledger Balance - Unmatched Statement total (or Matched remaining discrepancy) is zero.
    // Basically:
    // Reconciled Balance = ERP Balance + Outstanding Deposits (GL debit unmatched) - Unpresented Cheques (GL credit unmatched) + Adjustments.
    // Let's compute directly:
    // Unresolved Difference = Statement Closing Balance - (Current Ledger Balance + Outstanding Items etc.)
    // Let's query unmatched GL items up to endDate:
    const unmatchedLedgers = await prisma.journalLine.findMany({
      where: {
        accountId: recon.accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: recon.endDate }
        },
        bankReconciliationMatches: {
          none: {}
        }
      }
    });

    let outstandingDeposits = 0; // debits to bank account (receipts)
    let unpresentedCheques = 0; // credits to bank account (payments)

    for (const l of unmatchedLedgers) {
      const dbVal = parseFloat(l.debit || 0);
      const crVal = parseFloat(l.credit || 0);
      if (dbVal > 0) outstandingDeposits += dbVal;
      if (crVal > 0) unpresentedCheques += crVal;
    }

    // Reconciled balance:
    // ERP Ledger Balance + Outstanding Deposits - Unpresented Cheques?
    // Wait, if a payment is written (Credit Bank GL), it reduces Ledger balance. But statement hasn't cleared it yet.
    // So Statement Balance should be HIGHER by unpresented cheque amount.
    // If a deposit is made (Debit Bank GL), it increases Ledger balance. But statement hasn't cleared it yet.
    // So Statement Balance should be LOWER by outstanding deposit amount.
    // Reconciled Statement Balance = Ledger Balance + Unpresented Cheques - Outstanding Deposits
    const reconciledStatementBalance = currentLedgerBalance + unpresentedCheques - outstandingDeposits;
    const statementClosing = parseFloat(recon.statementClosingBalance);

    const difference = statementClosing - reconciledStatementBalance;

    // Unless approved by an administrator, reject if difference exists
    const hasDifference = Math.abs(difference) > 0.01;
    if (hasDifference && !req.body.forceApprove) {
      return res.status(400).json({
        error: `Cannot finalize. Unresolved difference of ${difference.toFixed(2)} exists.`,
        difference
      });
    }

    // Update status to COMPLETED
    const completedRecon = await prisma.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'COMPLETED',
        ledgerClosingBalance: currentLedgerBalance,
        reconciledAt: new Date(),
        reconciledBy: req.user.userId,
        approvedBy: hasDifference ? req.user.userId : null
      }
    });

    res.json({
      message: 'Reconciliation finalized and locked successfully.',
      reconciliation: completedRecon
    });
  } catch (error) {
    console.error('Finalize reconciliation error:', error);
    res.status(500).json({ error: 'Failed to finalize reconciliation' });
  }
};

// Reconciliation Reports
const getReconciliationReports = async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;

    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Account ID, start date, and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get reconciliations in this period
    const reconciliations = await prisma.bankReconciliation.findMany({
      where: {
        tenantId: req.tenantId,
        accountId,
        endDate: { gte: start, lte: end }
      },
      orderBy: { endDate: 'desc' }
    });

    // Let's calculate the current stats for report
    const ledgerLines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: end }
        }
      }
    });

    let erpBalance = 0;
    for (const l of ledgerLines) {
      erpBalance += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
    }

    // Unmatched/Outstanding Ledger items
    const unmatchedLedgers = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          tenantId: req.tenantId,
          isPosted: true,
          date: { lte: end }
        },
        bankReconciliationMatches: {
          none: {}
        }
      },
      include: { journalEntry: true }
    });

    const outstandingDepositsList = [];
    const unpresentedChequesList = [];
    let outstandingDeposits = 0;
    let unpresentedCheques = 0;

    for (const l of unmatchedLedgers) {
      const dbVal = parseFloat(l.debit || 0);
      const crVal = parseFloat(l.credit || 0);
      const row = {
        id: l.id,
        date: l.journalEntry.date,
        entryNumber: l.journalEntry.entryNumber,
        description: l.description || l.journalEntry.description,
        amount: dbVal > 0 ? dbVal : crVal
      };

      if (dbVal > 0) {
        outstandingDeposits += dbVal;
        outstandingDepositsList.push(row);
      } else {
        unpresentedCheques += crVal;
        unpresentedChequesList.push(row);
      }
    }

    // Unmatched Statement items
    const unmatchedStatementsList = await prisma.bankStatementLine.findMany({
      where: {
        tenantId: req.tenantId,
        accountId,
        isMatched: false,
        date: { lte: end }
      }
    });

    res.json({
      erpBalance,
      outstandingDeposits,
      outstandingDepositsList,
      unpresentedCheques,
      unpresentedChequesList,
      unmatchedStatementsList,
      reconciliations
    });
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reconciliation reports' });
  }
};

module.exports = {
  getReconciliations,
  startReconciliation,
  importStatement,
  getWorkspaceData,
  autoMatchEngine,
  manualMatch,
  unmatch,
  createAdjustment,
  finalizeReconciliation,
  getReconciliationReports
};
