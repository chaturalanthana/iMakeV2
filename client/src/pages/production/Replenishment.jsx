import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { TextControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
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
    setProducts(productRes.data.filter((product) => product.type !== 'SERVICE' && product.activeStatus !== 'INACTIVE' && !product.bomApplicable));
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
      <form onSubmit={savePolicy}>
        <FilterBar
          actions={(
            <>
              <ActionButton type="submit">Save policy</ActionButton>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', height: '42px' }}>
                <input type="checkbox" checked={daily} onChange={(event) => toggleDaily(event.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                Run daily
              </label>
            </>
          )}
        >
          <FormField label="Item" width="260px">
            <ProductSearchDropdown
              products={products}
              value={productName}
              onChange={(product) => { setProductId(product.id); setProductName(product.name); }}
              placeholder="Search product..."
              style={{ wrapper: { width: '100%' }, input: { height: '42px', padding: '0 1rem', border: '1px solid #e2e8f0', borderRadius: '8px' } }}
            />
          </FormField>
          <FormField label="Warehouse" width="240px">
            <WarehouseSearchDropdown
              warehouses={warehouses}
              value={warehouseName}
              onChange={(name, row) => { setWarehouseName(name); setWarehouseId(row?.id || ''); }}
              placeholder="All Warehouses"
              style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
            />
          </FormField>
          <FormField label="Reorder" width="110px">
            <TextControl value={reorderPoint} onChange={(event) => setReorderPoint(event.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Min" width="110px">
            <TextControl value={minQty} onChange={(event) => setMinQty(event.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Max" width="110px">
            <TextControl value={maxQty} onChange={(event) => setMaxQty(event.target.value)} inputMode="decimal" />
          </FormField>
        </FilterBar>
      </form>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
        Bought items only. Made items are planned in MRP Shortage Planner.
      </p>

      <DataTable
        columns={[
          { header: 'Item', accessor: 'code', fontWeight: 600 },
          { header: 'Name', accessor: 'name' },
          { header: 'Warehouse', accessor: 'warehouse' },
          { header: 'Reorder', accessor: 'reorderPoint', align: 'right' },
          { header: 'Min', accessor: 'minQty', align: 'right' },
          { header: 'Max', accessor: 'maxQty', align: 'right' }
        ]}
        data={policies}
        searchKeys={['code', 'name', 'warehouse']}
        searchPlaceholder="Search policies..."
        noDataMessage="No reorder policies yet."
      />

      <div style={{ display: 'flex', gap: '0.75rem', margin: '1.5rem 0 1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <ActionButton icon={Play} onClick={runNow} disabled={busy}>Run</ActionButton>
        <ActionButton icon={Check} onClick={approve} disabled={busy || run?.status !== 'DRAFT' || !lines.length} style={{ background: '#15803d' }}>
          Approve drafts
        </ActionButton>
        {run && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {run.runNumber} · <StatusBadge status={run.status} /> · {run.message}
          </span>
        )}
      </div>

      <DataTable
        columns={[
          { header: 'Item', accessor: 'code', fontWeight: 600 },
          { header: 'Name', accessor: 'name' },
          { header: 'Qty', accessor: 'quantity', align: 'right' },
          { header: 'Why', accessor: 'reason' },
          { header: 'Min/max', accessor: 'minMaxQty', align: 'right' },
          { header: 'MRP', accessor: 'mrpQty', align: 'right' }
        ]}
        data={lines}
        searchKeys={['code', 'name', 'reason']}
        searchPlaceholder="Search suggestions..."
        noDataMessage="Run replenishment to draft purchase requisitions."
      />
    </AppLayout>
  );
}
