import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Calculator, CircleDot, Ruler, SlidersHorizontal, Tags, Wallet } from 'lucide-react';
import Modal from './Modal';
import LiveSearchDropdown from './LiveSearchDropdown';
import { useToast } from '../../context/ToastContext';

const TABS = [
  { id: 'classification', label: 'Classification', icon: Tags },
  { id: 'units', label: 'Units', icon: Ruler },
  { id: 'costing', label: 'Costing', icon: Calculator },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'status', label: 'Status', icon: CircleDot }
];

const COSTING_OPTIONS = [
  { label: 'FIFO', value: 'FIFO' },
  { label: 'LIFO', value: 'LIFO' },
  { label: 'Moving Average', value: 'Moving Average' },
  { label: 'Standard Cost', value: 'Standard Cost' }
];

const STATUS_OPTIONS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' }
];

const FIELDS = [
  { key: 'productTypeId', label: 'Item Type', kind: 'select', group: 'classification', options: 'productTypes', placeholder: 'Item type' },
  { key: 'categoryId', label: 'Category', kind: 'select', group: 'classification', options: 'categories', placeholder: 'Category' },
  { key: 'brandId', label: 'Brand', kind: 'select', group: 'classification', options: 'brands', placeholder: 'Brand' },
  { key: 'productGroupId', label: 'Product Group', kind: 'select', group: 'classification', options: 'productGroups', placeholder: 'Product group' },
  { key: 'supplierId', label: 'Supplier', kind: 'select', group: 'classification', options: 'suppliers', placeholder: 'Supplier' },
  { key: 'stockUomId', label: 'Stock UOM', kind: 'select', group: 'units', options: 'uoms', placeholder: 'Stock UOM' },
  { key: 'purchaseUomId', label: 'Purchase UOM', kind: 'select', group: 'units', options: 'uoms', placeholder: 'Purchase UOM' },
  { key: 'salesUomId', label: 'Sales UOM', kind: 'select', group: 'units', options: 'uoms', placeholder: 'Sales UOM' },
  { key: 'costingMethod', label: 'Costing Method', kind: 'select', group: 'costing', options: 'costing', placeholder: 'Costing method' },
  { key: 'standardCost', label: 'Standard Cost', kind: 'number', group: 'costing', min: 0 },
  { key: 'scrapPercent', label: 'Scrap %', kind: 'number', group: 'costing', min: 0, max: 100 },
  { key: 'safetyStock', label: 'Safety Stock', kind: 'number', group: 'costing', min: 0, integer: true },
  { key: 'reorderLevel', label: 'Reorder Level', kind: 'number', group: 'costing', min: 0, integer: true },
  { key: 'taxGroup', label: 'Tax Group', kind: 'select', group: 'finance', options: 'taxGroups', placeholder: 'Tax group' },
  { key: 'currencyId', label: 'Currency', kind: 'select', group: 'finance', options: 'currencies', placeholder: 'Currency' },
  { key: 'inventoryAccountId', label: 'Inventory Account', kind: 'select', group: 'finance', options: 'assetAccounts', placeholder: 'Inventory account' },
  { key: 'cogsAccountId', label: 'COGS Account', kind: 'select', group: 'finance', options: 'expenseAccounts', placeholder: 'COGS account' },
  { key: 'activeStatus', label: 'Status', kind: 'select', group: 'status', options: 'status', placeholder: 'Status' },
  { key: 'bomApplicable', label: 'BOM', kind: 'boolean', group: 'status' },
  { key: 'isLocked', label: 'Locked', kind: 'boolean', group: 'status' }
];

function readShared(products, key) {
  const values = products.map((product) => {
    const value = product[key];
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return '';
    return String(value);
  });
  const first = values[0];
  const same = values.every((value) => value === first);
  return { value: same ? first : '', mixed: !same };
}

const inputStyle = {
  width: '100%',
  height: '38px',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '0 0.75rem',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  background: '#fff',
  fontFamily: 'inherit'
};

export default function ProductBatchModal({ isOpen, products = [], attributes = {}, taxGroups = [], onClose, onUpdated }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState('classification');
  const [values, setValues] = useState({});
  const [baseline, setBaseline] = useState({});
  const [mixed, setMixed] = useState({});
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);

  const selectionKey = products.map((product) => product.id).join('|');

  useEffect(() => {
    if (!isOpen) return;
    const nextValues = {};
    const nextMixed = {};
    FIELDS.forEach((field) => {
      const shared = readShared(products, field.key);
      nextValues[field.key] = shared.value;
      nextMixed[field.key] = shared.mixed;
    });
    setValues(nextValues);
    setBaseline(nextValues);
    setMixed(nextMixed);
    setInvalid({});
    setTab('classification');
  }, [isOpen, selectionKey]);

  const optionMap = useMemo(() => ({
    productTypes: attributes.productTypes || [],
    categories: attributes.categories || [],
    brands: attributes.brands || [],
    productGroups: attributes.productGroups || [],
    suppliers: attributes.suppliers || [],
    uoms: attributes.uoms || [],
    currencies: attributes.currencies || [],
    assetAccounts: (attributes.accounts || []).filter((account) => account.type === 'ASSET'),
    expenseAccounts: (attributes.accounts || []).filter((account) => account.type === 'EXPENSE'),
    taxGroups: taxGroups.map((group) => ({ label: group.name, value: group.name })),
    costing: COSTING_OPTIONS,
    status: STATUS_OPTIONS
  }), [attributes, taxGroups]);

  const setField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setInvalid((prev) => ({ ...prev, [key]: undefined }));
  };

  const fieldChanged = (field) => !sameValue(field, values[field.key], baseline[field.key]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextInvalid = {};
    const changes = {};

    FIELDS.forEach((field) => {
      if (!fieldChanged(field)) return;
      const value = values[field.key];

      if (field.kind === 'boolean') {
        changes[field.key] = value === true;
        return;
      }

      if (value === '' || value === null || value === undefined) {
        nextInvalid[field.key] = `${field.label} is required.`;
        return;
      }

      if (field.kind === 'number') {
        const num = field.integer ? parseInt(value, 10) : parseFloat(value);
        const tooSmall = !Number.isFinite(num) || num < field.min;
        const tooBig = field.max !== undefined && num > field.max;
        if (tooSmall || tooBig) {
          nextInvalid[field.key] = field.max !== undefined
            ? `${field.label} must be between ${field.min} and ${field.max}.`
            : `${field.label} cannot be negative.`;
          return;
        }
        changes[field.key] = num;
        return;
      }

      changes[field.key] = value;
    });

    if (Object.keys(changes).length === 0 && Object.keys(nextInvalid).length === 0) {
      showToast('Change a parameter to update.', 'error');
      return;
    }

    if (Object.keys(nextInvalid).length > 0) {
      setInvalid(nextInvalid);
      const first = FIELDS.find((field) => nextInvalid[field.key]);
      if (first) setTab(first.group);
      showToast(
        Object.keys(nextInvalid).length === 1
          ? Object.values(nextInvalid)[0]
          : 'Please fill the highlighted fields.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/products/batch', {
        ids: products.map((product) => product.id),
        changes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(`Updated ${response.data.updated} products`, 'success');
      onUpdated();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update products';
      const match = FIELDS.find((field) => message.toLowerCase().includes(field.label.toLowerCase()));
      if (match) {
        setInvalid({ [match.key]: message });
        setTab(match.group);
      }
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const visibleFields = FIELDS.filter((field) => field.group === tab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title={`Batch Update (${products.length})`}
      icon={SlidersHorizontal}
      maxWidth="820px"
      overflow="visible"
    >
      <form onSubmit={handleSubmit} style={{ height: '560px', display: 'flex', flexDirection: 'column', padding: '1.25rem 1.5rem 1.25rem', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '1.75rem', flex: 1, minHeight: 0 }}>
          <div style={{ width: '210px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    backgroundColor: active ? 'var(--accent-light)' : 'transparent',
                    color: active ? 'var(--accent)' : '#64748b',
                    width: '100%',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(event) => {
                    if (!active) {
                      event.currentTarget.style.backgroundColor = '#f8fafc';
                      event.currentTarget.style.color = '#1e293b';
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!active) {
                      event.currentTarget.style.backgroundColor = 'transparent';
                      event.currentTarget.style.color = '#64748b';
                    }
                  }}
                >
                  <Icon size={18} style={{ color: active ? 'var(--accent)' : '#64748b', flexShrink: 0 }} />
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em',
                    color: active ? 'var(--accent)' : '#334155',
                    lineHeight: '1.2'
                  }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {visibleFields.map((field) => (
            <div key={field.key}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {field.label}
                {mixed[field.key] && !fieldChanged(field) && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Mixed</span>
                )}
              </label>
              {field.kind === 'select' && (
                <LiveSearchDropdown
                  options={optionMap[field.options] || []}
                  value={values[field.key] || ''}
                  onChange={(val) => setField(field.key, val || '')}
                  placeholder={mixed[field.key] ? 'Mixed' : field.placeholder}
                  invalid={!!invalid[field.key]}
                />
              )}
              {field.kind === 'number' && (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.integer ? '1' : 'any'}
                  value={values[field.key] ?? ''}
                  placeholder={mixed[field.key] ? 'Mixed' : '0'}
                  onChange={(event) => setField(field.key, event.target.value)}
                  className={invalid[field.key] ? 'field-invalid' : undefined}
                  style={inputStyle}
                />
              )}
              {field.kind === 'boolean' && (
                <button
                  type="button"
                  onClick={() => setField(field.key, values[field.key] !== true)}
                  aria-label={field.label}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '999px',
                    border: invalid[field.key] ? '1px solid #ef4444' : 'none',
                    background: values[field.key] === true ? 'var(--accent)' : '#cbd5e1',
                    position: 'relative',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: values[field.key] === true ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.15s'
                  }} />
                </button>
              )}
              {invalid[field.key] && <span className="field-error-text">{invalid[field.key]}</span>}
            </div>
          ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.65rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function sameValue(field, value, initial) {
  if (field.kind === 'number') {
    if ((value === '' || value === undefined) && (initial === '' || initial === undefined)) return true;
    if (value === '' || value === undefined || initial === '' || initial === undefined) return false;
    return Number(value) === Number(initial);
  }
  if (field.kind === 'boolean') {
    const norm = (item) => (item === true ? 'true' : item === false ? 'false' : '');
    return norm(value) === norm(initial);
  }
  return (value || '') === (initial || '');
}
