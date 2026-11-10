import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function StockTransfers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/warehouse/transfers', { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransfers(res.data);
    } catch (error) {
      console.error('Failed to fetch stock transfers:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Stock Transfer',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/warehouse/transfers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Stock Transfer deleted successfully', 'success');
      fetchTransfers();
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
      accessor: 'transferNumber',
      fontWeight: 600
    },
    {
      header: 'From Warehouse',
      accessor: 'fromWarehouse',
      fontWeight: 500,
      render: (row) => row.fromWarehouse?.name || '-'
    },
    {
      header: 'To Warehouse',
      accessor: 'toWarehouse',
      fontWeight: 500,
      render: (row) => row.toWarehouse?.name || '-'
    },
    {
      header: 'Items Qty',
      accessor: 'items',
      fontWeight: 700,
      color: 'var(--accent)',
      render: (row) => `${row.items?.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) || 0}`
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <span style={{ fontSize: '0.75rem', fontWeight: 700, color: row.status === 'COMPLETED' ? '#059669' : '#d97706' }}>{row.status}</span>
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
    <button onClick={() => navigate('/warehouse/transfers/new')}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> New Transfer
    </button>
  );

  return (
    <AppLayout title="Stock Transfers" icon={RefreshCw}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={transfers}
            loading={loading}
            searchPlaceholder="Search by document, source or target..."
            searchKeys={['transferNumber', 'fromWarehouse.name', 'toWarehouse.name', 'reason']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(`/warehouse/transfers/${row.id}`)}
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
