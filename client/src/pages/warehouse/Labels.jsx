import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import FilterBar from '../../components/ui/FilterBar';
import ActionButton from '../../components/ui/ActionButton';
import Section, { EmptyState } from '../../components/ui/Section';
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
    <Section title={title} style={{ flex: '1 1 260px', marginBottom: 0, minWidth: 240 }}>
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        {rows.length === 0 && <EmptyState>None yet.</EmptyState>}
        {rows.map((row) => {
          const label = labelOf(row);
          return (
            <label key={label.code} style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={picked[type].includes(label.code)}
                onChange={() => toggle(type, label.code)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span>
                <strong style={{ fontWeight: 600 }}>{label.title}</strong>
                <br />
                <span style={{ color: 'var(--text-muted)' }}>{label.subtitle}</span>
              </span>
            </label>
          );
        })}
      </div>
    </Section>
  );

  return (
    <AppLayout title="Labels" icon={Tag}>
      <FilterBar
        variant="inline"
        actions={(
          <ActionButton icon={Printer} onClick={print}>Print selected</ActionButton>
        )}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Select items, lots, or work orders
        </span>
      </FilterBar>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        {column('Items', 'item', catalog.products, (row) => ({ code: row.code, title: row.code, subtitle: row.name }))}
        {column('Lots', 'lot', catalog.lots, (row) => ({ code: row.code, title: row.lotNumber, subtitle: row.productCode }))}
        {column('Work orders', 'work-order', catalog.workOrders, (row) => ({ code: row.orderNumber, title: row.orderNumber, subtitle: row.product?.code || row.status }))}
      </div>
      {labels.length > 0 && (
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
      )}
    </AppLayout>
  );
}
