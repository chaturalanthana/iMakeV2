import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ExportButton from '../../components/ui/ExportButton';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Suppliers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [query, setQuery] = useState({ page: 1, q: '', sort: 'createdAt', dir: 'desc' });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSuppliers();
  }, [query]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/suppliers', { headers: { Authorization: `Bearer ${token}` }, params: { page: query.page, pageSize: 15, q: query.q || undefined, sort: query.sort || undefined, dir: query.dir || undefined } });
      setSuppliers(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Supplier',
      message: 'Are you sure you want to delete this supplier? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/suppliers/${id}`, config);
      showToast('Supplier deleted successfully', 'success');
      fetchSuppliers();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete supplier', 'error');
    }
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'code',
      fontWeight: 500,
      render: (row) => row.code || '-'
    },
    {
      header: 'Name',
      accessor: 'name',
      fontWeight: 600
    },
    {
      header: 'Category',
      accessor: 'supplierCategory',
      color: 'var(--text-muted)',
      render: (row) => row.supplierCategory || '-'
    },
    {
      header: 'Email',
      accessor: 'email',
      color: 'var(--text-muted)',
      render: (row) => row.email || '-'
    },
    {
      header: 'Phone',
      accessor: 'phone',
      color: 'var(--text-muted)',
      render: (row) => row.phone || '-'
    },
    {
      header: 'Status',
      accessor: 'activeStatus',
      render: (row) => (
        <span style={{ 
          fontSize: '0.75rem', 
          fontWeight: 700, 
          padding: '0.2rem 0.6rem', 
          borderRadius: '4px',
          backgroundColor: row.activeStatus === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
          color: row.activeStatus === 'ACTIVE' ? '#059669' : '#dc2626'
        }}>
          {row.activeStatus || 'ACTIVE'}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            handleDeleteClick(row.id); 
          }} 
          style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  const extraActions = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
    <ExportButton url="/api/suppliers" filename="suppliers.xlsx" params={{ q: query.q, sort: query.sort, dir: query.dir }} />
    <button onClick={() => navigate('/procurement/suppliers/new')}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <Plus size={16} /> Add Supplier
    </button>
    </div>
  );

  return (
    <AppLayout title="Suppliers" icon={Truck}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={suppliers}
            loading={loading}
            searchPlaceholder="Search suppliers..."
            searchKeys={['name', 'code']}
            onServerQuery={(next) => setQuery((prev) => ({ ...prev, q: next.q ?? prev.q, page: next.page || 1, sort: next.sort || prev.sort, dir: next.dir || prev.dir }))}
            serverTotal={total}
            serverPage={query.page}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/procurement/suppliers', row, 'code'))}
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
