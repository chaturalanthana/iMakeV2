import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import QuotationPrintModal from '../../components/ui/QuotationPrintModal';
import DataTable from '../../components/ui/DataTable';
import { FileText, Plus, Printer } from 'lucide-react';

export default function Quotations() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [printModalData, setPrintModalData] = useState(null);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/sales/quotations', config);
      setQuotations(res.data);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status.toUpperCase();
    if (s === 'DRAFT') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>DRAFT</span>;
    if (s === 'SENT') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>SENT</span>;
    if (s === 'ACCEPTED') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>ACCEPTED</span>;
    if (s === 'REJECTED') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>REJECTED</span>;
    if (s === 'CONVERTED') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>CONVERTED</span>;
    return <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{status}</span>;
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'Number',
      accessor: 'quotationNumber',
      fontWeight: 600
    },
    {
      header: 'Customer',
      accessor: 'customer',
      fontWeight: 500,
      render: (row) => row.customer?.name || '-'
    },
    {
      header: 'Total ($)',
      accessor: 'total',
      fontWeight: 600,
      render: (row) => parseFloat(row.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => getStatusBadge(row.status)
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button 
          onClick={(e) => { e.stopPropagation(); setPrintModalData(row); }} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Print Quotation"
        >
          <Printer size={16} />
        </button>
      )
    }
  ];

  const extraActions = (
    <button
      onClick={() => navigate('/sales/quotations/new')}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '0.55rem 1.25rem',
        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> New Quotation
    </button>
  );

  return (
    <AppLayout title="Sales Quotations" icon={FileText}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={quotations}
            loading={loading}
            searchPlaceholder="Search by quote number or customer..."
            searchKeys={['quotationNumber', 'customer.name']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/sales/quotations', row, 'quotationNumber'))}
          />

          <ConfirmModal
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.onConfirm}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
          />

          <QuotationPrintModal
            isOpen={!!printModalData}
            onClose={() => setPrintModalData(null)}
            quotation={printModalData}
          />
        </>
      )}
    </AppLayout>
  );
}
