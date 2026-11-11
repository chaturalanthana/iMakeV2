import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import FormModal from '../../components/ui/FormModal';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Layers, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { promptDialog } from '../../components/ui/appDialog';

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
        <ActionButton variant="secondary" onClick={async () => {
          try {
            await axios.post(config.ensure, {}, { headers: headers() });
            showToast('Defaults are ready', 'success');
            load();
          } catch (error) {
            showToast(error.response?.data?.error || 'Failed to prepare defaults', 'error');
          }
        }}>Load defaults</ActionButton>
      )}
      {config.button && (
        <ActionButton icon={Plus} onClick={openModal}>{config.button}</ActionButton>
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
          <FormModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={config.modalTitle}
            subtitle={config.subtitle}
            icon={Layers}
            onSubmit={handleSubmit}
            submitLabel="Create"
          >
            {config.fields.map((field) => (
              <FormField key={field.key} label={field.label} required={field.required} error={fieldErrors[field.key]} variant="modal">
                {field.type === 'select' ? (
                  <SelectControl invalid={!!fieldErrors[field.key]} value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} style={{ height: 'auto', padding: '0.7rem 0.85rem' }}>
                    <option value="">Select</option>
                    {(field.options ? field.options : extras[field.source] || []).map((option) => (
                      <option key={option.id || option.value} value={option.id || option.value}>{option.name || option.label}{option.code ? ` (${option.code})` : ''}</option>
                    ))}
                  </SelectControl>
                ) : (
                  <TextControl invalid={!!fieldErrors[field.key]} type={field.type || 'text'} name={field.key} value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} placeholder={field.placeholder} style={{ height: 'auto', padding: '0.7rem 0.85rem' }} />
                )}
              </FormField>
            ))}
          </FormModal>
          <ConfirmModal isOpen={!!confirmConfig.isOpen} onClose={() => setConfirmConfig({ isOpen: false })} onConfirm={confirmConfig.onConfirm} title={confirmConfig.title} message={confirmConfig.message} confirmText="Confirm" />
        </>
      )}
    </AppLayout>
  );
}

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
      { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
      { header: 'Retest', accessor: 'retestStatus', render: (row) => <StatusBadge status={row.retestStatus} /> },
      actionColumn('Release', async (row) => {
        const proposed = await promptDialog({ title: 'QA retest', message: 'Revised expiry (YYYY-MM-DD)', defaultValue: '2027-12-31', confirmText: 'Propose' });
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
      { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
      actionColumn('Renumber', async (row) => {
        const code = await promptDialog({ title: 'Renumber pallet', message: 'New pallet code', confirmText: 'Renumber' });
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

