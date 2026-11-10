import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { ClipboardList, ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';

const FIELD_STYLE = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};
const LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem'
};
const BUTTON = {
  height: '38px', padding: '0 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
  fontWeight: 700, fontSize: '0.8rem'
};

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WorkOrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [order, setOrder] = useState(null);
  const [cost, setCost] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [issueQty, setIssueQty] = useState({});
  const [issueLot, setIssueLot] = useState({});
  const [form, setForm] = useState({
    productId: '', bomId: '', quantity: 1, priority: 'MEDIUM', issueMode: '',
    startDate: '', endDate: '', warehouseId: '', notes: ''
  });

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const loadOrder = useCallback(async (orderId) => {
    const config = authConfig();
    const [orderRes, costRes] = await Promise.all([
      axios.get(`/api/work-orders/${orderId}`, config),
      axios.get(`/api/work-orders/${orderId}/cost`, config)
    ]);
    setOrder(orderRes.data);
    setCost(costRes.data);
  }, [authConfig]);

  useEffect(() => {
    const load = async () => {
      try {
        const config = authConfig();
        const [productsRes, bomsRes, whRes] = await Promise.all([
          axios.get('/api/products', config),
          axios.get('/api/boms', config),
          axios.get('/api/warehouses', config).catch(() => ({ data: [] }))
        ]);
        setProducts(productsRes.data.filter((product) => product.activeStatus !== 'INACTIVE'));
        setBoms(bomsRes.data);
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
        if (!isNew) await loadOrder(id);
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to load work order', 'error');
      }
    };
    load();
  }, [id, isNew, authConfig, loadOrder, showToast]);

  const productOptions = products.map((product) => ({ label: `${product.code} - ${product.name}`, value: product.id }));
  const bomOptions = boms
    .filter((bom) => bom.productId === form.productId)
    .map((bom) => ({ label: `${bom.code} (v${bom.version})`, value: bom.id }));

  const save = async () => {
    const errors = {};
    if (!form.productId) errors.productId = 'Product is required';
    if (!(parseFloat(form.quantity) > 0)) errors.quantity = 'Quantity must be greater than zero';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await axios.post('/api/work-orders', {
        ...form,
        bomId: form.bomId || undefined,
        warehouseId: form.warehouseId || undefined,
        issueMode: form.issueMode || undefined,
        quantity: parseFloat(form.quantity)
      }, authConfig());
      showToast('Work order created', 'success');
      navigate(`/production/work-orders/${res.data.id}`);
    } catch (error) {
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to create work order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const act = async (path, success) => {
    try {
      const res = await axios.post(`/api/work-orders/${id}${path}`, {}, authConfig());
      if (res.data.warnings?.length) {
        showToast(`Released with ${res.data.warnings.length} material shortage warning${res.data.warnings.length === 1 ? '' : 's'}`, 'error');
      } else {
        showToast(success, 'success');
      }
      await loadOrder(id);
    } catch (error) {
      const shortages = error.response?.data?.shortages;
      showToast(error.response?.data?.error || 'Action failed', 'error');
      if (shortages?.length) {
        showToast(shortages.map((row) => `${row.code || 'Item'} short ${row.short}`).join(', '), 'error');
      }
    }
  };

  const issue = async (component) => {
    try {
      await axios.post(`/api/work-orders/${id}/issues`, {
        componentId: component.id,
        productId: component.productId,
        quantity: parseFloat(issueQty[component.id] || 0),
        lotNumber: issueLot[component.id] || undefined
      }, authConfig());
      showToast('Material issued', 'success');
      await loadOrder(id);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to issue material', 'error');
    }
  };

  return (
    <AppLayout title={isNew ? 'Create Work Order' : (order?.orderNumber || 'Work Order')} icon={ClipboardList}>
      <button
        onClick={() => navigate('/production/work-orders')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', marginBottom: '1rem' }}
      >
        <ArrowLeft size={16} /> Work Orders
      </button>

      {isNew ? (
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={LABEL_STYLE}>Product</label>
            <LiveSearchDropdown options={productOptions} value={form.productId} invalid={!!fieldErrors.productId} onChange={(value) => setForm((prev) => ({ ...prev, productId: value, bomId: '' }))} placeholder="Select product" />
          </div>
          <div>
            <label style={LABEL_STYLE}>BOM</label>
            <LiveSearchDropdown options={bomOptions} value={form.bomId} onChange={(value) => setForm((prev) => ({ ...prev, bomId: value }))} placeholder="Default active BOM" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Quantity</label>
            <input type="number" min="0" step="any" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} className={fieldErrors.quantity ? 'field-invalid' : undefined} style={FIELD_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Priority</label>
            <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} style={FIELD_STYLE}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Issue</label>
            <select value={form.issueMode} onChange={(event) => setForm((prev) => ({ ...prev, issueMode: event.target.value }))} style={FIELD_STYLE}>
              <option value="">Settings default</option>
              <option value="BACKFLUSH">Backflush</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Warehouse</label>
            <select value={form.warehouseId} onChange={(event) => setForm((prev) => ({ ...prev, warehouseId: event.target.value }))} style={FIELD_STYLE}>
              <option value="">First warehouse</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Start</label>
            <input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} style={FIELD_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>End</label>
            <input type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} style={FIELD_STYLE} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL_STYLE}>Notes</label>
            <input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} style={FIELD_STYLE} />
          </div>
          <div>
            <button onClick={save} disabled={saving} style={{ ...BUTTON, background: 'var(--accent)', color: '#fff' }}>
              <CheckCircle size={14} style={{ marginRight: 6 }} /> {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      ) : order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{order.product?.code} — {order.product?.name}</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
                Qty {parseFloat(order.quantity)} · Done {parseFloat(order.quantityCompleted || 0)} · Scrap {parseFloat(order.quantityScrapped || 0)} · {order.issueMode} · {order.status}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {order.status === 'CREATED' && <button onClick={() => act('/release', 'Work order released')} style={{ ...BUTTON, background: 'var(--accent)', color: '#fff' }}>Release</button>}
              {['RELEASED', 'IN_PROGRESS'].includes(order.status) && <button onClick={() => act('/teco', 'Technically complete')} style={{ ...BUTTON, background: '#b45309', color: '#fff' }}>TECO</button>}
              {order.status === 'TECO' && <button onClick={() => act('/close', 'Work order closed')} style={{ ...BUTTON, background: '#15803d', color: '#fff' }}>Close</button>}
              {['CREATED', 'RELEASED'].includes(order.status) && <button onClick={() => act('/cancel', 'Work order cancelled')} style={{ ...BUTTON, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' }}>Cancel</button>}
              <button onClick={() => navigate(`/production/shop-floor/${order.id}`)} style={{ ...BUTTON, background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0' }}>Shop floor</button>
            </div>
          </div>

          {order.warnings?.length > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '0.75rem 1rem', color: '#9a3412', fontSize: '0.85rem' }}>
              {order.warnings.map((warning) => `${warning.code}: short ${warning.short}`).join(' · ')}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'auto' }}>
            <div style={{ padding: '0.8rem 1rem', fontWeight: 800, fontSize: '0.85rem' }}>Components</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '680px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', height: '36px' }}>
                  <th style={{ padding: '0 1rem' }}>Component</th>
                  <th>Per</th>
                  <th>Required</th>
                  <th>Reserved</th>
                  <th>Issued</th>
                  <th>Cost</th>
                  <th style={{ paddingRight: '1rem' }}>Issue</th>
                </tr>
              </thead>
              <tbody>
                {(order.components || []).map((component) => (
                  <tr key={component.id} style={{ borderTop: '1px solid #f1f5f9', height: '48px' }}>
                    <td style={{ padding: '0 1rem' }}>{component.product?.code} — {component.product?.name}</td>
                    <td>{parseFloat(component.quantityPer)}</td>
                    <td>{parseFloat(component.requiredQty)}</td>
                    <td>{parseFloat(component.reservedQty || 0)}</td>
                    <td>{parseFloat(component.issuedQty || 0)}</td>
                    <td>{component.costSource} {money(component.unitCost)}</td>
                    <td style={{ paddingRight: '1rem' }}>
                      {['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <input placeholder="Qty" value={issueQty[component.id] || ''} onChange={(event) => setIssueQty((prev) => ({ ...prev, [component.id]: event.target.value }))} style={{ ...FIELD_STYLE, width: '70px', height: '34px' }} />
                          <input placeholder="Lot" value={issueLot[component.id] || ''} onChange={(event) => setIssueLot((prev) => ({ ...prev, [component.id]: event.target.value }))} style={{ ...FIELD_STYLE, width: '110px', height: '34px' }} />
                          <button onClick={() => issue(component)} style={{ ...BUTTON, height: '34px', background: '#fff', border: '1px solid #e2e8f0' }}>Issue</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'auto' }}>
            <div style={{ padding: '0.8rem 1rem', fontWeight: 800, fontSize: '0.85rem' }}>Operations</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '640px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', height: '36px' }}>
                  <th style={{ padding: '0 1rem' }}>Seq</th>
                  <th>Operation</th>
                  <th>Workstation</th>
                  <th>Setup</th>
                  <th>Run / unit</th>
                  <th>Status</th>
                  <th>Yield</th>
                  <th>Scrap</th>
                </tr>
              </thead>
              <tbody>
                {(order.operations || []).map((operation) => (
                  <tr key={operation.id} style={{ borderTop: '1px solid #f1f5f9', height: '44px' }}>
                    <td style={{ padding: '0 1rem' }}>{operation.sequence}</td>
                    <td>{operation.name}{operation.isSubcontract ? ' (subcontract)' : ''}</td>
                    <td>{operation.workstation?.code || '—'}</td>
                    <td>{parseFloat(operation.setupMinutes)} min</td>
                    <td>{parseFloat(operation.runMinutesPerUnit)} min</td>
                    <td>{operation.status}</td>
                    <td>{parseFloat(operation.yieldQty || 0)}</td>
                    <td>{parseFloat(operation.scrapQty || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cost && (
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.7rem' }}>Planned vs actual</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'right', color: '#64748b' }}>
                    <th style={{ textAlign: 'left' }}>Bucket</th>
                    <th>Planned</th>
                    <th>Actual</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {['material', 'labour', 'overhead', 'scrap'].map((key) => {
                    const row = cost.variance.buckets[key];
                    return (
                      <tr key={key} style={{ height: '36px', borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{key}</td>
                        <td style={{ textAlign: 'right' }}>{money(row.planned)}</td>
                        <td style={{ textAlign: 'right' }}>{money(row.actual)}</td>
                        <td style={{ textAlign: 'right', color: row.variance > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>{money(row.variance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>
                Plan is pro-rated to confirmed quantity ({cost.confirmedQuantity || 0}). Labour includes machine time and subcontract. Unit cost of the full order {money(cost.fullPlan?.unitCost || cost.planned.unitCost)}.
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
