import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function TaxGroups() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [taxGroups, setTaxGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchTaxGroups();
  }, []);

  const fetchTaxGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/finance/tax-groups', config);
      setTaxGroups(res.data);
    } catch (error) {
      console.error('Failed to fetch tax groups:', error);
      showToast('Failed to fetch tax groups', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Tax Group',
      message: 'Are you sure you want to delete this tax group? This action will permanently remove all associated tax slabs.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/finance/tax-groups/${id}`, config);
      showToast('Tax group deleted successfully', 'success');
      fetchTaxGroups();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete tax group', 'error');
    }
  };

  const getSlabsSummary = (slabs) => {
    if (!slabs || slabs.length === 0) return 'No Slabs';
    return slabs.map(s => `${s.name} (${parseFloat(s.rate)}%)`).join(' + ');
  };

  const getCumulativeRate = (slabs) => {
    if (!slabs || slabs.length === 0) return '0.00%';
    let base = 100;
    let current = 100;
    const sorted = [...slabs].sort((a, b) => a.calculationOrder - b.calculationOrder);
    let totalTaxAmt = 0;
    
    sorted.forEach(s => {
      const rate = parseFloat(s.rate);
      if (s.calculationType === 'COMPOUNDED') {
        const taxVal = (current * rate) / 100;
        totalTaxAmt += taxVal;
        current += taxVal;
      } else {
        const taxVal = (base * rate) / 100;
        totalTaxAmt += taxVal;
        current += taxVal;
      }
    });

    return `${totalTaxAmt.toFixed(2)}%`;
  };

  const columns = [
    { header: 'Name', accessor: 'name', fontWeight: 600 },
    { header: 'Description', accessor: 'description', color: 'var(--text-muted)' },
    { 
      header: 'Tax Slabs Breakdown', 
      accessor: 'slabs', 
      render: (row) => getSlabsSummary(row.slabs) 
    },
    { 
      header: 'Effective Cumulative Rate', 
      accessor: 'id', 
      align: 'right',
      fontWeight: 600,
      render: (row) => getCumulativeRate(row.slabs)
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
    <AppLayout title="Tax Groups" icon={Landmark}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={taxGroups}
            loading={loading}
            searchPlaceholder="Search tax group name..."
            searchKeys={['name', 'description']}
            onRowClick={(row) => navigate(`/finance/tax-groups/${row.id}`)}
            extraActions={
              <button
                onClick={() => navigate('/finance/tax-groups/new')}
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
                <Plus size={16} /> New Tax Group
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

