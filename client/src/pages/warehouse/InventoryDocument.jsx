import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ArrowLeft, Plus, Trash2, Save, CheckCircle, Calendar, FileText, Package, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const CONFIG = {
  mr: {
    icon: Package,
    list: '/warehouse/material-requests',
    title: 'Material Request',
    code: 'MR',
    subtitle: 'Request an issue or a transfer',
    confirm: 'Submit Request',
    endpoint: '/api/inventory/material-requests'
  },
  transfer: {
    icon: Package,
    list: '/warehouse/goods-transfers',
    title: 'Goods Transfer',
    code: 'GT',
    subtitle: 'Move stock between warehouses',
    confirm: 'Ship Transfer',
    endpoint: '/api/inventory/transfers'
  },
  return: {
    icon: Package,
    list: '/warehouse/returns',
    title: 'Stock Return',
    code: 'RTN',
    subtitle: 'Customer return or return to supplier',
    confirm: 'Post Return',
    endpoint: '/api/inventory/returns'
  },
  count: {
    icon: Package,
    list: '/warehouse/cycle-counts',
    title: 'Cycle Count',
    code: 'CC',
    subtitle: 'Count stock. Finance approves the variance.',
    confirm: 'Save Count',
    endpoint: '/api/inventory/cycle-counts'
  },
  receipt: {
    icon: Package,
    list: '/warehouse/batch-receipts',
    title: 'Batch Receipt',
    code: 'GR',
    subtitle: 'Receive a lot, including damaged quantity',
    confirm: 'Post Receipt',
    endpoint: '/api/inventory/receipts'
  }
};

const fieldLabel = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
};

const textInput = {
  width: '100%',
  height: '42px',
  padding: '0 1rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  outline: 'none',
  fontWeight: 500,
  boxSizing: 'border-box',
  color: 'var(--text-main)',
  fontSize: '0.85rem'
};

export default function InventoryDocument({ kind }) {
  const config = CONFIG[kind];
  const { id } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [status, setStatus] = useState('DRAFT');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [header, setHeader] = useState({
    requestingParty: '',
    purpose: '',
    sourceWarehouseId: '',
    sourceWarehouseName: '',
    destWarehouseId: '',
    destWarehouseName: '',
    fromWarehouseId: '',
    fromWarehouseName: '',
    toWarehouseId: '',
    toWarehouseName: '',
    warehouseId: '',
    warehouseName: '',
    kind: kind === 'mr' ? 'ISSUE' : kind === 'return' ? 'MARKET' : kind === 'transfer' ? 'IN_TRANSIT' : 'CYCLE',
    mode: 'IN_TRANSIT',
    reference: ''
  });
  const [items, setItems] = useState([blankLine(kind)]);
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [prodRes, whRes] = await Promise.all([
          axios.get('/api/products', { headers }),
          axios.get('/api/warehouses', { headers })
        ]);
        setProducts(prodRes.data);
        setWarehouses(whRes.data);
        if (id && kind !== 'receipt') {
          const list = await axios.get(config.endpoint, { headers });
          const existing = list.data.find((row) => row.id === id);
          if (existing) applyExisting(existing, whRes.data);
        }
      } catch (error) {
        showToast('Failed to load the document', 'error');
      } finally {
        setIsInitialLoad(false);
      }
    };
    load();
  }, [id, kind]);

  const applyExisting = (existing, whs) => {
    setDoc(existing);
    setNumber(existing.number || '');
    setStatus(existing.status || 'DRAFT');
    setDate(existing.date ? new Date(existing.date).toISOString().split('T')[0] : date);
    const nameOf = (warehouseId) => whs.find((row) => row.id === warehouseId)?.name || '';
    setHeader((prev) => ({
      ...prev,
      requestingParty: existing.requestingParty || '',
      purpose: existing.purpose || existing.reason || existing.notes || '',
      sourceWarehouseId: existing.sourceWarehouseId || '',
      sourceWarehouseName: nameOf(existing.sourceWarehouseId),
      destWarehouseId: existing.destWarehouseId || '',
      destWarehouseName: nameOf(existing.destWarehouseId),
      fromWarehouseId: existing.fromWarehouseId || '',
      fromWarehouseName: nameOf(existing.fromWarehouseId),
      toWarehouseId: existing.toWarehouseId || '',
      toWarehouseName: nameOf(existing.toWarehouseId),
      warehouseId: existing.warehouseId || '',
      warehouseName: nameOf(existing.warehouseId),
      kind: existing.kind || prev.kind,
      mode: existing.mode || prev.mode,
      reference: existing.reference || ''
    }));
    if (existing.items?.length) {
      setItems(existing.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || '',
        quantity: Number(item.quantity || item.countQty || 0),
        lotNumber: item.lotNumber || '',
        reason: item.reason || '',
        damagedQty: Number(item.damagedQty || 0),
        countQty: Number(item.countQty || item.quantity || 0)
      })));
    }
    if (existing.lines?.length && kind === 'count') {
      setItems(existing.lines.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || '',
        quantity: Number(item.countQty || 0),
        countQty: Number(item.countQty || 0),
        reason: item.reason || ''
      })));
    }
  };

  const setHead = (patch) => setHeader((prev) => ({ ...prev, ...patch }));
  const patchItem = (itemId, patch) => setItems((rows) => rows.map((row) => row.id === itemId ? { ...row, ...patch } : row));
  const addItem = () => setItems((rows) => [...rows, blankLine(kind)]);
  const removeItem = (itemId) => setItems((rows) => rows.length <= 1 ? rows : rows.filter((row) => row.id !== itemId));

  const validate = () => {
    const errors = {};
    if (!date) errors.date = 'Date is required.';
    if (kind === 'mr') {
      if (!header.requestingParty.trim()) errors.requestingParty = 'Requesting party is required.';
      if (!header.sourceWarehouseId) errors.sourceWarehouseId = 'Source warehouse is required.';
      if (header.kind === 'TRANSFER' && !header.destWarehouseId) errors.destWarehouseId = 'Destination warehouse is required.';
    }
    if (kind === 'transfer') {
      if (!header.fromWarehouseId) errors.fromWarehouseId = 'Source warehouse is required.';
      if (!header.toWarehouseId) errors.toWarehouseId = 'Destination warehouse is required.';
      if (header.fromWarehouseId && header.fromWarehouseId === header.toWarehouseId) errors.toWarehouseId = 'Source and destination warehouses cannot be the same.';
    }
    if (kind === 'return' || kind === 'count' || kind === 'receipt') {
      if (!header.warehouseId) errors.warehouseId = 'Warehouse is required.';
    }
    const lines = items.filter((row) => row.productId);
    if (!lines.length) errors.items = 'Add at least one product.';
    lines.forEach((row) => {
      if (kind === 'return' && !String(row.reason || '').trim()) errors.items = 'Each return line needs a reason.';
    });
    return { errors, lines };
  };

  const payloadFor = (lines) => {
    if (kind === 'mr') {
      return {
        date,
        requestingParty: header.requestingParty,
        purpose: header.purpose,
        sourceWarehouseId: header.sourceWarehouseId,
        destWarehouseId: header.kind === 'TRANSFER' ? header.destWarehouseId : null,
        kind: header.kind,
        items: lines.map((row) => ({ productId: row.productId, quantity: Number(row.quantity) }))
      };
    }
    if (kind === 'transfer') {
      return {
        date,
        fromWarehouseId: header.fromWarehouseId,
        toWarehouseId: header.toWarehouseId,
        mode: header.mode,
        reason: header.purpose,
        post: true,
        items: lines.map((row) => ({ productId: row.productId, quantity: Number(row.quantity), lotNumber: row.lotNumber || null }))
      };
    }
    if (kind === 'return') {
      return {
        date,
        kind: header.kind,
        warehouseId: header.warehouseId,
        reference: header.reference,
        post: true,
        customerId: header.customerId || undefined,
        supplierId: header.supplierId || undefined,
        items: lines.map((row) => ({
          productId: row.productId,
          quantity: Number(row.quantity),
          reason: row.reason,
          disposition: header.kind === 'DAMAGE' ? 'QUARANTINE' : undefined,
          unitCost: 0
        }))
      };
    }
    if (kind === 'count') {
      return {
        date,
        warehouseId: header.warehouseId,
        kind: header.kind,
        notes: header.purpose,
        lines: lines.map((row) => ({ productId: row.productId, countQty: Number(row.quantity), reason: row.reason || null }))
      };
    }
    return {
      date,
      warehouseId: header.warehouseId,
      items: lines.map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
        unitCost: Number(row.unitCost || 0),
        lotNumber: row.lotNumber || null,
        expiryDate: row.expiryDate || null,
        damagedQty: Number(row.damagedQty || 0)
      }))
    };
  };

  const handleSubmit = async () => {
    const { errors, lines } = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});
    if (kind === 'return' && ['MARKET', 'DAMAGE', 'GRA'].includes(header.kind) && !header.customerId) {
      showToast('Choose the customer on the return.', 'error');
      return;
    }
    if (kind === 'return' && header.kind === 'SUPPLIER' && !header.supplierId) {
      showToast('Choose the supplier on the return.', 'error');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(config.endpoint, payloadFor(lines), { headers });
      showToast('Saved successfully!', 'success');
      if (kind === 'receipt') navigate('/warehouse/stock-reports');
      else navigate(`${config.list}/${res.data.id}`, { replace: true });
    } catch (error) {
      const fields = error.response?.data?.fields || {};
      setFieldErrors(fields);
      showToast(error.response?.data?.error || 'Failed to process the document.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const act = async (path, body = {}) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${config.endpoint}/${id}/${path}`, body, { headers: { Authorization: `Bearer ${token}` } });
      showToast('Saved successfully!', 'success');
      if (path === 'pick') {
        const list = await axios.get(config.endpoint, { headers: { Authorization: `Bearer ${token}` } });
        const existing = list.data.find((row) => row.id === id);
        if (existing) {
          existing.pickLists = [res.data];
          applyExisting(existing, warehouses);
        }
        return;
      }
      applyExisting(res.data, warehouses);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process the document.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const readOnly = ['FULFILLED', 'POSTED', 'RECEIVED', 'CANCELLED', 'REJECTED'].includes(status);
  const Icon = config.icon;
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

  return (
    <AppLayout title={id ? `${config.title} - ${number}` : `New ${config.title}`} icon={Icon}>
      {isInitialLoad ? <PageSkeleton type="form" /> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate(config.list)} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {id ? number : `New ${config.title} (${config.code})`}
                  <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: readOnly ? '#ecfdf5' : '#fef3c7', color: readOnly ? '#059669' : '#d97706', fontWeight: 700, border: `1px solid ${readOnly ? '#a7f3d0' : '#fde68a'}` }}>
                    {status}
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{config.subtitle}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {id && (
                <button type="button" onClick={() => window.print()} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Printer size={16} /> Print
                </button>
              )}
              {!id && (
                <button onClick={handleSubmit} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> {config.confirm}
                </button>
              )}
              {id && kind === 'mr' && status === 'DRAFT' && (
                <button onClick={() => act('approve')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> Approve
                </button>
              )}
              {id && kind === 'mr' && ['APPROVED', 'PARTIAL'].includes(status) && (
                <>
                  <button onClick={() => act('pick')} disabled={loading} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={16} /> Pick List
                  </button>
                  <button onClick={() => fulfilOpen()} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Fulfil
                  </button>
                </>
              )}
              {id && kind === 'transfer' && status === 'IN_TRANSIT' && (
                <button onClick={() => act('receive')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> Receive
                </button>
              )}
              {id && kind === 'count' && status !== 'POSTED' && doc?.financeStatus !== 'APPROVED' && (
                <button onClick={() => act('finance', { decision: 'APPROVED' })} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> Finance Approve
                </button>
              )}
              {id && kind === 'count' && doc?.financeStatus === 'APPROVED' && status !== 'POSTED' && (
                <button onClick={() => act('post')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> Post Variance
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
            <Field label={<><Calendar size={14} /> Date *</>} width="220px" error={fieldErrors.date}>
              <DatePicker invalid={!!fieldErrors.date} error={fieldErrors.date || ''} value={date} onChange={setDate} placeholder="Select Date" style={{ height: '42px', boxSizing: 'border-box' }} />
            </Field>
            {kind === 'mr' && (
              <>
                <Field label="Requesting party *" width="250px" error={fieldErrors.requestingParty}>
                  <input value={header.requestingParty} onChange={(e) => setHead({ requestingParty: e.target.value })} style={textInput} placeholder="Department or person" />
                </Field>
                <Field label="Request" width="180px">
                  <select value={header.kind} onChange={(e) => setHead({ kind: e.target.value })} style={textInput}>
                    <option value="ISSUE">Issue</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </Field>
                <WarehouseField label="Source warehouse *" warehouses={warehouses} name={header.sourceWarehouseName} error={fieldErrors.sourceWarehouseId} onChange={(name, wh) => setHead({ sourceWarehouseName: name, sourceWarehouseId: wh?.id || '' })} />
                {header.kind === 'TRANSFER' && (
                  <WarehouseField label="Destination *" warehouses={warehouses} name={header.destWarehouseName} error={fieldErrors.destWarehouseId} onChange={(name, wh) => setHead({ destWarehouseName: name, destWarehouseId: wh?.id || '' })} />
                )}
              </>
            )}
            {kind === 'transfer' && (
              <>
                <WarehouseField label="From warehouse *" warehouses={warehouses} name={header.fromWarehouseName} error={fieldErrors.fromWarehouseId} onChange={(name, wh) => setHead({ fromWarehouseName: name, fromWarehouseId: wh?.id || '' })} />
                <WarehouseField label="To warehouse *" warehouses={warehouses} name={header.toWarehouseName} error={fieldErrors.toWarehouseId} onChange={(name, wh) => setHead({ toWarehouseName: name, toWarehouseId: wh?.id || '' })} />
                <Field label="Movement" width="180px">
                  <select value={header.mode} onChange={(e) => setHead({ mode: e.target.value })} style={textInput}>
                    <option value="IN_TRANSIT">In transit</option>
                    <option value="IMMEDIATE">Immediate</option>
                  </select>
                </Field>
              </>
            )}
            {(kind === 'return' || kind === 'count' || kind === 'receipt') && (
              <WarehouseField label="Warehouse *" warehouses={warehouses} name={header.warehouseName} error={fieldErrors.warehouseId} onChange={(name, wh) => setHead({ warehouseName: name, warehouseId: wh?.id || '' })} />
            )}
            {kind === 'return' && (
              <Field label="Return type" width="220px">
                <select value={header.kind} onChange={(e) => setHead({ kind: e.target.value })} style={textInput}>
                  <option value="MARKET">Market return</option>
                  <option value="DAMAGE">Damage return</option>
                  <option value="GRA">Goods return advice</option>
                  <option value="SUPPLIER">Return to supplier</option>
                </select>
              </Field>
            )}
            {kind === 'count' && (
              <Field label="Count" width="180px">
                <select value={header.kind} onChange={(e) => setHead({ kind: e.target.value })} style={textInput}>
                  <option value="CYCLE">Cycle</option>
                  <option value="FULL">Full</option>
                </select>
              </Field>
            )}
            <Field label={<><FileText size={14} /> Description / Reason</>} width="350px">
              <input value={header.purpose} onChange={(e) => setHead({ purpose: e.target.value })} style={textInput} placeholder="Purpose or notes" />
            </Field>
          </div>

          {kind === 'return' && (
            <PartyPicker kind={header.kind} onChange={(patch) => setHead(patch)} />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Items</h3>
            </div>
          </div>
          {fieldErrors.items && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{fieldErrors.items}</div>}

          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr style={{ height: '2.25rem' }}>
                  <th style={th}>#</th>
                  <th style={th}>Product Details</th>
                  <th style={{ ...th, textAlign: 'center', width: '120px' }}>Quantity</th>
                  {(kind === 'receipt') && <th style={th}>Lot</th>}
                  {(kind === 'receipt') && <th style={{ ...th, width: '120px' }}>Damaged</th>}
                  {(kind === 'return' || kind === 'count') && <th style={th}>Reason</th>}
                  {!readOnly && <th style={{ ...th, width: '50px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={{ height: '2.25rem', borderBottom: '1px solid var(--border-color)' }}>
                    <td style={tdCenter}>{index + 1}</td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ height: '2.25rem' }}>
                        <ProductSearchDropdown
                          products={products}
                          value={item.productName}
                          onChange={(product) => patchItem(item.id, { productId: product.id, productName: product.name, unitCost: product.costPrice || product.standardCost || 0 })}
                          placeholder="Type to search..."
                          className="spreadsheet-input"
                          style={{ wrapper: { height: '100%', width: '100%' }, input: { height: '100%', padding: '0 1rem', fontSize: '0.85rem', fontWeight: 500, borderRadius: '0px' } }}
                        />
                      </div>
                    </td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <input type="number" className="spreadsheet-input" value={item.quantity} onChange={(e) => patchItem(item.id, { quantity: e.target.value })} style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }} />
                    </td>
                    {kind === 'receipt' && (
                      <>
                        <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <input className="spreadsheet-input" value={item.lotNumber || ''} onChange={(e) => patchItem(item.id, { lotNumber: e.target.value })} style={{ padding: '0 0.75rem', fontSize: '0.85rem' }} />
                        </td>
                        <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <input type="number" className="spreadsheet-input" value={item.damagedQty || 0} onChange={(e) => patchItem(item.id, { damagedQty: e.target.value })} style={{ textAlign: 'center', fontSize: '0.85rem' }} />
                        </td>
                      </>
                    )}
                    {(kind === 'return' || kind === 'count') && (
                      <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <input className="spreadsheet-input" value={item.reason || ''} onChange={(e) => patchItem(item.id, { reason: e.target.value })} style={{ padding: '0 0.75rem', fontSize: '0.85rem' }} />
                      </td>
                    )}
                    {!readOnly && (
                      <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!readOnly && !id && (
                  <tr style={{ height: '2.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={addItem}>
                    <td style={tdCenter}><Plus size={14} color="#cbd5e1" /></td>
                    <td style={{ ...tdCenter, textAlign: 'left', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Click here to add another line...</td>
                    <td style={{ ...tdCenter, fontWeight: 800 }}>0</td>
                    <td colSpan={3}></td>
                  </tr>
                )}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
                <tr style={{ fontWeight: 800, height: '2.25rem' }}>
                  <td colSpan="2" style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Document Totals:</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent)' }}>{totalQty}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {doc?.pickLists?.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Pick list {doc.pickLists[0].number}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {doc.pickLists[0].lines?.map((line) => (
                  <div key={line.id}>{line.suggestedQty} suggested</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );

  async function fulfilOpen() {
    const lines = (doc?.items || []).filter((item) => Number(item.quantity) > Number(item.fulfilledQty || 0)).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity) - Number(item.fulfilledQty || 0)
    }));
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${config.endpoint}/${id}/fulfil`, { lines }, { headers: { Authorization: `Bearer ${token}` } });
      showToast('Saved successfully!', 'success');
      applyExisting(res.data, warehouses);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to fulfil.', 'error');
    } finally {
      setLoading(false);
    }
  }
}

function blankLine() {
  return { id: `${Date.now()}-${Math.random()}`, productId: '', productName: '', quantity: 1, lotNumber: '', reason: '', damagedQty: 0, unitCost: 0 };
}

const th = { borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 };
const tdCenter = { borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' };

function Field({ label, width, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
        <label style={fieldLabel}>{label}</label>
      </div>
      {children}
      {error && <div style={{ color: 'var(--error)', fontSize: '0.75rem' }}>{error}</div>}
    </div>
  );
}

function WarehouseField({ label, warehouses, name, error, onChange }) {
  return (
    <Field label={label} width="250px" error={error}>
      <WarehouseSearchDropdown
        warehouses={warehouses}
        invalid={!!error}
        error={error || ''}
        value={name}
        onChange={onChange}
        placeholder="Warehouse..."
        style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
      />
    </Field>
  );
}

function PartyPicker({ kind, onChange }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  useEffect(() => {
    const token = localStorage.getItem('token');
    const url = kind === 'SUPPLIER' ? '/api/suppliers' : '/api/customers';
    axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then((res) => setRows(res.data || [])).catch(() => setRows([]));
    setName('');
  }, [kind]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '280px', marginTop: '-1rem', marginBottom: '1rem' }}>
      <label style={fieldLabel}>{kind === 'SUPPLIER' ? 'Supplier *' : 'Customer *'}</label>
      <input
        list="party-list"
        value={name}
        onChange={(e) => {
          const value = e.target.value;
          setName(value);
          const match = rows.find((row) => row.name === value);
          if (kind === 'SUPPLIER') onChange({ supplierId: match?.id || '', customerId: '' });
          else onChange({ customerId: match?.id || '', supplierId: '' });
        }}
        placeholder={kind === 'SUPPLIER' ? 'Search supplier...' : 'Search customer...'}
        style={textInput}
      />
      <datalist id="party-list">
        {rows.map((row) => <option key={row.id} value={row.name} />)}
      </datalist>
    </div>
  );
}
