import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ExportButton from '../../components/ui/ExportButton';
import { Users, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Customers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [query, setQuery] = useState({ page: 1, q: '', sort: 'name', dir: 'asc' });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchCustomers();
  }, [query]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/customers', { ...config, params: { page: query.page, pageSize: 15, q: query.q || undefined, sort: query.sort || undefined, dir: query.dir || undefined } });
      setCustomers(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Customer',
      message: 'Are you sure you want to delete this customer? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/customers/${id}`, config);
      showToast('Customer deleted successfully', 'success');
      fetchCustomers();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete customer', 'error');
    }
  };

  // Reusable columns definition
  const columns = [
    { header: 'Code', accessor: 'code', fontWeight: 500 },
    { header: 'Name', accessor: 'name', fontWeight: 600 },
    { header: 'Email', accessor: 'email', color: 'var(--text-muted)' },
    { header: 'Phone', accessor: 'phone', color: 'var(--text-muted)' },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              handleDeleteClick(row.id); 
            }} 
            style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <Trash2 size={16} />
          </button>
        </>
      )
    }
  ];

  return (
    <AppLayout title="Customers" icon={Users}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={customers}
            loading={loading}
            searchPlaceholder="Search by name or code..."
            searchKeys={['name', 'code']}
            onServerQuery={(next) => setQuery((prev) => ({ ...prev, q: next.q ?? prev.q, page: next.page || 1, sort: next.sort || prev.sort, dir: next.dir || prev.dir }))}
            serverTotal={total}
            serverPage={query.page}
            onRowClick={(row) => navigate(recordPath('/sales/customers', row, 'code'))}
            extraActions={
              <div style={{ display: 'flex', gap: '0.5rem' }}>
              <ExportButton url="/api/customers" filename="customers.xlsx" params={{ q: query.q, sort: query.sort, dir: query.dir }} />
              <button
                onClick={() => navigate('/sales/customers/new')}
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
                <Plus size={16} /> New Customer
              </button>
              </div>
            }
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
