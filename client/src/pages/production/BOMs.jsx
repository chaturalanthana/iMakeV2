import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Plus, ClipboardList } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { bomPath } from '../../utils/bomPath';

export default function BOMs() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    fetchBOMs();
  }, []);

  const fetchBOMs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/boms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBoms(res.data);
    } catch (error) {
      console.error('Failed to fetch BOMs:', error);
      showToast('Failed to fetch BOMs', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const columns = [
    {
      header: 'BOM Code',
      accessor: 'code',
      fontWeight: 600
    },
    {
      header: 'BOM Name',
      accessor: 'name',
      fontWeight: 500
    },
    {
      header: 'Item Code',
      accessor: 'product.code',
      render: (row) => row.product?.code || '-'
    },
    {
      header: 'Assembled Item',
      accessor: 'product.name',
      render: (row) => row.product?.name || '-'
    },
    {
      header: 'Version',
      accessor: 'version',
      align: 'left',
      render: (row) => (
        <span>
          {row.version}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const colors = {
          DRAFT: '#64748b',
          ACTIVE: '#10b981',
          RETIRED: '#ef4444',
          SUPERSEDED: '#d97706'
        };
        const color = colors[row.status] || '#64748b';
        return (
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: color,
            textTransform: 'uppercase'
          }}>
            {row.status}
          </span>
        );
      }
    }
  ];

  const extraActions = (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <button onClick={() => navigate('/production/boms/new')} style={{
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
        <Plus size={16} /> Add New BOM
      </button>
    </div>
  );

  return (
    <AppLayout title="Bill of Materials (BOM)" icon={ClipboardList}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={boms}
          loading={loading}
          searchPlaceholder="Search BOM code or name..."
          searchKeys={['code', 'name', 'product.name', 'product.code']}
          extraActions={extraActions}
          onRowClick={(row) => navigate(bomPath(row))}
        />
      )}
    </AppLayout>
  );
}
