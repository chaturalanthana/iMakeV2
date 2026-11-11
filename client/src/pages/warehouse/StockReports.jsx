import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import { Package, Search, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const REPORTS = [
  { id: 'position', label: 'Stock position', path: '/api/inventory/positions' },
  { id: 'movement', label: 'Movement and valuation', path: '/api/inventory/reports/movement' },
  { id: 'aging', label: 'Aging', path: '/api/inventory/reports/aging' },
  { id: 'trace', label: 'Batch trace', path: '/api/inventory/trace' }
];

export default function StockReports() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('position');
  const [rows, setRows] = useState([]);
  const [trace, setTrace] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lot, setLot] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setWarehouses(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (report === 'trace' && !lot) {
      setTrace(null);
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const params = {};
        if (warehouseId && report !== 'trace') params.warehouseId = warehouseId;
        if (report === 'trace') params.lotNumber = lot;
        const res = await axios.get(REPORTS.find((item) => item.id === report).path, {
          headers: { Authorization: `Bearer ${token}` },
          params
        });
        if (report === 'trace') setTrace(res.data);
        else setRows(res.data || []);
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to load the report', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [report, warehouseId, lot]);

  const filtered = rows.filter((row) => {
    const blob = `${row.code || ''} ${row.name || ''} ${row.lotNumber || ''}`.toLowerCase();
    return blob.includes(searchQuery.toLowerCase());
  });

  return (
    <AppLayout title="Stock Reports" icon={Package}>
      {loading ? <PageSkeleton /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <FilterBar actions={<ActionButton variant="secondary" icon={Download} onClick={() => window.print()}>Export</ActionButton>}>
            <FormField label="Report" icon={Search} width="220px">
              <SelectControl value={report} onChange={(e) => setReport(e.target.value)}>
                {REPORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </SelectControl>
            </FormField>
            <FormField label={report === 'trace' ? 'Lot number' : 'Search'} icon={Search} width="280px">
              <TextControl
                value={report === 'trace' ? lot : searchQuery}
                onChange={(e) => report === 'trace' ? setLot(e.target.value) : setSearchQuery(e.target.value)}
                placeholder={report === 'trace' ? 'Lot number' : 'Search by name or code...'}
              />
            </FormField>
            {report !== 'trace' && (
              <FormField label="Warehouse" width="250px">
                <WarehouseSearchDropdown
                  warehouses={warehouses}
                  value={warehouseName}
                  onChange={(name, wh) => { setWarehouseName(name); setWarehouseId(wh?.id || ''); }}
                  placeholder="All Warehouses"
                  style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                />
              </FormField>
            )}
          </FilterBar>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ overflowX: 'auto' }}>
              {report === 'trace' ? <TraceTable trace={trace} /> : <Grid rows={filtered} report={report} />}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Grid({ rows, report }) {
  const columns = report === 'movement'
    ? [['Code', 'code'], ['Item', 'name'], ['UOM', 'uom'], ['Opening', 'opening'], ['Received', 'received'], ['Issued', 'issued'], ['Closing', 'closing'], ['Value', 'totalValue']]
    : report === 'aging'
      ? [['Code', 'code'], ['Item', 'name'], ['Qty', 'qty'], ['Value', 'value'], ['0-30', 'd0'], ['31-90', 'd31'], ['91-180', 'd91'], ['180+', 'd180']]
      : [['Code', 'code'], ['Item', 'name'], ['On hand', 'onHand'], ['Available', 'available'], ['Reserved', 'reserved'], ['Soft', 'soft'], ['Blocked', 'blocked'], ['In transit', 'inTransit'], ['Value', 'value']];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
      <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <tr>
          {columns.map(([label]) => (
            <th key={label} style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No products found matching your search.</td></tr>
        ) : rows.map((row) => (
          <tr key={row.productId || row.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
            {columns.map(([label, key]) => (
              <td key={label} style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: key === 'code' ? 700 : 500 }}>{format(row[key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TraceTable({ trace }) {
  if (!trace) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Enter a lot number.</div>;
  }
  const lines = [
    ...(trace.whereFrom || []).map((row) => ({ ...row, side: 'Where from' })),
    ...(trace.whereUsed || []).map((row) => ({ ...row, side: 'Where used' }))
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
      <thead style={{ backgroundColor: '#f8fafc' }}>
        <tr>
          {['Side', 'Type', 'Qty', 'Warehouse', 'Reference'].map((label) => (
            <th key={label} style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((row) => (
          <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '1rem' }}>{row.side}</td>
            <td style={{ padding: '1rem' }}>{row.type}</td>
            <td style={{ padding: '1rem' }}>{row.quantity}</td>
            <td style={{ padding: '1rem' }}>{row.warehouse || '-'}</td>
            <td style={{ padding: '1rem' }}>{row.referenceType}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function format(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value;
}

