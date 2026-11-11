import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { queryRef, recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Plus, Package, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Deliveries() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/sales/deliveries', config);
      setDeliveries(res.data);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Delivery',
      message: 'Are you sure you want to delete this delivery? Appending stock reversals is recommended rather than deletion in strict environments! This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/sales/deliveries/${id}`, config);
      showToast('Delivery deleted successfully', 'success');
      fetchDeliveries();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete delivery', 'error');
    }
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'Delivery #',
      accessor: 'deliveryNumber',
      fontWeight: 600
    },
    {
      header: 'Order Ref',
      accessor: 'order',
      render: (row) => row.order?.orderNumber || '-',
      color: 'var(--text-muted)'
    },
    {
      header: 'Customer',
      accessor: 'customer',
      fontWeight: 500,
      render: (row) => row.customer?.name || '-'
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
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/new?deliveryId=${queryRef(row.deliveryNumber)}${row.order?.orderNumber ? `&orderId=${queryRef(row.order.orderNumber)}` : ''}`); }} 
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Create Invoice
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}><Trash2 size={16} /></button>
        </div>
      )
    }
  ];

  const extraActions = (
    <button
      onClick={() => navigate('/sales/deliveries/new')}
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
      <Plus size={16} /> New Delivery
    </button>
  );

  return (
    <AppLayout title="Deliveries" icon={Package}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={deliveries}
            loading={loading}
            searchPlaceholder="Search by delivery # or customer..."
            searchKeys={['deliveryNumber', 'customer.name', 'order.orderNumber']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/sales/deliveries', row, 'deliveryNumber'))}
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
