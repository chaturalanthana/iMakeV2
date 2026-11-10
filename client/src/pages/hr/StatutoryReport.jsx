import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import { Landmark } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatutoryReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rates, setRates] = useState({ epfEmployeePercent: 8, epfEmployerPercent: 12, etfEmployerPercent: 3 });
  const [report, setReport] = useState({ employees: [], totals: {} });

  const load = async (nextMonth = month, nextYear = year) => {
    const res = await axios.get('/api/hr/statutory-report', { ...auth(), params: { month: nextMonth, year: nextYear } });
    setReport(res.data);
    setRates(res.data.rates);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const saveRates = async () => {
    const res = await axios.put('/api/hr/statutory-rates', rates, auth());
    setRates(res.data);
    await load();
  };

  const rows = (report.employees || []).map((row, index) => ({ ...row, id: `${row.runNumber}-${row.empCode}-${index}` }));
  const totals = report.totals || {};

  return (
    <AppLayout title="EPF and ETF" icon={Landmark}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}>
        <label style={label}>Month
          <select value={month} onChange={(event) => { const value = Number(event.target.value); setMonth(value); load(value, year); }} style={field}>
            {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </label>
        <label style={label}>Year
          <input value={year} onChange={(event) => setYear(event.target.value)} onBlur={() => load(month, year)} style={field} />
        </label>
        {[['Employee EPF %', 'epfEmployeePercent'], ['Employer EPF %', 'epfEmployerPercent'], ['ETF %', 'etfEmployerPercent']].map(([caption, key]) => (
          <label key={key} style={label}>{caption}
            <input value={rates[key]} onChange={(event) => setRates({ ...rates, [key]: event.target.value })} style={field} />
          </label>
        ))}
        <button type="button" onClick={saveRates} style={{ height: 36, padding: '0 0.8rem', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save rates</button>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[['EPF employee', totals.epfEmployee], ['EPF employer', totals.epfEmployer], ['EPF to remit', totals.epfTotal], ['ETF to remit', totals.etfEmployer]].map(([caption, value]) => (
          <div key={caption} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.8rem 1rem', minWidth: 140 }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{caption}</div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{money(value)}</div>
          </div>
        ))}
      </div>
      <DataTable
        columns={[
          { header: 'Employee', accessor: 'empCode' },
          { header: 'Name', accessor: 'name' },
          { header: 'Gross', accessor: 'gross', align: 'right', render: (row) => money(row.gross) },
          { header: 'EPF  employee', accessor: 'epfEmployee', align: 'right', render: (row) => money(row.epfEmployee) },
          { header: 'EPF employer', accessor: 'epfEmployer', align: 'right', render: (row) => money(row.epfEmployer) },
          { header: 'ETF', accessor: 'etfEmployer', align: 'right', render: (row) => money(row.etfEmployer) },
          { header: 'Net', accessor: 'netPay', align: 'right', render: (row) => money(row.netPay) }
        ]}
        data={rows}
        searchKeys={['empCode', 'name']}
        noDataMessage="No payroll for this month."
      />
    </AppLayout>
  );
}

const label = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748b' };
const field = { height: 36, border: '1px solid var(--border-color)', borderRadius: 8, padding: '0 8px', fontWeight: 650, color: '#1e293b' };
