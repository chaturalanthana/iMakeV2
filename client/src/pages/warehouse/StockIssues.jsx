import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function StockIssues() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/warehouse/issues', { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssues(res.data);
    } catch (error) {
      console.error('Failed to fetch stock issues:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Stock Issue',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/warehouse/issues/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Stock Issue deleted successfully', 'success');
      fetchIssues();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete record', 'error');
    }
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'createdAt',
      render: (row) => new Date(row.createdAt).toLocaleDateString()
    },
    {
      header: 'Document',
      accessor: 'giNumber',
      fontWeight: 600
    },
    {
      header: 'Supplier / Reason',
      accessor: 'reason',
      color: 'var(--text-muted)',
      render: (row) => row.supplier?.name || row.reason || '-'
    },
    {
      header: 'Items Qty',
      accessor: 'items',
      fontWeight: 700,
      color: '#b91c1c',
      render: (row) => `-${row.items?.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) || 0}`
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
      render: (row) => <span style={{ fontSize: '0.75rem', fontWeight: 700, color: row.status === 'COMPLETED' || row.status === 'ISSUED' ? '#059669' : '#d97706' }}>{row.status}</span>
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
    <button onClick={() => navigate('/warehouse/issues/new')}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> New Issue
    </button>
  );

  return (
    <AppLayout title="Stock Issues" icon={ArrowUpRight}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={issues}
            loading={loading}
            searchPlaceholder="Search by document or reason..."
            searchKeys={['giNumber', 'reason', 'supplier.name']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/warehouse/issues', row, 'giNumber'))}
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
