import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import FilterBar from '../../components/ui/FilterBar';
import ActionButton from '../../components/ui/ActionButton';
import SummaryCard from '../../components/ui/SummaryCard';
import Section, { EmptyState } from '../../components/ui/Section';
import ExportButton from '../../components/ui/ExportButton';
import { Scale, Printer, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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
    return <AppLayout title="Trial Balance" icon={Scale}><PageSkeleton /></AppLayout>;
  }

  const rows = report?.accounts || [];
  const balanced = Boolean(report?.balanced);

  return (
    <AppLayout title="Trial Balance" icon={Scale}>
      <FilterBar
        variant="inline"
        actions={(
          <>
            <ExportButton url="/api/finance/trial-balance" filename="trial-balance.xlsx" />
            <ActionButton variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print Report
            </ActionButton>
          </>
        )}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: balanced ? '#16a34a' : '#dc2626' }}>
          {balanced ? 'Debits equal credits' : 'Out of balance'}
        </span>
      </FilterBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <SummaryCard label="Total debit" value={money(report?.debit)} icon={ArrowUpRight} tone="blue" />
        <SummaryCard label="Total credit" value={money(report?.credit)} icon={ArrowDownLeft} tone={balanced ? 'green' : 'red'} valueColor={balanced ? '#1e293b' : '#dc2626'} />
      </div>
      <Section>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5}><EmptyState>No posted journals yet.</EmptyState></td></tr>
              ) : rows.map((row) => (
                <tr key={row.accountId}>
                  <td style={{ fontWeight: 500 }}>{row.code}</td>
                  <td>{row.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{row.type}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(row.debit)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(row.credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </AppLayout>
  );
}
