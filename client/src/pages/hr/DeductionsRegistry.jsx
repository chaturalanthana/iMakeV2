import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { MinusCircle, Plus, Pencil, Trash2, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { confirmDialog } from '../../components/ui/appDialog';

const FIELD_STYLE = { width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box' };
const LABEL_STYLE = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' };

export default function DeductionsRegistry() {
  const { showToast } = useToast();
  const [deductions, setDeductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'STATUTORY', defaultAmount: '', isStatutory: false });

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => { fetchDeductions(); }, []);

  const fetchDeductions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/hr/deductions', authConfig());
      setDeductions(res.data);
    } catch { showToast('Failed to fetch deductions', 'error'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditingId(null); setForm({ name: '', type: 'STATUTORY', defaultAmount: '', isStatutory: false }); setShowModal(true); };
  const openEdit = (d) => { setEditingId(d.id); setForm({ name: d.name, type: d.type, defaultAmount: d.defaultAmount?.toString() || '', isStatutory: d.isStatutory }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name) return showToast('Name is required', 'error');
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`/api/hr/deductions/${editingId}`, form, authConfig());
        showToast('Deduction updated', 'success');
      } else {
        await axios.post('/api/hr/deductions', form, authConfig());
        showToast('Deduction created', 'success');
      }
      setShowModal(false);
      fetchDeductions();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!(await confirmDialog({ title: 'Delete deduction', message: `Delete deduction "${name}"?` }))) return;
    try {
      await axios.delete(`/api/hr/deductions/${id}`, authConfig());
      showToast('Deduction deleted', 'success');
      fetchDeductions();
    } catch (err) { showToast(err.response?.data?.error || 'Failed to delete', 'error'); }
  };

  const statutory = deductions.filter(d => d.isStatutory);
  const voluntary = deductions.filter(d => !d.isStatutory);

  return (
    <AppLayout title="Deductions Registry" icon={MinusCircle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.4rem', color: '#1e293b' }}>Deduction Components</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Manage statutory and voluntary deduction components used in payroll</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
          <Plus size={16} /> Add Deduction
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {[
          { label: 'Statutory Deductions', color: '#dc2626', bg: '#fef2f2', icon: ShieldCheck, data: statutory, desc: 'Government mandated (EPF, ESI, Tax, LWF)' },
          { label: 'Voluntary Deductions', color: '#7c3aed', bg: '#f5f3ff', icon: MinusCircle, data: voluntary, desc: 'Optional (Advance, Insurance, etc.)' }
        ].map(group => (
          <div key={group.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', background: group.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <group.icon size={18} color={group.color} />
                <span style={{ fontWeight: 800, color: group.color, fontSize: '0.9rem' }}>{group.label}</span>
                <span style={{ marginLeft: 'auto', color: group.color, fontSize: '0.85rem', fontWeight: 700 }}>{group.data.length}</span>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: group.color, opacity: 0.75 }}>{group.desc}</p>
            </div>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
            ) : group.data.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No components configured</div>
            ) : (
              <div style={{ padding: '0.5rem' }}>
                {group.data.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 0.875rem', borderRadius: '8px', gap: '0.75rem' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{d.name}</span>
                        {d.isStatutory && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626' }}>STATUTORY</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Default: ${parseFloat(d.defaultAmount).toFixed(2)} · {d.type}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button onClick={() => openEdit(d)} style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(d.id, d.name)} style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{editingId ? 'Edit' : 'Add'} Deduction</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={LABEL_STYLE}>Deduction Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={FIELD_STYLE} placeholder="e.g. Employees Provident Fund" autoComplete="off" /></div>
              <div><label style={LABEL_STYLE}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={FIELD_STYLE}>
                  <option value="STATUTORY">Statutory</option>
                  <option value="VOLUNTARY">Voluntary</option>
                </select></div>
              <div><label style={LABEL_STYLE}>Default Amount</label>
                <input type="number" value={form.defaultAmount} onChange={e => setForm(f => ({ ...f, defaultAmount: e.target.value }))} style={FIELD_STYLE} placeholder="0.00" /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, isStatutory: !f.isStatutory }))}>
                <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${form.isStatutory ? 'var(--accent)' : '#cbd5e1'}`, background: form.isStatutory ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {form.isStatutory && <CheckCircle size={12} color="#fff" />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>Mark as Statutory</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Government mandated deduction (EPF, ESI, etc.)</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
