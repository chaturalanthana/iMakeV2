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

export default function DiscountGroups() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [discountGroups, setDiscountGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchDiscountGroups();
  }, []);

  const fetchDiscountGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/discount-groups', config);
      setDiscountGroups(res.data);
    } catch (error) {
      console.error('Failed to fetch discount groups:', error);
      showToast('Failed to fetch discount groups', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Discount Group',
      message: 'Are you sure you want to delete this discount group? This action will permanently remove all associated product discount rules.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/discount-groups/${id}`, config);
      showToast('Discount group deleted successfully', 'success');
      fetchDiscountGroups();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete discount group', 'error');
    }
  };

  const columns = [
    { header: 'Name', accessor: 'name', fontWeight: 600 },
    { 
      header: 'Status', 
      accessor: 'status', 
      fontWeight: 600, 
      render: (row) => <StatusBadge status={row.status} />
    },
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
    <AppLayout title="Discount Groups" icon={Layers}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={discountGroups}
            loading={loading}
            searchPlaceholder="Search discount group name..."
            searchKeys={['name']}
            onRowClick={(row) => navigate(recordPath('/sales/discount-groups', row, 'name'))}
            extraActions={
              <button
                onClick={() => navigate('/sales/discount-groups/new')}
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
                <Plus size={16} /> New Discount Group
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
