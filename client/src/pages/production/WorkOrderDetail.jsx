import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { isUuid, recordPath, routeKeyOf, showRecord } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import { ClipboardList } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import Section from '../../components/ui/Section';

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
      <PageHeader
        onBack={() => navigate('/production/work-orders')}
        title={order?.orderNumber || 'Work Order'}
        subtitle={order ? `${order.product?.code || ''} — ${order.product?.name || ''}` : 'Work order'}
        extra={order ? <StatusBadge status={order.status} /> : null}
        actions={order && (
          <>
            {order.status === 'CREATED' && <ActionButton variant="submit" onClick={() => act('/release', 'Work order released')}>Release</ActionButton>}
            {['RELEASED', 'IN_PROGRESS'].includes(order.status) && <ActionButton onClick={() => act('/teco', 'Technically complete')} style={{ background: '#b45309' }}>TECO</ActionButton>}
            {order.status === 'TECO' && <ActionButton onClick={() => act('/close', 'Work order closed')} style={{ background: '#15803d' }}>Close</ActionButton>}
            {['CREATED', 'RELEASED'].includes(order.status) && <ActionButton variant="danger" onClick={() => act('/cancel', 'Work order cancelled')}>Cancel</ActionButton>}
            <ActionButton variant="secondary" onClick={() => navigate(recordPath('/production/shop-floor', order, 'orderNumber'))}>Shop floor</ActionButton>
          </>
        )}
      />

      {order && (
        <div>
          <Section padded>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Qty {parseFloat(order.quantity)} · Done {parseFloat(order.quantityCompleted || 0)} · Scrap {parseFloat(order.quantityScrapped || 0)} · <StatusBadge status={order.issueMode} />
            </div>
          </Section>

          {order.warnings?.length > 0 && (
            <div className="field-error-text" style={{ marginBottom: '1rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '0.75rem 1rem', color: '#9a3412' }}>
              {order.warnings.map((warning) => `${warning.code}: short ${warning.short}`).join(' · ')}
            </div>
          )}

          <Section title="Components">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th style={{ textAlign: 'right' }}>Per</th>
                    <th style={{ textAlign: 'right' }}>Required</th>
                    <th style={{ textAlign: 'right' }}>Reserved</th>
                    <th style={{ textAlign: 'right' }}>Issued</th>
                    <th>Cost</th>
                    <th>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.components || []).map((component) => (
                    <tr key={component.id}>
                      <td style={{ fontWeight: 600 }}>{component.product?.code} — {component.product?.name}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(component.quantityPer)}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(component.requiredQty)}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(component.reservedQty || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(component.issuedQty || 0)}</td>
                      <td>{component.costSource} {money(component.unitCost)}</td>
                      <td>
                        {['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <input className="spreadsheet-input" placeholder="Qty" value={issueQty[component.id] || ''} onChange={(event) => setIssueQty((prev) => ({ ...prev, [component.id]: event.target.value }))} style={{ width: '70px', textAlign: 'right' }} />
                            <input className="spreadsheet-input" placeholder="Lot" value={issueLot[component.id] || ''} onChange={(event) => setIssueLot((prev) => ({ ...prev, [component.id]: event.target.value }))} style={{ width: '110px' }} />
                            <button type="button" onClick={() => issue(component)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Issue</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Operations">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th>Seq</th>
                    <th>Operation</th>
                    <th>Workstation</th>
                    <th>Setup</th>
                    <th>Run / unit</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Yield</th>
                    <th style={{ textAlign: 'right' }}>Scrap</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.operations || []).map((operation) => (
                    <tr key={operation.id}>
                      <td>{operation.sequence}</td>
                      <td style={{ fontWeight: 600 }}>{operation.name}{operation.isSubcontract ? ' (subcontract)' : ''}</td>
                      <td>{operation.workstation?.code || '—'}</td>
                      <td>{parseFloat(operation.setupMinutes)} min</td>
                      <td>{parseFloat(operation.runMinutesPerUnit)} min</td>
                      <td><StatusBadge status={operation.status} /></td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(operation.yieldQty || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(operation.scrapQty || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {cost && (
            <Section title="Planned vs actual">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th>Bucket</th>
                      <th style={{ textAlign: 'right' }}>Planned</th>
                      <th style={{ textAlign: 'right' }}>Actual</th>
                      <th style={{ textAlign: 'right' }}>Variance</th>
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
                        <tr key={key}>
                          <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{key}</td>
                          <td style={{ textAlign: 'right' }}>{money(planned)}</td>
                          <td style={{ textAlign: 'right' }}>{money(actual)}</td>
                          <td style={{ textAlign: 'right', color: variance > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>{variance == null ? '—' : money(variance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(cost.confirmedQuantity || 0) > 0
                  ? `Plan is scaled to the confirmed quantity (${cost.confirmedQuantity}). `
                  : 'This is the plan for the full order. Variance appears after the last operation is confirmed. '}
                Labour includes machine time and subcontract. Unit cost of the full order {money(cost.fullPlan?.unitCost || cost.planned.unitCost)}.
              </div>
            </Section>
          )}
        </div>
      )}
    </AppLayout>
  );
}
