import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useMatch, useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ConfirmModal from '../../components/ui/ConfirmModal';
import FormModal from '../../components/ui/FormModal';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import DatePicker from '../../components/ui/DatePicker';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import { ClipboardList, Plus, Eye, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = {
  productId: '', bomId: '', quantity: 1, priority: 'MEDIUM', issueMode: '',
  startDate: '', endDate: '', warehouseId: '', notes: ''
};

export default function WorkOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const creating = useMatch('/production/work-orders/new');

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/work-orders', authConfig());
      setOrders(res.data);
    } catch (err) {
      showToast('Failed to load work orders', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [authConfig, showToast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!creating) return;
    setForm(EMPTY_FORM);
    setFieldErrors({});
    const load = async () => {
      try {
        const config = authConfig();
        const [productsRes, bomsRes, whRes] = await Promise.all([
          axios.get('/api/products', config),
          axios.get('/api/boms', config),
          axios.get('/api/warehouses', config).catch(() => ({ data: [] }))
        ]);
        setProducts(productsRes.data.filter((product) => product.activeStatus !== 'INACTIVE'));
        setBoms(bomsRes.data);
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to load work order form', 'error');
      }
    };
    load();
  }, [creating, authConfig, showToast]);

  const closeCreate = () => navigate('/production/work-orders');

  const save = async () => {
    const errors = {};
    if (!form.productId) errors.productId = 'Product is required';
    if (!(parseFloat(form.quantity) > 0)) errors.quantity = 'Quantity must be greater than zero';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await axios.post('/api/work-orders', {
        ...form,
        bomId: form.bomId || undefined,
        warehouseId: form.warehouseId || undefined,
        issueMode: form.issueMode || undefined,
        quantity: parseFloat(form.quantity)
      }, authConfig());
      showToast('Work order created', 'success');
      navigate(recordPath('/production/work-orders', res.data, 'orderNumber'));
    } catch (error) {
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to create work order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const productOptions = products.map((product) => ({ label: `${product.code} - ${product.name}`, value: product.id }));
  const bomOptions = boms
    .filter((bom) => bom.productId === form.productId)
    .map((bom) => ({ label: `${bom.code} (v${bom.version})`, value: bom.id }));

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
            onClick={(event) => { event.stopPropagation(); navigate(recordPath('/production/work-orders', row, 'orderNumber')); }}
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
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            searchPlaceholder="Search orders, products..."
            searchKeys={['orderNumber', 'productLabel', 'sourceType', 'status']}
            onRowClick={(row) => navigate(recordPath('/production/work-orders', row, 'orderNumber'))}
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
      <FormModal
        isOpen={!!creating}
        onClose={closeCreate}
        title="Create Work Order"
        subtitle="Route a finished item through its BOM"
        icon={ClipboardList}
        onSubmit={save}
        submitLabel={saving ? 'Processing...' : 'Create'}
        busy={saving}
        maxWidth="760px"
        overflow="visible"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
          <FormField label="Product" width="320px" required error={fieldErrors.productId}>
            <LiveSearchDropdown options={productOptions} value={form.productId} invalid={!!fieldErrors.productId} onChange={(value) => setForm((prev) => ({ ...prev, productId: value, bomId: '' }))} placeholder="Select product" />
          </FormField>
          <FormField label="BOM" width="240px">
            <LiveSearchDropdown options={bomOptions} value={form.bomId} onChange={(value) => setForm((prev) => ({ ...prev, bomId: value }))} placeholder="Default active BOM" />
          </FormField>
          <FormField label="Quantity" width="140px" required error={fieldErrors.quantity}>
            <TextControl type="number" min="0" step="any" value={form.quantity} invalid={!!fieldErrors.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} />
          </FormField>
          <FormField label="Priority" width="160px">
            <SelectControl value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => <option key={priority}>{priority}</option>)}
            </SelectControl>
          </FormField>
          <FormField label="Issue" width="200px">
            <SelectControl value={form.issueMode} onChange={(event) => setForm((prev) => ({ ...prev, issueMode: event.target.value }))}>
              <option value="">Backflush (Default)</option>
              <option value="BACKFLUSH">Backflush</option>
              <option value="MANUAL">Manual</option>
            </SelectControl>
          </FormField>
          <FormField label="Warehouse" width="220px">
            <SelectControl value={form.warehouseId} onChange={(event) => setForm((prev) => ({ ...prev, warehouseId: event.target.value }))}>
              <option value="">First warehouse</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}
            </SelectControl>
          </FormField>
          <FormField label="Start" width="200px">
            <DatePicker value={form.startDate} onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))} placeholder="Start Date" style={{ height: '42px', boxSizing: 'border-box' }} />
          </FormField>
          <FormField label="End" width="200px">
            <DatePicker value={form.endDate} onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))} placeholder="End Date" style={{ height: '42px', boxSizing: 'border-box' }} />
          </FormField>
          <FormField label="Notes" width="100%">
            <TextControl value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </FormField>
        </div>
      </FormModal>
    </AppLayout>
  );
}
