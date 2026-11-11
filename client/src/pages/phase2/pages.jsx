import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import {
  FileText, Briefcase, ClipboardList, Landmark, Scale, Wallet, Receipt, CreditCard, Calendar
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  OriginalList, MasterForm, Field, LineTable, ReportFilter, authConfig, inputStyle,
  sectionHeaderStyle, applyServerErrors, useApiList
} from './ui';

function options(rows, label) {
  return (rows || []).map((row) => ({ value: row.id, label: label(row) }));
}

function useLookups() {
  const [data, setData] = useState({ suppliers: [], products: [], customers: [], accounts: [], projects: [], grns: [], classes: [], centers: [], funds: [], assets: [], employees: [] });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const config = authConfig();
    Promise.all([
      axios.get('/api/suppliers', config),
      axios.get('/api/products', config),
      axios.get('/api/customers', config),
      axios.get('/api/finance/accounts', config),
      axios.get('/api/phase2/projects', config),
      axios.get('/api/procurement/grn', config),
      axios.get('/api/phase2/asset-classes', config),
      axios.get('/api/phase2/centers', config),
      axios.get('/api/phase2/petty-cash', config),
      axios.get('/api/phase2/assets', config),
      axios.get('/api/hr/employees', config).catch(() => ({ data: [] }))
    ]).then(([suppliers, products, customers, accounts, projects, grns, classes, centers, funds, assets, employees]) => {
      setData({
        suppliers: suppliers.data || [], products: products.data || [], customers: customers.data || [],
        accounts: accounts.data || [], projects: projects.data || [], grns: grns.data || [],
        classes: classes.data || [], centers: centers.data || [], funds: funds.data || [],
        assets: assets.data || [], employees: employees.data || []
      });
    }).finally(() => setReady(true));
  }, []);
  return { ...data, ready };
}

function statusText(status) {
  const color = status === 'CLOSED' || status === 'ACTIVE' || status === 'POSTED' || status === 'REALISED' || status === 'HARD' ? '#059669' : status === 'BOUNCED' || status === 'CANCELLED' ? '#dc2626' : '#d97706';
  return <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{status}</span>;
}

function SimpleList({ title, icon, endpoint, columns, searchKeys, searchPlaceholder, newTo, newLabel, rowTo }) {
  const navigate = useNavigate();
  const { rows, loading, initial } = useApiList(endpoint);
  return (
    <OriginalList title={title} icon={icon} columns={columns} rows={rows} loading={loading} initial={initial} searchKeys={searchKeys} searchPlaceholder={searchPlaceholder} newLabel={newLabel} onNew={() => navigate(newTo)} onRowClick={rowTo ? (row) => navigate(rowTo(row)) : undefined} />
  );
}

export function Centers() {
  return (
    <SimpleList title="Cost and profit centers" icon={Landmark} endpoint="/api/phase2/centers" newTo="/finance/centers/new" newLabel="New Center" searchKeys={['code', 'name']} searchPlaceholder="Search by code or name..." columns={[
      { header: 'Code', accessor: 'code', fontWeight: 600 },
      { header: 'Name', accessor: 'name', fontWeight: 500 },
      { header: 'Kind', accessor: 'kind' },
      { header: 'Status', accessor: 'active', render: (row) => statusText(row.active ? 'ACTIVE' : 'INACTIVE') }
    ]} />
  );
}

export function Projects() {
  return (
    <SimpleList title="Capital projects" icon={Briefcase} endpoint="/api/phase2/projects" newTo="/finance/projects/new" newLabel="New Project" searchKeys={['code', 'name']} searchPlaceholder="Search by project code..." columns={[
      { header: 'Code', accessor: 'code', fontWeight: 600 },
      { header: 'Name', accessor: 'name' },
      { header: 'Budget', accessor: 'budgetAmount', fontWeight: 600 },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) }
    ]} />
  );
}

export function Budgets() {
  return (
    <SimpleList title="Budgets" icon={Scale} endpoint="/api/phase2/budgets" newTo="/finance/budgets/new" newLabel="New Budget" searchKeys={['kind']} searchPlaceholder="Search by kind..." columns={[
      { header: 'Kind', accessor: 'kind', fontWeight: 600 },
      { header: 'Year', accessor: 'year' },
      { header: 'Month', accessor: 'month', render: (row) => row.month || 'Year' },
      { header: 'Amount', accessor: 'amount', fontWeight: 600 }
    ]} />
  );
}

export function Contracts() {
  const lookups = useLookups();
  const names = {
    supplier: Object.fromEntries(lookups.suppliers.map((row) => [row.id, row.name])),
    product: Object.fromEntries(lookups.products.map((row) => [row.id, row.name]))
  };
  return (
    <SimpleList title="Contract prices" icon={ClipboardList} endpoint="/api/phase2/contracts" newTo="/procurement/contracts/new" newLabel="New Price" searchKeys={['currencyCode']} searchPlaceholder="Search by currency..." columns={[
      { header: 'Supplier', accessor: 'supplierId', render: (row) => names.supplier[row.supplierId] || row.supplierId },
      { header: 'Product', accessor: 'productId', render: (row) => names.product[row.productId] || row.productId },
      { header: 'Price', accessor: 'unitPrice', fontWeight: 600 },
      { header: 'Currency', accessor: 'currencyCode' },
      { header: 'From', accessor: 'validFrom', render: (row) => new Date(row.validFrom).toLocaleDateString() }
    ]} />
  );
}

export function Rfqs() {
  return (
    <SimpleList title="Requests for quotation" icon={ClipboardList} endpoint="/api/phase2/rfqs" newTo="/procurement/rfqs/new" newLabel="New RFQ" searchKeys={['rfqNumber']} searchPlaceholder="Search by RFQ number..." rowTo={(row) => `/procurement/rfqs/${row.id}`} columns={[
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'RFQ #', accessor: 'rfqNumber', fontWeight: 600 },
      { header: 'Quotes', accessor: 'quotations', render: (row) => row.quotations?.length || 0 },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) }
    ]} />
  );
}

export function LandedCosts() {
  return (
    <SimpleList title="Landed cost" icon={Receipt} endpoint="/api/phase2/landed-costs" newTo="/procurement/landed-costs/new" newLabel="New Allocation" searchKeys={['number', 'basis']} searchPlaceholder="Search by document number..." columns={[
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Number', accessor: 'number', fontWeight: 600 },
      { header: 'Basis', accessor: 'basis' },
      { header: 'GRN rate', accessor: 'grnExchangeRate' },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) }
    ]} />
  );
}

export function Assets() {
  return (
    <SimpleList title="Fixed assets" icon={Landmark} endpoint="/api/phase2/assets" newTo="/finance/depreciation" newLabel="Run Depreciation" searchKeys={['code', 'name', 'status']} searchPlaceholder="Search by asset code..." rowTo={(row) => `/finance/assets/${row.id}`} columns={[
      { header: 'Code', accessor: 'code', fontWeight: 600 },
      { header: 'Name', accessor: 'name' },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) },
      { header: 'Cost', accessor: 'cost', fontWeight: 600 },
      { header: 'NBV', accessor: 'accountingNbv' }
    ]} />
  );
}

export function Notes() {
  return (
    <SimpleList title="Credit and debit notes" icon={Receipt} endpoint="/api/phase2/notes" newTo="/finance/notes/new" newLabel="New Note" searchKeys={['noteNumber', 'reasonCode', 'partyType']} searchPlaceholder="Search by note number..." columns={[
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Number', accessor: 'noteNumber', fontWeight: 600 },
      { header: 'Party', accessor: 'partyType' },
      { header: 'Kind', accessor: 'kind' },
      { header: 'Reason', accessor: 'reasonCode' },
      { header: 'Amount', accessor: 'total', fontWeight: 600 }
    ]} />
  );
}

export function Cheques() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { rows, loading, initial, reload } = useApiList('/api/phase2/cheques');
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
  return (
    <OriginalList title="Cheque register" icon={CreditCard} columns={[
      { header: 'Date', accessor: 'chequeDate', render: (row) => new Date(row.chequeDate).toLocaleDateString() },
      { header: 'Number', accessor: 'chequeNumber', fontWeight: 600 },
      { header: 'Payee', accessor: 'payee' },
      { header: 'Amount', accessor: 'amount', fontWeight: 600 },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) },
      { header: 'Actions', align: 'right', sortable: false, render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {row.direction === 'IN' && row.status === 'UNREALISED' ? <button type="button" onClick={(event) => act(event, row.id, 'deposit')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Deposit</button> : null}
          {['UNREALISED', 'DEPOSITED', 'PRINTED', 'RELEASED'].includes(row.status) ? <button type="button" onClick={(event) => act(event, row.id, 'realise')} style={{ background: 'transparent', border: 'none', color: '#059669', fontWeight: 700, cursor: 'pointer' }}>Realise</button> : null}
          {!['BOUNCED', 'CANCELLED'].includes(row.status) ? <button type="button" onClick={(event) => act(event, row.id, 'bounce')} style={{ background: 'transparent', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Bounce</button> : null}
        </div>
      ) }
    ]} rows={rows} loading={loading} initial={initial} searchKeys={['chequeNumber', 'payee', 'status']} searchPlaceholder="Search by cheque number..." newLabel="New Cheque" onNew={() => navigate('/finance/cheques/new')} />
  );
}

export function Ious() {
  return (
    <SimpleList title="IOU and petty cash" icon={Wallet} endpoint="/api/phase2/ious" newTo="/finance/ious/new" newLabel="New IOU" searchKeys={['reference', 'employeeName', 'status']} searchPlaceholder="Search by employee or reference..." rowTo={(row) => `/finance/ious/${row.id}`} columns={[
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Reference', accessor: 'reference', fontWeight: 600 },
      { header: 'Employee', accessor: 'employeeName' },
      { header: 'Department', accessor: 'department' },
      { header: 'Advance', accessor: 'amount', fontWeight: 600 },
      { header: 'Outstanding', accessor: 'settled', render: (row) => (Number(row.amount) - Number(row.settled)).toFixed(2) },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) }
    ]} />
  );
}

export function Closes() {
  return (
    <SimpleList title="Period close" icon={Calendar} endpoint="/api/phase2/period-closes" newTo="/finance/period-close/new" newLabel="Open Period" searchKeys={['status']} searchPlaceholder="Search by status..." rowTo={(row) => `/finance/period-close/${row.id}`} columns={[
      { header: 'Year', accessor: 'year', fontWeight: 600 },
      { header: 'Month', accessor: 'month' },
      { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) }
    ]} />
  );
}

function FormShell({ title, subtitle, backTo, saveLabel, tabs, onSave, childrenBuilder }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeStatus, setActiveStatus] = useState('ACTIVE');
  const [values, setValues] = useState({});
  const [lines, setLines] = useState([{ id: 1 }]);
  const set = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));
  const submit = async () => {
    const next = {};
    tabs.flatMap((tab) => tab.fields || []).forEach((field) => {
      if (field.required && !String(values[field.name] || '').trim()) next[field.name] = `${field.label} is required.`;
      if (field.positive && values[field.name] !== undefined && values[field.name] !== '' && !(Number(values[field.name]) > 0)) next[field.name] = `${field.label} must be greater than zero.`;
    });
    if (Object.keys(next).length) {
      setErrors(next);
      showToast(Object.values(next)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await onSave(values, lines, activeStatus);
      showToast('Saved', 'success');
      navigate(created || backTo);
    } catch (error) {
      applyServerErrors(error, showToast, setErrors);
      setSaving(false);
    }
  };
  return (
    <MasterForm title={title} subtitle={subtitle} backTo={backTo} tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} onSubmit={submit} saving={saving} saveLabel={saveLabel} activeStatus={activeStatus} setActiveStatus={tabs.some((tab) => tab.status) ? setActiveStatus : null}>
      {tabs.filter((tab) => tab.id === activeTab).map((tab) => (
        <div key={tab.id}>
          <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>{tab.label}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: tab.lines ? '100%' : '550px' }}>
            {(tab.fields || []).map((field) => (
              <Field key={field.name} label={field.label} required={field.required} error={errors[field.name]}>
                {field.type === 'select' ? (
                  <select value={values[field.name] || ''} onChange={(event) => set(field.name, event.target.value)} style={inputStyle} className={errors[field.name] ? 'field-invalid' : undefined}>
                    <option value="">Select</option>
                    {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input type={field.type || 'text'} value={values[field.name] || ''} onChange={(event) => set(field.name, event.target.value)} style={inputStyle} className={errors[field.name] ? 'field-invalid' : undefined} />
                )}
              </Field>
            ))}
            {tab.lines ? (
              <LineTable columns={tab.lines} rows={lines} onAdd={() => setLines((prev) => [...prev, { id: Date.now() }])} onRemove={(id) => setLines((prev) => prev.filter((row) => row.id !== id))} onChange={(id, key, value) => setLines((prev) => prev.map((row) => row.id === id ? { ...row, [key]: value } : row))} />
            ) : null}
          </div>
        </div>
      ))}
      {childrenBuilder ? childrenBuilder({ values, lines, set }) : null}
    </MasterForm>
  );
}

export function NewCenter() {
  return (
    <FormShell title="Create center" subtitle="Cost center, profit center, or both." backTo="/finance/centers" saveLabel="Save Center" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, status: true, fields: [
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'BOTH', label: 'Cost and profit' }, { value: 'COST', label: 'Cost' }, { value: 'PROFIT', label: 'Profit' }] }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/centers', { ...values, kind: values.kind || 'BOTH' }, authConfig()).then(() => '/finance/centers')} />
  );
}

export function NewProject() {
  return (
    <FormShell title="Create capital project" subtitle="Budget checked when a capex request is saved." backTo="/finance/projects" saveLabel="Save Project" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'code', label: 'Project code', required: true },
        { name: 'name', label: 'Name', required: true },
        { name: 'budgetAmount', label: 'Budget (LKR)', type: 'number', required: true, positive: true }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/projects', values, authConfig()).then(() => '/finance/projects')} />
  );
}

export function NewBudget() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="New budget" icon={Scale}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Create budget" subtitle="Opex is checked by account and cost center. Capex uses the project budget." backTo="/finance/budgets" saveLabel="Save Budget" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'kind', label: 'Kind', type: 'select', required: true, options: [{ value: 'OPEX', label: 'Opex' }, { value: 'CAPEX', label: 'Capex' }] },
        { name: 'year', label: 'Year', type: 'number', required: true, positive: true },
        { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'month', label: 'Month (0 = year)', type: 'number' },
        { name: 'accountId', label: 'Account', type: 'select', options: options(lookups.accounts, (row) => `${row.code} ${row.name}`) },
        { name: 'costCenterId', label: 'Cost center', type: 'select', options: options(lookups.centers, (row) => row.name) },
        { name: 'capitalProjectId', label: 'Project', type: 'select', options: options(lookups.projects, (row) => row.code) }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/budgets', values, authConfig()).then(() => '/finance/budgets')} />
  );
}

export function NewContract() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="New contract price" icon={ClipboardList}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Agreed supplier price" subtitle="Purchase orders outside the tolerance need a reason." backTo="/procurement/contracts" saveLabel="Save Price" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'supplierId', label: 'Supplier', type: 'select', required: true, options: options(lookups.suppliers, (row) => row.name) },
        { name: 'productId', label: 'Product', type: 'select', required: true, options: options(lookups.products, (row) => `${row.code} ${row.name}`) },
        { name: 'unitPrice', label: 'Agreed price', type: 'number', required: true, positive: true },
        { name: 'validFrom', label: 'Valid from', type: 'date', required: true }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'validTo', label: 'Valid to', type: 'date' },
        { name: 'currencyCode', label: 'Currency', type: 'select', options: [{ value: 'LKR', label: 'LKR' }, { value: 'USD', label: 'USD' }] },
        { name: 'tolerancePercent', label: 'Tolerance %', type: 'number' },
        { name: 'minimumOrderQty', label: 'Minimum order qty', type: 'number' }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/contracts', { ...values, currencyCode: values.currencyCode || 'LKR' }, authConfig()).then(() => '/procurement/contracts')} />
  );
}

export function NewRfq() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="New RFQ" icon={ClipboardList}><PageSkeleton type="form" /></AppLayout>;
  const productOptions = options(lookups.products, (row) => `${row.code} ${row.name}`);
  return (
    <FormShell title="New request for quotation" subtitle="Record supplier prices and keep the reason for the selection." backTo="/procurement/rfqs" saveLabel="Save RFQ" tabs={[
      { id: 'lines', label: 'Lines', icon: FileText, fields: [{ name: 'date', label: 'Date', type: 'date', required: true }], lines: [
        { key: 'productId', label: 'Product', options: productOptions },
        { key: 'quantity', label: 'Quantity', type: 'number', placeholder: '0' }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'supplierId', label: 'Invite supplier', type: 'select', options: options(lookups.suppliers, (row) => row.name) },
        { name: 'notes', label: 'Notes' }
      ] }
    ]} onSave={(values, lines) => axios.post('/api/phase2/rfqs', {
      date: values.date,
      notes: values.notes,
      supplierIds: values.supplierId ? [values.supplierId] : [],
      lines: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }))
    }, authConfig()).then((res) => `/procurement/rfqs/${res.data.id}`)} />
  );
}

export function RfqDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const lookups = useLookups();
  const [board, setBoard] = useState(null);
  const [quote, setQuote] = useState({ supplierId: '', unitPrice: '', leadTimeDays: '7' });
  const load = () => axios.get(`/api/phase2/rfqs/${id}`, authConfig()).then((res) => setBoard(res.data));
  useEffect(() => { load(); }, [id]);
  if (!board) return <AppLayout title="Quotation comparison" icon={ClipboardList}><PageSkeleton type="table" /></AppLayout>;
  const product = board.rfq.lines[0];
  const saveQuote = async () => {
    try {
      await axios.post(`/api/phase2/rfqs/${id}/quotes`, {
        supplierId: quote.supplierId, date: new Date().toISOString().slice(0, 10), leadTimeDays: Number(quote.leadTimeDays || 0), currencyCode: 'LKR', exchangeRate: 1,
        lines: [{ productId: product.productId, quantity: Number(product.quantity), unitPrice: Number(quote.unitPrice) }]
      }, authConfig());
      setQuote({ supplierId: '', unitPrice: '', leadTimeDays: '7' });
      load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not save the quotation', 'error');
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
      <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{board.rfq.rfqNumber} · {board.rfq.status}</div>
      <DataTable columns={[
        { header: 'Rank', accessor: 'rank' },
        { header: 'Supplier', accessor: 'supplierName', fontWeight: 600 },
        { header: 'Lead time', accessor: 'leadTimeDays' },
        { header: 'Total LKR', accessor: 'totalBase', fontWeight: 600 },
        { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) },
        { header: 'Actions', align: 'right', render: (row) => board.rfq.status === 'OPEN' ? <button type="button" onClick={(event) => { event.stopPropagation(); select(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Select</button> : null }
      ]} data={board.quotes} searchKeys={['supplierName']} searchPlaceholder="Search quotations..." />
      {board.rfq.status === 'OPEN' ? (
        <div style={{ marginTop: '1.5rem', background: '#fff', padding: '1.5rem', borderRadius: '12px', maxWidth: '720px' }}>
          <h3 style={sectionHeaderStyle}>Record a quotation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="Supplier" required>
              <select value={quote.supplierId} onChange={(event) => setQuote({ ...quote, supplierId: event.target.value })} style={inputStyle}>
                <option value="">Select</option>
                {lookups.suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </Field>
            <Field label="Unit price" required>
              <input type="number" value={quote.unitPrice} onChange={(event) => setQuote({ ...quote, unitPrice: event.target.value })} style={inputStyle} />
            </Field>
            <button type="button" onClick={saveQuote} style={{ alignSelf: 'flex-start', padding: '0.55rem 1.25rem', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save quotation</button>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}

export function NewLandedCost() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="Landed cost" icon={Receipt}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Allocate landed cost" subtitle="Freight, duty, clearing and insurance update the FIFO layer at the GRN rate." backTo="/procurement/landed-costs" saveLabel="Post Allocation" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'grnId', label: 'Goods receipt', type: 'select', required: true, options: options(lookups.grns, (row) => row.grnNumber) },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'basis', label: 'Basis', type: 'select', options: [{ value: 'VALUE', label: 'Value' }, { value: 'QTY', label: 'Quantity' }, { value: 'WEIGHT', label: 'Weight' }] }
      ], lines: [
        { key: 'kind', label: 'Charge', options: ['FREIGHT', 'DUTY', 'CLEARING', 'INSURANCE'].map((value) => ({ value, label: value })) },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'exchangeRate', label: 'Invoice rate', type: 'number' }
      ] }
    ]} onSave={(values, lines) => axios.post('/api/phase2/landed-costs', {
      grnId: values.grnId, date: values.date, basis: values.basis || 'VALUE',
      charges: lines.filter((line) => line.kind && Number(line.amount) > 0).map((line) => ({ kind: line.kind, amount: Number(line.amount), exchangeRate: line.exchangeRate ? Number(line.exchangeRate) : undefined }))
    }, authConfig()).then(() => '/procurement/landed-costs')} />
  );
}

export function NewCapex() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="Capex request" icon={Briefcase}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Capex purchase request" subtitle="Checked against the project budget. Amounts at or above the threshold go to CWIP." backTo="/finance/projects" saveLabel="Save Request" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'capitalProjectId', label: 'Project', type: 'select', required: true, options: options(lookups.projects, (row) => `${row.code} ${row.name}`) },
        { name: 'productId', label: 'Item', type: 'select', required: true, options: options(lookups.products, (row) => `${row.code} ${row.name}`) },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true, positive: true },
        { name: 'unitPrice', label: 'Price', type: 'number', required: true, positive: true }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'overrideReason', label: 'Override reason' }
      ] }
    ]} onSave={(values) => axios.post('/api/procurement/purchase-requisitions', {
      date: values.date, spendClass: 'CAPEX', capitalProjectId: values.capitalProjectId,
      executiveOverride: Boolean(values.overrideReason), overrideReason: values.overrideReason,
      items: [{ productId: values.productId, quantity: Number(values.quantity), unitPrice: Number(values.unitPrice), total: Number(values.quantity) * Number(values.unitPrice) }]
    }, authConfig()).then(() => '/procurement/purchase-requisitions')} />
  );
}

export function AssetDetail() {
  const { id } = useParams();
  const lookups = useLookups();
  const asset = lookups.assets.find((row) => row.id === id);
  if (!lookups.ready) return <AppLayout title="Asset" icon={Landmark}><PageSkeleton type="form" /></AppLayout>;
  if (!asset) return <AppLayout title="Asset" icon={Landmark}><PageSkeleton type="form" /></AppLayout>;
  if (asset.status !== 'CWIP') {
    return (
      <FormShell title={asset.name} subtitle={`${asset.code} · ${asset.status}`} backTo="/finance/assets" saveLabel="Transfer" tabs={[
        { id: 'mandatory', label: 'Transfer', icon: FileText, fields: [
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'costCenterId', label: 'Cost center', type: 'select', options: options(lookups.centers, (row) => row.name) }
        ] }
      ]} onSave={(values) => axios.post(`/api/phase2/assets/${id}/transfer`, values, authConfig()).then(() => '/finance/assets')} />
    );
  }
  return (
    <FormShell title="Capitalize CWIP" subtitle={asset.name} backTo="/finance/assets" saveLabel="Capitalize" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'date', label: 'Commissioning date', type: 'date', required: true },
        { name: 'classId', label: 'Asset class', type: 'select', required: true, options: options(lookups.classes, (row) => row.name) },
        { name: 'name', label: 'Asset name' }
      ] }
    ]} onSave={(values) => axios.post(`/api/phase2/assets/${id}/capitalize`, values, authConfig()).then(() => '/finance/assets')} />
  );
}

export function DepreciationRun() {
  return (
    <FormShell title="Monthly depreciation" subtitle="Accounting book posts to the ledger. The tax book is kept separately." backTo="/finance/assets" saveLabel="Run Depreciation" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'year', label: 'Year', type: 'number', required: true, positive: true },
        { name: 'month', label: 'Month', type: 'number', required: true, positive: true }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/depreciation-runs', { year: Number(values.year), month: Number(values.month) }, authConfig()).then(() => '/finance/assets')} />
  );
}

export function NewNote() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="New note" icon={Receipt}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Credit or debit note" subtitle="Posted to receivables or payables and to tax." backTo="/finance/notes" saveLabel="Post Note" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'partyType', label: 'Party', type: 'select', required: true, options: [{ value: 'CUSTOMER', label: 'Customer' }, { value: 'SUPPLIER', label: 'Supplier' }] },
        { name: 'partyId', label: 'Customer or supplier', type: 'select', required: true, options: options([...lookups.customers, ...lookups.suppliers], (row) => row.name) },
        { name: 'kind', label: 'Kind', type: 'select', required: true, options: [{ value: 'CREDIT', label: 'Credit' }, { value: 'DEBIT', label: 'Debit' }] },
        { name: 'reasonCode', label: 'Reason', required: true },
        { name: 'subtotal', label: 'Amount', type: 'number', required: true, positive: true }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'taxAmount', label: 'Tax', type: 'number' },
        { name: 'invoiceId', label: 'Invoice id' }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/notes', { ...values, taxAmount: Number(values.taxAmount || 0), subtotal: Number(values.subtotal) }, authConfig()).then(() => '/finance/notes')} />
  );
}

export function Collections() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [initial, setInitial] = useState(true);
  useEffect(() => {
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
        promised: byCustomer[customer.id]?.promisedDate ? new Date(byCustomer[customer.id].promisedDate).toLocaleDateString() : '',
        notes: byCustomer[customer.id]?.notes || ''
      })));
    }).finally(() => setInitial(false));
  }, []);
  return (
    <OriginalList title="Collections" icon={Wallet} columns={[
      { header: 'Customer', accessor: 'name', fontWeight: 600 },
      { header: 'Dispute', accessor: 'dispute' },
      { header: 'Promised', accessor: 'promised' },
      { header: 'Notes', accessor: 'notes' }
    ]} rows={rows} initial={initial} searchKeys={['name', 'dispute']} searchPlaceholder="Search by customer..." onRowClick={(row) => navigate(`/finance/collections/${row.id}`)} />
  );
}

export function CollectionDetail() {
  const { id } = useParams();
  return (
    <FormShell title="Collection follow-up" subtitle="Promised date, dispute and the note from the debtor meeting." backTo="/finance/collections" saveLabel="Save Follow-up" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'disputeStatus', label: 'Dispute', type: 'select', options: [{ value: 'NONE', label: 'None' }, { value: 'DISPUTED', label: 'Disputed' }, { value: 'RESOLVED', label: 'Resolved' }] },
        { name: 'promisedDate', label: 'Promised date', type: 'date' },
        { name: 'body', label: 'Note', required: true }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/collections', { ...values, customerId: id }, authConfig()).then(() => '/finance/collections')} />
  );
}

export function NewCheque() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="New cheque" icon={CreditCard}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Cheque" subtitle="Post-dated cheques stay in Cheques in Hand until they are realised." backTo="/finance/cheques" saveLabel="Save Cheque" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'chequeNumber', label: 'Cheque number', required: true },
        { name: 'chequeDate', label: 'Cheque date', type: 'date', required: true },
        { name: 'payee', label: 'Payee', required: true },
        { name: 'direction', label: 'Direction', type: 'select', required: true, options: [{ value: 'IN', label: 'Incoming' }, { value: 'OUT', label: 'Outgoing' }] },
        { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true }
      ] },
      { id: 'more', label: 'More', icon: Briefcase, fields: [
        { name: 'partyId', label: 'Customer or supplier', type: 'select', options: options([...lookups.customers, ...lookups.suppliers], (row) => row.name) },
        { name: 'invoiceId', label: 'Invoice id' }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/cheques', { ...values, amount: Number(values.amount), isPdc: true }, authConfig()).then(() => '/finance/cheques')} />
  );
}

export function NewIou() {
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="New IOU" icon={Wallet}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Employee IOU" subtitle="Issued from petty cash. Settle it from the claim when Finance posts the bills." backTo="/finance/ious" saveLabel="Issue IOU" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'employeeName', label: 'Employee', required: true },
        { name: 'department', label: 'Department' },
        { name: 'amount', label: 'Advance', type: 'number', required: true, positive: true },
        { name: 'fundId', label: 'Petty cash fund', type: 'select', options: options(lookups.funds, (row) => row.name) }
      ] }
    ]} onSave={async (values) => {
      if (!lookups.funds.length) {
        const fund = await axios.post('/api/phase2/petty-cash', { name: 'Main tin', amount: 20000, date: values.date }, authConfig());
        values.fundId = fund.data.id;
      }
      await axios.post('/api/phase2/ious', { ...values, amount: Number(values.amount), source: 'PETTY_CASH' }, authConfig());
      return '/finance/ious';
    }} />
  );
}

export function IouDetail() {
  const { id } = useParams();
  const lookups = useLookups();
  if (!lookups.ready) return <AppLayout title="Settle IOU" icon={Wallet}><PageSkeleton type="form" /></AppLayout>;
  return (
    <FormShell title="Settle IOU" subtitle="Post the expense or the cash returned." backTo="/finance/ious" saveLabel="Post Settlement" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true },
        { name: 'kind', label: 'Settlement', type: 'select', options: [{ value: 'EXPENSE', label: 'Expense claim' }, { value: 'RETURN', label: 'Cash returned' }] },
        { name: 'expenseAccountId', label: 'Expense account', type: 'select', options: options(lookups.accounts.filter((row) => row.type === 'EXPENSE'), (row) => `${row.code} ${row.name}`) }
      ] }
    ]} onSave={(values) => axios.post(`/api/phase2/ious/${id}/settle`, { ...values, amount: Number(values.amount), kind: values.kind || 'EXPENSE' }, authConfig()).then(() => '/finance/ious')} />
  );
}

export function NewClose() {
  return (
    <FormShell title="Open period close" subtitle="Inventory, production, payables, receivables, cash, assets, then the ledger." backTo="/finance/period-close" saveLabel="Open Checklist" tabs={[
      { id: 'mandatory', label: 'Mandatory', icon: FileText, fields: [
        { name: 'year', label: 'Year', type: 'number', required: true, positive: true },
        { name: 'month', label: 'Month', type: 'number', required: true, positive: true }
      ] }
    ]} onSave={(values) => axios.post('/api/phase2/period-closes', { year: Number(values.year), month: Number(values.month) }, authConfig()).then((res) => `/finance/period-close/${res.data.id}`)} />
  );
}

export function CloseDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [close, setClose] = useState(null);
  const load = () => axios.get('/api/phase2/period-closes', authConfig()).then((res) => setClose(res.data.find((row) => row.id === id)));
  useEffect(() => { load(); }, [id]);
  if (!close) return <AppLayout title="Period close" icon={Calendar}><PageSkeleton type="table" /></AppLayout>;
  const mark = async (code) => {
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
    <AppLayout title={`Close ${close.year}-${close.month}`} icon={Calendar}>
      <DataTable columns={[
        { header: 'Step', accessor: 'sequence' },
        { header: 'Name', accessor: 'name', fontWeight: 600 },
        { header: 'Status', accessor: 'status', render: (row) => statusText(row.status) },
        { header: 'Actions', align: 'right', render: (row) => row.status === 'PENDING' ? <button type="button" onClick={(event) => { event.stopPropagation(); mark(row.code); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Mark done</button> : null }
      ]} data={close.steps || []} searchKeys={['name']} searchPlaceholder="Search steps..." extraActions={close.status !== 'HARD' ? <button type="button" onClick={post} style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Post closing entries</button> : null} />
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
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const load = async (key = reportKey) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/phase2/reports/${key}`, { ...authConfig(), params: { from: fromDate, to: toDate, asOf: toDate } });
      setColumns((res.data.columns || []).map((column) => ({ header: column.label, accessor: column.key })));
      setRows(res.data.rows || []);
    } finally {
      setLoading(false);
      setInitial(false);
    }
  };
  useEffect(() => { load(); }, [reportKey, fromDate, toDate]);
  const exportFile = async () => {
    const res = await axios.get(`/api/phase2/reports/${reportKey}`, { ...authConfig(), params: { from: fromDate, to: toDate, asOf: toDate, format: 'xlsx' }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportKey}.xlsx`;
    link.click();
  };
  return (
    <AppLayout title="Finance reports" icon={FileText}>
      {initial ? <PageSkeleton /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ReportFilter fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} onExport={exportFile}>
            <select value={reportKey} onChange={(event) => setReportKey(event.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }}>
              {REPORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </ReportFilter>
          <DataTable columns={columns} data={rows} loading={loading} searchPlaceholder="Search this report..." searchKeys={columns.slice(0, 3).map((column) => column.accessor)} noDataMessage="No rows for this filter." />
        </div>
      )}
    </AppLayout>
  );
}
