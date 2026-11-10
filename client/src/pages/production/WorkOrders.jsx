import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { ClipboardList, Plus, Search, Eye, Trash2 } from 'lucide-react';
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

export default function WorkOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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
                        onClick={() => navigate(`/production/work-orders/${order.id}`)}
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
    </AppLayout>
  );
}
