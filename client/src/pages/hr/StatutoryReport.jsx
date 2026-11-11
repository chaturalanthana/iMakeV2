import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { SelectControl, TextControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import SummaryCard from '../../components/ui/SummaryCard';
import { Landmark } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatutoryReport() {
  const { showToast } = useToast();
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
    try {
      const res = await axios.put('/api/hr/statutory-rates', rates, auth());
      setRates(res.data);
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not save statutory rates', 'error');
    }
  };

  const rows = (report.employees || []).map((row, index) => ({ ...row, id: `${row.runNumber}-${row.empCode}-${index}` }));
  const totals = report.totals || {};

  return (
    <AppLayout title="EPF and ETF" icon={Landmark}>
      <FilterBar
        actions={(
          <ActionButton onClick={saveRates}>Save rates</ActionButton>
        )}
      >
        <FormField label="Month" width="180px">
          <SelectControl value={month} onChange={(event) => { const value = Number(event.target.value); setMonth(value); load(value, year); }}>
            {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Year" width="140px">
          <TextControl value={year} onChange={(event) => setYear(event.target.value)} onBlur={() => load(month, year)} />
        </FormField>
        <FormField label="Employee EPF %" width="160px">
          <TextControl value={rates.epfEmployeePercent} onChange={(event) => setRates({ ...rates, epfEmployeePercent: event.target.value })} />
        </FormField>
        <FormField label="Employer EPF %" width="160px">
          <TextControl value={rates.epfEmployerPercent} onChange={(event) => setRates({ ...rates, epfEmployerPercent: event.target.value })} />
        </FormField>
        <FormField label="ETF %" width="140px">
          <TextControl value={rates.etfEmployerPercent} onChange={(event) => setRates({ ...rates, etfEmployerPercent: event.target.value })} />
        </FormField>
      </FilterBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <SummaryCard label="EPF employee" value={money(totals.epfEmployee)} icon={Landmark} tone="blue" />
        <SummaryCard label="EPF employer" value={money(totals.epfEmployer)} icon={Landmark} tone="violet" />
        <SummaryCard label="EPF to remit" value={money(totals.epfTotal)} icon={Landmark} tone="green" />
        <SummaryCard label="ETF to remit" value={money(totals.etfEmployer)} icon={Landmark} tone="amber" />
      </div>
      <DataTable
        columns={[
          { header: 'Employee', accessor: 'empCode', fontWeight: 600 },
          { header: 'Name', accessor: 'name' },
          { header: 'Gross', accessor: 'gross', align: 'right', render: (row) => money(row.gross) },
          { header: 'EPF employee', accessor: 'epfEmployee', align: 'right', render: (row) => money(row.epfEmployee) },
          { header: 'EPF employer', accessor: 'epfEmployer', align: 'right', render: (row) => money(row.epfEmployer) },
          { header: 'ETF', accessor: 'etfEmployer', align: 'right', render: (row) => money(row.etfEmployer) },
          { header: 'Net', accessor: 'netPay', align: 'right', render: (row) => money(row.netPay) }
        ]}
        data={rows}
        searchKeys={['empCode', 'name']}
        searchPlaceholder="Search employees..."
        noDataMessage="No payroll for this month."
      />
    </AppLayout>
  );
}
