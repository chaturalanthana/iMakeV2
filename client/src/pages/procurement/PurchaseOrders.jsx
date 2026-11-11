import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { queryRef, recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import PurchaseOrderPrintModal from '../../components/ui/PurchaseOrderPrintModal';
import DataTable from '../../components/ui/DataTable';
import { ShoppingBag, Plus, Printer } from 'lucide-react';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [printModalData, setPrintModalData] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/procurement/purchase-orders', config);
      setOrders(res.data);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status.toUpperCase();
    if (s === 'PENDING' || s === 'DRAFT') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>{s}</span>;
    if (s === 'RECEIVED') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>RECEIVED</span>;
    if (s === 'CANCELLED') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>CANCELLED</span>;
    return <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{status}</span>;
  };

  const columns = [
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'PO #',
      accessor: 'poNumber',
      fontWeight: 600
    },
    {
      header: 'Supplier',
      accessor: 'supplier',
      fontWeight: 500,
      render: (row) => row.supplier?.name || row.supplierName
    },
    {
      header: 'Total Amount',
      accessor: 'total',
      fontWeight: 600,
      render: (row) => '$' + parseFloat(row.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => getStatusBadge(row.status)
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          {row.status !== 'RECEIVED' && row.status !== 'DRAFT' && (
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/procurement/grn/new?poId=${queryRef(row.poNumber)}`); }} 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Receive GRN
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setPrintModalData(row); }} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Print Order"
          >
            <Printer size={16} />
          </button>
        </div>
      )
    }
  ];

  const extraActions = (
    <button
      onClick={() => navigate('/procurement/purchase-orders/new')}
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
      <Plus size={16} /> New PO
    </button>
  );

  return (
    <AppLayout title="Purchase Orders" icon={ShoppingBag}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={orders}
            loading={loading}
            searchPlaceholder="Search by PO number or supplier..."
            searchKeys={['poNumber', 'supplierName']}
            extraActions={extraActions}
            onRowClick={(row) => navigate(recordPath('/procurement/purchase-orders', row, 'poNumber'))}
          />

          <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
            onConfirm={confirmConfig.onConfirm}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText="Delete"
          />

          <PurchaseOrderPrintModal
            isOpen={!!printModalData}
            onClose={() => setPrintModalData(null)}
            order={printModalData}
          />
        </>
      )}
    </AppLayout>
  );
}
