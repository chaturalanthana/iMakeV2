import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { ClipboardList, ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';

const FIELD_STYLE = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};

const LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem'
};

export default function NewProductionOrder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);
  const [availableBoms, setAvailableBoms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    productId: '', bomId: '', quantity: 1, status: 'DRAFT',
    startDate: '', endDate: '', assignedTo: '', workCenterId: '', notes: ''
  });

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const config = authConfig();
      const [productsRes, bomsRes] = await Promise.all([
        axios.get('/api/products', config),
        axios.get('/api/boms', config)
      ]);
      const manufactureable = productsRes.data.filter(p => p.bomApplicable);
      setProducts(manufactureable);
      setBoms(bomsRes.data);

      if (id) {
        const orderRes = await axios.get('/api/production-orders', config);
        const order = orderRes.data.find(o => o.id === id);
        if (order) {
          // Filter BOMs for this product
          const filtered = bomsRes.data.filter(b => b.productId === order.productId);
          setAvailableBoms(filtered.map(b => ({ label: `${b.code} (v${b.version})`, value: b.id })));
          
          setForm({
            productId: order.productId,
            bomId: order.bomId || '',
            quantity: parseFloat(order.quantity),
            status: order.status,
            startDate: order.startDate ? new Date(order.startDate).toISOString().slice(0, 16) : '',
            endDate: order.endDate ? new Date(order.endDate).toISOString().slice(0, 16) : '',
            assignedTo: order.assignedTo || '',
            workCenterId: order.workCenterId || '',
            notes: order.notes || ''
          });
        }
      }
    } catch (err) {
      showToast('Failed to load form registries', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, authConfig, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProductChange = (val) => {
    setForm(prev => ({ ...prev, productId: val, bomId: '' }));
    const filtered = boms.filter(b => b.productId === val);
    setAvailableBoms(filtered.map(b => ({ label: `${b.code} (v${b.version})`, value: b.id })));
    
    const defaultBom = filtered.find(b => b.isDefault);
    if (defaultBom) {
      setForm(prev => ({ ...prev, bomId: defaultBom.id }));
    }
  };

  const handleSave = async () => {
    const errors = {};
    if (!form.productId) errors.productId = 'Output Product is required';
    if (!(parseFloat(form.quantity) > 0)) errors.quantity = 'Quantity must be greater than zero';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      return showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const config = authConfig();
      if (id) {
        await axios.put(`/api/production-orders/${id}`, form, config);
        showToast('Production Order updated successfully', 'success');
      } else {
        await axios.post('/api/production-orders', form, config);
        showToast('Production Order created successfully', 'success');
      }
      navigate('/production/orders');
    } catch (err) {
      setFieldErrors(err.response?.data?.fields || {});
      showToast(err.response?.data?.error || 'Failed to save Production Order', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title={id ? "Edit Production Order" : "New Production Order"} icon={ClipboardList}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => navigate('/production/orders')}
          style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Back to Production Orders</span>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading form...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
          <div>
            <label style={LABEL_STYLE}>Output Product *</label>
            <LiveSearchDropdown
              options={products.map(p => ({ label: `${p.code} - ${p.name}`, value: p.id }))}
              value={form.productId}
              invalid={!!fieldErrors.productId}
              onChange={handleProductChange}
              placeholder="Select finished or semi-finished product..."
              style={{ input: FIELD_STYLE }}
            />
            {fieldErrors.productId && <span className="field-error-text">{fieldErrors.productId}</span>}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Target Quantity *</label>
              <input 
                type="number" 
                value={form.quantity} 
                onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                className={fieldErrors.quantity ? 'field-invalid' : undefined}
                style={FIELD_STYLE} 
              />
              {fieldErrors.quantity && <span className="field-error-text">{fieldErrors.quantity}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>BOM Version</label>
              <LiveSearchDropdown
                options={availableBoms}
                value={form.bomId}
                onChange={val => setForm(prev => ({ ...prev, bomId: val }))}
                placeholder="Auto-resolved BOM..."
                style={{ input: FIELD_STYLE }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Start Date</label>
              <input 
                type="datetime-local" 
                value={form.startDate} 
                onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} 
                style={FIELD_STYLE} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>End Date</label>
              <input 
                type="datetime-local" 
                value={form.endDate} 
                onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))} 
                style={FIELD_STYLE} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Status</label>
              <LiveSearchDropdown
                options={[
                  { label: 'DRAFT', value: 'DRAFT' },
                  { label: 'RELEASED', value: 'RELEASED' },
                  { label: 'WIP', value: 'WIP' },
                  { label: 'COMPLETED', value: 'COMPLETED' },
                  { label: 'CANCELLED', value: 'CANCELLED' }
                ]}
                value={form.status}
                onChange={val => setForm(prev => ({ ...prev, status: val }))}
                style={{ input: FIELD_STYLE }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Work Station / Center</label>
              <input 
                type="text" 
                value={form.workCenterId} 
                onChange={e => setForm(prev => ({ ...prev, workCenterId: e.target.value }))}
                placeholder="e.g. Line 02 / CNC"
                style={FIELD_STYLE} 
              />
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Assigned Supervisor / Operator</label>
            <input 
              type="text" 
              value={form.assignedTo} 
              onChange={e => setForm(prev => ({ ...prev, assignedTo: e.target.value }))}
              placeholder="e.g. Supervisor Bob"
              style={FIELD_STYLE} 
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Planner Instructions / Notes</label>
            <textarea 
              value={form.notes} 
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Material allocations details, quality checklist instructions..."
              style={{ ...FIELD_STYLE, height: 'auto', padding: '0.625rem 0.875rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifySet: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <button 
              onClick={() => navigate('/production/orders')}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.75rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
            >
              <CheckCircle size={16} /> {saving ? 'Saving...' : 'Save Production Order'}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
