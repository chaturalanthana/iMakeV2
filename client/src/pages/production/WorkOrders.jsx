import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useMatch, useNavigate } from 'react-router-dom';
import { recordPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import { ClipboardList, Plus, Search, Eye, Trash2, CheckCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const STATUS_TAGS = {
  CREATED: { bg: '#f1f5f9', text: '#475569', label: 'Created' },
  RELEASED: { bg: '#e0f2fe', text: '#0369a1', label: 'Released' },
  IN_PROGRESS: { bg: '#dbeafe', text: '#1e40af', label: 'In Progress' },
  TECO: { bg: '#fef3c7', text: '#b45309', label: 'TECO' },
  CLOSED: { bg: '#dcfce7', text: '#15803d', label: 'Closed' },
  CANCELLED: { bg: '#fee2e2', text: '#b91c1c', label: 'Cancelled' }
};

const FIELD = {
  height: '38px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff',
  padding: '0 0.6rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b'
};
const MODAL_FIELD = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};
const LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem'
};
const EMPTY_FORM = {
  productId: '', bomId: '', quantity: 1, priority: 'MEDIUM', issueMode: '',
  startDate: '', endDate: '', warehouseId: '', notes: ''
};

export default function WorkOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
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

  const saveSetting = async (patch) => {
    try {
      const res = await axios.put('/api/work-orders/settings', patch, authConfig());
      setSettings(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save production settings', 'error');
    }
  };

  const handleDelete = async (id, orderNumber) => {
    if (!window.confirm(`Delete work order "${orderNumber}"?`)) return;
    try {
      await axios.delete(`/api/work-orders/${id}`, authConfig());
      showToast('Work order removed', 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove work order', 'error');
    }
  };

  const filtered = orders.filter((order) => {
    const haystack = `${order.orderNumber} ${order.product?.name || ''} ${order.product?.code || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <AppLayout title="Work Orders" icon={ClipboardList}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>MATERIAL CHECK</label>
          <select
            value={settings?.materialCheck || 'WARN'}
            onChange={(event) => saveSetting({ materialCheck: event.target.value })}
            style={FIELD}
          >
            <option value="WARN">Warn and release</option>
            <option value="BLOCK">Block when short</option>
          </select>
          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>ISSUE</label>
          <select
            value={settings?.issueMode || 'BACKFLUSH'}
            onChange={(event) => saveSetting({ issueMode: event.target.value })}
            style={FIELD}
          >
            <option value="BACKFLUSH">Backflush on confirm</option>
            <option value="MANUAL">Manual issue</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search orders, products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: '100%', height: '38px', paddingLeft: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>
        <button
          onClick={() => navigate('/production/work-orders/new')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
        >
          <Plus size={16} /> Create Work Order
        </button>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '720px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', height: '40px', textAlign: 'left', fontWeight: 800, color: '#64748b' }}>
              <th style={{ padding: '0 1rem' }}>Work Order</th>
              <th>Finished Product</th>
              <th>Quantity</th>
              <th>Done</th>
              <th>BOM</th>
              <th>Status</th>
              <th>Source</th>
              <th style={{ padding: '0 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr style={{ height: '80px', textAlign: 'center' }}><td colSpan={8}>Loading work orders...</td></tr>
            ) : filtered.length === 0 ? (
              <tr style={{ height: '80px', textAlign: 'center' }}><td colSpan={8}>No work orders found</td></tr>
            ) : filtered.map((order) => {
              const tag = STATUS_TAGS[order.status] || STATUS_TAGS.CREATED;
              return (
                <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9', height: '48px', color: 'var(--text-main)' }}>
                  <td style={{ padding: '0 1rem', fontWeight: 700, color: 'var(--accent)' }}>{order.orderNumber}</td>
                  <td>{order.product?.code} - {order.product?.name}</td>
                  <td><strong>{parseFloat(order.quantity)}</strong></td>
                  <td>{parseFloat(order.quantityCompleted || 0)}</td>
                  <td>{order.bom ? `${order.bom.code} (v${order.bom.version})` : 'None'}</td>
                  <td>
                    <span style={{ backgroundColor: tag.bg, color: tag.text, fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                      {tag.label}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{order.sourceType}</td>
                  <td style={{ padding: '0 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        onClick={() => navigate(recordPath('/production/work-orders', order, 'orderNumber'))}
                        style={{ display: 'flex', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b' }}
                        title="Open"
                      >
                        <Eye size={14} />
                      </button>
                      {['CREATED', 'CANCELLED'].includes(order.status) && (
                        <button
                          onClick={() => handleDelete(order.id, order.orderNumber)}
                          style={{ display: 'flex', padding: '6px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!creating}
        onClose={closeCreate}
        title="Create Work Order"
        icon={ClipboardList}
        maxWidth="760px"
        overflow="visible"
      >
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={LABEL_STYLE}>Product *</label>
            <LiveSearchDropdown options={productOptions} value={form.productId} invalid={!!fieldErrors.productId} onChange={(value) => setForm((prev) => ({ ...prev, productId: value, bomId: '' }))} placeholder="Select product" />
          </div>
          <div>
            <label style={LABEL_STYLE}>BOM</label>
            <LiveSearchDropdown options={bomOptions} value={form.bomId} onChange={(value) => setForm((prev) => ({ ...prev, bomId: value }))} placeholder="Default active BOM" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Quantity *</label>
            <input type="number" min="0" step="any" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} className={fieldErrors.quantity ? 'field-invalid' : undefined} style={MODAL_FIELD} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Priority</label>
            <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} style={MODAL_FIELD}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Issue</label>
            <select value={form.issueMode} onChange={(event) => setForm((prev) => ({ ...prev, issueMode: event.target.value }))} style={MODAL_FIELD}>
              <option value="">Settings default</option>
              <option value="BACKFLUSH">Backflush</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Warehouse</label>
            <select value={form.warehouseId} onChange={(event) => setForm((prev) => ({ ...prev, warehouseId: event.target.value }))} style={MODAL_FIELD}>
              <option value="">First warehouse</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Start</label>
            <input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} style={MODAL_FIELD} />
          </div>
          <div>
            <label style={LABEL_STYLE}>End</label>
            <input type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} style={MODAL_FIELD} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL_STYLE}>Notes</label>
            <input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} style={MODAL_FIELD} />
          </div>
        </div>
        <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <button onClick={closeCreate} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <CheckCircle size={16} /> {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
