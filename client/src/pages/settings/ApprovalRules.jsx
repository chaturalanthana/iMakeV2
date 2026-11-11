import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ClipboardList, X } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { useToast } from '../../context/ToastContext';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const inputStyle = { width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' };

export default function ApprovalRules() {
  const { showToast } = useToast();
  const [pack, setPack] = useState({ rules: [], roles: [], users: [], types: [] });
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(null);

  const load = async () => {
    const res = await axios.get('/api/controls/approval-rules', auth());
    setPack(res.data);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const open = (rule) => {
    setCurrent(rule);
    const levels = (rule.levels || []).slice(0, 2);
    while (levels.length < 1) levels.push({ threshold: 0, approverRoleId: '', approverUserId: '' });
    setForm({
      enabled: rule.enabled,
      allowSelfApprove: rule.allowSelfApprove,
      levels: levels.map((level) => ({
        threshold: String(level.threshold ?? 0),
        approverRoleId: level.approverRoleId || '',
        approverUserId: level.approverUserId || ''
      }))
    });
  };

  const save = async (event) => {
    event.preventDefault();
    try {
      await axios.put(`/api/controls/approval-rules/${current.documentType}`, {
        enabled: form.enabled,
        allowSelfApprove: form.allowSelfApprove,
        levels: form.levels.filter((level) => level.approverRoleId || level.approverUserId).map((level) => ({
          threshold: Number(level.threshold || 0),
          approverRoleId: level.approverRoleId || null,
          approverUserId: level.approverUserId || null
        }))
      }, auth());
      showToast('Approval rule saved', 'success');
      setCurrent(null);
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not save the rule', 'error');
    }
  };

  const label = (type) => pack.types.find((row) => row.type === type)?.label || type;

  if (loading) return <AppLayout title="Approval rules" icon={ClipboardList}><PageSkeleton type="table" /></AppLayout>;

  return (
    <AppLayout title="Approval rules" icon={ClipboardList}>
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Approval rules</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>Rules stay off until you enable them. Amounts under the first threshold approve themselves.</p>
        </div>
        {form && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', marginBottom: '2rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{label(current.documentType)}</h2>
              <button type="button" onClick={() => setForm(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <form onSubmit={save}>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.allowSelfApprove} onChange={(e) => setForm({ ...form, allowSelfApprove: e.target.checked })} /> Allow self-approve
                </label>
              </div>
              {form.levels.map((level, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Level {index + 1} threshold</label>
                    <input style={inputStyle} value={level.threshold} onChange={(e) => {
                      const levels = [...form.levels];
                      levels[index] = { ...level, threshold: e.target.value };
                      setForm({ ...form, levels });
                    }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Approver role</label>
                    <select style={inputStyle} value={level.approverRoleId} onChange={(e) => {
                      const levels = [...form.levels];
                      levels[index] = { ...level, approverRoleId: e.target.value };
                      setForm({ ...form, levels });
                    }}>
                      <option value="">None</option>
                      {pack.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Approver user</label>
                    <select style={inputStyle} value={level.approverUserId} onChange={(e) => {
                      const levels = [...form.levels];
                      levels[index] = { ...level, approverUserId: e.target.value };
                      setForm({ ...form, levels });
                    }}>
                      <option value="">None</option>
                      {pack.users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {form.levels.length < 2 && (
                <button type="button" onClick={() => setForm({ ...form, levels: [...form.levels, { threshold: '0', approverRoleId: '', approverUserId: '' }] })} style={{ marginBottom: '1rem', background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Add second level</button>
              )}
              <button type="submit" style={{ backgroundColor: 'var(--accent)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Save rule</button>
            </form>
          </div>
        )}
        <DataTable
          columns={[
            { header: 'Document', accessor: 'documentType', render: (row) => label(row.documentType), fontWeight: 600 },
            { header: 'Enabled', accessor: 'enabled', render: (row) => row.enabled ? 'Yes' : 'No' },
            { header: 'Self-approve', accessor: 'allowSelfApprove', render: (row) => row.allowSelfApprove ? 'Yes' : 'No' },
            { header: 'Levels', accessor: 'levels', render: (row) => (row.levels || []).map((level) => Number(level.threshold).toLocaleString()).join(' → ') },
            { header: 'Actions', align: 'right', sortable: false, render: (row) => <button type="button" onClick={(e) => { e.stopPropagation(); open(row); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>Edit</button> }
          ]}
          data={pack.rules}
          onRowClick={open}
          searchKeys={['documentType']}
          searchPlaceholder="Search document type..."
        />
      </div>
    </AppLayout>
  );
}
