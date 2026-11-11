import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: '0.9rem',
  backgroundColor: '#fff'
};

export default function InventoryMaster({ kind }) {
  const config = MASTERS[kind];
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [extras, setExtras] = useState({ warehouses: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(config.empty());
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false });

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const load = async () => {
    setLoading(true);
    try {
      const [main, warehouses, products] = await Promise.all([
        axios.get(config.endpoint, { headers: headers() }),
        axios.get('/api/warehouses', { headers: headers() }).catch(() => ({ data: [] })),
        config.needsProducts ? axios.get('/api/products', { headers: headers() }) : Promise.resolve({ data: [] })
      ]);
      setRows(main.data);
      setExtras({ warehouses: warehouses.data || [], products: products.data || [] });
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to load records', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => { load(); }, [kind]);

  const openModal = () => {
    setForm(config.empty());
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = config.validate(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }
    setFieldErrors({});
    try {
      await axios.post(config.endpoint, config.payload(form), { headers: headers() });
      showToast('Saved successfully', 'success');
      setIsModalOpen(false);
      load();
    } catch (error) {
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to save', 'error');
    }
  };

  const extraActions = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {config.ensure && (
        <button type="button" onClick={async () => {
          try {
            await axios.post(config.ensure, {}, { headers: headers() });
            showToast('Defaults are ready', 'success');
            load();
          } catch (error) {
            showToast(error.response?.data?.error || 'Failed to prepare defaults', 'error');
          }
        }} style={ghostButton}>Load defaults</button>
      )}
      {config.button && (
        <button onClick={openModal} style={primaryButton} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
          <Plus size={16} /> {config.button}
        </button>
      )}
    </div>
  );

  return (
    <AppLayout title={config.title} icon={Layers}>
      {isInitialLoad ? <PageSkeleton /> : (
        <>
          <DataTable
            columns={config.columns(setConfirmConfig, headers, load, showToast)}
            data={rows}
            loading={loading}
            searchPlaceholder={config.search}
            searchKeys={config.keys}
            extraActions={extraActions}
          />
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={config.modalTitle} subtitle={config.subtitle} icon={Layers}>
            <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {config.fields.map((field) => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      {field.label} {field.required && <span style={{ color: 'var(--error)' }}>*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} style={inputStyle}>
                        <option value="">Select</option>
                        {(field.options ? field.options : extras[field.source] || []).map((option) => (
                          <option key={option.id || option.value} value={option.id || option.value}>{option.name || option.label}{option.code ? ` (${option.code})` : ''}</option>
                        ))}
                      </select>
                    ) : (
                      <input type={field.type || 'text'} name={field.key} value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} placeholder={field.placeholder} style={{ ...inputStyle, border: fieldErrors[field.key] ? '1px solid var(--error)' : '1px solid var(--border-color)' }} />
                    )}
                    {fieldErrors[field.key] && <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.35rem' }}>{fieldErrors[field.key]}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff' }}>Create</button>
              </div>
            </form>
          </Modal>
          <ConfirmModal isOpen={!!confirmConfig.isOpen} onClose={() => setConfirmConfig({ isOpen: false })} onConfirm={confirmConfig.onConfirm} title={confirmConfig.title} message={confirmConfig.message} confirmText="Confirm" />
        </>
      )}
    </AppLayout>
  );
}

const primaryButton = {
  display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem',
  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
  border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
};
const ghostButton = {
  background: '#fff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 1rem', fontWeight: 600, cursor: 'pointer'
};

function actionColumn(label, onClick) {
  return {
    header: 'Actions',
    align: 'right',
    sortable: false,
    render: (row) => (
      <button onClick={(e) => { e.stopPropagation(); onClick(row); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0.25rem', fontWeight: 700, fontSize: '0.75rem' }}>
        {label}
      </button>
    )
  };
}

const MASTERS = {
  bins: {
    title: 'Bins',
    endpoint: '/api/inventory/bins',
    button: 'New Bin',
    modalTitle: 'Create Bin',
    subtitle: 'A sub-location inside a warehouse.',
    search: 'Search bins...',
    keys: ['code', 'name', 'binType'],
    empty: () => ({ warehouseId: '', code: '', name: '', binType: 'STORAGE' }),
    validate: (form) => {
      const errors = {};
      if (!form.warehouseId) errors.warehouseId = 'Warehouse is required.';
      if (!form.code) errors.code = 'Code is required.';
      if (!form.name) errors.name = 'Name is required.';
      return errors;
    },
    payload: (form) => form,
    fields: [
      { key: 'warehouseId', label: 'Warehouse', required: true, type: 'select', source: 'warehouses' },
      { key: 'code', label: 'Code', required: true, placeholder: 'BIN-A1' },
      { key: 'name', label: 'Name', required: true, placeholder: 'Bulk rack' },
      { key: 'binType', label: 'Type', type: 'select', options: [
        { value: 'STORAGE', label: 'Storage' },
        { value: 'QUARANTINE', label: 'Quarantine' },
        { value: 'DAMAGED', label: 'Damaged' },
        { value: 'SCRAP', label: 'Scrap' }
      ] }
    ],
    columns: () => [
      { header: 'Code', accessor: 'code', fontWeight: 700 },
      { header: 'Name', accessor: 'name' },
      { header: 'Warehouse', accessor: 'warehouse', render: (row) => row.warehouse?.code || '-' },
      { header: 'Type', accessor: 'binType' }
    ]
  },
  batches: {
    title: 'Batches',
    endpoint: '/api/inventory/batches',
    button: 'New Batch',
    modalTitle: 'Create Batch',
    subtitle: 'Lot, expiry and stock status.',
    search: 'Search lots...',
    keys: ['lotNumber', 'status'],
    needsProducts: true,
    empty: () => ({ productId: '', lotNumber: '', expiryDate: '', status: 'UNRESTRICTED' }),
    validate: (form) => {
      const errors = {};
      if (!form.productId) errors.productId = 'Product is required.';
      if (!form.lotNumber) errors.lotNumber = 'Lot number is required.';
      return errors;
    },
    payload: (form) => form,
    fields: [
      { key: 'productId', label: 'Item', required: true, type: 'select', source: 'products' },
      { key: 'lotNumber', label: 'Lot', required: true, placeholder: 'LOT-001' },
      { key: 'expiryDate', label: 'Expiry', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: 'UNRESTRICTED', label: 'Unrestricted' },
        { value: 'QUARANTINE', label: 'Quarantine' },
        { value: 'BLOCKED', label: 'Blocked' }
      ] }
    ],
    columns: (setConfirm, headers, load, showToast) => [
      { header: 'Lot', accessor: 'lotNumber', fontWeight: 700 },
      { header: 'Item', accessor: 'product', render: (row) => row.product?.code || '-' },
      { header: 'Expiry', accessor: 'expiryDate', render: (row) => row.expiryDate ? String(row.expiryDate).slice(0, 10) : '-' },
      { header: 'Status', accessor: 'status' },
      { header: 'Retest', accessor: 'retestStatus' },
      actionColumn('Release', async (row) => {
        const proposed = window.prompt('Revised expiry (YYYY-MM-DD)', '2027-12-31');
        if (!proposed) return;
        try {
          await axios.post(`/api/inventory/batches/${row.id}/retest`, { proposedExpiry: proposed, evidence: 'Lab note' }, { headers: headers() });
          await axios.post(`/api/inventory/batches/${row.id}/retest/decide`, { decision: 'APPROVED' }, { headers: headers() });
          showToast('Expiry updated', 'success');
          load();
        } catch (error) {
          showToast(error.response?.data?.error || 'Retest failed', 'error');
        }
      })
    ]
  },
  pallets: {
    title: 'Pallets',
    endpoint: '/api/inventory/pallets',
    button: 'New Pallet',
    modalTitle: 'Create Pallet',
    subtitle: 'Active pallets can be picked. Renumber keeps history.',
    search: 'Search pallets...',
    keys: ['code', 'status'],
    empty: () => ({ warehouseId: '', code: '' }),
    validate: (form) => {
      const errors = {};
      if (!form.warehouseId) errors.warehouseId = 'Warehouse is required.';
      if (!form.code) errors.code = 'Code is required.';
      return errors;
    },
    payload: (form) => form,
    fields: [
      { key: 'warehouseId', label: 'Warehouse', required: true, type: 'select', source: 'warehouses' },
      { key: 'code', label: 'Code', required: true, placeholder: 'PLT-100' }
    ],
    columns: (setConfirm, headers, load, showToast) => [
      { header: 'Code', accessor: 'code', fontWeight: 700 },
      { header: 'Warehouse', accessor: 'warehouse', render: (row) => row.warehouse?.code || '-' },
      { header: 'Status', accessor: 'status' },
      actionColumn('Renumber', async (row) => {
        const code = window.prompt('New pallet code');
        if (!code) return;
        try {
          await axios.post(`/api/inventory/pallets/${row.id}/renumber`, { code }, { headers: headers() });
          showToast('Pallet renumbered', 'success');
          load();
        } catch (error) {
          showToast(error.response?.data?.error || 'Could not renumber', 'error');
        }
      })
    ]
  },
  templates: {
    title: 'UOM Templates',
    endpoint: '/api/inventory/uom-templates',
    ensure: '/api/inventory/uom-templates/ensure',
    button: '',
    modalTitle: 'Templates',
    subtitle: 'Weight, volume and count conversions.',
    search: 'Search templates...',
    keys: ['code', 'name', 'baseCode'],
    empty: () => ({ code: '', name: '' }),
    validate: () => ({ code: 'Use Load defaults for the standard templates.' }),
    payload: (form) => form,
    fields: [
      { key: 'code', label: 'Code', required: true }
    ],
    columns: () => [
      { header: 'Code', accessor: 'code', fontWeight: 700 },
      { header: 'Name', accessor: 'name' },
      { header: 'Base', accessor: 'baseCode' },
      { header: 'Units', accessor: 'lines', render: (row) => (row.lines || []).map((line) => `${line.uomCode}×${Number(line.factorToBase)}`).join(', ') }
    ]
  }
};

void Trash2;
void ConfirmModal;
