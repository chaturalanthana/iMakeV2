import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import PageSkeleton from '../../components/ui/PageSkeleton';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import { useToast } from '../../context/ToastContext';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function FiscalPeriods() {
  const { showToast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState([]);
  const [allowNegative, setAllowNegative] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (nextYear = year) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/controls/periods', { ...auth(), params: { year: nextYear } });
      setPeriods(res.data.periods || []);
      setAllowNegative(Boolean(res.data.allowNegativeStock));
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not load periods', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(year); }, [year]);

  const setStatus = async (period, status) => {
    try {
      await axios.put('/api/controls/periods', { year: period.year, month: period.month, status }, auth());
      showToast('Period updated', 'success');
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not update the period', 'error');
    }
  };

  const saveStock = async (value) => {
    setAllowNegative(value);
    try {
      await axios.put('/api/controls/stock', { allowNegativeStock: value }, auth());
      showToast('Stock setting saved', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not save the setting', 'error');
      setAllowNegative(!value);
    }
  };

  return (
    <AppLayout title="Fiscal periods" icon={CalendarDays}>
      {loading ? <PageSkeleton type="table" /> : (
        <>
          <FilterBar variant="card">
            <FormField label="Year" icon={CalendarDays} width="160px">
              <TextControl type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </FormField>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, height: '42px' }}>
              <input type="checkbox" checked={allowNegative} onChange={(e) => saveStock(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
              Allow negative stock
            </label>
          </FilterBar>
          <DataTable
            columns={[
              { header: 'Period', accessor: 'month', fontWeight: 600, render: (row) => `${MONTHS[row.month - 1]} ${row.year}` },
              { header: 'Status', accessor: 'status', render: (row) => (
                <SelectControl value={row.status} onClick={(e) => e.stopPropagation()} onChange={(e) => setStatus(row, e.target.value)} style={{ width: '160px' }}>
                  <option value="OPEN">Open</option>
                  <option value="SOFT_CLOSED">Soft-closed</option>
                  <option value="CLOSED">Closed</option>
                </SelectControl>
              ) }
            ]}
            data={periods}
            searchKeys={['status']}
            searchPlaceholder="Search status..."
            noDataMessage="No periods for this year."
          />
        </>
      )}
    </AppLayout>
  );
}
