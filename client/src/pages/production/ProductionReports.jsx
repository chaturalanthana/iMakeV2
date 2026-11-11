import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { BarChart2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const REPORTS = [
  { key: 'variance', label: 'Cost variance' },
  { key: 'wip', label: 'WIP valuation' },
  { key: 'yield', label: 'Machine yield' },
  { key: 'genealogy', label: 'Batch genealogy' }
];

export default function ProductionReports() {
  const { showToast } = useToast();
  const [key, setKey] = useState('variance');
  const [report, setReport] = useState(null);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const load = async (next = key) => {
    try {
      const res = await axios.get(`/api/production/reports/${next}`, authConfig());
      setReport(res.data);
      setKey(next);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to load the report', 'error');
    }
  };

  useEffect(() => { load('variance'); }, []);

  const download = async (format) => {
    try {
      const res = await axios.get(`/api/production/reports/${key}`, {
        ...authConfig(),
        params: { format },
        responseType: format === 'xlsx' ? 'blob' : 'text'
      });
      const blob = format === 'xlsx'
        ? res.data
        : new Blob([res.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'xlsx' ? `${key}.xlsx` : `${key}.html`;
      if (format === 'html') window.open(url, '_blank');
      else link.click();
    } catch (error) {
      showToast('Failed to export the report', 'error');
    }
  };

  return (
    <AppLayout title="Production Reports" icon={BarChart2}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {REPORTS.map((item) => (
          <button key={item.key} type="button" onClick={() => load(item.key)} style={{ height: '32px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: key === item.key ? 'var(--accent)' : '#fff', color: key === item.key ? '#fff' : '#1e293b', fontWeight: 700, cursor: 'pointer' }}>
            {item.label}
          </button>
        ))}
        <button type="button" onClick={() => download('xlsx')} style={{ height: '32px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Excel</button>
        <button type="button" onClick={() => download('html')} style={{ height: '32px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Print</button>
      </div>
      {report && (
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'auto' }}>
          <div style={{ padding: '0.8rem 1rem', fontWeight: 800 }}>{report.title}</div>
          <div style={{ padding: '0 1rem 0.6rem', color: '#64748b', fontSize: '0.8rem' }}>{report.note}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', height: '36px' }}>
                {report.columns.map((column) => <th key={column.key} style={{ padding: '0 0.6rem' }}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(report.rows || []).map((row, index) => (
                <tr key={index} style={{ borderTop: '1px solid #f1f5f9', height: '40px' }}>
                  {report.columns.map((column) => <td key={column.key} style={{ padding: '0 0.6rem' }}>{row[column.key] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
