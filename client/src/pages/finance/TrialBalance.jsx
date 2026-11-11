import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Scale, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalance() {
  const { showToast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/finance/trial-balance', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then((res) => setReport(res.data))
      .catch(() => showToast('Could not load the trial balance', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AppLayout title="Trial balance" icon={Scale}><PageSkeleton /></AppLayout>;
  }

  const rows = report?.accounts || [];
  const balanced = Boolean(report?.balanced);

  return (
    <AppLayout title="Trial balance" icon={Scale}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          padding: '0.7rem 1rem', borderRadius: 10, fontWeight: 750,
          background: balanced ? '#ecfdf5' : '#fef2f2',
          color: balanced ? '#047857' : '#b91c1c',
          border: `1px solid ${balanced ? '#a7f3d0' : '#fecaca'}`
        }}>
          {balanced ? 'Debits equal credits' : 'Out of balance'} · Debit {money(report?.debit)} · Credit {money(report?.credit)}
        </div>
        <button type="button" onClick={() => window.print()} style={{ height: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', background: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Printer size={15} /> Print
        </button>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Code', 'Account', 'Type', 'Debit', 'Credit'].map((heading) => (
                <th key={heading} style={{ textAlign: heading === 'Debit' || heading === 'Credit' ? 'right' : 'left', padding: '0.6rem 1rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid var(--border-color)' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', color: '#64748b' }}>No posted journals yet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.accountId}>
                <td style={cell}>{row.code}</td>
                <td style={cell}>{row.name}</td>
                <td style={cell}>{row.type}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{money(row.debit)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{money(row.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

const cell = { padding: '0.55rem 1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' };
