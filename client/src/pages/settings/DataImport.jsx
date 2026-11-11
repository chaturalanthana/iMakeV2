import React, { useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { SelectControl } from '../../components/ui/FormField';
import ActionButton, { actionButtonStyle } from '../../components/ui/ActionButton';
import Section from '../../components/ui/Section';
import { Upload, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ENTITIES = [
  ['products', 'Products'],
  ['customers', 'Customers'],
  ['suppliers', 'Suppliers'],
  ['boms', 'Bills of materials'],
  ['workstations', 'Workstations'],
  ['opening-stock', 'Opening stock'],
  ['opening-ar', 'Opening receivables'],
  ['opening-ap', 'Opening payables']
];

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function DataImport() {
  const { showToast } = useToast();
  const [entity, setEntity] = useState('products');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const download = async (format) => {
    try {
      const res = await axios.get(`/api/imports/${entity}/template`, { ...auth(), params: { format }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${entity}-template.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast('Could not download the template', 'error');
    }
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setErrors([]);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await axios.post(`/api/imports/${entity}`, body, auth());
      showToast(`Imported ${res.data.created} row${res.data.created === 1 ? '' : 's'}`, 'success');
    } catch (error) {
      const rows = error.response?.data?.errors || [];
      setErrors(rows);
      showToast(error.response?.data?.error || 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout title="Data Import" icon={Upload}>
      <FilterBar
        actions={(
          <>
            <ActionButton variant="secondary" icon={Download} onClick={() => download('csv')}>CSV template</ActionButton>
            <ActionButton variant="secondary" icon={Download} onClick={() => download('xlsx')}>Excel template</ActionButton>
            <label style={actionButtonStyle('primary', busy, { cursor: busy ? 'not-allowed' : 'pointer' })}>
              <Upload size={16} /> {busy ? 'Importing…' : 'Upload file'}
              <input type="file" accept=".csv,.xlsx,text/csv" hidden disabled={busy} onChange={upload} />
            </label>
          </>
        )}
      >
        <FormField label="Import" width="260px">
          <SelectControl value={entity} onChange={(event) => { setEntity(event.target.value); setErrors([]); }}>
            {ENTITIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </SelectControl>
        </FormField>
      </FilterBar>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0, marginBottom: '1.25rem' }}>
        Invalid rows are listed and nothing from that file is saved. Opening stock creates FIFO layers and the opening balance in the ledger.
      </p>
      {errors.length > 0 && (
        <Section title="Rows that failed">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((row, index) => (
                  <tr key={`${row.row}-${row.field}-${index}`}>
                    <td>{row.row}</td>
                    <td style={{ fontWeight: 600 }}>{row.field}</td>
                    <td><span className="field-error-text" style={{ marginTop: 0 }}>{row.message}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </AppLayout>
  );
}
