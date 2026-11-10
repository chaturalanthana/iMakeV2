import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { TrendingUp, Calendar, Printer, DollarSign, TrendingDown } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ProfitAndLoss() {
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
    fetchPnLData();
  }, []);

  const fetchPnLData = async () => {
    setLoading(true);
    try {
      const [accountsRes, linesRes] = await Promise.all([
        axios.get('/api/finance/accounts', authConfig()),
        axios.get('/api/finance/ledger', authConfig())
      ]);
      setAccounts(accountsRes.data);
      setLines(linesRes.data);
    } catch (error) {
      console.error('Failed to load P&L data:', error);
      showToast('Error loading Profit & Loss data', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Filter lines by selected date range
  const filteredLines = lines.filter(line => {
    const dateStr = line.journalEntry.date.split('T')[0];
    return dateStr >= fromDate && dateStr <= toDate;
  });

  // Sum transaction values per account
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
    return c - d;
  };

  // Group accounts
  const revenueAccounts = [];
  const cogsAccounts = [];
  const operatingExpenseAccounts = [];

  accounts.forEach(acc => {
    if (acc.type === 'REVENUE') {
      revenueAccounts.push({ ...acc, val: getAccountValue(acc) });
    } else if (acc.type === 'EXPENSE') {
      const isCogs = acc.code.startsWith('5') || acc.name.toLowerCase().includes('cost of goods sold') || acc.name.toLowerCase().includes('cogs');
      if (isCogs) {
        cogsAccounts.push({ ...acc, val: getAccountValue(acc) });
      } else {
        operatingExpenseAccounts.push({ ...acc, val: getAccountValue(acc) });
      }
    }
  });

  // Calculate aggregates
  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.val, 0);
  const totalCogs = cogsAccounts.reduce((sum, a) => sum + a.val, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = operatingExpenseAccounts.reduce((sum, a) => sum + a.val, 0);
  const netProfit = grossProfit - totalExpenses;

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
        color: isFinal ? (val >= 0 ? '#16a34a' : '#dc2626') : 'var(--text-main)',
        
      }}>
        {formatCurrency(val)}
      </td>
    </tr>
  );

  return (
    <AppLayout title="Profit & Loss Statement" icon={TrendingUp}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filter Bar & Quick Stats */}
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
              <Printer size={16} /> Print Report
            </button>
          </div>

          {/* Quick Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Revenue</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(totalRevenue)}</span>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justify: 'center', color: '#2563eb' }}>
                <DollarSign size={20} />
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Operating Expenses</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(totalExpenses + totalCogs)}</span>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fdf2f8', display: 'flex', alignItems: 'center', justify: 'center', color: '#db2777' }}>
                <TrendingDown size={20} />
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Profit</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: netProfit >= 0 ? '#16a34a' : '#dc2626',  }}>{formatCurrency(netProfit)}</span>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justify: 'center', color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          {/* Statement Report Sheet */}
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
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', width: '70%' }}>Account Name</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right', width: '30%' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                
                {/* REVENUE SECTION */}
                {renderSectionHeader('1. Revenue / Income')}
                {revenueAccounts.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No revenue entries found in date range.</td></tr>
                ) : (
                  revenueAccounts.map(renderAccountRow)
                )}
                {renderTotalRow('Total Revenue / Income', totalRevenue)}

                {/* COGS SECTION */}
                {renderSectionHeader('2. Cost of Sales / COGS')}
                {cogsAccounts.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No cost of goods sold entries found in date range.</td></tr>
                ) : (
                  cogsAccounts.map(renderAccountRow)
                )}
                {renderTotalRow('Total Cost of Sales / COGS', totalCogs)}

                {/* GROSS PROFIT */}
                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 800 }}>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                    Gross Profit (Revenue - COGS)
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '1rem', color: 'var(--text-main)',  }}>
                    {formatCurrency(grossProfit)}
                  </td>
                </tr>

                {/* OPERATING EXPENSES SECTION */}
                {renderSectionHeader('3. Operating Expenses')}
                {operatingExpenseAccounts.length === 0 ? (
                  <tr><td colSpan="2" style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No operating expense entries found in date range.</td></tr>
                ) : (
                  operatingExpenseAccounts.map(renderAccountRow)
                )}
                {renderTotalRow('Total Operating Expenses', totalExpenses)}

                {/* NET PROFIT */}
                {renderTotalRow('Net Profit / Net Income (Gross Profit - Expenses)', netProfit, true)}

              </tbody>
            </table>
          </div>

        </div>
      )}
    </AppLayout>
  );
}

