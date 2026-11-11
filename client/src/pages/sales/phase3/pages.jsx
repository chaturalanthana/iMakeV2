import React, { useEffect, useState } from 'react';
import AppLayout from '../../../components/layout/AppLayout';
import DataTable from '../../../components/ui/DataTable';
import FilterBar from '../../../components/ui/FilterBar';
import FormField, { SelectControl, TextControl } from '../../../components/ui/FormField';
import FormModal from '../../../components/ui/FormModal';
import PageHeader from '../../../components/ui/PageHeader';
import PageSkeleton from '../../../components/ui/PageSkeleton';
import StatusBadge from '../../../components/ui/StatusBadge';
import ActionButton from '../../../components/ui/ActionButton';
import { useToast } from '../../../context/ToastContext';
import { api, errorsOf, messageOf } from './api';
import {
  BadgePercent, Truck, Route, Receipt, RotateCcw, Landmark, Bell, SlidersHorizontal, Plus
} from 'lucide-react';

function useLoader(path) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      const res = await api().get(path);
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, [path]);
  return { rows, loading, reload, setRows };
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PriceRules() {
  const { showToast } = useToast();
  const { rows, loading, reload } = useLoader('/api/sales/dispatch/prices');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ scope: 'CUSTOMER', price: '', minQty: '1', currency: 'LKR' });
  const [errors, setErrors] = useState({});
  const [options, setOptions] = useState({ customers: [], products: [], groups: [] });

  useEffect(() => {
    const client = api();
    Promise.all([
      client.get('/api/customers'),
      client.get('/api/products'),
      client.get('/api/customer-categories')
    ]).then(([customers, products, groups]) => {
      setOptions({ customers: customers.data || [], products: products.data || [], groups: groups.data || [] });
    }).catch(() => {});
  }, []);

  const save = async () => {
    const next = {};
    if (!form.productId) next.productId = 'Product is required.';
    if (form.price === '' || Number(form.price) < 0) next.price = 'Price is required.';
    if (form.scope === 'CUSTOMER' && !form.customerId) next.customerId = 'Customer is required.';
    if (form.scope === 'GROUP' && !form.customerCategoryId) next.customerCategoryId = 'Customer group is required.';
    if (form.scope === 'CHANNEL' && !form.channel) next.channel = 'Channel is required.';
    setErrors(next);
    if (Object.keys(next).length) return showToast('Please fill the highlighted fields.', 'error');
    try {
      await api().post('/api/sales/dispatch/prices', { ...form, price: Number(form.price), minQty: Number(form.minQty || 1) });
      setOpen(false);
      showToast('Price saved.', 'success');
      reload();
    } catch (error) {
      setErrors(errorsOf(error));
      showToast(messageOf(error, 'Failed to save price.'), 'error');
    }
  };

  return (
    <AppLayout title="Customer prices" icon={BadgePercent}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Level', accessor: 'scope', render: (row) => <StatusBadge status={row.scope} /> },
            { header: 'Applies to', render: (row) => row.customer?.name || row.category?.name || row.channel || 'Default' },
            { header: 'Product', render: (row) => row.product?.name },
            { header: 'Min qty', accessor: 'minQty' },
            { header: 'Price', accessor: 'price', render: (row) => money(row.price) }
          ]}
          data={rows}
          searchKeys={['scope', 'channel']}
          searchPlaceholder="Search prices..."
          extraActions={<ActionButton icon={Plus} onClick={() => setOpen(true)}>New price</ActionButton>}
          noDataMessage="No customer, group, channel or default prices yet."
        />
      )}
      <FormModal isOpen={open} onClose={() => setOpen(false)} title="Price rule" subtitle="Customer, then group, then channel, then default." icon={BadgePercent} onSubmit={save} submitLabel="Save">
        <FormField label="Level" variant="modal" required error={errors.scope}>
          <SelectControl value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} style={{ height: 'auto' }}>
            <option value="CUSTOMER">Customer</option>
            <option value="GROUP">Customer group</option>
            <option value="CHANNEL">Channel</option>
            <option value="DEFAULT">Default</option>
          </SelectControl>
        </FormField>
        {form.scope === 'CUSTOMER' && (
          <FormField label="Customer" variant="modal" required error={errors.customerId}>
            <SelectControl value={form.customerId || ''} onChange={(event) => setForm({ ...form, customerId: event.target.value })} style={{ height: 'auto' }}>
              <option value="">Select</option>
              {options.customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </SelectControl>
          </FormField>
        )}
        {form.scope === 'GROUP' && (
          <FormField label="Group" variant="modal" required error={errors.customerCategoryId}>
            <SelectControl value={form.customerCategoryId || ''} onChange={(event) => setForm({ ...form, customerCategoryId: event.target.value })} style={{ height: 'auto' }}>
              <option value="">Select</option>
              {options.groups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </SelectControl>
          </FormField>
        )}
        {form.scope === 'CHANNEL' && (
          <FormField label="Channel" variant="modal" required error={errors.channel}>
            <SelectControl value={form.channel || ''} onChange={(event) => setForm({ ...form, channel: event.target.value })} style={{ height: 'auto' }}>
              <option value="">Select</option>
              <option value="GENERAL_TRADE">General trade</option>
              <option value="MODERN_TRADE">Modern trade</option>
              <option value="VAN_SALES">Van sales</option>
              <option value="FACTORY_CASH">Factory cash</option>
            </SelectControl>
          </FormField>
        )}
        <FormField label="Product" variant="modal" required error={errors.productId}>
          <SelectControl value={form.productId || ''} onChange={(event) => setForm({ ...form, productId: event.target.value })} style={{ height: 'auto' }}>
            <option value="">Select</option>
            {options.products.map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Minimum quantity" variant="modal">
          <TextControl value={form.minQty} onChange={(event) => setForm({ ...form, minQty: event.target.value })} />
        </FormField>
        <FormField label="Price" variant="modal" required error={errors.price}>
          <TextControl invalid={!!errors.price} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
        </FormField>
      </FormModal>
    </AppLayout>
  );
}

export function DispatchBoard() {
  const { showToast } = useToast();
  const [board, setBoard] = useState(null);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [release, setRelease] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api().get('/api/sales/dispatch/board');
    setBoard(res.data);
  };
  useEffect(() => {
    load().catch(() => setBoard({ orders: [] }));
    api().get('/api/warehouses').then((res) => setWarehouses(res.data || [])).catch(() => {});
  }, []);

  const rows = (board?.orders || []).filter((row) => (!channel || row.channel === channel) && (!status || row.status === status));

  const submit = async () => {
    if (!warehouseId) {
      setError('Warehouse is required.');
      return showToast('Warehouse is required.', 'error');
    }
    try {
      await api().post(`/api/sales/dispatch/orders/${release.id}/release`, { warehouseId });
      setRelease(null);
      showToast('Order released for picking.', 'success');
      load();
    } catch (err) {
      setError(errorsOf(err).warehouseId || errorsOf(err).discount || errorsOf(err).credit || '');
      showToast(messageOf(err, 'Could not release the order.'), 'error');
    }
  };

  return (
    <AppLayout title="Dispatch" icon={Truck}>
      {!board ? <PageSkeleton type="table" /> : (
        <>
          <FilterBar>
            <FormField label="Channel" icon={Route} width="220px">
              <SelectControl value={channel} onChange={(event) => setChannel(event.target.value)}>
                <option value="">All channels</option>
                <option value="GENERAL_TRADE">General trade</option>
                <option value="MODERN_TRADE">Modern trade</option>
                <option value="VAN_SALES">Van sales</option>
                <option value="FACTORY_CASH">Factory cash</option>
              </SelectControl>
            </FormField>
            <FormField label="Status" width="220px">
              <SelectControl value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="RELEASED">Released</option>
                <option value="PARTIALLY_DELIVERED">Partially delivered</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </SelectControl>
            </FormField>
          </FilterBar>
          <DataTable
            columns={[
              { header: 'Order', accessor: 'orderNumber' },
              { header: 'Customer', accessor: 'customerName' },
              { header: 'Channel', accessor: 'channel', render: (row) => <StatusBadge status={row.channel} /> },
              { header: 'Pending', accessor: 'pendingQty' },
              { header: 'Delivered', accessor: 'deliveredQty' },
              { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
              { header: 'Actions', align: 'right', sortable: false, render: (row) => row.status === 'PENDING' ? (
                <ActionButton onClick={(event) => { event.stopPropagation(); setError(''); setRelease(row); }}>Release</ActionButton>
              ) : null }
            ]}
            data={rows}
            searchKeys={['orderNumber', 'customerName']}
            searchPlaceholder="Search orders..."
            noDataMessage="No orders in this view."
          />
        </>
      )}
      <FormModal isOpen={!!release} onClose={() => setRelease(null)} title="Release order" subtitle={release?.orderNumber} icon={Truck} onSubmit={submit} submitLabel="Release">
        <FormField label="Warehouse" variant="modal" required error={error}>
          <SelectControl invalid={!!error} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} style={{ height: 'auto' }}>
            <option value="">Select</option>
            {warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}
          </SelectControl>
        </FormField>
      </FormModal>
    </AppLayout>
  );
}

export function RoutePicks() {
  const { rows, loading } = useLoader('/api/sales/dispatch/picks');
  return (
    <AppLayout title="Route picks" icon={Route}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Pick', accessor: 'number' },
            { header: 'Route', render: (row) => row.route?.name || '—' },
            { header: 'Vehicle', render: (row) => row.vehicle?.registration || '—' },
            { header: 'Lines', render: (row) => row.summary?.length || row.lines?.length || 0 },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
          ]}
          data={rows}
          searchKeys={['number']}
          searchPlaceholder="Search pick lists..."
          noDataMessage="No route pick lists yet."
        />
      )}
    </AppLayout>
  );
}

export function Trips() {
  const { rows, loading } = useLoader('/api/sales/dispatch/trips');
  return (
    <AppLayout title="Trips and gate passes" icon={Truck}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Trip', accessor: 'number' },
            { header: 'Driver', accessor: 'driverName' },
            { header: 'Vehicle', render: (row) => row.vehicle?.registration || '—' },
            { header: 'Gate pass', render: (row) => row.gatePass ? <StatusBadge status={row.gatePass.status} /> : '—' },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
          ]}
          data={rows}
          searchKeys={['number', 'driverName']}
          searchPlaceholder="Search trips..."
          noDataMessage="No trip sheets yet."
        />
      )}
    </AppLayout>
  );
}

export function CashSale() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ saleKind: 'VAN_CASH', date: new Date().toISOString().slice(0, 10), quantity: '1', unitPrice: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const client = api();
    Promise.all([client.get('/api/customers'), client.get('/api/products'), client.get('/api/warehouses')]).then(([c, p, w]) => {
      setCustomers(c.data || []);
      setProducts(p.data || []);
      setWarehouses(w.data || []);
    }).catch(() => {});
  }, []);

  const fillPrice = async (productId, customerId) => {
    if (!productId) return;
    try {
      const res = await api().get('/api/sales/dispatch/quote', { params: { productId, customerId, channel: form.saleKind === 'VAN_CASH' ? 'VAN_SALES' : 'FACTORY_CASH', quantity: form.quantity || 1 } });
      setForm((current) => ({ ...current, unitPrice: String(res.data.price) }));
    } catch { /* keep the typed price */ }
  };

  const submit = async () => {
    const next = {};
    if (!form.customerId) next.customerId = 'Customer is required.';
    if (!form.warehouseId) next.warehouseId = 'Choose the van or factory location.';
    if (!form.date) next.date = 'Date is required.';
    if (!form.productId) next.productId = 'Product is required.';
    if (!(Number(form.quantity) > 0)) next.quantity = 'Quantity must be greater than zero.';
    if (form.unitPrice === '' || Number(form.unitPrice) < 0) next.unitPrice = 'Price is required.';
    setErrors(next);
    if (Object.keys(next).length) return showToast('Please fill the highlighted fields.', 'error');
    setSaving(true);
    try {
      const quantity = Number(form.quantity);
      const unitPrice = Number(form.unitPrice);
      const res = await api().post('/api/sales/dispatch/cash-sales', {
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        date: form.date,
        saleKind: form.saleKind,
        items: [{ productId: form.productId, quantity, unitPrice, total: quantity * unitPrice }]
      });
      showToast(`Posted ${res.data.invoiceNumber}. Stock, revenue and cash were updated together.`, 'success');
    } catch (error) {
      setErrors(errorsOf(error));
      showToast(messageOf(error, 'Failed to post the cash sale.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Van and factory sales" icon={Receipt}>
      <PageHeader title="Cash sale" subtitle="Posts the invoice, stock and cash in one step." actions={<ActionButton variant="submit" disabled={saving} onClick={submit}>Post sale</ActionButton>} />
      <FilterBar>
        <FormField label="Sale" width="220px" required error={errors.saleKind}>
          <SelectControl value={form.saleKind} onChange={(event) => setForm({ ...form, saleKind: event.target.value })}>
            <option value="VAN_CASH">Van sales</option>
            <option value="FACTORY_CASH">Factory cash</option>
          </SelectControl>
        </FormField>
        <FormField label="Customer" width="260px" required error={errors.customerId}>
          <SelectControl invalid={!!errors.customerId} value={form.customerId || ''} onChange={(event) => { setForm({ ...form, customerId: event.target.value }); fillPrice(form.productId, event.target.value); }}>
            <option value="">Select</option>
            {customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Location" width="260px" required error={errors.warehouseId}>
          <SelectControl invalid={!!errors.warehouseId} value={form.warehouseId || ''} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
            <option value="">Select</option>
            {warehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Date" width="180px" required error={errors.date}>
          <TextControl type="date" invalid={!!errors.date} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </FormField>
        <FormField label="Product" width="260px" required error={errors.productId}>
          <SelectControl invalid={!!errors.productId} value={form.productId || ''} onChange={(event) => { setForm({ ...form, productId: event.target.value }); fillPrice(event.target.value, form.customerId); }}>
            <option value="">Select</option>
            {products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Quantity" width="140px" required error={errors.quantity}>
          <TextControl invalid={!!errors.quantity} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        </FormField>
        <FormField label="Price" width="160px" required error={errors.unitPrice}>
          <TextControl invalid={!!errors.unitPrice} value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
        </FormField>
      </FilterBar>
    </AppLayout>
  );
}

export function SalesReturns() {
  const { showToast } = useToast();
  const { rows, loading, reload } = useLoader('/api/sales/dispatch/returns');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'GRA', date: new Date().toISOString().slice(0, 10), quantity: '1' });
  const [errors, setErrors] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const client = api();
    client.get('/api/sales/invoices').then((res) => setInvoices(res.data || [])).catch(() => {});
    client.get('/api/products').then((res) => setProducts(res.data || [])).catch(() => {});
  }, []);

  const save = async () => {
    const next = {};
    if (!form.invoiceId) next.invoiceId = 'Invoice is required.';
    if (!form.reason || form.reason.trim().length < 2) next.reason = 'A reason is required.';
    if (!form.productId) next.productId = 'Product is required.';
    if (!(Number(form.quantity) > 0)) next.quantity = 'Quantity must be greater than zero.';
    setErrors(next);
    if (Object.keys(next).length) return showToast('Please fill the highlighted fields.', 'error');
    try {
      await api().post('/api/sales/dispatch/returns', {
        invoiceId: form.invoiceId,
        date: form.date,
        kind: form.kind,
        reason: form.reason,
        items: [{ productId: form.productId, quantity: Number(form.quantity) }]
      });
      setOpen(false);
      showToast('Return posted and the invoice credited.', 'success');
      reload();
    } catch (error) {
      setErrors(errorsOf(error));
      showToast(messageOf(error, 'Failed to post the return.'), 'error');
    }
  };

  return (
    <AppLayout title="Sales returns" icon={RotateCcw}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Return', accessor: 'number' },
            { header: 'Customer', render: (row) => row.customer?.name },
            { header: 'Invoice', render: (row) => row.invoice?.invoiceNumber },
            { header: 'Kind', accessor: 'kind', render: (row) => <StatusBadge status={row.kind} /> },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
          ]}
          data={rows}
          searchKeys={['number']}
          searchPlaceholder="Search returns..."
          extraActions={<ActionButton icon={Plus} onClick={() => setOpen(true)}>New return</ActionButton>}
          noDataMessage="No sales returns yet."
        />
      )}
      <FormModal isOpen={open} onClose={() => setOpen(false)} title="Sales return" subtitle="Credits the invoice and puts the goods back." icon={RotateCcw} onSubmit={save} submitLabel="Post">
        <FormField label="Invoice" variant="modal" required error={errors.invoiceId}>
          <SelectControl invalid={!!errors.invoiceId} value={form.invoiceId || ''} onChange={(event) => setForm({ ...form, invoiceId: event.target.value })} style={{ height: 'auto' }}>
            <option value="">Select</option>
            {invoices.map((row) => <option key={row.id} value={row.id}>{row.invoiceNumber}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Kind" variant="modal" required>
          <SelectControl value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} style={{ height: 'auto' }}>
            <option value="MARKET">Market — expired</option>
            <option value="DAMAGE">Damage</option>
            <option value="GRA">Dissatisfaction</option>
          </SelectControl>
        </FormField>
        <FormField label="Product" variant="modal" required error={errors.productId}>
          <SelectControl invalid={!!errors.productId} value={form.productId || ''} onChange={(event) => setForm({ ...form, productId: event.target.value })} style={{ height: 'auto' }}>
            <option value="">Select</option>
            {products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </SelectControl>
        </FormField>
        <FormField label="Quantity" variant="modal" required error={errors.quantity}>
          <TextControl invalid={!!errors.quantity} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        </FormField>
        <FormField label="Reason" variant="modal" required error={errors.reason}>
          <TextControl invalid={!!errors.reason} value={form.reason || ''} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        </FormField>
      </FormModal>
    </AppLayout>
  );
}

export function BankFiles() {
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const exportFile = async () => {
    try {
      const res = await api().post('/api/sales/dispatch/bank-file/export', { from, to });
      setFile(res.data);
      showToast(`Exported ${res.data.rowCount} rows.`, 'success');
    } catch (error) {
      showToast(messageOf(error, 'Export failed.'), 'error');
    }
  };

  return (
    <AppLayout title="Bank file" icon={Landmark}>
      <FilterBar variant="inline" actions={<ActionButton onClick={exportFile}>Export CSV</ActionButton>}>
        <FormField label="From" width="180px">
          <TextControl type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </FormField>
        <FormField label="To" width="180px">
          <TextControl type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </FormField>
      </FilterBar>
      {file && <pre style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1rem', overflow: 'auto' }}>{file.body}</pre>}
    </AppLayout>
  );
}

export function DispatchSettings() {
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [defaults, setDefaults] = useState([]);

  useEffect(() => {
    const client = api();
    Promise.all([client.get('/api/sales/dispatch/settings'), client.get('/api/sales/dispatch/defaults')]).then(([settings, confirmed]) => {
      setForm(settings.data);
      setDefaults(confirmed.data);
    }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      const res = await api().put('/api/sales/dispatch/settings', {
        ...form,
        maxDiscountPercent: Number(form.maxDiscountPercent)
      });
      setForm(res.data);
      showToast('Dispatch settings saved.', 'success');
    } catch (error) {
      showToast(messageOf(error, 'Could not save settings.'), 'error');
    }
  };

  if (!form) return <AppLayout title="Dispatch settings" icon={SlidersHorizontal}><PageSkeleton type="form" /></AppLayout>;
  const flag = (key, label) => (
    <label key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
      <input type="checkbox" checked={!!form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
      {label}
    </label>
  );
  return (
    <AppLayout title="Dispatch settings" icon={SlidersHorizontal}>
      <PageHeader title="Confirmed defaults" subtitle="These apply until NCC confirms a different value." actions={<ActionButton variant="submit" onClick={save}>Save</ActionButton>} />
      <FilterBar>
        <FormField label="Max discount %" width="180px">
          <TextControl value={form.maxDiscountPercent} onChange={(event) => setForm({ ...form, maxDiscountPercent: event.target.value })} />
        </FormField>
        <FormField label="Shortage" width="220px">
          <SelectControl value={form.shortagePolicy} onChange={(event) => setForm({ ...form, shortagePolicy: event.target.value })}>
            <option value="ALLOW_PARTIAL">Allow partial</option>
            <option value="BLOCK">Block the release</option>
          </SelectControl>
        </FormField>
        <FormField label="Email hook URL" width="320px">
          <TextControl value={form.emailHookUrl || ''} onChange={(event) => setForm({ ...form, emailHookUrl: event.target.value })} />
        </FormField>
      </FilterBar>
      <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.5rem' }}>
        {flag('blockCreditOverLimit', 'Block release when the credit limit is exceeded')}
        {flag('blockOverdue', 'Block release when the customer is overdue')}
        {flag('gatePassRequired', 'Block departure until the gate pass is issued')}
        {flag('invoiceBeforeDispatch', 'Require the tax invoice before the gate pass')}
        {flag('emailHookEnabled', 'Send dispatch events to the email hook')}
      </div>
      <DataTable
        columns={[{ header: 'Decision', accessor: 'key' }, { header: 'Default', accessor: 'value' }]}
        data={defaults}
        searchPlaceholder="Search defaults..."
        searchKeys={['key', 'value']}
      />
    </AppLayout>
  );
}

export function NotificationsPage() {
  const { rows, loading, reload } = useLoader('/api/sales/dispatch/notifications');
  const mark = async (row) => {
    await api().post(`/api/sales/dispatch/notifications/${row.id}/read`);
    reload();
  };
  return (
    <AppLayout title="Notifications" icon={Bell}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'When', render: (row) => new Date(row.createdAt).toLocaleString() },
            { header: 'Title', accessor: 'title' },
            { header: 'Detail', accessor: 'body' },
            { header: 'Email', accessor: 'emailStatus', render: (row) => <StatusBadge status={row.emailStatus} /> },
            { header: 'Actions', align: 'right', sortable: false, render: (row) => row.readAt ? null : <ActionButton variant="secondary" onClick={(event) => { event.stopPropagation(); mark(row); }}>Mark read</ActionButton> }
          ]}
          data={rows}
          searchKeys={['title', 'body']}
          searchPlaceholder="Search notifications..."
          noDataMessage="No dispatch notifications yet."
        />
      )}
    </AppLayout>
  );
}
