import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ScanCapture, { lookupScan } from '../../components/ui/ScanCapture';
import PageHeader from '../../components/ui/PageHeader';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import Section from '../../components/ui/Section';
import { Factory } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ShopFloor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [forms, setForms] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);

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
    const operations = orderRes.data.operations || [];
    operations.forEach((operation) => {
      const previous = [...operations].reverse().find((row) => Number(row.sequence) < Number(operation.sequence));
      const ceiling = previous ? Number(previous.yieldQty || 0) : Number(orderRes.data.quantity || 0);
      const remaining = Math.max(0, ceiling - Number(operation.yieldQty || 0) - Number(operation.scrapQty || 0));
      const clockMinutes = Math.round(parseFloat(operation.actualMachineMinutes || 0));
      next[operation.id] = {
        yieldQty: remaining > 0 ? String(remaining) : '',
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
      setLoading(true);
      try {
        if (id) await loadOrder(id);
        else await loadList();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to load shop floor', 'error');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, loadList, loadOrder, showToast]);

  const onScan = async (code) => {
    try {
      const hit = await lookupScan(code);
      if (hit.kind === 'workOrder') {
        if (!id || hit.workOrder.id !== id) navigate(`/production/shop-floor/${hit.workOrder.id}`);
        return;
      }
      if (hit.kind === 'lot' && id && order) {
        const operation = (order.operations || []).find((row) => row.status !== 'COMPLETE') || order.operations?.[0];
        if (operation) {
          setField(operation.id, 'lotNumber', hit.lotNumber);
          showToast(`Lot ${hit.lotNumber}`, 'success');
        }
        return;
      }
      showToast('Scan a work order to open it, or a lot to fill the confirmation.', 'error');
    } catch (error) {
      showToast(error.response?.data?.error || 'Nothing matched that scan', 'error');
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
    const errors = {};
    const yieldQty = parseFloat(form.yieldQty || 0);
    const scrapQty = parseFloat(form.scrapQty || 0);
    const reworkQty = parseFloat(form.reworkQty || 0);
    if (!(yieldQty > 0) && !(scrapQty > 0) && !(reworkQty > 0)) errors.yieldQty = 'Enter a yield, scrap, or rework quantity';
    if (scrapQty > 0 && !form.scrapReasonId) errors.scrapReasonId = 'Scrap reason is required';
    if (reworkQty > 0 && !form.reworkReasonId) errors.reworkReasonId = 'Rework reason is required';
    if (Object.keys(errors).length) {
      setFieldErrors({ [operation.id]: errors });
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});
    try {
      await axios.post(`/api/work-orders/${id}/confirmations`, {
        operationId: operation.id,
        ...form,
        yieldQty: parseFloat(form.yieldQty || 0),
        scrapQty: parseFloat(form.scrapQty || 0),
        reworkQty: parseFloat(form.reworkQty || 0),
        labourMinutes: parseFloat(form.labourMinutes || 0),
        machineMinutes: parseFloat(form.machineMinutes || 0)
      }, authConfig());
      showToast('Confirmation posted', 'success');
      await loadOrder(id);
    } catch (error) {
      setFieldErrors({ [operation.id]: error.response?.data?.fields || {} });
      showToast(error.response?.data?.error || 'Confirmation failed', 'error');
    }
  };

  const setField = (operationId, field, value) => {
    setForms((prev) => ({ ...prev, [operationId]: { ...prev[operationId], [field]: value } }));
  };

  const scrapReasons = reasons.filter((reason) => reason.category === 'SCRAP');
  const reworkReasons = reasons.filter((reason) => reason.category === 'REWORK');
  const queue = orders.map((row) => ({
    ...row,
    productLabel: [row.product?.code, row.product?.name].filter(Boolean).join(' - ')
  }));

  return (
    <AppLayout title="Shop Floor" icon={Factory}>
      {loading ? <PageSkeleton type={id ? 'form' : 'table'} /> : !id ? (
        <>
          <ScanCapture onScan={onScan} placeholder="Scan or type a work order" />
          <DataTable
            columns={[
              { header: 'Work Order', accessor: 'orderNumber', fontWeight: 600, render: (row) => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.orderNumber}</span> },
              { header: 'Product', accessor: 'productLabel' },
              { header: 'Quantity', accessor: 'quantity', render: (row) => parseFloat(row.quantity) },
              { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
            ]}
            data={queue}
            searchKeys={['orderNumber', 'productLabel', 'status']}
            searchPlaceholder="Search released orders..."
            noDataMessage="No released work orders."
            onRowClick={(row) => navigate(`/production/shop-floor/${row.id}`)}
          />
        </>
      ) : order && (
        <div>
          <PageHeader
            onBack={() => navigate('/production/shop-floor')}
            title={order.orderNumber}
            subtitle={`${order.product?.code || ''} — ${order.product?.name || ''}`}
            extra={<StatusBadge status={order.status} />}
          />
          <ScanCapture onScan={onScan} placeholder="Scan the next work order or a finished lot" />
          <Section padded>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              Order {parseFloat(order.quantity)} · Good {parseFloat(order.quantityCompleted || 0)} · Scrap {parseFloat(order.quantityScrapped || 0)}
            </div>
          </Section>
          {(order.operations || []).map((operation) => {
            const form = forms[operation.id] || {};
            const errors = fieldErrors[operation.id] || {};
            const done = operation.status === 'COMPLETE';
            return (
              <Section key={operation.id} title={`${operation.sequence}. ${operation.name}`} padded>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>{operation.workstation?.code || 'No workstation'}</span>
                  <StatusBadge status={operation.status} />
                  <span>clock {parseFloat(operation.actualMachineMinutes || 0).toFixed(1)} min</span>
                </div>
                {done ? (
                  <div style={{ fontWeight: 700, color: '#15803d' }}>
                    Completed · good {parseFloat(operation.yieldQty || 0)}
                    {parseFloat(operation.scrapQty || 0) > 0 ? ` · scrap ${parseFloat(operation.scrapQty || 0)}` : ''}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    <ActionButton onClick={() => clock(operation.id, 'start')} style={{ background: '#15803d' }}>Start</ActionButton>
                    <ActionButton onClick={() => clock(operation.id, 'pause')} style={{ background: '#b45309' }}>Pause</ActionButton>
                    <ActionButton variant="secondary" onClick={() => clock(operation.id, 'stop')}>Stop</ActionButton>
                  </div>
                )}
                {!done && (
                  <>
                    {(parseFloat(operation.yieldQty || 0) > 0 || parseFloat(operation.scrapQty || 0) > 0) && (
                      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>
                        Good {parseFloat(operation.yieldQty || 0)} · Scrap {parseFloat(operation.scrapQty || 0)}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                      <FormField label="Operator" width="240px">
                        <TextControl placeholder="Name" value={form.operatorName || ''} onChange={(event) => setField(operation.id, 'operatorName', event.target.value)} />
                      </FormField>
                      <FormField label="Good qty" width="160px" error={errors.yieldQty}>
                        <TextControl className={errors.yieldQty ? 'field-invalid' : undefined} invalid={!!errors.yieldQty} inputMode="decimal" placeholder="0" value={form.yieldQty || ''} onChange={(event) => setField(operation.id, 'yieldQty', event.target.value)} />
                      </FormField>
                      <FormField label="Scrap qty" width="160px">
                        <TextControl inputMode="decimal" placeholder="0" value={form.scrapQty || ''} onChange={(event) => setField(operation.id, 'scrapQty', event.target.value)} />
                      </FormField>
                      <FormField label="Rework qty" width="160px">
                        <TextControl inputMode="decimal" placeholder="0" value={form.reworkQty || ''} onChange={(event) => setField(operation.id, 'reworkQty', event.target.value)} />
                      </FormField>
                      <FormField label="Scrap reason" width="280px" error={errors.scrapReasonId}>
                        <SelectControl invalid={!!errors.scrapReasonId} value={form.scrapReasonId || ''} onChange={(event) => setField(operation.id, 'scrapReasonId', event.target.value)}>
                          <option value="">Select reason</option>
                          {scrapReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.code} — {reason.name}</option>)}
                        </SelectControl>
                      </FormField>
                      <FormField label="Rework reason" width="280px" error={errors.reworkReasonId}>
                        <SelectControl invalid={!!errors.reworkReasonId} value={form.reworkReasonId || ''} onChange={(event) => setField(operation.id, 'reworkReasonId', event.target.value)}>
                          <option value="">Select reason</option>
                          {reworkReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.code} — {reason.name}</option>)}
                        </SelectControl>
                      </FormField>
                      <FormField label="Labour minutes" width="180px">
                        <TextControl inputMode="decimal" placeholder="0" value={form.labourMinutes || ''} onChange={(event) => setField(operation.id, 'labourMinutes', event.target.value)} />
                      </FormField>
                      <FormField label="Machine minutes" width="180px">
                        <TextControl inputMode="decimal" placeholder="0" value={form.machineMinutes || ''} onChange={(event) => setField(operation.id, 'machineMinutes', event.target.value)} />
                      </FormField>
                      <FormField label="Finished lot" width="220px">
                        <TextControl placeholder="Lot" autoCapitalize="characters" autoComplete="off" value={form.lotNumber || ''} onChange={(event) => setField(operation.id, 'lotNumber', event.target.value)} />
                      </FormField>
                      <FormField label="Serial numbers" width="280px">
                        <TextControl placeholder="Serial numbers" autoComplete="off" value={form.serialNumbers || ''} onChange={(event) => setField(operation.id, 'serialNumbers', event.target.value)} />
                      </FormField>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                      <ActionButton variant="submit" onClick={() => confirm(operation)}>Confirm</ActionButton>
                    </div>
                  </>
                )}
              </Section>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
