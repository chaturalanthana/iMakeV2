import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';

export const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export function useApiList(url) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(url, authConfig());
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setInitial(false);
    }
  };
  useEffect(() => { load(); }, [url]);
  return { rows, loading, initial, reload: load };
}

export function useLookups() {
  const [data, setData] = useState({
    suppliers: [], products: [], customers: [], accounts: [], projects: [],
    grns: [], classes: [], centers: [], funds: [], assets: []
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const config = authConfig();
    Promise.all([
      axios.get('/api/suppliers', config),
      axios.get('/api/products', config),
      axios.get('/api/customers', config),
      axios.get('/api/finance/accounts', config),
      axios.get('/api/phase2/projects', config),
      axios.get('/api/procurement/grn', config),
      axios.get('/api/phase2/asset-classes', config),
      axios.get('/api/phase2/centers', config),
      axios.get('/api/phase2/petty-cash', config),
      axios.get('/api/phase2/assets', config)
    ]).then(([suppliers, products, customers, accounts, projects, grns, classes, centers, funds, assets]) => {
      setData({
        suppliers: suppliers.data || [],
        products: products.data || [],
        customers: customers.data || [],
        accounts: accounts.data || [],
        projects: projects.data || [],
        grns: grns.data || [],
        classes: classes.data || [],
        centers: centers.data || [],
        funds: funds.data || [],
        assets: assets.data || []
      });
    }).finally(() => setReady(true));
  }, []);
  return { ...data, ready };
}

export function namedOptions(rows, label) {
  return (rows || []).map((row) => ({ value: row.id, label: label(row) }));
}

export function applyServerErrors(error, showToast, setFieldErrors) {
  const fields = error.response?.data?.fields || {};
  if (setFieldErrors) setFieldErrors(fields);
  showToast(error.response?.data?.error || 'Could not save.', 'error');
}

export function validateFields(defs, values) {
  const errors = {};
  defs.forEach((field) => {
    const value = values[field.name];
    if (field.required && !String(value || '').trim()) errors[field.name] = `${field.label} is required.`;
    if (field.positive && value !== undefined && value !== '' && !(Number(value) > 0)) {
      errors[field.name] = `${field.label} must be greater than zero.`;
    }
  });
  return errors;
}

export function LineTable({ columns, rows, onChange, onAdd, onRemove }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff', overflowX: 'auto' }}>
      <table className="spreadsheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <tr style={{ height: '2.25rem' }}>
            <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
            {columns.map((column) => (
              <th key={column.key} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{column.label}</th>
            ))}
            <th style={{ width: '50px' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} style={{ height: '2.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.25rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
              {columns.map((column) => (
                <td key={column.key} className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {column.options ? (
                    <select className="spreadsheet-input" value={row[column.key] || ''} onChange={(event) => onChange(row.id, column.key, event.target.value)}>
                      <option value="">Select</option>
                      {column.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input className="spreadsheet-input" type={column.type || 'text'} value={row[column.key] ?? ''} placeholder={column.placeholder || ''} onChange={(event) => onChange(row.id, column.key, event.target.value)} style={{ textAlign: column.type === 'number' ? 'right' : 'left' }} />
                  )}
                </td>
              ))}
              <td style={{ textAlign: 'center' }}>
                <button type="button" onClick={() => onRemove(row.id)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}>
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td />
            <td colSpan={columns.length} style={{ padding: '0.75rem 1rem' }}>
              <button type="button" onClick={onAdd} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Add new line
              </button>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
