import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { BadgeDollarSign, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function PriceLists() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchPriceLists();
  }, []);

  const fetchPriceLists = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/price-lists', config);
      setPriceLists(res.data);
    } catch (error) {
      console.error('Failed to fetch price lists:', error);
      showToast('Failed to fetch price lists', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Price List',
      message: 'Are you sure you want to delete this price list? This action will permanently remove all associated custom product prices.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/price-lists/${id}`, config);
      showToast('Price list deleted successfully', 'success');
      fetchPriceLists();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete price list', 'error');
    }
  };

  const columns = [
    { header: 'Name', accessor: 'name', fontWeight: 600 },
    { header: 'Currency', accessor: 'currency', color: 'var(--text-muted)' },
    { 
      header: 'Type', 
      render: (row) => {
        const types = [];
        if (row.isSelling) types.push('Selling');
        if (row.isBuying) types.push('Buying');
        return <span>{types.join(' / ')}</span>;
      }
    },
    { 
      header: 'Status', 
      accessor: 'status', 
      fontWeight: 600, 
      render: (row) => (
        <span style={{
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '0.75rem',
          backgroundColor: row.status === 'ACTIVE' ? '#e2fbe8' : '#fee2e2',
          color: row.status === 'ACTIVE' ? '#15803d' : '#b91c1c'
        }}>
          {row.status}
        </span>
      )
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
    <AppLayout title="Price Lists" icon={BadgeDollarSign}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={priceLists}
            loading={loading}
            searchPlaceholder="Search price list name..."
            searchKeys={['name']}
            onRowClick={(row) => navigate(recordPath('/sales/price-lists', row, 'name'))}
            extraActions={
              <button
                onClick={() => navigate('/sales/price-lists/new')}
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
                <Plus size={16} /> New Price List
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
