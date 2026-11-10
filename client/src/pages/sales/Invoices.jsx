import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import OrderPrintModal from '../../components/ui/OrderPrintModal';
import DataTable from '../../components/ui/DataTable';
import { Receipt, Plus, Printer, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Invoices() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [printModalData, setPrintModalData] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/sales/invoices', config);
      setInvoices(res.data);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Invoice',
      message: 'Are you sure you want to delete this invoice? Appending credit notes is strictly recommended over deletion. This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/sales/invoices/${id}`, config);
      showToast('Invoice deleted successfully', 'success');
      fetchInvoices();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete invoice', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const s = status.toUpperCase();
    if (s === 'PENDING' || s === 'DRAFT') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>{s}</span>;
    if (s === 'UNPAID') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>UNPAID</span>;
    if (s === 'PARTIAL') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>PARTIAL</span>;
    if (s === 'PAID') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>PAID</span>;
    return <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{status}</span>;
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'Invoice #',
      accessor: 'invoiceNumber',
      fontWeight: 600
    },
    {
      header: 'Customer',
      accessor: 'customer',
      fontWeight: 500,
      render: (row) => row.customer?.name || '-'
    },
    {
      header: 'Total Amount',
      accessor: 'total',
      fontWeight: 600,
      render: (row) => '$' + parseFloat(row.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      header: 'Amount Paid',
      accessor: 'amountPaid',
      fontWeight: 600,
      color: 'var(--success)',
      render: (row) => '$' + parseFloat(row.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          {row.status !== 'PAID' && row.status !== 'PENDING' && (
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/finance/payment-receipts/new?invoiceId=${row.id}`); }} 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#059669', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Collect
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setPrintModalData({ ...row, orderNumber: row.invoiceNumber, isInvoice: true }); }} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Print Invoice"
          >
            <Printer size={16} />
          </button>
          {row.status === 'PENDING' && (
            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}><Trash2 size={16} /></button>
          )}
        </div>
      )
    }
  ];

  const extraActions = (
    <button
      onClick={() => navigate('/sales/invoices/new')}
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
      <Plus size={16} /> New Invoice
    </button>
  );

  return (
    <AppLayout title="Sales Invoices" icon={Receipt}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <div style={{
            borderRadius: '12px',
            padding: '0.65rem 0',
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Receipt size={22} color="var(--accent)" />
              <h2 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
                Sales Invoices
              </h2>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={invoices}
            loading={loading}
            searchPlaceholder="Search by invoice number or customer..."
            searchKeys={['invoiceNumber', 'customer.name']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(`/sales/invoices/${row.id}`)}
          />

          <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
            onConfirm={confirmConfig.onConfirm}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText="Delete"
          />

          <OrderPrintModal
            isOpen={!!printModalData}
            onClose={() => setPrintModalData(null)}
            order={printModalData}
          />
        </>
      )}
    </AppLayout>
  );
}
