import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { queryRef, recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { ClipboardList, Plus, ArrowUpRight } from 'lucide-react';

export default function PurchaseRequisitions() {
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchRequisitions();
  }, []);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/procurement/purchase-requisitions', config);
      setRequisitions(res.data);
    } catch (error) {
      console.error('Failed to fetch purchase requisitions:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status.toUpperCase();
    if (s === 'PENDING' || s === 'DRAFT') {
      return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>{s}</span>;
    }
    if (s === 'CONVERTED') {
      return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>CONVERTED</span>;
    }
    if (s === 'APPROVED') {
      return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>APPROVED</span>;
    }
    if (s === 'CANCELLED') {
      return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>CANCELLED</span>;
    }
    return <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{status}</span>;
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'PR #',
      accessor: 'prNumber',
      fontWeight: 600
    },
    {
      header: 'Supplier',
      accessor: 'supplier',
      fontWeight: 500,
      render: (row) => row.supplier?.name || 'Unassigned / Multiple'
    },
    {
      header: 'Total Amount',
      accessor: 'total',
      fontWeight: 600,
      render: (row) => '$' + parseFloat(row.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
          {row.status !== 'CONVERTED' && (
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/procurement/purchase-orders/new?prId=${queryRef(row.prNumber)}`); }} 
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0.35rem 0.65rem', 
                fontSize: '0.75rem', 
                borderRadius: '6px', 
                backgroundColor: 'var(--accent-light, #f3e8ff)', 
                color: 'var(--accent, #7c3aed)', 
                border: 'none', 
                cursor: 'pointer', 
                fontWeight: 700,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <ArrowUpRight size={12} /> Convert to PO
            </button>
          )}
        </div>
      )
    }
  ];

  const extraActions = (
    <button
      onClick={() => navigate('/procurement/purchase-requisitions/new')}
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
      <Plus size={16} /> New PR
    </button>
  );

  return (
    <AppLayout title="Purchase Requisitions" icon={ClipboardList}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={requisitions}
            loading={loading}
            searchPlaceholder="Search by PR number..."
            searchKeys={['prNumber']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/procurement/purchase-requisitions', row, 'prNumber'))}
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
