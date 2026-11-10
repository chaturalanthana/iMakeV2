import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Landmark, Calendar, Printer, DollarSign, ArrowUpRight, ArrowDownLeft, TrendingUp } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CashFlow() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Default date filter: start of current year to today
  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchCashFlowData();
  }, []);

  const fetchCashFlowData = async () => {
    setLoading(true);
    try {
      const [accountsRes, linesRes] = await Promise.all([
        axios.get('/api/finance/accounts', authConfig()),
        axios.get('/api/finance/ledger', authConfig())
      ]);
      setAccounts(accountsRes.data);
      setLines(linesRes.data);
    } catch (error) {
      console.error('Failed to load cash flow data:', error);
      showToast('Error loading Cash Flow data', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // 1. Identify Cash & Bank accounts
  const isCashAccount = (acc) => {
    if (!acc) return false;
    const nameLower = acc.name.toLowerCase();
    return acc.type === 'ASSET' && (
      acc.code.startsWith('10') || 
      nameLower.includes('cash') || 
      nameLower.includes('checking') || 
      nameLower.includes('bank') || 
      nameLower.includes('payroll')
    );
  };

  const cashAccountIds = new Set(accounts.filter(isCashAccount).map(a => a.id));

  // 2. Compute Cash at Beginning of Period (all cash lines before fromDate)
  let beginningCash = 0;
  lines.forEach(line => {
    if (cashAccountIds.has(line.accountId)) {
      const dateStr = line.journalEntry.date.split('T')[0];
      if (dateStr < fromDate) {
        beginningCash += (parseFloat(line.debit || 0) - parseFloat(line.credit || 0));
      }
    }
  });

  // 3. Classify and sum cash flows in the selected date range
  const rangeLines = lines.filter(line => {
    const dateStr = line.journalEntry.date.split('T')[0];
    return dateStr >= fromDate && dateStr <= toDate;
  });

  // Group lines by journal entry to find opposing accounts
  const linesByEntry = {};
  rangeLines.forEach(line => {
    if (!linesByEntry[line.journalEntryId]) {
      linesByEntry[line.journalEntryId] = [];
    }
    linesByEntry[line.journalEntryId].push(line);
  });

  let operatingFlows = [];
  let investingFlows = [];
  let financingFlows = [];

  // Iterate over journal entries that affect cash
  Object.keys(linesByEntry).forEach(entryId => {
    const entryLines = linesByEntry[entryId];
    const cashLinesInEntry = entryLines.filter(l => cashAccountIds.has(l.accountId));
    
    if (cashLinesInEntry.length === 0) return; // No cash affected in this transaction

    const nonCashLinesInEntry = entryLines.filter(l => !cashAccountIds.has(l.accountId));

    // Determine classification based on non-cash accounts in the entry
    let classification = 'OPERATING'; // default

    for (const nonCashLine of nonCashLinesInEntry) {
      const acc = accounts.find(a => a.id === nonCashLine.accountId);
      if (!acc) continue;

      if (acc.type === 'REVENUE' || acc.type === 'EXPENSE') {
        classification = 'OPERATING';
        break;
      } else if (acc.type === 'ASSET' && acc.code.startsWith('16')) {
        // Fixed Assets
        classification = 'INVESTING';
        break;
      } else if ((acc.type === 'LIABILITY' && acc.code.startsWith('25')) || acc.type === 'EQUITY') {
        // Loans or Equity
        classification = 'FINANCING';
        break;
      }
    }

    // Sum cash impact for this entry (debit increases asset cash, credit decreases it)
    let cashImpact = 0;
    cashLinesInEntry.forEach(l => {
      cashImpact += (parseFloat(l.debit || 0) - parseFloat(l.credit || 0));
    });

    const description = cashLinesInEntry[0].description || cashLinesInEntry[0].journalEntry.description || 'Cash Transaction';
    const entryNum = cashLinesInEntry[0].journalEntry.entryNumber;
    const date = new Date(cashLinesInEntry[0].journalEntry.date).toLocaleDateString();

    const flowItem = {
      id: entryId,
      entryNumber: entryNum,
      date,
      description,
      amount: cashImpact
    };

    if (classification === 'OPERATING') {
      operatingFlows.push(flowItem);
    } else if (classification === 'INVESTING') {
      investingFlows.push(flowItem);
    } else {
      financingFlows.push(flowItem);
    }
  });

  const totalOperating = operatingFlows.reduce((sum, f) => sum + f.amount, 0);
  const totalInvesting = investingFlows.reduce((sum, f) => sum + f.amount, 0);
  const totalFinancing = financingFlows.reduce((sum, f) => sum + f.amount, 0);
  const netIncrease = totalOperating + totalInvesting + totalFinancing;
  const endingCash = beginningCash + netIncrease;

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num < 0) {
      return `($${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderSectionHeader = (title) => (
    <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
        {title}
      </td>
      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, fontSize: '0.8rem', color: '#475569' }}>
        Amount
      </td>
    </tr>
  );

  const renderFlowRow = (flow) => (
    <tr key={flow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{flow.description}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({flow.date} - {flow.entryNumber})</span>
        </div>
      </td>
      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontSize: '0.9rem', color: flow.amount >= 0 ? '#16a34a' : '#dc2626',  }}>
        {formatCurrency(flow.amount)}
      </td>
    </tr>
  );

  const renderTotalRow = (title, val, isFinal = false) => (
    <tr style={{ 
      borderBottom: isFinal ? '4px double #94a3b8' : '1px solid #cbd5e1', 
      backgroundColor: isFinal ? '#f1f5f9' : '#fff',
      fontWeight: 700 
    }}>
      <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
        {title}
      </td>
      <td style={{ 
        padding: '0.75rem 1rem', 
        textAlign: 'right', 
        fontSize: isFinal ? '1.05rem' : '0.95rem', 
        color: val >= 0 ? '#16a34a' : '#dc2626',
        
      }}>
        {formatCurrency(val)}
      </td>
    </tr>
  );

  return (
    <AppLayout title="Statement of Cash Flows" icon={Landmark}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filter Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '1rem',
            paddingBottom: '1.25rem',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Calendar size={16} /> Date Range:
              </div>
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => setFromDate(e.target.value)} 
                style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>to</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => setToDate(e.target.value)} 
                style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}
              />
            </div>

            <button 
              onClick={() => window.print()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 1.25rem',
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> Print Statement
            </button>
          </div>

          {/* Quick Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Beginning Cash', val: beginningCash, icon: ArrowDownLeft, color: '#2563eb', bg: '#eff6ff' },
              { label: 'Operating Flows', val: totalOperating, icon: TrendingUp, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Investing & Financing', val: totalInvesting + totalFinancing, icon: ArrowUpRight, color: '#d97706', bg: '#fffbeb' },
              { label: 'Ending Cash Balance', val: endingCash, icon: DollarSign, color: '#7c3aed', bg: '#f5f3ff' }
            ].map((card, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{card.label}</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(card.val)}</span>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justify: 'center', color: card.color }}>
                  <card.icon size={20} />
                </div>
              </div>
            ))}
          </div>

          {/* Cash Flow Statement Sheet */}
          <div style={{ 
            background: '#fff', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: '70%' }}>Cash Flow Activity</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right', width: '30%' }}>Cash Impact</th>
                </tr>
              </thead>
              <tbody>
                
                {/* Cash at Beginning of Period */}
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Cash and Cash Equivalents at Beginning of Period
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.95rem', color: 'var(--text-main)',  }}>
                    {formatCurrency(beginningCash)}
                  </td>
                </tr>

                {/* OPERATING ACTIVITIES SECTION */}
                {renderSectionHeader('1. Cash Flows from Operating Activities')}
                {operatingFlows.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No operating cash receipts or payments.</td></tr>
                ) : (
                  operatingFlows.map(renderFlowRow)
                )}
                {renderTotalRow('Net Cash provided by Operating Activities', totalOperating)}

                {/* INVESTING ACTIVITIES SECTION */}
                {renderSectionHeader('2. Cash Flows from Investing Activities')}
                {investingFlows.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No investing cash flows (fixed assets purchase/sales).</td></tr>
                ) : (
                  investingFlows.map(renderFlowRow)
                )}
                {renderTotalRow('Net Cash provided by (used in) Investing Activities', totalInvesting)}

                {/* FINANCING ACTIVITIES SECTION */}
                {renderSectionHeader('3. Cash Flows from Financing Activities')}
                {financingFlows.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No financing cash flows (loans receipts/repayments, equity).</td></tr>
                ) : (
                  financingFlows.map(renderFlowRow)
                )}
                {renderTotalRow('Net Cash provided by (used in) Financing Activities', totalFinancing)}

                {/* NET INCREASE / DECREASE */}
                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 800 }}>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                    Net Increase (Decrease) in Cash and Cash Equivalents
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '1rem', color: netIncrease >= 0 ? '#16a34a' : '#dc2626',  }}>
                    {formatCurrency(netIncrease)}
                  </td>
                </tr>

                {/* Cash at End of Period */}
                {renderTotalRow('Cash and Cash Equivalents at End of Period', endingCash, true)}

              </tbody>
            </table>
          </div>

        </div>
      )}
    </AppLayout>
  );
}

