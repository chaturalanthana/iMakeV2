import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Plus, Trash2, Sliders } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { workstationPath } from '../../utils/workstationPath';

export default function Workstations() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [workstations, setWorkstations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchWorkstations();
  }, []);

  const fetchWorkstations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/workstations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkstations(res.data);
    } catch (error) {
      console.error('Failed to fetch workstations:', error);
      showToast('Failed to fetch workstations', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Workstation',
      message: 'Are you sure you want to delete this workstation? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/workstations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Workstation deleted successfully', 'success');
      fetchWorkstations();
    } catch (error) {
      console.error('Failed to delete workstation:', error);
      showToast(error.response?.data?.error || 'Failed to delete workstation', 'error');
    }
  };

  const columns = [
    {
      header: 'Workstation Code',
      accessor: 'code',
      fontWeight: 600
    },
    {
      header: 'Workstation Name',
      accessor: 'name',
      fontWeight: 500
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => row.description || '-'
    },
    {
      header: 'Hourly Rate',
      accessor: 'hourlyRate',
      fontWeight: 600,
      render: (row) => '$' + parseFloat(row.hourlyRate || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const colors = {
          ACTIVE: { bg: '#ecfdf5', color: '#047857' },
          INACTIVE: { bg: '#f1f5f9', color: '#475569' },
          UNDER_MAINTENANCE: { bg: '#fff7ed', color: '#c2410c' }
        };
        const style = colors[row.status] || { bg: '#f1f5f9', color: '#475569' };
        return (
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: style.bg,
            color: style.color,
            textTransform: 'uppercase'
          }}>
            {row.status.replace('_', ' ')}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={(e) => handleDeleteClick(e, row.id)}
            title="Delete Workstation"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--error)',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const extraActions = (
    <button onClick={() => navigate('/production/workstations/new')} style={{
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
      <Plus size={16} /> Add Workstation
    </button>
  );

  return (
    <AppLayout title="Workstations" icon={Sliders}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={workstations}
            loading={loading}
            searchPlaceholder="Search workstation code or name..."
            searchKeys={['code', 'name', 'description']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(workstationPath(row))}
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
