import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Factory, ArrowLeft } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const FIELD = {
  width: '100%', minHeight: '52px', borderRadius: '10px', border: '1px solid #cbd5e1',
  background: '#fff', padding: '0 0.9rem', fontSize: '1.05rem', fontWeight: 650, boxSizing: 'border-box'
};
const BUTTON = {
  minHeight: '52px', borderRadius: '10px', border: 'none', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', padding: '0 1rem'
};

export default function ShopFloor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [scan, setScan] = useState('');
  const [forms, setForms] = useState({});

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const loadList = useCallback(async () => {
    const res = await axios.get('/api/work-orders', { ...authConfig(), params: { status: 'RELEASED,IN_PROGRESS' } });
    setOrders(res.data);
  }, [authConfig]);

  const loadOrder = useCallback(async (orderId) => {
    const config = authConfig();
    const [orderRes, reasonRes] = await Promise.all([
      axios.get(`/api/work-orders/${orderId}`, config),
      axios.get('/api/work-orders/reason-codes', config)
    ]);
    setOrder(orderRes.data);
    setReasons(reasonRes.data);
    const next = {};
    (orderRes.data.operations || []).forEach((operation) => {
      const clockMinutes = Math.round(parseFloat(operation.actualMachineMinutes || 0));
      next[operation.id] = {
        yieldQty: '',
        scrapQty: '',
        reworkQty: '',
        scrapReasonId: '',
        reworkReasonId: '',
        labourMinutes: '',
        machineMinutes: clockMinutes > 0 ? String(clockMinutes) : '',
        lotNumber: '',
        serialNumbers: '',
        operatorName: ''
      };
    });
    setForms(next);
  }, [authConfig]);

  useEffect(() => {
    const run = async () => {
      try {
        if (id) await loadOrder(id);
        else await loadList();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to load shop floor', 'error');
      }
    };
    run();
  }, [id, loadList, loadOrder, showToast]);

  const submitScan = async (event) => {
    event.preventDefault();
    try {
      const res = await axios.get('/api/work-orders/scan', { ...authConfig(), params: { code: scan.trim() } });
      navigate(`/production/shop-floor/${res.data.id}`);
    } catch (error) {
      showToast(error.response?.data?.error || 'Work order not found', 'error');
    }
  };

  const clock = async (operationId, action) => {
    try {
      const res = await axios.post(`/api/work-orders/${id}/operations/${operationId}/${action}`, {
        operatorName: forms[operationId]?.operatorName
      }, authConfig());
      setOrder(res.data);
      showToast(action === 'start' ? 'Operation started' : action === 'pause' ? 'Operation paused' : 'Operation stopped', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not update the operation', 'error');
    }
  };

  const confirm = async (operation) => {
    const form = forms[operation.id] || {};
    try {
      const res = await axios.post(`/api/work-orders/${id}/confirmations`, {
        operationId: operation.id,
        ...form,
        yieldQty: parseFloat(form.yieldQty || 0),
        scrapQty: parseFloat(form.scrapQty || 0),
        reworkQty: parseFloat(form.reworkQty || 0),
        labourMinutes: parseFloat(form.labourMinutes || 0),
        machineMinutes: parseFloat(form.machineMinutes || 0)
      }, authConfig());
      showToast('Confirmation posted', 'success');
      setOrder(res.data);
    } catch (error) {
      showToast(error.response?.data?.error || 'Confirmation failed', 'error');
    }
  };

  const setField = (operationId, field, value) => {
    setForms((prev) => ({ ...prev, [operationId]: { ...prev[operationId], [field]: value } }));
  };

  const scrapReasons = reasons.filter((reason) => reason.category === 'SCRAP');
  const reworkReasons = reasons.filter((reason) => reason.category === 'REWORK');

  return (
    <AppLayout title="Shop Floor" icon={Factory}>
      {!id ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <form onSubmit={submitScan}>
            <input
              autoFocus
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              placeholder="Scan or type work order / job number"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              style={FIELD}
            />
          </form>
          {orders.length === 0 && <div style={{ color: '#64748b', padding: '1rem 0' }}>No released work orders.</div>}
          {orders.map((row) => (
            <button
              key={row.id}
              onClick={() => navigate(`/production/shop-floor/${row.id}`)}
              style={{ ...BUTTON, textAlign: 'left', background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b' }}
            >
              <div>{row.orderNumber}</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b' }}>{row.product?.code} · {parseFloat(row.quantity)} · {row.status}</div>
            </button>
          ))}
        </div>
      ) : order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <button onClick={() => navigate('/production/shop-floor')} style={{ ...BUTTON, background: 'transparent', color: '#475569', width: 'fit-content', minHeight: '40px' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{order.orderNumber}</div>
            <div style={{ color: '#475569' }}>{order.product?.code} — {order.product?.name}</div>
            <div style={{ marginTop: 4, fontWeight: 700 }}>Order {parseFloat(order.quantity)} · Good {parseFloat(order.quantityCompleted || 0)} · Scrap {parseFloat(order.quantityScrapped || 0)}</div>
          </div>
          {(order.operations || []).map((operation) => {
            const form = forms[operation.id] || {};
            return (
              <div key={operation.id} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{operation.sequence}. {operation.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{operation.workstation?.code || 'No workstation'} · {operation.status} · clock {parseFloat(operation.actualMachineMinutes || 0).toFixed(1)} min</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                  <button onClick={() => clock(operation.id, 'start')} style={{ ...BUTTON, background: '#15803d', color: '#fff' }}>Start</button>
                  <button onClick={() => clock(operation.id, 'pause')} style={{ ...BUTTON, background: '#b45309', color: '#fff' }}>Pause</button>
                  <button onClick={() => clock(operation.id, 'stop')} style={{ ...BUTTON, background: '#1e293b', color: '#fff' }}>Stop</button>
                </div>
                <input style={FIELD} placeholder="Operator" value={form.operatorName || ''} onChange={(event) => setField(operation.id, 'operatorName', event.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                  <input style={FIELD} inputMode="decimal" placeholder="Good qty" value={form.yieldQty || ''} onChange={(event) => setField(operation.id, 'yieldQty', event.target.value)} />
                  <input style={FIELD} inputMode="decimal" placeholder="Scrap qty" value={form.scrapQty || ''} onChange={(event) => setField(operation.id, 'scrapQty', event.target.value)} />
                  <input style={FIELD} inputMode="decimal" placeholder="Rework qty" value={form.reworkQty || ''} onChange={(event) => setField(operation.id, 'reworkQty', event.target.value)} />
                </div>
                <select style={FIELD} value={form.scrapReasonId || ''} onChange={(event) => setField(operation.id, 'scrapReasonId', event.target.value)}>
                  <option value="">Scrap reason</option>
                  {scrapReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.code} — {reason.name}</option>)}
                </select>
                <select style={FIELD} value={form.reworkReasonId || ''} onChange={(event) => setField(operation.id, 'reworkReasonId', event.target.value)}>
                  <option value="">Rework reason</option>
                  {reworkReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.code} — {reason.name}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                  <input style={FIELD} inputMode="decimal" placeholder="Labour minutes" value={form.labourMinutes || ''} onChange={(event) => setField(operation.id, 'labourMinutes', event.target.value)} />
                  <input style={FIELD} inputMode="decimal" placeholder="Machine minutes" value={form.machineMinutes || ''} onChange={(event) => setField(operation.id, 'machineMinutes', event.target.value)} />
                </div>
                <input style={FIELD} placeholder="Finished lot" autoCapitalize="characters" autoComplete="off" value={form.lotNumber || ''} onChange={(event) => setField(operation.id, 'lotNumber', event.target.value)} />
                <input style={FIELD} placeholder="Serial numbers" autoComplete="off" value={form.serialNumbers || ''} onChange={(event) => setField(operation.id, 'serialNumbers', event.target.value)} />
                <button onClick={() => confirm(operation)} style={{ ...BUTTON, background: 'var(--accent)', color: '#fff' }}>Confirm</button>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
