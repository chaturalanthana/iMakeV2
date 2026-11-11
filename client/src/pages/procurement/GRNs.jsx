import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function GRNs() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchGrns();
  }, []);

  const fetchGrns = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/procurement/grn', config);
      setGrns(res.data);
    } catch (error) {
      console.error('Failed to fetch GRNs:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete GRN',
      message: 'Are you sure you want to delete this GRN? Stock movements should be manually adjusted. This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/procurement/grn/${id}`, config);
      showToast('Goods Receipt Note deleted successfully', 'success');
      fetchGrns();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete GRN', 'error');
    }
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'GRN #',
      accessor: 'grnNumber',
      fontWeight: 600
    },
    {
      header: 'PO Ref',
      accessor: 'purchaseOrder',
      render: (row) => row.purchaseOrder?.poNumber || '-',
      color: 'var(--text-muted)'
    },
    {
      header: 'Supplier',
      accessor: 'supplier',
      fontWeight: 500,
      render: (row) => row.supplier?.name
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>{row.status}</span>
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/procurement/supplier-invoices/new?grnId=${row.id}`); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#eef2ff', color: '#4338ca', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Supplier Invoice
            </button>
          {!row.poId && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/finance/vouchers/new`); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#fdf4ff', color: '#c026d3', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Issue Payment
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='var(--error)'} onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const extraActions = (
    <button onClick={() => navigate('/procurement/grn/new')}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> New GRN
    </button>
  );

  return (
    <AppLayout title="Goods Receipt Notes" icon={Package}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={grns}
            loading={loading}
            searchPlaceholder="Search by GRN number or supplier..."
            searchKeys={['grnNumber', 'supplier.name']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(`/procurement/grn/${row.id}`)}
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
