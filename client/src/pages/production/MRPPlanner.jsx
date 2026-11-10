import React, { useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import { Boxes, Play, ShoppingCart, Factory } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const qty = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const numberCol = (header, accessor) => ({
  header,
  accessor,
  align: 'right',
  render: (row) => qty(row[accessor])
});

export default function MRPPlanner() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [tab, setTab] = useState('buy');
  const [data, setData] = useState({ purchaseSuggestions: [], productionSuggestions: [] });

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const runMRP = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/mrp/plan', {}, authConfig());
      setData(res.data);
      setRan(true);
      showToast(res.data.message || 'MRP run completed', 'success');
    } catch (err) {
      showToast('Failed to run MRP planner analysis', 'error');
    } finally {
      setLoading(false);
    }
  };

  const buyRows = (data.purchaseSuggestions || []).map((row) => ({ ...row, id: row.productId }));
  const makeRows = (data.productionSuggestions || []).map((row) => ({ ...row, id: row.productId }));
  const rows = tab === 'buy' ? buyRows : makeRows;
  const refColor = tab === 'buy' ? '#0369a1' : '#15803d';

  const columns = [
    { header: 'Code', accessor: 'code', fontWeight: 700 },
    { header: 'Product', accessor: 'name' },
    numberCol('Demand', 'grossDemand'),
    numberCol('Stock', 'currentStock'),
    numberCol('Safety', 'safetyStock'),
    {
      header: 'Shortage',
      accessor: 'shortage',
      align: 'right',
      render: (row) => <span style={{ color: '#dc2626', fontWeight: 700 }}>{qty(row.shortage)}</span>
    },
    {
      header: 'Ref',
      accessor: 'documentNumber',
      render: (row) => <span style={{ fontWeight: 700, color: refColor }}>{row.documentNumber || ''}</span>
    }
  ];

  const tabButton = (id, Icon, label, count, color) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          height: '32px',
          padding: '0 0.75rem',
          border: 'none',
          borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
          background: 'transparent',
          color: active ? color : '#94a3b8',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        <Icon size={15} />
        {label}
        <span style={{ fontWeight: 800 }}>{ran ? count : '—'}</span>
      </button>
    );
  };

  return (
    <AppLayout title="MRP Shortage Planner" icon={Boxes}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.65rem' }}>
        <button
          type="button"
          onClick={runMRP}
          disabled={loading}
          title="Run"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '32px', padding: '0 0.75rem', marginRight: '0.35rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
        >
          <Play size={14} fill="#fff" /> {loading ? '…' : 'Run'}
        </button>
        {tabButton('buy', ShoppingCart, 'Buy', buyRows.length, '#0369a1')}
        {tabButton('make', Factory, 'Make', makeRows.length, '#15803d')}
      </div>

      {ran && (
        <DataTable
          key={tab}
          columns={columns}
          data={rows}
          searchKeys={['code', 'name', 'documentNumber']}
          searchPlaceholder="Search"
          itemsPerPage={25}
          noDataMessage=""
        />
      )}
    </AppLayout>
  );
}
