import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { ClipboardList, Plus, Search, Eye, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const STATUS_TAGS = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  RELEASED: { bg: '#e0f2fe', text: '#0369a1' },
  WIP: { bg: '#dbeafe', text: '#1e40af' },
  COMPLETED: { bg: '#dcfce7', text: '#15803d' },
  CANCELLED: { bg: '#fee2e2', text: '#b91c1c' }
};

export default function ProductionOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/production-orders', authConfig());
      setOrders(res.data);
    } catch (err) {
      showToast('Failed to load production orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [authConfig, showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id, orderNumber) => {
    if (!window.confirm(`Delete production order "${orderNumber}"?`)) return;
    try {
      await axios.delete(`/api/production-orders/${id}`, authConfig());
      showToast('Production order removed successfully', 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove production order', 'error');
    }
  };

  const filtered = orders.filter(o => 
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.product?.name.toLowerCase().includes(search.toLowerCase()) ||
    o.product?.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Production Orders" icon={ClipboardList}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Search orders, products..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: '38px', paddingLeft: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem' }}
          />
        </div>
        
        <button 
          onClick={() => navigate('/production/orders/new')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
        >
          <Plus size={16} /> Create Order
        </button>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', height: '40px', textAlign: 'left', fontWeight: 800, color: '#64748b' }}>
              <th style={{ padding: '0 1rem' }}>Order Number</th>
              <th>Finished Product</th>
              <th>Quantity</th>
              <th>BOM Version</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th style={{ padding: '0 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr style={{ height: '80px', textAlign: 'center' }}><td colSpan={8}>Loading production orders...</td></tr>
            ) : filtered.length === 0 ? (
              <tr style={{ height: '80px', textAlign: 'center' }}><td colSpan={8}>No production orders found</td></tr>
            ) : filtered.map(o => {
              const tag = STATUS_TAGS[o.status] || STATUS_TAGS.DRAFT;
              return (
                <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9', height: '48px', color: 'var(--text-main)' }}>
                  <td style={{ padding: '0 1rem', fontWeight: 700, color: 'var(--accent)' }}>{o.orderNumber}</td>
                  <td>{o.product?.code} - {o.product?.name}</td>
                  <td><strong>{parseFloat(o.quantity)}</strong></td>
                  <td>{o.bom ? `${o.bom.code} (v${o.bom.version})` : 'None'}</td>
                  <td>
                    <span style={{ backgroundColor: tag.bg, color: tag.text, fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                      {o.status}
                    </span>
                  </td>
                  <td>{o.startDate ? new Date(o.startDate).toLocaleDateString() : '-'}</td>
                  <td>{o.endDate ? new Date(o.endDate).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: '0 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button 
                        onClick={() => navigate(`/production/orders/${o.id}`)}
                        style={{ display: 'flex', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b' }}
                        title="View / Edit Details"
                      >
                        <Eye size={14} />
                      </button>
                      {['DRAFT', 'CANCELLED'].includes(o.status) && (
                        <button 
                          onClick={() => handleDelete(o.id, o.orderNumber)}
                          style={{ display: 'flex', padding: '6px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}
                          title="Delete Order"
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
