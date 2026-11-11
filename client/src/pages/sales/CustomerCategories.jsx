import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CustomerCategories() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/customer-categories', config);
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      showToast('Failed to fetch customer categories', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Customer Category',
      message: 'Are you sure you want to delete this customer category? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/customer-categories/${id}`, config);
      showToast('Customer category deleted successfully', 'success');
      fetchCategories();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete customer category', 'error');
    }
  };

  const columns = [
    { header: 'Code', accessor: 'code', fontWeight: 500 },
    { header: 'Name', accessor: 'name', fontWeight: 600 },
    { header: 'Price List', accessor: 'priceList', color: 'var(--text-muted)' },
    { header: 'Credit Limit', accessor: 'creditLimit', color: 'var(--text-muted)' },
    { header: 'Credit Period', accessor: 'creditPeriod', color: 'var(--text-muted)' },
    { header: 'Status', accessor: 'status', fontWeight: 600, render: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      align: 'right',
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

  return (
    <AppLayout title="Customer Categories" icon={Layers}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={categories}
            loading={loading}
            searchPlaceholder="Search category code or name..."
            searchKeys={['name', 'code']}
            onRowClick={(row) => navigate(recordPath('/sales/categories', row, 'code'))}
            extraActions={
              <button
                onClick={() => navigate('/sales/categories/new')}
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
                <Plus size={16} /> New Category
              </button>
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
