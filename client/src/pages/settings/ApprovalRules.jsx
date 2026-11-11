import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ClipboardList } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import PageSkeleton from '../../components/ui/PageSkeleton';
import FormModal from '../../components/ui/FormModal';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import ActionButton from '../../components/ui/ActionButton';
import { useToast } from '../../context/ToastContext';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function ApprovalRules() {
  const { showToast } = useToast();
  const [pack, setPack] = useState({ rules: [], roles: [], users: [], types: [] });
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await axios.get('/api/controls/approval-rules', auth());
    setPack(res.data);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const label = (type) => pack.types.find((row) => row.type === type)?.label || type;

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

  const setLevel = (index, patch) => {
    const levels = [...form.levels];
    levels[index] = { ...levels[index], ...patch };
    setForm({ ...form, levels });
  };

  const save = async () => {
    setSaving(true);
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
      setForm(null);
      setCurrent(null);
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not save the rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppLayout title="Approval rules" icon={ClipboardList}><PageSkeleton type="table" /></AppLayout>;

  return (
    <AppLayout title="Approval rules" icon={ClipboardList}>
      <DataTable
        columns={[
          { header: 'Document', accessor: 'documentType', render: (row) => label(row.documentType), fontWeight: 600 },
          { header: 'Enabled', accessor: 'enabled', render: (row) => <StatusBadge status={row.enabled ? 'ACTIVE' : 'INACTIVE'} label={row.enabled ? 'On' : 'Off'} /> },
          { header: 'Self-approve', accessor: 'allowSelfApprove', render: (row) => row.allowSelfApprove ? 'Yes' : 'No' },
          { header: 'Levels', accessor: 'levels', render: (row) => (row.levels || []).map((level) => Number(level.threshold).toLocaleString()).join(' → ') },
          { header: 'Actions', align: 'right', sortable: false, render: (row) => <button type="button" onClick={(e) => { e.stopPropagation(); open(row); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>Edit</button> }
        ]}
        data={pack.rules}
        onRowClick={open}
        searchKeys={['documentType']}
        searchPlaceholder="Search document type..."
        noDataMessage="No approval rules yet."
      />
      <FormModal
        isOpen={Boolean(form)}
        onClose={() => setForm(null)}
        title={current ? label(current.documentType) : 'Approval rule'}
        subtitle="Amounts under the first threshold approve themselves."
        icon={ClipboardList}
        onSubmit={save}
        submitLabel="Save rule"
        busy={saving}
        maxWidth="760px"
      >
        {form && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={form.allowSelfApprove} onChange={(e) => setForm({ ...form, allowSelfApprove: e.target.checked })} /> Allow self-approve
            </label>
            {form.levels.map((level, index) => (
              <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <FormField label={`Level ${index + 1} threshold`} variant="modal" width="180px">
                  <TextControl value={level.threshold} onChange={(e) => setLevel(index, { threshold: e.target.value })} />
                </FormField>
                <FormField label="Approver role" variant="modal" style={{ flex: 1, minWidth: '180px' }}>
                  <SelectControl value={level.approverRoleId} onChange={(e) => setLevel(index, { approverRoleId: e.target.value })}>
                    <option value="">None</option>
                    {pack.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </SelectControl>
                </FormField>
                <FormField label="Approver user" variant="modal" style={{ flex: 1, minWidth: '180px' }}>
                  <SelectControl value={level.approverUserId} onChange={(e) => setLevel(index, { approverUserId: e.target.value })}>
                    <option value="">None</option>
                    {pack.users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                  </SelectControl>
                </FormField>
              </div>
            ))}
            {form.levels.length < 2 && (
              <ActionButton variant="ghost" onClick={() => setForm({ ...form, levels: [...form.levels, { threshold: '0', approverRoleId: '', approverUserId: '' }] })}>
                Add second level
              </ActionButton>
            )}
          </>
        )}
      </FormModal>
    </AppLayout>
  );
}
