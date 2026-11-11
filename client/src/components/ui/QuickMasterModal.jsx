import React, { useState } from 'react';
import axios from 'axios';
import { Banknote, FolderTree, Layers, Ruler, Tag, Landmark } from 'lucide-react';
import Modal from './Modal';
import LiveSearchDropdown from './LiveSearchDropdown';
import { useToast } from '../../context/ToastContext';

const MASTER_CONFIG = {
  productType: {
    title: 'New Item Type',
    icon: Layers,
    endpoint: '/api/product-types',
    success: 'Item type created',
    fields: [
      {
        name: 'kind',
        label: 'Class',
        type: 'select',
        required: true,
        options: [
          { value: 'FINISHED_GOOD', label: 'Finished Good' },
          { value: 'SEMI_FINISHED', label: 'Semi-Finished Good' },
          { value: 'RAW_MATERIAL', label: 'Raw Material' },
          { value: 'PACKAGING', label: 'Packaging Material' },
          { value: 'CONSUMABLE', label: 'Consumable' },
          { value: 'SERVICE', label: 'Service' }
        ]
      },
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Finished Good' },
      { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional details about this type' }
    ]
  },
  category: {
    title: 'New Category',
    icon: FolderTree,
    endpoint: '/api/categories',
    success: 'Category created',
    parent: true,
    parentLabel: 'Parent Category',
    parentPlaceholder: 'Top level (no parent)',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Raw Metals' }
    ]
  },
  uom: {
    title: 'New Unit of Measure',
    icon: Ruler,
    endpoint: '/api/uoms',
    success: 'Unit of measure created',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. PCS, BOX, KG' }
    ]
  },
  brand: {
    title: 'New Brand',
    icon: Tag,
    endpoint: '/api/brands',
    success: 'Brand created',
    parent: true,
    parentLabel: 'Parent Brand',
    parentPlaceholder: 'Top level (no parent)',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Acme' }
    ]
  },
  productGroup: {
    title: 'New Product Group',
    icon: FolderTree,
    endpoint: '/api/product-groups',
    success: 'Product group created',
    parent: true,
    parentLabel: 'Parent Group',
    parentPlaceholder: 'Top level (no parent)',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Electrical' }
    ]
  },
  taxGroup: {
    title: 'New Tax Group',
    icon: Landmark,
    endpoint: '/api/finance/tax-groups',
    success: 'Tax group created',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Standard VAT' },
      { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional details' }
    ]
  },
  currency: {
    title: 'New Currency',
    icon: Banknote,
    endpoint: '/api/finance/currencies',
    success: 'Currency created',
    fields: [
      { name: 'code', label: 'Code', required: true, placeholder: 'e.g. USD', half: true },
      { name: 'symbol', label: 'Symbol', placeholder: 'e.g. $', half: true },
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. US Dollar' }
    ]
  },
  account: {
    title: 'New Account',
    icon: Landmark,
    endpoint: '/api/finance/accounts',
    success: 'Account created',
    fields: [
      { name: 'code', label: 'Account Code', required: true, placeholder: 'e.g. 1400' },
      { name: 'name', label: 'Account Name', required: true, placeholder: 'e.g. Raw Material Inventory' }
    ]
  }
};

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: '0.9rem',
  backgroundColor: '#fff',
  color: 'var(--text-main)'
};

const labelStyle = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'var(--text-main)',
  marginBottom: '0.5rem'
};

function hierarchyLabel(node, list) {
  let path = node.name;
  let parentId = node.parentId || null;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = list.find((item) => item.id === parentId);
    if (!parent) break;
    path = `${parent.name} > ${path}`;
    parentId = parent.parentId || null;
  }
  return path;
}

function emptyForm(config) {
  const next = {};
  config.fields.forEach((field) => {
    next[field.name] = '';
  });
  if (config.parent) next.parentId = '';
  return next;
}

export default function QuickMasterModal({ kind, accountType, parents = [], onClose, onCreated }) {
  const { showToast } = useToast();
  const config = MASTER_CONFIG[kind];
  const [form, setForm] = useState(() => emptyForm(config));
  const [saving, setSaving] = useState(false);
  const [invalidFields, setInvalidFields] = useState({});

  if (!config) return null;

  const title = kind === 'account'
    ? (accountType === 'EXPENSE' ? 'New COGS Account' : 'New Inventory Account')
    : config.title;

  const parentChoices = [...parents]
    .map((item) => ({ label: hierarchyLabel(item, parents), value: item.id }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const clearInvalid = (name) => {
    setInvalidFields((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (kind === 'productType' && name === 'kind') {
        const options = config.fields.find((field) => field.name === 'kind')?.options || [];
        const selected = options.find((item) => item.value === value);
        const previous = options.find((item) => item.value === prev.kind);
        if (selected && (!String(prev.name || '').trim() || prev.name === previous?.label)) next.name = selected.label;
      }
      return next;
    });
    clearInvalid(name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = config.fields.filter((field) => field.required && !String(form[field.name] || '').trim());
    if (missing.length) {
      const next = {};
      missing.forEach((field) => {
        next[field.name] = `${field.label} is required.`;
      });
      setInvalidFields(next);
      showToast(missing.length === 1 ? next[missing[0].name] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setInvalidFields({});

    const payload = {};
    config.fields.forEach((field) => {
      const value = String(form[field.name] || '').trim();
      if (field.name === 'code') payload.code = value.toUpperCase();
      else payload[field.name] = value;
    });
    if (config.parent) payload.parentId = form.parentId || null;
    if (kind === 'taxGroup') payload.status = 'ACTIVE';
    if (kind === 'currency') payload.exchangeRate = 1;
    if (kind === 'account') payload.type = accountType || 'ASSET';

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(config.endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(config.success, 'success');
      onCreated(response.data);
    } catch (error) {
      const message = error.response?.data?.error || `Failed to create ${title.toLowerCase()}`;
      const lower = message.toLowerCase();
      const matched = config.fields.find((field) => lower.includes(field.name.toLowerCase()) || lower.includes(field.label.toLowerCase()));
      if (matched) setInvalidFields({ [matched.name]: message });
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fields = [];
  for (let i = 0; i < config.fields.length; i += 1) {
    const field = config.fields[i];
    const next = config.fields[i + 1];
    if (field.half && next?.half) {
      fields.push([field, next]);
      i += 1;
    } else {
      fields.push([field]);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={title} icon={config.icon} maxWidth="520px" overflow="visible">
      <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {kind === 'account' && (
            <div>
              <label style={labelStyle}>Account Type</label>
              <input value={accountType === 'EXPENSE' ? 'Expense' : 'Asset'} readOnly style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#475569' }} />
            </div>
          )}

          {fields.map((row) => (
            <div key={row.map((field) => field.name).join('-')} style={{ display: 'grid', gridTemplateColumns: row.length > 1 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
              {row.map((field) => (
                <div key={field.name}>
                  <label style={labelStyle}>
                    {field.label} {field.required && <span style={{ color: 'var(--error)' }}>*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      className={invalidFields[field.name] ? 'field-invalid' : undefined}
                      style={inputStyle}
                    >
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      rows={3}
                      className={invalidFields[field.name] ? 'field-invalid' : undefined}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type="text"
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      className={invalidFields[field.name] ? 'field-invalid' : undefined}
                      style={inputStyle}
                    />
                  )}
                  {invalidFields[field.name] && <span className="field-error-text">{invalidFields[field.name]}</span>}
                </div>
              ))}
            </div>
          ))}

          {config.parent && (
            <div>
              <label style={labelStyle}>{config.parentLabel}</label>
              <LiveSearchDropdown
                options={parentChoices}
                value={form.parentId}
                onChange={(val) => setForm((prev) => ({ ...prev, parentId: val || '' }))}
                placeholder={config.parentPlaceholder}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
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
            {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
