import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import DataTable from '../components/ui/DataTable';
import ConfirmModal from '../components/ui/ConfirmModal';
import PageSkeleton from '../components/ui/PageSkeleton';
import StatusBadge from '../components/ui/StatusBadge';
import FormField, { TextControl } from '../components/ui/FormField';
import { CheckCircle, ClipboardList } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { approvalDecisionSchema, firstZodError } from '../validation/controls';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const tabStyle = (active) => ({
  padding: '0.75rem 0',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
});

export default function Approvals() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadError, setLoadError] = useState('');
  const requestRef = useRef(0);

  const load = async (which = tab) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoading(true);
    setLoadError('');
    try {
      const res = await axios.get('/api/approvals', { ...auth(), params: { status: which }, timeout: 20000 });
      if (request !== requestRef.current) return;
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list);
      setSelected((current) => list.find((row) => row.id === current?.id) || list[0] || null);
    } catch (error) {
      if (request !== requestRef.current) return;
      const message = error.response?.data?.error || 'Could not load approvals';
      setRows([]);
      setSelected(null);
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const decide = async () => {
    if (!dialog) return;
    const parsed = approvalDecisionSchema.safeParse({ action: dialog.action, reason });
    if (!parsed.success) {
      const message = firstZodError(parsed.error);
      setReasonError(message);
      showToast(message, 'error');
      return;
    }
    try {
      await axios.post(`/api/approvals/${dialog.id}/decide`, { action: dialog.action, reason }, auth());
      showToast('Approval updated', 'success');
      setDialog(null);
      setReason('');
      setReasonError('');
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not update the approval', 'error');
    }
  };

  const columns = [
    { header: 'Document', accessor: 'documentNumber', fontWeight: 600, render: (row) => row.documentNumber || row.documentId },
    { header: 'Type', accessor: 'documentType' },
    { header: 'Amount', accessor: 'amount' },
    { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Level', accessor: 'currentLevel' },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {row.link && (
            <button type="button" onClick={() => navigate(row.link)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Open</button>
          )}
          {tab === 'pending' && (
            <>
              <button type="button" onClick={() => { setReason(''); setReasonError(''); setDialog({ id: row.id, action: 'APPROVE' }); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
              <button type="button" onClick={() => { setReason(''); setReasonError(''); setDialog({ id: row.id, action: 'RETURN' }); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#fffbeb', color: '#b45309', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Return</button>
              <button type="button" onClick={() => { setReason(''); setReasonError(''); setDialog({ id: row.id, action: 'REJECT' }); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#fef2f2', color: '#b91c1c', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout title="Approvals" icon={ClipboardList}>
      {loading && !rows.length && !loadError ? <PageSkeleton type="table" /> : (
        <>
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button type="button" onClick={() => setTab('pending')} style={tabStyle(tab === 'pending')}>Pending</button>
            <button type="button" onClick={() => setTab('completed')} style={tabStyle(tab === 'completed')}><CheckCircle size={16} /> Completed</button>
          </div>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            searchPlaceholder="Search by document..."
            searchKeys={['documentNumber', 'documentType', 'status']}
            noDataMessage={loadError || 'No approvals in this list.'}
            onRowClick={setSelected}
          />
          {Array.isArray(selected?.actions) && selected.actions.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <DataTable
                columns={[
                  { header: 'When', accessor: 'createdAt', render: (row) => new Date(row.createdAt).toLocaleString() },
                  { header: 'Action', accessor: 'action', render: (row) => <StatusBadge status={row.action} /> },
                  { header: 'Reason', accessor: 'reason' }
                ]}
                data={selected.actions}
                searchKeys={[]}
                noDataMessage="No history for this request."
              />
            </div>
          )}
          <ConfirmModal
            isOpen={Boolean(dialog)}
            onClose={() => setDialog(null)}
            onConfirm={decide}
            title={dialog?.action === 'APPROVE' ? 'Approve document' : dialog?.action === 'RETURN' ? 'Return for correction' : 'Reject document'}
            message={dialog?.action === 'APPROVE' ? 'Approve this step?' : 'A reason is required.'}
            confirmText={dialog?.action === 'APPROVE' ? 'Approve' : dialog?.action === 'RETURN' ? 'Return' : 'Reject'}
            type={dialog?.action === 'APPROVE' ? 'info' : 'danger'}
          >
            {dialog?.action !== 'APPROVE' && (
              <FormField label="Reason" required error={reasonError} variant="modal">
                <TextControl
                  value={reason}
                  invalid={Boolean(reasonError)}
                  onChange={(event) => { setReason(event.target.value); setReasonError(''); }}
                  placeholder="Reason"
                />
              </FormField>
            )}
          </ConfirmModal>
        </>
      )}
    </AppLayout>
  );
}
