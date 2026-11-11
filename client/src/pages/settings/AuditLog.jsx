import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import ExportButton from '../../components/ui/ExportButton';
import { useToast } from '../../context/ToastContext';

const field = { height: '38px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: '#fff', padding: '0 12px' };

export default function AuditLog() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 15;

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/audit', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { page: nextPage, pageSize, q: q || undefined, entity: entity || undefined, action: action || undefined }
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || nextPage);
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not load the audit log', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [entity, action]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;

  return (
    <AppLayout title="Audit log" icon={ScrollText}>
      {loading && !rows.length ? <PageSkeleton /> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} placeholder="Search action, entity, or id..." style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', height: '38px', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', backgroundColor: '#fff', boxSizing: 'border-box' }} />
              </div>
              <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Entity" style={{ ...field, width: '140px' }} />
              <select value={action} onChange={(e) => setAction(e.target.value)} style={{ ...field }}>
                <option value="">All actions</option>
                {['CREATE', 'UPDATE', 'DELETE', 'STATUS', 'POST', 'APPROVE', 'REVERSE'].map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <ExportButton url="/api/audit" filename="audit-log.xlsx" params={{ q, entity, action }} />
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['When', 'Action', 'Entity', 'Record', 'Change'].map((header) => (
                    <th key={header} style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No audit entries found.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{new Date(row.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>{row.action}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{row.entity}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{row.entityId}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{JSON.stringify(row.after || {})}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="5" style={{ padding: '0' }}>
                    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Showing {start} to {Math.min(page * pageSize, total)} of {total} entries</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button type="button" onClick={() => load(page - 1)} disabled={page === 1} style={{ padding: '5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: page === 1 ? '#f8fafc' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={18} /></button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.5rem' }}>Page {page} of {pages}</span>
                        <button type="button" onClick={() => load(page + 1)} disabled={page >= pages} style={{ padding: '5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: page >= pages ? '#f8fafc' : '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer' }}><ChevronRight size={18} /></button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
