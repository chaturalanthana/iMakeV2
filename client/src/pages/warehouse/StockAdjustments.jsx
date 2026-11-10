import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import ConfirmModal from '../../components/ui/ConfirmModal';
import DataTable from '../../components/ui/DataTable';
import { Plus, Trash2, ArrowUpRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function StockAdjustments() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/warehouse/adjustments', { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdjustments(res.data);
    } catch (error) {
      console.error('Failed to fetch adjustments:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Stock Adjustment',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/warehouse/adjustments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Stock adjustment deleted successfully', 'success');
      fetchAdjustments();
      setConfirmConfig({ ...confirmConfig, isOpen: false });
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
      accessor: 'adjNumber',
      fontWeight: 600
    },
    {
      header: 'Reason',
      accessor: 'reason',
      color: 'var(--text-muted)',
      render: (row) => row.reason || '-'
    },
    {
      header: 'Diff Impact',
      accessor: 'items',
      fontWeight: 700,
      render: (row) => {
        const totalDiffQty = row.items?.reduce((sum, item) => sum + parseFloat(item.diffQty || 0), 0) || 0;
        const isPositive = totalDiffQty >= 0;
        return (
          <span style={{ color: isPositive ? '#059669' : '#b91c1c' }}>
            {isPositive ? '+' : ''}{totalDiffQty}
          </span>
        );
      }
    },
    {
      header: 'Value Impact',
      accessor: 'total',
      fontWeight: 600,
      render: (row) => '$' + parseFloat(row.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
    <button onClick={() => navigate('/warehouse/adjustments/new')}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> New Adjustment
    </button>
  );

  return (
    <AppLayout title="Stock Adjustments" icon={ArrowUpRight}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={adjustments}
            loading={loading}
            searchPlaceholder="Search by ADJ Code or reason..."
            searchKeys={['adjNumber', 'reason']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(`/warehouse/adjustments/${row.id}`)}
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
