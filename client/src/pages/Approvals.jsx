import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import DataTable from '../components/ui/DataTable';
import ConfirmModal from '../components/ui/ConfirmModal';
import PageSkeleton from '../components/ui/PageSkeleton';
import { CheckCircle, ClipboardList } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { approvalDecisionSchema, firstZodError } from '../validation/controls';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function Approvals() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = async (which = tab) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/approvals', { ...auth(), params: { status: which } });
      setRows(res.data || []);
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not load approvals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const decide = async () => {
    if (!dialog) return;
    const parsed = approvalDecisionSchema.safeParse({ action: dialog.action, reason });
    if (!parsed.success) {
      showToast(firstZodError(parsed.error), 'error');
      return;
    }
    try {
      await axios.post(`/api/approvals/${dialog.id}/decide`, { action: dialog.action, reason }, auth());
      showToast('Approval updated', 'success');
      setDialog(null);
      setReason('');
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not update the approval', 'error');
    }
  };

  const columns = [
    { header: 'Document', accessor: 'documentNumber', fontWeight: 600, render: (row) => row.documentNumber || row.documentId },
    { header: 'Type', accessor: 'documentType' },
    { header: 'Amount', accessor: 'amount' },
    { header: 'Status', accessor: 'status', render: (row) => <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{row.status}</span> },
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
              <button type="button" onClick={() => { setReason(''); setDialog({ id: row.id, action: 'APPROVE' }); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
              <button type="button" onClick={() => { setReason(''); setDialog({ id: row.id, action: 'RETURN' }); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#fffbeb', color: '#b45309', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Return</button>
              <button type="button" onClick={() => { setReason(''); setDialog({ id: row.id, action: 'REJECT' }); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', backgroundColor: '#fef2f2', color: '#b91c1c', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout title="Approvals" icon={ClipboardList}>
      {loading && !rows.length ? <PageSkeleton type="table" /> : (
        <>
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button type="button" onClick={() => setTab('pending')} style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: tab === 'pending' ? '2px solid var(--accent)' : '2px solid transparent', color: tab === 'pending' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Pending</button>
            <button type="button" onClick={() => setTab('completed')} style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: tab === 'completed' ? '2px solid var(--accent)' : '2px solid transparent', color: tab === 'completed' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> Completed</button>
          </div>
          <DataTable columns={columns} data={rows} loading={loading} searchPlaceholder="Search by document..." searchKeys={['documentNumber', 'documentType', 'status']} />
          {tab === 'pending' && rows[0]?.actions && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem' }}>Latest request history</h3>
              <DataTable
                columns={[
                  { header: 'When', accessor: 'createdAt', render: (row) => new Date(row.createdAt).toLocaleString() },
                  { header: 'Action', accessor: 'action' },
                  { header: 'Reason', accessor: 'reason' }
                ]}
                data={rows[0].actions}
                searchKeys={[]}
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
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            )}
          </ConfirmModal>
        </>
      )}
    </AppLayout>
  );
}
