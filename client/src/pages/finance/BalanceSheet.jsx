import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Landmark, Calendar, Printer, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function BalanceSheet() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Balance sheet date: default is today
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchBalanceSheetData();
  }, []);

  const fetchBalanceSheetData = async () => {
    setLoading(true);
    try {
      const [accountsRes, linesRes] = await Promise.all([
        axios.get('/api/finance/accounts', authConfig()),
        axios.get('/api/finance/ledger', authConfig())
      ]);
      setAccounts(accountsRes.data);
      setLines(linesRes.data);
    } catch (error) {
      console.error('Failed to load balance sheet data:', error);
      showToast('Error loading Balance Sheet data', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Filter lines by selected "As of Date"
  const filteredLines = lines.filter(line => {
    const dateStr = line.journalEntry.date.split('T')[0];
    return dateStr <= asOfDate;
  });

  // Calculate totals per account
  const accountTotals = {};
  filteredLines.forEach(line => {
    if (!accountTotals[line.accountId]) {
      accountTotals[line.accountId] = { debit: 0, credit: 0 };
    }
    accountTotals[line.accountId].debit += parseFloat(line.debit || 0);
    accountTotals[line.accountId].credit += parseFloat(line.credit || 0);
  });

  const getAccountValue = (acc) => {
    const totals = accountTotals[acc.id] || { debit: 0, credit: 0 };
    const d = totals.debit;
    const c = totals.credit;
    if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
      return d - c;
    }
    return c - d; // liability, equity, revenue
  };

  // Group accounts
  const assetAccounts = [];
  const liabilityAccounts = [];
  const equityAccounts = [];
  
  let netIncome = 0; // Net Income flows into Equity

  accounts.forEach(acc => {
    const val = getAccountValue(acc);
    if (acc.type === 'ASSET') {
      assetAccounts.push({ ...acc, val });
    } else if (acc.type === 'LIABILITY') {
      liabilityAccounts.push({ ...acc, val });
    } else if (acc.type === 'EQUITY') {
      equityAccounts.push({ ...acc, val });
    } else if (acc.type === 'REVENUE') {
      netIncome += val; // revenue value is credit - debit
    } else if (acc.type === 'EXPENSE') {
      netIncome -= val; // expense value is debit - credit, which reduces net income
    }
  });

  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.val, 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.val, 0);
  const totalEquity = equityAccounts.reduce((sum, a) => sum + a.val, 0) + netIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

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
        Balance
      </td>
    </tr>
  );

  const renderAccountRow = (acc) => (
    <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
        {acc.code} - {acc.name}
      </td>
      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-main)',  }}>
        {formatCurrency(acc.val)}
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
        color: 'var(--text-main)',
        
      }}>
        {formatCurrency(val)}
      </td>
    </tr>
  );

  return (
    <AppLayout title="Balance Sheet" icon={Landmark}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Controls toolbar */}
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
                <Calendar size={16} /> As of Date:
              </div>
              <input 
                type="date" 
                value={asOfDate} 
                onChange={e => setAsOfDate(e.target.value)} 
                style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {isBalanced ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#16a34a' }}>
                  <ShieldCheck size={14} /> Balanced
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: '#fee2e2', color: '#dc2626' }}>
                  <AlertTriangle size={14} /> Out of Balance
                </div>
              )}
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
                <Printer size={16} /> Print Sheet
              </button>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Assets</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(totalAssets)}</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Liabilities</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(totalLiabilities)}</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Equity</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(totalEquity)}</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Statement */}
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
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: '70%' }}>Classification / Account</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right', width: '30%' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                
                {/* ASSETS SECTION */}
                {renderSectionHeader('1. Assets')}
                {assetAccounts.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No asset accounts found.</td></tr>
                ) : (
                  assetAccounts.map(renderAccountRow)
                )}
                {renderTotalRow('Total Assets', totalAssets)}

                {/* LIABILITIES SECTION */}
                {renderSectionHeader('2. Liabilities')}
                {liabilityAccounts.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No liability accounts found.</td></tr>
                ) : (
                  liabilityAccounts.map(renderAccountRow)
                )}
                {renderTotalRow('Total Liabilities', totalLiabilities)}

                {/* EQUITY SECTION */}
                {renderSectionHeader('3. Shareholders\' Equity')}
                {equityAccounts.map(renderAccountRow)}
                {/* Net Income line item */}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                    Net Income (Current Period)
                  </td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-main)',  }}>
                    {formatCurrency(netIncome)}
                  </td>
                </tr>
                {renderTotalRow('Total Shareholders\' Equity', totalEquity)}

                {/* LIABILITIES & EQUITY */}
                {renderTotalRow('Total Liabilities & Shareholders\' Equity', totalLiabilitiesAndEquity, true)}

              </tbody>
            </table>
          </div>

        </div>
      )}
    </AppLayout>
  );
}

