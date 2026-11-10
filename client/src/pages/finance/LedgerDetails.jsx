import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Landmark, ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function LedgerDetails() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [account, setAccount] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchDetails();
  }, [accountId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [accountsRes, linesRes] = await Promise.all([
        axios.get('/api/finance/accounts', authConfig()),
        axios.get(`/api/finance/ledger?accountId=${accountId}`, authConfig())
      ]);

      const acc = accountsRes.data.find(a => a.id === accountId);
      if (acc) {
        setAccount(acc);
      } else {
        showToast('Account not found', 'error');
        navigate('/finance/ledger');
        return;
      }

      // Sort lines by date
      const sorted = linesRes.data.sort((a, b) => new Date(a.journalEntry.date) - new Date(b.journalEntry.date));
      
      // Compute running balance
      const getNormalBalance = (debit, credit, type) => {
        const d = parseFloat(debit || 0);
        const c = parseFloat(credit || 0);
        if (type === 'ASSET' || type === 'EXPENSE') {
          return d - c;
        }
        return c - d;
      };

      let running = 0;
      const linesWithBalance = sorted.map(line => {
        const amount = getNormalBalance(line.debit, line.credit, acc.type);
        running += amount;
        return {
          ...line,
          dateFormatted: new Date(line.journalEntry.date).toLocaleDateString(),
          refType: line.journalEntry.referenceType || 'Journal',
          docNo: line.journalEntry.entryNumber,
          description: line.description || line.journalEntry.description || '',
          debitVal: parseFloat(line.debit) > 0 ? parseFloat(line.debit) : 0,
          creditVal: parseFloat(line.credit) > 0 ? parseFloat(line.credit) : 0,
          runningBalance: running
        };
      });

      setLines(linesWithBalance);
    } catch (error) {
      console.error('Failed to load ledger details:', error);
      showToast('Error loading ledger details', 'error');
    } finally {
      setLoading(false);
    }
  };

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
      accessor: 'dateFormatted',
      width: '12%',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.dateFormatted}</span>
    },
    {
      header: 'Type',
      accessor: 'refType',
      width: '12%',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.refType}</span>
    },
    {
      header: 'Doc Number',
      accessor: 'docNo',
      width: '15%',
      render: (row) => <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{row.docNo}</span>
    },
    {
      header: 'Description',
      accessor: 'description',
      width: '31%',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.description}</span>
    },
    {
      header: 'Debit',
      accessor: 'debitVal',
      width: '10%',
      align: 'right',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.debitVal > 0 ? formatCurrency(row.debitVal) : ''}</span>
    },
    {
      header: 'Credit',
      accessor: 'creditVal',
      width: '10%',
      align: 'right',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.creditVal > 0 ? formatCurrency(row.creditVal) : ''}</span>
    },
    {
      header: 'Balance',
      accessor: 'runningBalance',
      width: '10%',
      align: 'right',
      render: (row) => <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(row.runningBalance)}</span>
    }
  ];

  const extraActions = (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button 
        onClick={() => window.print()}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
      >
        <Printer size={14} /> Print Detail
      </button>
    </div>
  );

  return (
    <AppLayout title={account ? `${account.code} - ${account.name}` : 'Ledger Details'} icon={Landmark}>
      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <button 
              onClick={() => navigate('/finance/ledger')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={14} /> Back to General Ledger
            </button>
          </div>

          <DataTable
            columns={columns}
            data={lines}
            loading={loading}
            searchPlaceholder="Search transactions..."
            searchKeys={['docNo', 'description', 'refType']}
            itemsPerPage={25}
            extraActions={extraActions}
            noDataMessage="No transaction lines found for this account."
          />
        </>
      )}
    </AppLayout>
  );
}

