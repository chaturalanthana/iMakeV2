import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { Printer, Tag } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function Labels() {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState({ products: [], lots: [], workOrders: [] });
  const [picked, setPicked] = useState({ item: [], lot: [], 'work-order': [] });
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    axios.get('/api/labels/catalog', auth()).then((res) => setCatalog(res.data)).catch(() => showToast('Failed to load labels', 'error'));
  }, []);

  const toggle = (type, code) => {
    setPicked((current) => {
      const list = current[type].includes(code) ? current[type].filter((row) => row !== code) : [...current[type], code];
      return { ...current, [type]: list };
    });
  };

  const print = async () => {
    const jobs = [
      ['item', picked.item],
      ['lot', picked.lot],
      ['work-order', picked['work-order']]
    ].filter(([, codes]) => codes.length);
    if (!jobs.length) {
      showToast('Select at least one label', 'error');
      return;
    }
    try {
      const batches = await Promise.all(jobs.map(([type, codes]) => axios.post('/api/labels/render', { type, codes }, auth())));
      setLabels(batches.flatMap((res) => res.data.labels));
      setTimeout(() => window.print(), 200);
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not print labels', 'error');
    }
  };

  const column = (title, type, rows, labelOf) => (
    <div style={{ flex: 1, minWidth: 240 }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{title}</h3>
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, background: '#fff' }}>
        {rows.length === 0 && <div style={{ padding: '0.8rem', color: '#64748b' }}>None yet.</div>}
        {rows.map((row) => {
          const code = labelOf(row).code;
          return (
            <label key={code} style={{ display: 'flex', gap: 8, padding: '0.45rem 0.7rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={picked[type].includes(code)} onChange={() => toggle(type, code)} />
              <span><strong>{labelOf(row).title}</strong><br />{labelOf(row).subtitle}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <AppLayout title="Labels" icon={Tag}>
      <button type="button" onClick={print} style={{ height: 36, marginBottom: '0.8rem', padding: '0 0.9rem', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Printer size={15} /> Print selected
      </button>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {column('Items', 'item', catalog.products, (row) => ({ code: row.code, title: row.code, subtitle: row.name }))}
        {column('Lots', 'lot', catalog.lots, (row) => ({ code: row.code, title: row.lotNumber, subtitle: row.productCode }))}
        {column('Work orders', 'work-order', catalog.workOrders, (row) => ({ code: row.orderNumber, title: row.orderNumber, subtitle: row.product?.code || row.status }))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {labels.map((label) => (
          <div key={label.payload} style={{ width: 240, border: '1px solid #000', padding: '0.75rem', background: '#fff', color: '#000' }}>
            <div style={{ fontWeight: 800 }}>{label.title}</div>
            <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>{label.subtitle}</div>
            <div dangerouslySetInnerHTML={{ __html: label.qrSvg }} />
            {label.barcodeSvg && <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: label.barcodeSvg }} />}
            <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: '0.85rem' }}>{label.payload}</div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
