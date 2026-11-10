import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Landmark, Calendar, Printer, DollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CashBook() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Default date filter: start of current year to today
  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchCashBookData();
  }, []);

  const fetchCashBookData = async () => {
    setLoading(true);
    try {
      const [accountsRes, linesRes] = await Promise.all([
        axios.get('/api/finance/accounts', authConfig()),
        axios.get('/api/finance/ledger', authConfig())
      ]);

      const allAccs = accountsRes.data;
      setAccounts(allAccs);
      setLines(linesRes.data);

      // Filter to find Cash & Bank accounts
      const cashAccs = allAccs.filter(acc => {
        if (!acc) return false;
        const nameLower = acc.name.toLowerCase();
        return acc.type === 'ASSET' && (
          acc.code.startsWith('10') || 
          nameLower.includes('cash') || 
          nameLower.includes('checking') || 
          nameLower.includes('bank') || 
          nameLower.includes('payroll')
        );
      });
      setCashAccounts(cashAccs);

    } catch (error) {
      console.error('Failed to load Cash Book data:', error);
      showToast('Error loading Cash Book data', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // 1. Determine active Cash Account IDs
  const activeCashIds = new Set(
    selectedAccountId === 'ALL'
      ? cashAccounts.map(a => a.id)
      : [selectedAccountId]
  );

  // 2. Compute Opening Balance (debit - credit for active cash IDs before fromDate)
  let openingBalance = 0;
  lines.forEach(line => {
    if (activeCashIds.has(line.accountId)) {
      const dateStr = line.journalEntry.date.split('T')[0];
      if (dateStr < fromDate) {
        openingBalance += (parseFloat(line.debit || 0) - parseFloat(line.credit || 0));
      }
    }
  });

  // 3. Filter lines in range that affect selected cash account(s)
  const rangeLines = lines.filter(line => {
    if (!activeCashIds.has(line.accountId)) return false;
    const dateStr = line.journalEntry.date.split('T')[0];
    return dateStr >= fromDate && dateStr <= toDate;
  });

  // Sort lines by date ascending to calculate running balance
  const sortedLines = [...rangeLines].sort((a, b) => new Date(a.journalEntry.date) - new Date(b.journalEntry.date));

  // Build mapping of entry lines to easily find opposing accounts
  const linesByEntry = {};
  lines.forEach(line => {
    if (!linesByEntry[line.journalEntryId]) {
      linesByEntry[line.journalEntryId] = [];
    }
    linesByEntry[line.journalEntryId].push(line);
  });

  let running = openingBalance;
  let totalReceipts = 0;
  let totalPayments = 0;

  const processedData = sortedLines.map(line => {
    const debit = parseFloat(line.debit || 0);
    const credit = parseFloat(line.credit || 0);
    
    totalReceipts += debit;
    totalPayments += credit;
    running += (debit - credit);

    // Find opposing accounts in this transaction
    const entryLines = linesByEntry[line.journalEntryId] || [];
    const opposing = entryLines.filter(l => !activeCashIds.has(l.accountId));
    
    let opposingAccountLabel = '-';
    if (opposing.length === 1) {
      const acc = accounts.find(a => a.id === opposing[0].accountId);
      opposingAccountLabel = acc ? `${acc.code} - ${acc.name}` : 'Opposing Account';
    } else if (opposing.length > 1) {
      opposingAccountLabel = 'Multiple Accounts';
    }

    return {
      id: line.id,
      date: new Date(line.journalEntry.date).toLocaleDateString(),
      docNo: line.journalEntry.entryNumber,
      description: line.description || line.journalEntry.description || 'Cash Transaction',
      opposingAccount: opposingAccountLabel,
      debit: debit,
      credit: credit,
      balance: running
    };
  });

  const closingBalance = openingBalance + totalReceipts - totalPayments;

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num < 0) {
      return `($${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      width: '12%',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.date}</span>
    },
    {
      header: 'Voucher #',
      accessor: 'docNo',
      width: '15%',
      render: (row) => <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{row.docNo}</span>
    },
    {
      header: 'Description',
      accessor: 'description',
      width: '28%',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.description}</span>
    },
    {
      header: 'Contra Account',
      accessor: 'opposingAccount',
      width: '20%',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{row.opposingAccount}</span>
    },
    {
      header: 'Debit (Inflow)',
      accessor: 'debit',
      width: '11%',
      align: 'right',
      render: (row) => <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>{row.debit > 0 ? formatCurrency(row.debit) : ''}</span>
    },
    {
      header: 'Credit (Outflow)',
      accessor: 'credit',
      width: '11%',
      align: 'right',
      render: (row) => <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>{row.credit > 0 ? formatCurrency(row.credit) : ''}</span>
    },
    {
      header: 'Balance',
      accessor: 'balance',
      width: '13%',
      align: 'right',
      render: (row) => <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatCurrency(row.balance)}</span>
    }
  ];

  const extraActions = (
    <button 
      onClick={() => window.print()}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
    >
      <Printer size={14} /> Print Cash Book
    </button>
  );

  return (
    <AppLayout title="Cash Book" icon={Landmark}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filters Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-end', 
            flexWrap: 'wrap', 
            gap: '1rem',
            paddingBottom: '1.25rem',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cash/Bank Account</span>
                <select 
                  value={selectedAccountId} 
                  onChange={e => setSelectedAccountId(e.target.value)}
                  style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 600, outline: 'none', minWidth: '220px', backgroundColor: '#fff' }}
                >
                  <option value="ALL">All Cash & Bank Accounts</option>
                  {cashAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>From Date</span>
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={e => setFromDate(e.target.value)} 
                  style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>To Date</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={e => setToDate(e.target.value)} 
                  style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}
                />
              </div>
            </div>

            <div style={{ alignSelf: 'end' }}>
              {extraActions}
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Opening Balance</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(openingBalance)}</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Inflows (Receipts)</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a',  }}>{formatCurrency(totalReceipts)}</span>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justify: 'center', color: '#16a34a' }}>
                <ArrowDownLeft size={18} />
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Outflows (Payments)</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626',  }}>{formatCurrency(totalPayments)}</span>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justify: 'center', color: '#dc2626' }}>
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Closing Balance</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: closingBalance >= 0 ? '#1e293b' : '#dc2626',  }}>{formatCurrency(closingBalance)}</span>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justify: 'center', color: '#7c3aed' }}>
                <DollarSign size={18} />
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={processedData}
            loading={loading}
            searchPlaceholder="Search Cash Book transactions..."
            searchKeys={['docNo', 'description', 'opposingAccount']}
            itemsPerPage={25}
            noDataMessage="No cash or bank transaction lines found in selected range."
          />

        </div>
      )}
    </AppLayout>
  );
}

