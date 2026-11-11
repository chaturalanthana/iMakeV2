import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import { Boxes, Play, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function Replenishment() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [run, setRun] = useState(null);
  const [daily, setDaily] = useState(false);
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [reorderPoint, setReorderPoint] = useState('0');
  const [minQty, setMinQty] = useState('0');
  const [maxQty, setMaxQty] = useState('0');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [policyRes, currentRes, productRes, warehouseRes] = await Promise.all([
      axios.get('/api/replenishment/policies', auth()),
      axios.get('/api/replenishment/settings', auth()),
      axios.get('/api/products', auth()),
      axios.get('/api/warehouses', auth())
    ]);
    setPolicies(policyRes.data);
    setRun(currentRes.data.run);
    setDaily(Boolean(currentRes.data.settings?.replenishDaily));
    setProducts(productRes.data);
    setWarehouses(warehouseRes.data);
  };

  useEffect(() => {
    load().catch(() => showToast('Failed to load replenishment', 'error'));
  }, []);

  const savePolicy = async (event) => {
    event.preventDefault();
    try {
      await axios.post('/api/replenishment/policies', {
        productId, warehouseId, reorderPoint, minQty, maxQty
      }, auth());
      setProductId('');
      setProductName('');
      setReorderPoint('0');
      setMinQty('0');
      setMaxQty('0');
      await load();
      showToast('Reorder policy saved', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not save the policy', 'error');
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const res = await axios.post('/api/replenishment/run', {}, auth());
      setRun(res.data);
      showToast(res.data.message, 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Replenishment failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      const res = await axios.post('/api/replenishment/approve', {}, auth());
      showToast(res.data.message, 'success');
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleDaily = async (checked) => {
    setDaily(checked);
    try {
      await axios.put('/api/replenishment/settings', { replenishDaily: checked }, auth());
    } catch (error) {
      setDaily(!checked);
      showToast('Could not save the schedule', 'error');
    }
  };

  const lines = (run?.lines || []).map((line) => ({ ...line, id: line.id }));

  return (
    <AppLayout title="Replenishment" icon={Boxes}>
      <form onSubmit={savePolicy} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}>
        <div style={{ width: 240 }}>
          <ProductSearchDropdown products={products} value={productName} onChange={(product) => { setProductId(product.id); setProductName(product.name); }} placeholder="Item" />
        </div>
        <div style={{ width: 220 }}>
          <WarehouseSearchDropdown warehouses={warehouses} value={warehouseName} onChange={(name, row) => { setWarehouseName(name); setWarehouseId(row?.id || ''); }} placeholder="Warehouse" />
        </div>
        {[['Reorder', reorderPoint, setReorderPoint], ['Min', minQty, setMinQty], ['Max', maxQty, setMaxQty]].map(([label, value, setter]) => (
          <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
            {label}
            <input value={value} onChange={(event) => setter(event.target.value)} inputMode="decimal" style={{ width: 90, height: 38, border: '1px solid var(--border-color)', borderRadius: 8, padding: '0 8px' }} />
          </label>
        ))}
        <button type="submit" style={{ height: 38, padding: '0 0.9rem', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save policy</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 650, marginLeft: 'auto' }}>
          <input type="checkbox" checked={daily} onChange={(event) => toggleDaily(event.target.checked)} />
          Run daily
        </label>
      </form>

      <DataTable
        columns={[
          { header: 'Item', accessor: 'code' },
          { header: 'Name', accessor: 'name' },
          { header: 'Warehouse', accessor: 'warehouse' },
          { header: 'Reorder', accessor: 'reorderPoint', align: 'right' },
          { header: 'Min', accessor: 'minQty', align: 'right' },
          { header: 'Max', accessor: 'maxQty', align: 'right' }
        ]}
        data={policies}
        searchKeys={['code', 'name', 'warehouse']}
        searchPlaceholder="Search policies"
        noDataMessage="No reorder policies yet."
      />

      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
        <button type="button" onClick={runNow} disabled={busy} style={{ height: 36, padding: '0 0.9rem', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Play size={14} /> Run
        </button>
        <button type="button" onClick={approve} disabled={busy || run?.status !== 'DRAFT' || !lines.length} style={{ height: 36, padding: '0 0.9rem', border: 'none', borderRadius: 8, background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} /> Approve drafts
        </button>
        {run && <span style={{ alignSelf: 'center', color: '#64748b', fontSize: '0.85rem' }}>{run.runNumber} · {run.status} · {run.message}</span>}
      </div>

      <DataTable
        columns={[
          { header: 'Item', accessor: 'code' },
          { header: 'Name', accessor: 'name' },
          { header: 'Action', accessor: 'kind' },
          { header: 'Qty', accessor: 'quantity', align: 'right' },
          { header: 'Why', accessor: 'reason' },
          { header: 'Min/max', accessor: 'minMaxQty', align: 'right' },
          { header: 'MRP', accessor: 'mrpQty', align: 'right' }
        ]}
        data={lines}
        searchKeys={['code', 'name', 'kind', 'reason']}
        searchPlaceholder="Search suggestions"
        noDataMessage="Run replenishment to draft purchase requisitions and work orders."
      />
    </AppLayout>
  );
}
