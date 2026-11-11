import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { ArrowDownLeft, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function StockReceipts() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/warehouse/receipts', { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceipts(res.data);
    } catch (error) {
      console.error('Failed to fetch stock receipts:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Stock Receipt',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/warehouse/receipts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Stock Receipt deleted successfully', 'success');
      fetchReceipts();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete record', 'error');
    }
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'Document',
      accessor: 'receiptNumber',
      fontWeight: 600
    },
    {
      header: 'Warehouse',
      accessor: 'warehouse',
      fontWeight: 500,
      render: (row) => row.warehouse?.name || '-'
    },
    {
      header: 'Items Qty',
      accessor: 'items',
      fontWeight: 700,
      color: '#059669',
      render: (row) => `+${row.items?.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) || 0}`
    },
    {
      header: 'Total Amount',
      accessor: 'total',
      fontWeight: 600,
      render: (row) => '$' + parseFloat(row.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <span style={{ fontSize: '0.75rem', fontWeight: 700, color: row.status === 'COMPLETED' || row.status === 'RECEIVED' ? '#059669' : '#d97706' }}>{row.status}</span>
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}>
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  const extraActions = (
    <button onClick={() => navigate('/warehouse/receipts/new')}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> New Receipt
    </button>
  );

  return (
    <AppLayout title="Stock Receipts" icon={ArrowDownLeft}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={receipts}
            loading={loading}
            searchPlaceholder="Search by document or warehouse..."
            searchKeys={['receiptNumber', 'warehouse.name', 'reason']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/warehouse/receipts', row, 'receiptNumber'))}
          />

          <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
            onConfirm={confirmConfig.onConfirm}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText="Delete"
          />
        </>
      )}
    </AppLayout>
  );
}
