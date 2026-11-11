import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useMatch, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import FilterBar from '../../components/ui/FilterBar';
import FormModal from '../../components/ui/FormModal';
import FormField, { SelectControl, TextControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import PageHeader from '../../components/ui/PageHeader';
import {
  Briefcase, Calendar, ClipboardList, CreditCard, FileText, Landmark, Plus, Printer, Receipt, Scale, Wallet
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  LineTable, applyServerErrors, authConfig, namedOptions, useApiList, useLookups, validateFields
} from './ui';

function Fields({ defs, values, setValues, errors }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
      {defs.map((field) => (
        <FormField key={field.name} label={field.label} required={field.required} error={errors[field.name]} width={field.width || '240px'}>
          {field.type === 'select' ? (
            <SelectControl value={values[field.name] || ''} invalid={!!errors[field.name]} onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}>
              <option value="">Select</option>
              {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectControl>
          ) : (
            <TextControl
              type={field.type || 'text'}
              value={values[field.name] || ''}
              invalid={!!errors[field.name]}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
            />
          )}
        </FormField>
      ))}
    </div>
  );
}

function Register({ title, icon, endpoint, columns, searchKeys, searchPlaceholder, newPath, newLabel, formTitle, formSubtitle, formIcon, fields, buildBody, rowTo, actions }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const creating = useMatch(newPath || '/__never__');
  const lookups = useLookups();
  const { rows, loading, initial, reload } = useApiList(endpoint);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const defs = typeof fields === 'function' ? fields(lookups) : (fields || []);

  const save = async () => {
    const next = validateFields(defs, values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post(endpoint, buildBody ? buildBody(values) : values, authConfig());
      showToast('Saved', 'success');
      setValues({});
      setErrors({});
      reload();
      if (newPath) navigate(newPath.replace('/new', ''));
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title={title} icon={icon}>
      {initial ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          searchKeys={searchKeys}
          noDataMessage="No records found."
          onRowClick={rowTo ? (row) => navigate(rowTo(row)) : undefined}
          extraActions={newPath ? <ActionButton icon={Plus} onClick={() => navigate(newPath)}>{newLabel}</ActionButton> : null}
        />
      )}
      {actions}
      {newPath && (
        <FormModal
          isOpen={!!creating}
          onClose={() => navigate(newPath.replace('/new', ''))}
          title={formTitle}
          subtitle={formSubtitle}
          icon={formIcon || icon}
          onSubmit={save}
          submitLabel={saving ? 'Saving...' : 'Save'}
          busy={saving}
          maxWidth="760px"
          overflow="visible"
        >
          <Fields defs={defs} values={values} setValues={setValues} errors={errors} />
        </FormModal>
      )}
    </AppLayout>
  );
}

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Centers() {
  return (
    <Register
      title="Cost and profit centers"
      icon={Landmark}
      endpoint="/api/phase2/centers"
      newPath="/finance/centers/new"
      newLabel="New Center"
      formTitle="Create center"
      formSubtitle="Cost center, profit center, or both"
      searchKeys={['code', 'name']}
      searchPlaceholder="Search by code or name..."
      fields={[
        { name: 'code', label: 'Code', required: true, width: '180px' },
        { name: 'name', label: 'Name', required: true, width: '280px' },
        { name: 'kind', label: 'Kind', type: 'select', width: '200px', options: [
          { value: 'BOTH', label: 'Cost and profit' },
          { value: 'COST', label: 'Cost' },
          { value: 'PROFIT', label: 'Profit' }
        ] }
      ]}
      buildBody={(values) => ({ ...values, kind: values.kind || 'BOTH' })}
      columns={[
        { header: 'Code', accessor: 'code', fontWeight: 600 },
        { header: 'Name', accessor: 'name' },
        { header: 'Kind', accessor: 'kind' },
        { header: 'Status', accessor: 'active', render: (row) => <StatusBadge status={row.active ? 'ACTIVE' : 'INACTIVE'} /> }
      ]}
    />
  );
}

export function Projects() {
  return (
    <Register
      title="Capital projects"
      icon={Briefcase}
      endpoint="/api/phase2/projects"
      newPath="/finance/projects/new"
      newLabel="New Project"
      formTitle="Create capital project"
      formSubtitle="Capex requests are checked against this budget"
      searchKeys={['code', 'name']}
      searchPlaceholder="Search by project code..."
      fields={[
        { name: 'code', label: 'Project code', required: true, width: '180px' },
        { name: 'name', label: 'Name', required: true, width: '280px' },
        { name: 'budgetAmount', label: 'Budget (LKR)', type: 'number', required: true, positive: true, width: '180px' }
      ]}
      columns={[
        { header: 'Code', accessor: 'code', fontWeight: 600 },
        { header: 'Name', accessor: 'name' },
        { header: 'Budget', accessor: 'budgetAmount', render: (row) => money(row.budgetAmount) },
        { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
      ]}
    />
  );
}

export function Budgets() {
  const lookups = useLookups();
  return (
    <Register
      title="Budgets"
      icon={Scale}
      endpoint="/api/phase2/budgets"
      newPath="/finance/budgets/new"
      newLabel="New Budget"
      formTitle="Create budget"
      formSubtitle="Opex is checked by account and cost center"
      searchKeys={['kind']}
      searchPlaceholder="Search by kind..."
      fields={() => [
        { name: 'kind', label: 'Kind', type: 'select', required: true, width: '160px', options: [{ value: 'OPEX', label: 'Opex' }, { value: 'CAPEX', label: 'Capex' }] },
        { name: 'year', label: 'Year', type: 'number', required: true, positive: true, width: '120px' },
        { name: 'month', label: 'Month', type: 'number', width: '120px' },
        { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true, width: '160px' },
        { name: 'accountId', label: 'Account', type: 'select', width: '280px', options: namedOptions(lookups.accounts, (row) => `${row.code} ${row.name}`) },
        { name: 'costCenterId', label: 'Cost center', type: 'select', width: '220px', options: namedOptions(lookups.centers, (row) => row.name) },
        { name: 'capitalProjectId', label: 'Project', type: 'select', width: '220px', options: namedOptions(lookups.projects, (row) => row.code) }
      ]}
      columns={[
        { header: 'Kind', accessor: 'kind', fontWeight: 600 },
        { header: 'Year', accessor: 'year' },
        { header: 'Month', accessor: 'month', render: (row) => row.month || 'Year' },
        { header: 'Amount', accessor: 'amount', render: (row) => money(row.amount) }
      ]}
    />
  );
}

export function Contracts() {
  const lookups = useLookups();
  const supplierName = Object.fromEntries(lookups.suppliers.map((row) => [row.id, row.name]));
  const productName = Object.fromEntries(lookups.products.map((row) => [row.id, row.name]));
  return (
    <Register
      title="Contract prices"
      icon={ClipboardList}
      endpoint="/api/phase2/contracts"
      newPath="/procurement/contracts/new"
      newLabel="New Price"
      formTitle="Agreed supplier price"
      formSubtitle="Prices outside the tolerance need a reason on the purchase order"
      searchKeys={['currencyCode']}
      searchPlaceholder="Search by currency..."
      fields={() => [
        { name: 'supplierId', label: 'Supplier', type: 'select', required: true, width: '240px', options: namedOptions(lookups.suppliers, (row) => row.name) },
        { name: 'productId', label: 'Product', type: 'select', required: true, width: '280px', options: namedOptions(lookups.products, (row) => `${row.code} ${row.name}`) },
        { name: 'unitPrice', label: 'Agreed price', type: 'number', required: true, positive: true, width: '160px' },
        { name: 'validFrom', label: 'Valid from', type: 'date', required: true, width: '180px' },
        { name: 'validTo', label: 'Valid to', type: 'date', width: '180px' },
        { name: 'currencyCode', label: 'Currency', type: 'select', width: '140px', options: [{ value: 'LKR', label: 'LKR' }, { value: 'USD', label: 'USD' }] },
        { name: 'tolerancePercent', label: 'Tolerance %', type: 'number', width: '140px' },
        { name: 'minimumOrderQty', label: 'Minimum qty', type: 'number', width: '140px' }
      ]}
      buildBody={(values) => ({ ...values, currencyCode: values.currencyCode || 'LKR' })}
      columns={[
        { header: 'Supplier', accessor: 'supplierId', render: (row) => supplierName[row.supplierId] || '' },
        { header: 'Product', accessor: 'productId', render: (row) => productName[row.productId] || '' },
        { header: 'Price', accessor: 'unitPrice', fontWeight: 600, render: (row) => money(row.unitPrice) },
        { header: 'Currency', accessor: 'currencyCode' },
        { header: 'From', accessor: 'validFrom', render: (row) => new Date(row.validFrom).toLocaleDateString() }
      ]}
    />
  );
}

export function Rfqs() {
  return (
    <Register
      title="Requests for quotation"
      icon={ClipboardList}
      endpoint="/api/phase2/rfqs"
      newPath="/procurement/rfqs/new"
      newLabel="New RFQ"
      searchKeys={['rfqNumber']}
      searchPlaceholder="Search by RFQ number..."
      rowTo={(row) => `/procurement/rfqs/${row.id}`}
      columns={[
        { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
        { header: 'RFQ #', accessor: 'rfqNumber', fontWeight: 600 },
        { header: 'Quotes', accessor: 'quotations', render: (row) => row.quotations?.length || 0 },
        { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
      ]}
    />
  );
}

export function NewRfq() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const lookups = useLookups();
  const [values, setValues] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [lines, setLines] = useState([{ id: 1 }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const products = namedOptions(lookups.products, (row) => `${row.code} ${row.name}`);
  const save = async () => {
    const next = validateFields([{ name: 'date', label: 'Date', required: true }], values);
    if (!lines.some((line) => line.productId && Number(line.quantity) > 0)) next.lines = 'Add at least one product.';
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/api/phase2/rfqs', {
        date: values.date,
        notes: values.notes,
        supplierIds: values.supplierId ? [values.supplierId] : [],
        lines: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }))
      }, authConfig());
      showToast('RFQ saved', 'success');
      navigate(`/procurement/rfqs/${res.data.id}`);
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
      setSaving(false);
    }
  };
  return (
    <AppLayout title="New RFQ" icon={ClipboardList}>
      <PageHeader
        onBack={() => navigate('/procurement/rfqs')}
        title="New request for quotation"
        subtitle="Invite a supplier and record the quantities to price"
        actions={(
          <>
            <ActionButton variant="discard" onClick={() => navigate('/procurement/rfqs')}>Discard</ActionButton>
            <ActionButton variant="submit" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save RFQ'}</ActionButton>
          </>
        )}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', margin: '1.5rem 0' }}>
        <Fields
          defs={[
            { name: 'date', label: 'Date', type: 'date', required: true, width: '180px' },
            { name: 'supplierId', label: 'Invite supplier', type: 'select', width: '280px', options: namedOptions(lookups.suppliers, (row) => row.name) },
            { name: 'notes', label: 'Notes', width: '320px' }
          ]}
          values={values}
          setValues={setValues}
          errors={errors}
        />
      </div>
      {errors.lines && <span className="field-error-text">{errors.lines}</span>}
      <LineTable
        columns={[
          { key: 'productId', label: 'Product', options: products },
          { key: 'quantity', label: 'Quantity', type: 'number', placeholder: '0' }
        ]}
        rows={lines}
        onAdd={() => setLines((prev) => [...prev, { id: Date.now() }])}
        onRemove={(id) => setLines((prev) => prev.filter((row) => row.id !== id))}
        onChange={(id, key, value) => setLines((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)))}
      />
    </AppLayout>
  );
}

export function RfqDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const lookups = useLookups();
  const [board, setBoard] = useState(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ leadTimeDays: '7' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const load = () => axios.get(`/api/phase2/rfqs/${id}`, authConfig()).then((res) => setBoard(res.data)).catch(() => setBoard(null));
  useEffect(() => { load(); }, [id]);
  if (!board) return <AppLayout title="Quotation comparison" icon={ClipboardList}><PageSkeleton type="table" /></AppLayout>;
  const product = board.rfq.lines[0];
  const saveQuote = async () => {
    const next = validateFields([
      { name: 'supplierId', label: 'Supplier', required: true },
      { name: 'unitPrice', label: 'Unit price', required: true, positive: true }
    ], values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/api/phase2/rfqs/${id}/quotes`, {
        supplierId: values.supplierId,
        date: new Date().toISOString().slice(0, 10),
        leadTimeDays: Number(values.leadTimeDays || 0),
        currencyCode: 'LKR',
        exchangeRate: 1,
        lines: [{ productId: product.productId, quantity: Number(product.quantity), unitPrice: Number(values.unitPrice) }]
      }, authConfig());
      setOpen(false);
      setValues({ leadTimeDays: '7' });
      load();
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  const select = async (quotationId) => {
    const reason = window.prompt('Why was this supplier selected?');
    if (!reason) return;
    try {
      await axios.post(`/api/phase2/rfqs/${id}/select`, { quotationId, reason, savePrices: true }, authConfig());
      showToast('Supplier selected', 'success');
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not select the quotation', 'error');
    }
  };
  return (
    <AppLayout title="Quotation comparison" icon={ClipboardList}>
      <DataTable
        columns={[
          { header: 'Rank', accessor: 'rank' },
          { header: 'Supplier', accessor: 'supplierName', fontWeight: 600 },
          { header: 'Lead time', accessor: 'leadTimeDays' },
          { header: 'Total LKR', accessor: 'totalBase', render: (row) => money(row.totalBase) },
          { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
          { header: 'Actions', align: 'right', sortable: false, render: (row) => board.rfq.status === 'OPEN' ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); select(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Select</button>
          ) : null }
        ]}
        data={board.quotes}
        searchKeys={['supplierName', 'status']}
        searchPlaceholder="Search quotations..."
        noDataMessage="No quotations recorded."
        extraActions={board.rfq.status === 'OPEN' ? <ActionButton icon={Plus} onClick={() => setOpen(true)}>Record quotation</ActionButton> : null}
      />
      <FormModal isOpen={open} onClose={() => setOpen(false)} title="Record a quotation" subtitle={board.rfq.rfqNumber} icon={ClipboardList} onSubmit={saveQuote} submitLabel={saving ? 'Saving...' : 'Save'} busy={saving}>
        <Fields
          defs={[
            { name: 'supplierId', label: 'Supplier', type: 'select', required: true, width: '100%', options: namedOptions(lookups.suppliers, (row) => row.name) },
            { name: 'unitPrice', label: 'Unit price', type: 'number', required: true, positive: true, width: '180px' },
            { name: 'leadTimeDays', label: 'Lead time (days)', type: 'number', width: '180px' }
          ]}
          values={values}
          setValues={setValues}
          errors={errors}
        />
      </FormModal>
    </AppLayout>
  );
}

export function LandedCosts() {
  return (
    <Register
      title="Landed cost"
      icon={Receipt}
      endpoint="/api/phase2/landed-costs"
      newPath="/procurement/landed-costs/new"
      newLabel="New Allocation"
      searchKeys={['number', 'basis']}
      searchPlaceholder="Search by document number..."
      columns={[
        { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
        { header: 'Number', accessor: 'number', fontWeight: 600 },
        { header: 'Basis', accessor: 'basis' },
        { header: 'GRN rate', accessor: 'grnExchangeRate' },
        { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
      ]}
    />
  );
}

export function NewLandedCost() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const lookups = useLookups();
  const [values, setValues] = useState({ date: new Date().toISOString().slice(0, 10), basis: 'VALUE' });
  const [lines, setLines] = useState([{ id: 1, kind: 'FREIGHT' }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const next = validateFields([
      { name: 'grnId', label: 'Goods receipt', required: true },
      { name: 'date', label: 'Date', required: true }
    ], values);
    if (!lines.some((line) => line.kind && Number(line.amount) > 0)) next.charges = 'Add freight, duty, clearing, or insurance.';
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/phase2/landed-costs', {
        grnId: values.grnId,
        date: values.date,
        basis: values.basis || 'VALUE',
        charges: lines.filter((line) => line.kind && Number(line.amount) > 0).map((line) => ({
          kind: line.kind,
          amount: Number(line.amount),
          exchangeRate: line.exchangeRate ? Number(line.exchangeRate) : undefined
        }))
      }, authConfig());
      showToast('Landed cost posted', 'success');
      navigate('/procurement/landed-costs');
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
      setSaving(false);
    }
  };
  return (
    <AppLayout title="Landed cost" icon={Receipt}>
      <PageHeader
        onBack={() => navigate('/procurement/landed-costs')}
        title="Allocate landed cost"
        subtitle="Freight, duty, clearing and insurance update the FIFO layer at the GRN rate"
        actions={(
          <>
            <ActionButton variant="discard" onClick={() => navigate('/procurement/landed-costs')}>Discard</ActionButton>
            <ActionButton variant="submit" disabled={saving} onClick={save}>{saving ? 'Posting...' : 'Post Allocation'}</ActionButton>
          </>
        )}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', margin: '1.5rem 0' }}>
        <Fields
          defs={[
            { name: 'grnId', label: 'Goods receipt', type: 'select', required: true, width: '240px', options: namedOptions(lookups.grns, (row) => row.grnNumber) },
            { name: 'date', label: 'Date', type: 'date', required: true, width: '180px' },
            { name: 'basis', label: 'Basis', type: 'select', width: '180px', options: [
              { value: 'VALUE', label: 'Value' },
              { value: 'QTY', label: 'Quantity' },
              { value: 'WEIGHT', label: 'Weight' }
            ] }
          ]}
          values={values}
          setValues={setValues}
          errors={errors}
        />
      </div>
      {errors.charges && <span className="field-error-text">{errors.charges}</span>}
      <LineTable
        columns={[
          { key: 'kind', label: 'Charge', options: ['FREIGHT', 'DUTY', 'CLEARING', 'INSURANCE'].map((value) => ({ value, label: value })) },
          { key: 'amount', label: 'Amount', type: 'number' },
          { key: 'exchangeRate', label: 'Invoice rate', type: 'number' }
        ]}
        rows={lines}
        onAdd={() => setLines((prev) => [...prev, { id: Date.now() }])}
        onRemove={(id) => setLines((prev) => prev.filter((row) => row.id !== id))}
        onChange={(id, key, value) => setLines((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)))}
      />
    </AppLayout>
  );
}

export function NewCapex() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const lookups = useLookups();
  const [values, setValues] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const defs = [
    { name: 'date', label: 'Date', type: 'date', required: true, width: '180px' },
    { name: 'capitalProjectId', label: 'Project', type: 'select', required: true, width: '280px', options: namedOptions(lookups.projects, (row) => `${row.code} ${row.name}`) },
    { name: 'productId', label: 'Item', type: 'select', required: true, width: '280px', options: namedOptions(lookups.products, (row) => `${row.code} ${row.name}`) },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true, positive: true, width: '140px' },
    { name: 'unitPrice', label: 'Price', type: 'number', required: true, positive: true, width: '160px' },
    { name: 'overrideReason', label: 'Override reason', width: '320px' }
  ];
  const save = async () => {
    const next = validateFields(defs, values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/procurement/purchase-requisitions', {
        date: values.date,
        spendClass: 'CAPEX',
        capitalProjectId: values.capitalProjectId,
        executiveOverride: Boolean(values.overrideReason),
        overrideReason: values.overrideReason,
        items: [{
          productId: values.productId,
          quantity: Number(values.quantity),
          unitPrice: Number(values.unitPrice),
          total: Number(values.quantity) * Number(values.unitPrice)
        }]
      }, authConfig());
      showToast('Capex request saved', 'success');
      navigate('/procurement/purchase-requisitions');
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
      setSaving(false);
    }
  };
  return (
    <AppLayout title="Capex request" icon={Briefcase}>
      <PageHeader
        onBack={() => navigate('/finance/projects')}
        title="Capex purchase request"
        subtitle="Checked against the project budget. Amounts at or above the threshold go to CWIP"
        actions={(
          <>
            <ActionButton variant="discard" onClick={() => navigate('/finance/projects')}>Discard</ActionButton>
            <ActionButton variant="submit" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Request'}</ActionButton>
          </>
        )}
      />
      <div style={{ marginTop: '1.5rem' }}>
        <Fields defs={defs} values={values} setValues={setValues} errors={errors} />
      </div>
    </AppLayout>
  );
}

export function Assets() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();
  const depreciating = useMatch('/finance/depreciation');
  const lookups = useLookups();
  const { rows, loading, initial, reload } = useApiList('/api/phase2/assets');
  const asset = rows.find((row) => row.id === id) || lookups.assets.find((row) => row.id === id);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const close = () => navigate('/finance/assets');
  const saveDepreciation = async () => {
    const defs = [
      { name: 'year', label: 'Year', required: true, positive: true },
      { name: 'month', label: 'Month', required: true, positive: true }
    ];
    const next = validateFields(defs, values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/phase2/depreciation-runs', { year: Number(values.year), month: Number(values.month) }, authConfig());
      showToast('Depreciation posted', 'success');
      close();
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  const saveAsset = async () => {
    if (!asset) return;
    const endpoint = asset.status === 'CWIP' ? 'capitalize' : 'transfer';
    const defs = asset.status === 'CWIP'
      ? [{ name: 'date', label: 'Commissioning date', required: true }, { name: 'classId', label: 'Asset class', required: true }]
      : [{ name: 'date', label: 'Date', required: true }];
    const next = validateFields(defs, values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/api/phase2/assets/${asset.id}/${endpoint}`, values, authConfig());
      showToast('Asset updated', 'success');
      reload();
      close();
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppLayout title="Fixed assets" icon={Landmark}>
      {initial ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Code', accessor: 'code', fontWeight: 600 },
            { header: 'Name', accessor: 'name' },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
            { header: 'Cost', accessor: 'cost', render: (row) => money(row.cost) },
            { header: 'NBV', accessor: 'accountingNbv', render: (row) => money(row.accountingNbv) }
          ]}
          data={rows}
          loading={loading}
          searchKeys={['code', 'name', 'status']}
          searchPlaceholder="Search by asset code..."
          noDataMessage="No assets yet."
          onRowClick={(row) => navigate(`/finance/assets/${row.id}`)}
          extraActions={<ActionButton icon={Calendar} onClick={() => navigate('/finance/depreciation')}>Run Depreciation</ActionButton>}
        />
      )}
      <FormModal isOpen={!!depreciating} onClose={close} title="Monthly depreciation" subtitle="The accounting book posts to the ledger. The tax book is kept separately." icon={Landmark} onSubmit={saveDepreciation} submitLabel={saving ? 'Posting...' : 'Run'} busy={saving}>
        <Fields defs={[
          { name: 'year', label: 'Year', type: 'number', required: true, positive: true, width: '140px' },
          { name: 'month', label: 'Month', type: 'number', required: true, positive: true, width: '140px' }
        ]} values={values} setValues={setValues} errors={errors} />
      </FormModal>
      <FormModal isOpen={!!asset} onClose={close} title={asset?.status === 'CWIP' ? 'Capitalize CWIP' : 'Transfer asset'} subtitle={asset?.name} icon={Landmark} onSubmit={saveAsset} submitLabel={saving ? 'Saving...' : 'Save'} busy={saving}>
        <Fields defs={asset?.status === 'CWIP' ? [
          { name: 'date', label: 'Commissioning date', type: 'date', required: true, width: '220px' },
          { name: 'classId', label: 'Asset class', type: 'select', required: true, width: '240px', options: namedOptions(lookups.classes, (row) => row.name) },
          { name: 'name', label: 'Asset name', width: '240px' }
        ] : [
          { name: 'date', label: 'Date', type: 'date', required: true, width: '180px' },
          { name: 'costCenterId', label: 'Cost center', type: 'select', width: '240px', options: namedOptions(lookups.centers, (row) => row.name) }
        ]} values={values} setValues={setValues} errors={errors} />
      </FormModal>
    </AppLayout>
  );
}

export function Notes() {
  const lookups = useLookups();
  const parties = [...lookups.customers, ...lookups.suppliers];
  const names = Object.fromEntries(parties.map((row) => [row.id, row.name]));
  return (
    <Register
      title="Credit and debit notes"
      icon={Receipt}
      endpoint="/api/phase2/notes"
      newPath="/finance/notes/new"
      newLabel="New Note"
      formTitle="Credit or debit note"
      formSubtitle="Posted to receivables or payables and to tax"
      searchKeys={['noteNumber', 'reasonCode', 'partyType']}
      searchPlaceholder="Search by note number..."
      fields={() => [
        { name: 'date', label: 'Date', type: 'date', required: true, width: '160px' },
        { name: 'partyType', label: 'Party', type: 'select', required: true, width: '160px', options: [{ value: 'CUSTOMER', label: 'Customer' }, { value: 'SUPPLIER', label: 'Supplier' }] },
        { name: 'partyId', label: 'Name', type: 'select', required: true, width: '240px', options: namedOptions(parties, (row) => row.name) },
        { name: 'kind', label: 'Kind', type: 'select', required: true, width: '140px', options: [{ value: 'CREDIT', label: 'Credit' }, { value: 'DEBIT', label: 'Debit' }] },
        { name: 'reasonCode', label: 'Reason', required: true, width: '180px' },
        { name: 'subtotal', label: 'Amount', type: 'number', required: true, positive: true, width: '160px' },
        { name: 'taxAmount', label: 'Tax', type: 'number', width: '140px' },
        { name: 'invoiceId', label: 'Invoice id', width: '240px' }
      ]}
      buildBody={(values) => ({ ...values, subtotal: Number(values.subtotal), taxAmount: Number(values.taxAmount || 0) })}
      columns={[
        { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
        { header: 'Number', accessor: 'noteNumber', fontWeight: 600 },
        { header: 'Party', accessor: 'partyId', render: (row) => names[row.partyId] || row.partyType },
        { header: 'Kind', accessor: 'kind', render: (row) => <StatusBadge status={row.kind === 'CREDIT' ? 'CLOSED' : 'PENDING'} label={row.kind} /> },
        { header: 'Reason', accessor: 'reasonCode' },
        { header: 'Amount', accessor: 'total', render: (row) => money(row.total) }
      ]}
    />
  );
}

export function Cheques() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const creating = useMatch('/finance/cheques/new');
  const lookups = useLookups();
  const { rows, loading, initial, reload } = useApiList('/api/phase2/cheques');
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const defs = [
    { name: 'chequeNumber', label: 'Cheque number', required: true, width: '180px' },
    { name: 'chequeDate', label: 'Cheque date', type: 'date', required: true, width: '180px' },
    { name: 'payee', label: 'Payee', required: true, width: '240px' },
    { name: 'direction', label: 'Direction', type: 'select', required: true, width: '160px', options: [{ value: 'IN', label: 'Incoming' }, { value: 'OUT', label: 'Outgoing' }] },
    { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true, width: '160px' },
    { name: 'partyId', label: 'Customer or supplier', type: 'select', width: '240px', options: namedOptions([...lookups.customers, ...lookups.suppliers], (row) => row.name) }
  ];
  const act = async (event, id, action) => {
    event.stopPropagation();
    try {
      await axios.post(`/api/phase2/cheques/${id}/${action}`, { date: new Date().toISOString().slice(0, 10) }, authConfig());
      showToast('Cheque updated', 'success');
      reload();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not update the cheque', 'error');
    }
  };
  const save = async () => {
    const next = validateFields(defs, values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/phase2/cheques', { ...values, amount: Number(values.amount), isPdc: true }, authConfig());
      showToast('Cheque recorded', 'success');
      reload();
      navigate('/finance/cheques');
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppLayout title="Cheque register" icon={CreditCard}>
      {initial ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Date', accessor: 'chequeDate', render: (row) => new Date(row.chequeDate).toLocaleDateString() },
            { header: 'Number', accessor: 'chequeNumber', fontWeight: 600 },
            { header: 'Payee', accessor: 'payee' },
            { header: 'Amount', accessor: 'amount', render: (row) => money(row.amount) },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
            { header: 'Actions', align: 'right', sortable: false, render: (row) => (
              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                {row.direction === 'IN' && row.status === 'UNREALISED' ? <button type="button" onClick={(event) => act(event, row.id, 'deposit')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Deposit</button> : null}
                {['UNREALISED', 'DEPOSITED', 'PRINTED', 'RELEASED'].includes(row.status) ? <button type="button" onClick={(event) => act(event, row.id, 'realise')} style={{ background: 'transparent', border: 'none', color: '#059669', fontWeight: 700, cursor: 'pointer' }}>Realise</button> : null}
                {!['BOUNCED', 'CANCELLED'].includes(row.status) ? <button type="button" onClick={(event) => act(event, row.id, 'bounce')} style={{ background: 'transparent', border: 'none', color: 'var(--error)', fontWeight: 700, cursor: 'pointer' }}>Bounce</button> : null}
              </div>
            ) }
          ]}
          data={rows}
          loading={loading}
          searchKeys={['chequeNumber', 'payee', 'status']}
          searchPlaceholder="Search by cheque number..."
          noDataMessage="No cheques recorded."
          extraActions={<ActionButton icon={Plus} onClick={() => navigate('/finance/cheques/new')}>New Cheque</ActionButton>}
        />
      )}
      <FormModal isOpen={!!creating} onClose={() => navigate('/finance/cheques')} title="Cheque" subtitle="Post-dated cheques stay in Cheques in Hand until they are realised" icon={CreditCard} onSubmit={save} submitLabel={saving ? 'Saving...' : 'Save'} busy={saving} maxWidth="760px" overflow="visible">
        <Fields defs={defs} values={values} setValues={setValues} errors={errors} />
      </FormModal>
    </AppLayout>
  );
}

export function Ious() {
  const navigate = useNavigate();
  const { id } = useParams();
  const creating = useMatch('/finance/ious/new');
  const { showToast } = useToast();
  const lookups = useLookups();
  const { rows, loading, initial, reload } = useApiList('/api/phase2/ious');
  const [values, setValues] = useState({ date: new Date().toISOString().slice(0, 10), kind: 'EXPENSE' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const close = () => navigate('/finance/ious');
  const issue = async () => {
    const defs = [
      { name: 'date', label: 'Date', required: true },
      { name: 'employeeName', label: 'Employee', required: true },
      { name: 'amount', label: 'Advance', required: true, positive: true }
    ];
    const next = validateFields(defs, values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      let fundId = values.fundId;
      if (!fundId) {
        const fund = lookups.funds[0] || (await axios.post('/api/phase2/petty-cash', { name: 'Main tin', amount: 20000, date: values.date }, authConfig())).data;
        fundId = fund.id;
      }
      await axios.post('/api/phase2/ious', { ...values, amount: Number(values.amount), fundId, source: 'PETTY_CASH' }, authConfig());
      showToast('IOU issued', 'success');
      reload();
      close();
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  const settle = async () => {
    const defs = [
      { name: 'date', label: 'Date', required: true },
      { name: 'amount', label: 'Amount', required: true, positive: true }
    ];
    const next = validateFields(defs, values);
    if ((values.kind || 'EXPENSE') === 'EXPENSE' && !values.expenseAccountId) next.expenseAccountId = 'Expense account is required.';
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/api/phase2/ious/${id}/settle`, { ...values, amount: Number(values.amount), kind: values.kind || 'EXPENSE' }, authConfig());
      showToast('Settlement posted', 'success');
      reload();
      close();
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppLayout title="IOU and petty cash" icon={Wallet}>
      {initial ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
            { header: 'Reference', accessor: 'reference', fontWeight: 600 },
            { header: 'Employee', accessor: 'employeeName' },
            { header: 'Department', accessor: 'department' },
            { header: 'Advance', accessor: 'amount', render: (row) => money(row.amount) },
            { header: 'Outstanding', accessor: 'settled', render: (row) => money(Number(row.amount) - Number(row.settled)) },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
          ]}
          data={rows}
          loading={loading}
          searchKeys={['reference', 'employeeName', 'status']}
          searchPlaceholder="Search by employee or reference..."
          noDataMessage="No IOUs recorded."
          onRowClick={(row) => navigate(`/finance/ious/${row.id}`)}
          extraActions={<ActionButton icon={Plus} onClick={() => navigate('/finance/ious/new')}>New IOU</ActionButton>}
        />
      )}
      <FormModal isOpen={!!creating} onClose={close} title="Employee IOU" subtitle="Issued from petty cash" icon={Wallet} onSubmit={issue} submitLabel={saving ? 'Saving...' : 'Issue'} busy={saving} maxWidth="720px" overflow="visible">
        <Fields defs={[
          { name: 'date', label: 'Date', type: 'date', required: true, width: '160px' },
          { name: 'employeeName', label: 'Employee', required: true, width: '220px' },
          { name: 'department', label: 'Department', width: '180px' },
          { name: 'amount', label: 'Advance', type: 'number', required: true, positive: true, width: '140px' },
          { name: 'fundId', label: 'Petty cash fund', type: 'select', width: '220px', options: namedOptions(lookups.funds, (row) => row.name) }
        ]} values={values} setValues={setValues} errors={errors} />
      </FormModal>
      <FormModal isOpen={!!id && !creating} onClose={close} title="Settle IOU" subtitle="Post the expense or the cash returned" icon={Wallet} onSubmit={settle} submitLabel={saving ? 'Posting...' : 'Post'} busy={saving} maxWidth="720px" overflow="visible">
        <Fields defs={[
          { name: 'date', label: 'Date', type: 'date', required: true, width: '160px' },
          { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true, width: '140px' },
          { name: 'kind', label: 'Settlement', type: 'select', width: '180px', options: [{ value: 'EXPENSE', label: 'Expense claim' }, { value: 'RETURN', label: 'Cash returned' }] },
          { name: 'expenseAccountId', label: 'Expense account', type: 'select', width: '280px', options: namedOptions(lookups.accounts.filter((row) => row.type === 'EXPENSE'), (row) => `${row.code} ${row.name}`) }
        ]} values={values} setValues={setValues} errors={errors} />
      </FormModal>
    </AppLayout>
  );
}

export function Closes() {
  return (
    <Register
      title="Period close"
      icon={Calendar}
      endpoint="/api/phase2/period-closes"
      newPath="/finance/period-close/new"
      newLabel="Open Period"
      formTitle="Open period close"
      formSubtitle="Inventory, production, payables, receivables, cash, assets, then the ledger"
      searchKeys={['status']}
      searchPlaceholder="Search by status..."
      rowTo={(row) => `/finance/period-close/${row.id}`}
      fields={[
        { name: 'year', label: 'Year', type: 'number', required: true, positive: true, width: '140px' },
        { name: 'month', label: 'Month', type: 'number', required: true, positive: true, width: '140px' }
      ]}
      buildBody={(values) => ({ year: Number(values.year), month: Number(values.month) })}
      columns={[
        { header: 'Year', accessor: 'year', fontWeight: 600 },
        { header: 'Month', accessor: 'month' },
        { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
        { header: 'Posting lock', accessor: 'fiscalStatus', render: (row) => <StatusBadge status={row.fiscalStatus || 'OPEN'} /> }
      ]}
    />
  );
}

export function CloseDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [close, setClose] = useState(null);
  const load = () => axios.get('/api/phase2/period-closes', authConfig()).then((res) => setClose((res.data || []).find((row) => row.id === id) || null));
  useEffect(() => { load(); }, [id]);
  if (!close) return <AppLayout title="Period close" icon={Calendar}><PageSkeleton type="table" /></AppLayout>;
  const mark = async (event, code) => {
    event.stopPropagation();
    try {
      await axios.post(`/api/phase2/period-closes/${id}/steps/${code}`, { status: 'DONE' }, authConfig());
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Complete the earlier step first', 'error');
    }
  };
  const post = async () => {
    try {
      await axios.post(`/api/phase2/period-closes/${id}/closing-entries`, {}, authConfig());
      showToast('Closing entries posted', 'success');
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not post closing entries', 'error');
    }
  };
  return (
    <AppLayout title={`Close ${close.year}-${String(close.month).padStart(2, '0')}`} icon={Calendar}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#64748b' }}>
        Posting lock: {close.fiscalStatus === 'CLOSED' ? 'Closed' : close.fiscalStatus === 'SOFT_CLOSED' ? 'Soft-closed' : 'Open'}. Completing every step soft-closes this month. Posting closing entries closes it.
      </p>
      <DataTable
        columns={[
          { header: 'Step', accessor: 'sequence' },
          { header: 'Name', accessor: 'name', fontWeight: 600 },
          { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
          { header: 'Actions', align: 'right', sortable: false, render: (row) => row.status === 'PENDING' ? (
            <button type="button" onClick={(event) => mark(event, row.code)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Mark done</button>
          ) : null }
        ]}
        data={close.steps || []}
        searchKeys={['name', 'status']}
        searchPlaceholder="Search steps..."
        noDataMessage="No close steps."
        extraActions={close.status !== 'HARD' ? <ActionButton onClick={post}>Post closing entries</ActionButton> : null}
      />
    </AppLayout>
  );
}

export function Collections() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [initial, setInitial] = useState(true);
  const [values, setValues] = useState({ disputeStatus: 'NONE' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const load = () => {
    const config = authConfig();
    Promise.all([
      axios.get('/api/customers', config),
      axios.get('/api/phase2/collections', config)
    ]).then(([customers, collections]) => {
      const byCustomer = Object.fromEntries((collections.data.cases || []).map((row) => [row.customerId, row]));
      setRows(customers.data.map((customer) => ({
        id: customer.id,
        name: customer.name,
        dispute: byCustomer[customer.id]?.disputeStatus || 'NONE',
        promised: byCustomer[customer.id]?.promisedDate ? String(byCustomer[customer.id].promisedDate).slice(0, 10) : '',
        notes: byCustomer[customer.id]?.notes || ''
      })));
    }).finally(() => setInitial(false));
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    const next = validateFields([{ name: 'body', label: 'Note', required: true }], values);
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/phase2/collections', { ...values, customerId: id }, authConfig());
      showToast('Follow-up saved', 'success');
      load();
      navigate('/finance/collections');
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppLayout title="Collections" icon={Wallet}>
      {initial ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Customer', accessor: 'name', fontWeight: 600 },
            { header: 'Dispute', accessor: 'dispute', render: (row) => <StatusBadge status={row.dispute === 'DISPUTED' ? 'PENDING' : row.dispute === 'RESOLVED' ? 'CLOSED' : 'OPEN'} label={row.dispute} /> },
            { header: 'Promised', accessor: 'promised' },
            { header: 'Notes', accessor: 'notes' }
          ]}
          data={rows}
          searchKeys={['name', 'dispute']}
          searchPlaceholder="Search by customer..."
          noDataMessage="No customers found."
          onRowClick={(row) => navigate(`/finance/collections/${row.id}`)}
        />
      )}
      <FormModal isOpen={!!id} onClose={() => navigate('/finance/collections')} title="Collection follow-up" subtitle="Promised date, dispute and the note from the debtor meeting" icon={Wallet} onSubmit={save} submitLabel={saving ? 'Saving...' : 'Save'} busy={saving}>
        <Fields defs={[
          { name: 'disputeStatus', label: 'Dispute', type: 'select', width: '180px', options: [{ value: 'NONE', label: 'None' }, { value: 'DISPUTED', label: 'Disputed' }, { value: 'RESOLVED', label: 'Resolved' }] },
          { name: 'promisedDate', label: 'Promised date', type: 'date', width: '180px' },
          { name: 'body', label: 'Note', required: true, width: '100%' }
        ]} values={values} setValues={setValues} errors={errors} />
      </FormModal>
    </AppLayout>
  );
}

const REPORTS = [
  ['trial-balance', 'Trial balance'], ['balance-sheet', 'Balance sheet'], ['profit-and-loss', 'Profit and loss'],
  ['cash-flow', 'Cash flow'], ['gl-detail', 'General ledger detail'], ['chart-of-accounts', 'Chart of accounts'],
  ['sales-register', 'Sales register'], ['open-sales-orders', 'Open sales orders'], ['ar-aging', 'AR ageing'],
  ['debtor-review', 'Debtor review'], ['ar-credit-notes', 'AR credit notes'], ['sales-analysis', 'Sales analysis'],
  ['grni', 'GRNI'], ['ap-aging', 'AP ageing'], ['ap-credit-notes', 'AP credit notes'], ['cash-requirements', 'Cash requirements'],
  ['purchase-analysis', 'Purchase analysis'], ['bank-reconciliation', 'Bank reconciliation'], ['cash-position', 'Cash position'],
  ['petty-cash', 'Petty cash'], ['cheque-register', 'Cheque register'], ['iou-list', 'IOU list'],
  ['stock-valuation', 'Stock valuation'], ['inventory-aging', 'Inventory ageing'], ['stock-variance', 'Stock variance'],
  ['production-variance', 'Production variance'], ['wip', 'Work in progress'], ['budget-vs-actual', 'Budget versus actual'],
  ['cost-center-profitability', 'Cost center profitability'], ['fixed-assets', 'Fixed assets'], ['tax-summary', 'VAT, SSCL and WHT'],
  ['audit-trail', 'Posted documents'], ['landed-cost', 'Landed cost']
];

export function FinanceReports() {
  const year = new Date().getFullYear();
  const [reportKey, setReportKey] = useState('profit-and-loss');
  const [fromDate, setFromDate] = useState(`${year}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async (key = reportKey, from = fromDate, to = toDate) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/phase2/reports/${key}`, { ...authConfig(), params: { from, to, asOf: to } });
      setColumns((res.data.columns || []).map((column) => ({ header: column.label, accessor: column.key })));
      setRows(res.data.rows || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [reportKey, fromDate, toDate]);
  const exportFile = async () => {
    const res = await axios.get(`/api/phase2/reports/${reportKey}`, {
      ...authConfig(),
      params: { from: fromDate, to: toDate, asOf: toDate, format: 'xlsx' },
      responseType: 'blob'
    });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportKey}.xlsx`;
    link.click();
  };
  return (
    <AppLayout title="Finance reports" icon={FileText}>
      <FilterBar
        actions={(
          <>
            <ActionButton variant="secondary" icon={Printer} onClick={() => window.print()}>Print</ActionButton>
            <ActionButton variant="secondary" onClick={exportFile}>Export XLSX</ActionButton>
          </>
        )}
      >
        <FormField label="From" width="180px">
          <TextControl type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </FormField>
        <FormField label="To" width="180px">
          <TextControl type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </FormField>
        <FormField label="Report" width="260px">
          <SelectControl value={reportKey} onChange={(event) => setReportKey(event.target.value)}>
            {REPORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </SelectControl>
        </FormField>
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchPlaceholder="Search this report..."
        searchKeys={columns.slice(0, 3).map((column) => column.accessor)}
        noDataMessage="No rows for this filter."
      />
    </AppLayout>
  );
}
