import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { FileText, Calendar, Printer, DollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function VATReport() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // States for report data
  const [outputTaxBreakdown, setOutputTaxBreakdown] = useState([]);
  const [inputTaxBreakdown, setInputTaxBreakdown] = useState([]);
  const [summary, setSummary] = useState({ outputVat: 0, inputVat: 0, netPayable: 0 });
  const [transactionLog, setTransactionLog] = useState([]);

  // Date Filters
  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchVATData();
  }, [fromDate, toDate]);

  const fetchVATData = async () => {
    setLoading(true);
    try {
      const [accountsRes, ledgerRes, salesTaxesRes, purchaseTaxesRes] = await Promise.all([
        axios.get('/api/finance/accounts', authConfig()),
        axios.get('/api/finance/ledger', authConfig()),
        axios.get('/api/finance/tax-groups', authConfig()),
        axios.get('/api/procurement/tax-groups', authConfig())
      ]);

      const accounts = accountsRes.data;
      const ledgerLines = ledgerRes.data;
      const salesTaxGroups = salesTaxesRes.data;
      const purchaseTaxGroups = purchaseTaxesRes.data;

      // 1. Identify Output Tax Account IDs
      const outputTaxAccIds = new Set();
      const outputRateMap = {}; // accountId -> rate
      salesTaxGroups.forEach(g => {
        if (g.slabs) {
          g.slabs.forEach(s => {
            if (s.accountId) {
              outputTaxAccIds.add(s.accountId);
              outputRateMap[s.accountId] = parseFloat(s.rate || 0);
            }
          });
        }
      });

      // 2. Identify Input Tax Account IDs
      const inputTaxAccIds = new Set();
      const inputRateMap = {}; // accountId -> rate
      purchaseTaxGroups.forEach(g => {
        if (g.slabs) {
          g.slabs.forEach(s => {
            if (s.accountId) {
              inputTaxAccIds.add(s.accountId);
              inputRateMap[s.accountId] = parseFloat(s.rate || 0);
            }
          });
        }
      });

      // Fallback name-based classification for unmatched tax accounts
      accounts.forEach(acc => {
        const nameLower = acc.name.toLowerCase();
        if (nameLower.includes('vat') || nameLower.includes('sales tax') || nameLower.includes('purchase tax') || nameLower.includes('tax payable') || nameLower.includes('tax receivable')) {
          if (nameLower.includes('output') || nameLower.includes('sales') || nameLower.includes('payable')) {
            if (!outputTaxAccIds.has(acc.id) && !inputTaxAccIds.has(acc.id)) {
              outputTaxAccIds.add(acc.id);
            }
          } else if (nameLower.includes('input') || nameLower.includes('purchase') || nameLower.includes('receivable') || nameLower.includes('grn')) {
            if (!inputTaxAccIds.has(acc.id) && !outputTaxAccIds.has(acc.id)) {
              inputTaxAccIds.add(acc.id);
            }
          }
        }
      });

      // 3. Filter lines in range
      const rangeLines = ledgerLines.filter(line => {
        const dateStr = line.journalEntry.date.split('T')[0];
        return dateStr >= fromDate && dateStr <= toDate;
      });

      // Calculate totals per account
      const outputTotals = {};
      const inputTotals = {};
      const log = [];

      rangeLines.forEach(line => {
        const debit = parseFloat(line.debit || 0);
        const credit = parseFloat(line.credit || 0);
        const date = new Date(line.journalEntry.date).toLocaleDateString();
        const docNo = line.journalEntry.entryNumber;
        const refType = line.journalEntry.referenceType || 'Journal';

        if (outputTaxAccIds.has(line.accountId)) {
          // Output tax is credit-normal liability
          if (!outputTotals[line.accountId]) {
            const acc = accounts.find(a => a.id === line.accountId);
            outputTotals[line.accountId] = {
              accountId: line.accountId,
              accountName: acc ? `${acc.code} - ${acc.name}` : 'Output Tax Account',
              rate: outputRateMap[line.accountId] || 0,
              debit: 0,
              credit: 0,
              net: 0
            };
          }
          outputTotals[line.accountId].debit += debit;
          outputTotals[line.accountId].credit += credit;
          outputTotals[line.accountId].net += (credit - debit);

          log.push({
            id: line.id,
            date,
            docNo,
            refType,
            type: 'Output VAT',
            accountName: outputTotals[line.accountId].accountName,
            rate: outputTotals[line.accountId].rate,
            amount: credit - debit
          });

        } else if (inputTaxAccIds.has(line.accountId)) {
          // Input tax is debit-normal asset
          if (!inputTotals[line.accountId]) {
            const acc = accounts.find(a => a.id === line.accountId);
            inputTotals[line.accountId] = {
              accountId: line.accountId,
              accountName: acc ? `${acc.code} - ${acc.name}` : 'Input Tax Account',
              rate: inputRateMap[line.accountId] || 0,
              debit: 0,
              credit: 0,
              net: 0
            };
          }
          inputTotals[line.accountId].debit += debit;
          inputTotals[line.accountId].credit += credit;
          inputTotals[line.accountId].net += (debit - credit);

          log.push({
            id: line.id,
            date,
            docNo,
            refType,
            type: 'Input VAT',
            accountName: inputTotals[line.accountId].accountName,
            rate: inputTotals[line.accountId].rate,
            amount: debit - credit
          });
        }
      });

      // Formulate breakdowns
      const outputList = Object.values(outputTotals);
      const inputList = Object.values(inputTotals);

      const totalOutput = outputList.reduce((sum, item) => sum + item.net, 0);
      const totalInput = inputList.reduce((sum, item) => sum + item.net, 0);
      const payable = totalOutput - totalInput;

      setOutputTaxBreakdown(outputList);
      setInputTaxBreakdown(inputList);
      setSummary({ outputVat: totalOutput, inputVat: totalInput, netPayable: payable });
      
      // Sort log by date descending
      log.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactionLog(log);

    } catch (error) {
      console.error('Failed to fetch VAT Report data:', error);
      showToast('Error loading VAT Report data', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num < 0) {
      return `($${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const logColumns = [
    {
      header: 'Date',
      accessor: 'date',
      width: '12%',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.date}</span>
    },
    {
      header: 'Doc #',
      accessor: 'docNo',
      width: '15%',
      render: (row) => <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{row.docNo}</span>
    },
    {
      header: 'VAT Type',
      accessor: 'type',
      width: '15%',
      render: (row) => (
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: row.type === 'Output VAT' ? '#3b82f6' : '#10b981' }}>
          {row.type}
        </span>
      )
    },
    {
      header: 'Tax Account',
      accessor: 'accountName',
      width: '28%',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.accountName}</span>
    },
    {
      header: 'Rate',
      accessor: 'rate',
      width: '10%',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.rate}%</span>
    },
    {
      header: 'Net Impact',
      accessor: 'amount',
      width: '20%',
      align: 'right',
      render: (row) => (
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
          {formatCurrency(row.amount)}
        </span>
      )
    }
  ];

  return (
    <AppLayout title="VAT Report" icon={FileText}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Date Range Selector */}
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
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <Printer size={16} /> Print VAT Report
            </button>
          </div>

          {/* Core Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Output VAT (Sales)</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(summary.outputVat)}</span>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justify: 'center', color: '#2563eb' }}>
                <ArrowUpRight size={20} />
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Input VAT (Purchases)</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b',  }}>{formatCurrency(summary.inputVat)}</span>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justify: 'center', color: '#16a34a' }}>
                <ArrowDownLeft size={20} />
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net VAT Payable</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: summary.netPayable >= 0 ? '#1e293b' : '#dc2626',  }}>{formatCurrency(summary.netPayable)}</span>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justify: 'center', color: '#7c3aed' }}>
                <DollarSign size={20} />
              </div>
            </div>
          </div>

          {/* Breakdown Sheets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Output VAT Breakdown */}
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Output VAT (Sales Ledger Accounts)</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#fcfcfc' }}>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Account</th>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total Debits</th>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total Credits</th>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Net Output VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {outputTaxBreakdown.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No sales tax entries found.</td></tr>
                  ) : (
                    outputTaxBreakdown.map(item => (
                      <tr key={item.accountId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{item.accountName}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'right',  }}>{formatCurrency(item.debit)}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'right',  }}>{formatCurrency(item.credit)}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'right', fontWeight: 700,  }}>{formatCurrency(item.net)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Input VAT Breakdown */}
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Input VAT (Purchase Ledger Accounts)</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#fcfcfc' }}>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Account</th>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total Debits</th>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total Credits</th>
                    <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Net Input VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {inputTaxBreakdown.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No purchase tax entries found.</td></tr>
                  ) : (
                    inputTaxBreakdown.map(item => (
                      <tr key={item.accountId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{item.accountName}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'right',  }}>{formatCurrency(item.debit)}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'right',  }}>{formatCurrency(item.credit)}</td>
                        <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'right', fontWeight: 700,  }}>{formatCurrency(item.net)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* Transaction Log */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>VAT Posting Transaction Log</h3>
            <DataTable
              columns={logColumns}
              data={transactionLog}
              loading={loading}
              searchPlaceholder="Search postings by doc # or account..."
              searchKeys={['docNo', 'accountName', 'type']}
              itemsPerPage={25}
              noDataMessage="No tax entries found in selected date range."
            />
          </div>

        </div>
      )}
    </AppLayout>
  );
}

