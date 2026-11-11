import React, { useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
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
    <AppLayout title="Data import" icon={Upload}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <select value={entity} onChange={(event) => { setEntity(event.target.value); setErrors([]); }} style={{ height: 38, borderRadius: 8, border: '1px solid var(--border-color)', padding: '0 0.6rem', fontWeight: 650 }}>
          {ENTITIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <button type="button" onClick={() => download('csv')} style={button}><Download size={15} /> CSV template</button>
        <button type="button" onClick={() => download('xlsx')} style={button}><Download size={15} /> Excel template</button>
        <label style={{ ...button, background: 'var(--accent)', color: '#fff', border: 'none' }}>
          <Upload size={15} /> {busy ? 'Importing…' : 'Upload file'}
          <input type="file" accept=".csv,.xlsx,text/csv" hidden disabled={busy} onChange={upload} />
        </label>
      </div>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 0 }}>Invalid rows are listed and nothing from that file is saved. Opening stock creates FIFO layers and the opening balance in the ledger.</p>
      {errors.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr>
              {['Row', 'Field', 'Message'].map((heading) => <th key={heading} style={th}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {errors.map((error, index) => (
              <tr key={`${error.row}-${error.field}-${index}`}>
                <td style={td}>{error.row}</td>
                <td style={td}>{error.field}</td>
                <td style={td}>{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppLayout>
  );
}

const button = {
  height: 38, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', background: '#fff',
  fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
};
const th = { textAlign: 'left', fontSize: '0.75rem', color: '#64748b', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border-color)' };
const td = { padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' };
