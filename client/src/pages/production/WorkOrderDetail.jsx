import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { isUuid, recordPath, routeKeyOf, showRecord } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import { ClipboardList, ArrowLeft } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const FIELD_STYLE = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};
const BUTTON = {
  height: '38px', padding: '0 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
  fontWeight: 700, fontSize: '0.8rem'
};

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WorkOrderDetail() {
  const navigate = useNavigate();
  const routeKey = routeKeyOf(useParams());
  const [id, setId] = useState(() => (isUuid(routeKey) ? routeKey : ''));
  const { showToast } = useToast();
  const [order, setOrder] = useState(null);
  const [cost, setCost] = useState(null);
  const [issueQty, setIssueQty] = useState({});
  const [issueLot, setIssueLot] = useState({});

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
    return orderRes.data;
  }, [authConfig]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!routeKey) return;
        let orderId = isUuid(routeKey) ? routeKey : '';
        if (!orderId) {
          const scanned = await axios.get('/api/work-orders/scan', { ...authConfig(), params: { code: routeKey } });
          orderId = scanned.data.id;
        }
        setId(orderId);
        const loaded = await loadOrder(orderId);
        showRecord(navigate, '/production/work-orders', loaded, 'orderNumber');
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to load work order', 'error');
      }
    };
    load();
  }, [routeKey, authConfig, loadOrder, showToast, navigate]);

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
    <AppLayout title={order?.orderNumber || 'Work Order'} icon={ClipboardList}>
      <button
        onClick={() => navigate('/production/work-orders')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', marginBottom: '1rem' }}
      >
        <ArrowLeft size={16} /> Work Orders
      </button>

      {order && (
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
              {['RELEASED', 'IN_PROGRESS', 'TECO'].includes(order.status) && <button onClick={() => act('/close-now', 'Work order closed')} style={{ ...BUTTON, background: '#15803d', color: '#fff' }}>Close now</button>}
              {['RELEASED', 'IN_PROGRESS', 'TECO'].includes(order.status) && <button onClick={() => act('/short-close', 'Short closed')} style={{ ...BUTTON, background: '#fff', color: '#9a3412', border: '1px solid #fed7aa' }}>Short close</button>}
              {['CREATED', 'RELEASED'].includes(order.status) && <button onClick={() => act('/cancel', 'Work order cancelled')} style={{ ...BUTTON, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' }}>Cancel</button>}
              <button onClick={() => navigate(recordPath('/production/shop-floor', order, 'orderNumber'))} style={{ ...BUTTON, background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0' }}>Shop floor</button>
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
                    const started = (cost.confirmedQuantity || 0) > 0;
                    const row = cost.variance.buckets[key];
                    const planned = started ? row.planned : (cost.fullPlan?.[key] || 0);
                    const actual = started ? row.actual : 0;
                    const variance = started ? row.variance : null;
                    return (
                      <tr key={key} style={{ height: '36px', borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{key}</td>
                        <td style={{ textAlign: 'right' }}>{money(planned)}</td>
                        <td style={{ textAlign: 'right' }}>{money(actual)}</td>
                        <td style={{ textAlign: 'right', color: variance > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>{variance == null ? '—' : money(variance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>
                {(cost.confirmedQuantity || 0) > 0
                  ? `Plan is scaled to the confirmed quantity (${cost.confirmedQuantity}). `
                  : 'This is the plan for the full order. Variance appears after the last operation is confirmed. '}
                Labour includes machine time and subcontract. Unit cost of the full order {money(cost.fullPlan?.unitCost || cost.planned.unitCost)}.
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
