import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ConfirmModal from '../../components/ui/ConfirmModal';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { SelectControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import { ClipboardList, Plus, Eye, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function WorkOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, settingsRes] = await Promise.all([
        axios.get('/api/work-orders', authConfig()),
        axios.get('/api/work-orders/settings', authConfig())
      ]);
      setOrders(ordersRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      showToast('Failed to load work orders', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [authConfig, showToast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const saveSetting = async (patch) => {
    try {
      const res = await axios.put('/api/work-orders/settings', patch, authConfig());
      setSettings(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save production settings', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/work-orders/${id}`, authConfig());
      showToast('Work order removed', 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove work order', 'error');
    }
  };

  const rows = orders.map((order) => ({
    ...order,
    productLabel: [order.product?.code, order.product?.name].filter(Boolean).join(' - '),
    bomLabel: order.bom ? `${order.bom.code} (v${order.bom.version})` : 'None'
  }));

  const columns = [
    {
      header: 'Work Order',
      accessor: 'orderNumber',
      fontWeight: 600,
      render: (row) => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.orderNumber}</span>
    },
    { header: 'Finished Product', accessor: 'productLabel' },
    { header: 'Quantity', accessor: 'quantity', render: (row) => parseFloat(row.quantity) },
    { header: 'Done', accessor: 'quantityCompleted', render: (row) => parseFloat(row.quantityCompleted || 0) },
    { header: 'BOM', accessor: 'bomLabel' },
    { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Source', accessor: 'sourceType', color: 'var(--text-muted)' },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); navigate(`/production/work-orders/${row.id}`); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
            title="Open"
          >
            <Eye size={16} />
          </button>
          {['CREATED', 'CANCELLED'].includes(row.status) && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmConfig({
                  isOpen: true,
                  title: 'Delete Work Order',
                  message: `Are you sure you want to delete work order "${row.orderNumber}"? This action cannot be undone.`,
                  onConfirm: () => handleDelete(row.id)
                });
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout title="Work Orders" icon={ClipboardList}>
      {isInitialLoad ? <PageSkeleton type="table" /> : (
        <>
          <FilterBar>
            <FormField label="Material check" width="240px">
              <SelectControl
                value={settings?.materialCheck || 'WARN'}
                onChange={(event) => saveSetting({ materialCheck: event.target.value })}
              >
                <option value="WARN">Warn and release</option>
                <option value="BLOCK">Block when short</option>
              </SelectControl>
            </FormField>
            <FormField label="Issue" width="240px">
              <SelectControl
                value={settings?.issueMode || 'BACKFLUSH'}
                onChange={(event) => saveSetting({ issueMode: event.target.value })}
              >
                <option value="BACKFLUSH">Backflush on confirm</option>
                <option value="MANUAL">Manual issue</option>
              </SelectControl>
            </FormField>
          </FilterBar>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            searchPlaceholder="Search orders, products..."
            searchKeys={['orderNumber', 'productLabel', 'sourceType', 'status']}
            onRowClick={(row) => navigate(`/production/work-orders/${row.id}`)}
            noDataMessage="No work orders found."
            extraActions={(
              <ActionButton icon={Plus} onClick={() => navigate('/production/work-orders/new')}>
                Create Work Order
              </ActionButton>
            )}
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
