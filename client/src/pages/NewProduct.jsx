import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { findByRouteKey, isUuid, recordPath, routeKeyOf, showRecord } from '../utils/recordPath';
import AppLayout from '../components/layout/AppLayout';
import PageSkeleton from '../components/ui/PageSkeleton';
import LiveSearchDropdown from '../components/ui/LiveSearchDropdown';
import TreeSelect from '../components/ui/TreeSelect';
import QuickMasterModal from '../components/ui/QuickMasterModal';
import { ArrowLeft, Check, Box, FileText, Wrench, DollarSign, Tag, RefreshCw, Copy, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

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

export default function NewProduct() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const routeKey = routeKeyOf(useParams());
  const [id, setId] = useState(() => (isUuid(routeKey) ? routeKey : ''));

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('mandatory'); // 'mandatory', 'manufacturing', 'finance', 'classification'
  
  const [duplicateConfig, setDuplicateConfig] = useState({ isOpen: false, productId: null, sourceCode: '' });
  const [newProductCode, setNewProductCode] = useState('');

  // Attributes data
  const [attributes, setAttributes] = useState({ 
    categories: [], 
    brands: [], 
    uoms: [], 
    productTypes: [], 
    suppliers: [],
    accounts: []
  });
  const [rawCategories, setRawCategories] = useState([]);
  const [rawBrands, setRawBrands] = useState([]);
  const [rawProductGroups, setRawProductGroups] = useState([]);
  const [taxGroups, setTaxGroups] = useState([]);
  const [masterModal, setMasterModal] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicateCodeError, setDuplicateCodeError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Mandatory Section
    code: '',
    name: '',
    productTypeId: '',
    categoryId: '',
    categoryName: '',
    stockUomId: '',
    purchaseUomId: '',
    salesUomId: '',
    conversionFactor: '1.0',
    uomConversions: [],
    costingMethod: 'FIFO',
    bomApplicable: false,
    activeStatus: 'ACTIVE',

    // Manufacturing Section
    standardCost: '0.0',
    scrapPercent: '0.0',
    reorderLevel: '0',
    safetyStock: '0',
    sku: '',
    barcode: '',
    variant: '',
    sizeLabel: '',
    weight: '',
    volume: '',
    leadTimeDays: '0',
    dailyDemand: '0',
    pickRule: 'FIFO',
    batchTracked: false,
    expiryTracked: false,

    // Finance Section
    taxGroup: 'Tax Exempt',
    inventoryAccountId: '',
    cogsAccountId: '',
    currencyId: '',

    // Classification Section
    brandId: '',
    productGroup: '',
    productGroupId: '',

    // Legacy fields / fallback
    description: '',
    type: 'PRODUCT',
    costPrice: '0.0',
    sellingPrice: '0.0',
    supplierId: '',
    isLocked: false,
    currency: 'USD'
  });

  useEffect(() => {
    fetchData();
  }, [routeKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [attrRes, catRes, prodRes, tgRes, pgRes, brandRes] = await Promise.all([
        axios.get('/api/products/attributes', config),
        axios.get('/api/categories', config),
        routeKey ? axios.get('/api/products', config) : Promise.resolve(null),
        axios.get('/api/finance/tax-groups', config),
        axios.get('/api/product-groups', config),
        axios.get('/api/brands', config)
      ]);

      setAttributes(attrRes.data);
      setRawCategories(catRes.data);
      setRawBrands(brandRes.data);
      setRawProductGroups(pgRes.data);
      setTaxGroups(tgRes.data.filter(tg => tg.status === 'ACTIVE'));

      if (routeKey && prodRes) {
        const product = findByRouteKey(prodRes.data, routeKey, 'code');
        if (product) {
          setId(product.id);
          showRecord(navigate, '/products', product, 'code');
          setFormData({
            code: product.code || '',
            name: product.name || '',
            description: product.description || '',
            type: product.type || 'PRODUCT',
            categoryId: product.categoryId || '',
            categoryName: product.category?.name || '',
            brandId: product.brandId || '',
            supplierId: product.supplierId || '',
            productTypeId: product.productTypeId || '',
            hsCode: product.hsCode || '',
            cpg: product.cpg || '',
            currency: product.currency || 'USD',
            currencyId: product.currencyId || '',
            reorderLevel: product.reorderLevel !== undefined ? product.reorderLevel.toString() : '0',
            isLocked: product.isLocked || false,
            costPrice: product.costPrice !== undefined ? product.costPrice.toString() : '0.0',
            sellingPrice: product.sellingPrice !== undefined ? product.sellingPrice.toString() : '0.0',

            // Refactored fields
            stockUomId: product.stockUomId || '',
            purchaseUomId: product.purchaseUomId || '',
            salesUomId: product.salesUomId || '',
            conversionFactor: product.conversionFactor !== undefined ? product.conversionFactor.toString() : '1.0',
            uomConversions: product.uomConversions || [],
            costingMethod: product.costingMethod || 'FIFO',
            bomApplicable: product.bomApplicable || false,
            activeStatus: product.activeStatus || 'ACTIVE',
            standardCost: product.standardCost !== undefined ? product.standardCost.toString() : '0.0',
            scrapPercent: product.scrapPercent !== undefined ? product.scrapPercent.toString() : '0.0',
            safetyStock: product.safetyStock !== undefined ? product.safetyStock.toString() : '0',
            sku: product.sku || '',
            barcode: product.barcode || '',
            variant: product.variant || '',
            sizeLabel: product.sizeLabel || '',
            weight: product.weight != null ? String(product.weight) : '',
            volume: product.volume != null ? String(product.volume) : '',
            leadTimeDays: product.leadTimeDays != null ? String(product.leadTimeDays) : '0',
            dailyDemand: product.dailyDemand != null ? String(product.dailyDemand) : '0',
            pickRule: product.pickRule || 'FIFO',
            batchTracked: !!product.batchTracked,
            expiryTracked: !!product.expiryTracked,
            taxGroup: product.taxGroup || 'Tax Exempt',
            inventoryAccountId: product.inventoryAccountId || '',
            cogsAccountId: product.cogsAccountId || '',
            productGroup: product.productGroup || '',
            productGroupId: product.productGroupId || ''
          });
        } else {
          showToast('Product not found', 'error');
          navigate('/products');
        }
      }
    } catch (error) {
      console.error('Failed to fetch product attributes or details:', error);
      showToast('Error loading page details', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const clearFieldError = (name) => {
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const controlStyle = (name) => fieldErrors[name]
    ? { ...inputStyle, borderColor: 'var(--error)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.14)', backgroundColor: '#fff5f5' }
    : inputStyle;

  const handleToggleChange = (name) => {
    setFormData(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleTypeOrCategoryChange = (updatedFields, lookups = {}) => {
    setFormData(prev => {
      const nextData = { ...prev, ...updatedFields };
      if (!id && nextData.productTypeId && nextData.categoryId) {
        const types = lookups.productTypes || attributes.productTypes;
        const cats = lookups.categories || attributes.categories;
        const typeObj = types.find(t => t.value === nextData.productTypeId);
        const catObj = cats.find(c => c.value === nextData.categoryId);
        if (typeObj && catObj) {
          const typeStr = typeObj.label || '';
          const typePrefix = typeStr.split(/\s+/).map(w => w[0]).join('').substring(0, 3).toUpperCase() || typeStr.substring(0, 3).toUpperCase();
          
          const catLabel = catObj.label || '';
          const parts = catLabel.split(/\s*(?:>|\/)\s*/);
          const leafName = parts[parts.length - 1];
          const catPrefix = leafName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
          
          const suffix = Math.floor(1000 + Math.random() * 9000);
          nextData.code = `${typePrefix}-${catPrefix}-${suffix}`;
        }
      }
      return nextData;
    });
  };

  const handleMasterCreated = (record) => {
    if (!masterModal) return;
    const { kind, target } = masterModal;

    if (kind === 'productType') {
      const option = { label: record.name, value: record.id };
      const productTypes = [...(attributes.productTypes || []), option].sort((a, b) => a.label.localeCompare(b.label));
      setAttributes(prev => ({ ...prev, productTypes }));
      handleTypeOrCategoryChange({ productTypeId: record.id }, { productTypes });
    }

    if (kind === 'category') {
      const node = { id: record.id, name: record.name, parentId: record.parentId || null };
      const nextRaw = [...rawCategories, node];
      const option = { label: hierarchyLabel(node, nextRaw), value: record.id };
      const categories = [...(attributes.categories || []), option].sort((a, b) => a.label.localeCompare(b.label));
      setRawCategories(nextRaw);
      setAttributes(prev => ({ ...prev, categories }));
      handleTypeOrCategoryChange({
        categoryId: record.id,
        categoryName: option.label
      }, { categories });
    }

    if (kind === 'uom') {
      const option = { label: record.name, value: record.id };
      setAttributes(prev => ({
        ...prev,
        uoms: [...(prev.uoms || []), option].sort((a, b) => a.label.localeCompare(b.label))
      }));
      setFormData(prev => ({ ...prev, [target]: record.id }));
    }

    if (kind === 'brand') {
      const node = { id: record.id, name: record.name, parentId: record.parentId || null };
      const nextRaw = [...rawBrands, node];
      const option = { label: hierarchyLabel(node, nextRaw), value: record.id };
      setRawBrands(nextRaw);
      setAttributes(prev => ({
        ...prev,
        brands: [...(prev.brands || []), option].sort((a, b) => a.label.localeCompare(b.label))
      }));
      setFormData(prev => ({ ...prev, brandId: record.id }));
    }

    if (kind === 'productGroup') {
      const node = { id: record.id, name: record.name, parentId: record.parentId || null };
      setRawProductGroups(prev => [...prev, node]);
      setFormData(prev => ({
        ...prev,
        productGroupId: record.id,
        productGroup: record.name
      }));
    }

    if (kind === 'taxGroup') {
      setTaxGroups(prev => [...prev, { ...record, status: record.status || 'ACTIVE' }]
        .sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, taxGroup: record.name }));
    }

    if (kind === 'currency') {
      const option = {
        label: `${record.code} - ${record.name}`,
        value: record.id,
        code: record.code,
        symbol: record.symbol
      };
      setAttributes(prev => ({
        ...prev,
        currencies: [...(prev.currencies || []), option].sort((a, b) => a.label.localeCompare(b.label))
      }));
      setFormData(prev => ({ ...prev, currencyId: record.id, currency: record.code || prev.currency }));
    }

    if (kind === 'account') {
      const option = {
        label: `${record.code} - ${record.name}`,
        value: record.id,
        code: record.code,
        name: record.name,
        type: record.type
      };
      setAttributes(prev => ({
        ...prev,
        accounts: [...(prev.accounts || []), option].sort((a, b) => String(a.code).localeCompare(String(b.code)))
      }));
      setFormData(prev => ({ ...prev, [target]: record.id }));
    }

    setMasterModal(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = [
      ['code', 'Item Code', formData.code],
      ['name', 'Item Name', formData.name],
      ['productTypeId', 'Item Type', formData.productTypeId],
      ['categoryId', 'Category', formData.categoryId],
      ['stockUomId', 'Stock UOM', formData.stockUomId]
    ];
    const missing = requiredFields.filter(([, , value]) => !String(value || '').trim());
    if (missing.length) {
      const next = {};
      missing.forEach(([key, label]) => {
        next[key] = `${label} is required.`;
      });
      setFieldErrors(next);
      setActiveTab('mandatory');
      showToast(missing.length === 1 ? next[missing[0][0]] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        ...formData,
        costPrice: formData.standardCost ? parseFloat(formData.standardCost) : 0, // Fallback link
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
        reorderLevel: formData.reorderLevel ? parseInt(formData.reorderLevel) : 0,
        
        conversionFactor: formData.conversionFactor ? parseFloat(formData.conversionFactor) : 1.0,
        standardCost: formData.standardCost ? parseFloat(formData.standardCost) : 0.0,
        scrapPercent: formData.scrapPercent ? parseFloat(formData.scrapPercent) : 0.0,
        safetyStock: formData.safetyStock ? parseInt(formData.safetyStock) : 0,
        bomApplicable: formData.bomApplicable === true
      };

      if (id) {
        await axios.put(`/api/products/${id}`, payload, config);
        showToast('Product updated successfully', 'success');
      } else {
        await axios.post('/api/products', payload, config);
        showToast('Product created successfully', 'success');
      }
      navigate('/products');
    } catch (error) {
      console.error('Failed to save product:', error);
      showToast(error.response?.data?.error || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!newProductCode || !newProductCode.trim()) {
      setDuplicateCodeError('Product code is required.');
      showToast('Product code is required.', 'error');
      return;
    }
    setDuplicateCodeError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/products/${duplicateConfig.productId}/duplicate`, {
        newCode: newProductCode.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Product duplicated successfully', 'success');
      setDuplicateConfig({ isOpen: false, productId: null, sourceCode: '' });
      setNewProductCode('');
      // Navigate to the newly duplicated product details page
      navigate(recordPath('/products', res.data, 'code'));
    } catch (error) {
      console.error('Failed to duplicate product:', error);
      showToast(error.response?.data?.error || 'Failed to duplicate product', 'error');
    }
  };

  if (isInitialLoad) {
    return (
      <AppLayout title={routeKey ? "Edit Item" : "Create New Item"} icon={Box}>
        <PageSkeleton type="form" />
      </AppLayout>
    );
  }

  // Filter accounts for Inventory & COGS mapping if desired, otherwise display all
  const assetAccounts = attributes.accounts?.filter(a => a.type === 'ASSET') || [];
  const expenseAccounts = attributes.accounts?.filter(a => a.type === 'EXPENSE') || [];

  const accountColumns = [
    { label: 'Code', key: 'code', width: '80px' },
    { label: 'Name', key: 'name' },
    { label: 'Type', key: 'type', width: '90px' }
  ];

  // Common input styling matching reference UI
  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    width: '180px',
    flexShrink: 0,
    margin: 0
  };

  const formRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    width: '100%',
    maxWidth: '550px'
  };

  const inputStyle = {
    width: '100%',
    height: '42px',
    padding: '0.65rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: '0.9rem',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    transition: 'border-color 0.2s',
  };

  const sectionHeaderStyle = {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.65rem',
    marginBottom: '1.25rem',
    marginTop: '0.5rem'
  };

  return (
    <AppLayout title={routeKey ? "Edit Item" : "Create New Item"}>
      {/* Header Action Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/products')} 
            style={{ 
              background: '#fff', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              padding: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              color: '#64748b',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1.25rem' }}>
              {routeKey ? 'Update Product Item' : 'Create New Item'}
            </h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Active Status Header Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginRight: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Active Status</span>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ 
                ...prev, 
                activeStatus: prev.activeStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' 
              }))}
              style={{
                width: '46px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: formData.activeStatus === 'ACTIVE' ? 'var(--accent)' : '#cbd5e1',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.2s',
                padding: 0
              }}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                position: 'absolute',
                top: '3px',
                left: formData.activeStatus === 'ACTIVE' ? '25px' : '3px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </button>
          </div>
          <div style={{ height: '24px', width: '1px', backgroundColor: '#cbd5e1', marginRight: '0.75rem' }} />

          {id && (
            <button 
              type="button" 
              onClick={() => {
                setDuplicateConfig({
                  isOpen: true,
                  productId: id,
                  sourceCode: formData.code
                });
                setNewProductCode(`${formData.code}-DUP`);
              }} 
              style={{ 
                background: '#fff', 
                color: 'var(--accent)', 
                border: '1px solid var(--accent)', 
                padding: '0.55rem 1.25rem', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 600, 
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff';
              }}
            >
              <Copy size={16} /> Duplicate
            </button>
          )}

          <button 
            type="button" 
            onClick={() => navigate('/products')} 
            style={{ 
              background: '#fff', 
              color: '#64748b', 
              border: '1px solid #e2e8f0', 
              padding: '0.55rem 1.25rem', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 600, 
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{ 
              padding: '0.55rem 1.5rem', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.85rem', 
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', 
              color: '#ffffff', 
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {saving ? 'Saving...' : <><Check size={16} /> Save Item</>}
          </button>
        </div>
      </div>

      {/* Main Single Column Form with Vertical Tab Sidebar Navigation */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '1200px', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left Side: Vertical Tab Sidebar */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'mandatory', label: 'Mandatory', icon: FileText },
            { id: 'conversions', label: 'Conversions', icon: RefreshCw },
            { id: 'manufacturing', label: 'Manufacturing', icon: Wrench },
            { id: 'finance', label: 'Finance', icon: DollarSign },
            { id: 'classification', label: 'Classification', icon: Tag }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : '#64748b',
                  width: '100%',
                  fontFamily: 'inherit',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.color = '#1e293b';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <IconComponent size={18} style={{ color: isActive ? 'var(--accent)' : '#64748b', flexShrink: 0 }} />
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.025em',
                  color: isActive ? 'var(--accent)' : '#334155',
                  lineHeight: '1.2'
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Active Tab Form Fields */}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          {/* ==================== TAB 1: MANDATORY ==================== */}
          {activeTab === 'mandatory' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Mandatory Fields</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Item Type <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.productTypes}
                      value={formData.productTypeId}
                      onChange={(val) => {
                        clearFieldError('productTypeId');
                        handleTypeOrCategoryChange({ productTypeId: val });
                      }}
                      placeholder="Select Item Type..."
                      style={{ input: controlStyle('productTypeId') }}
                      invalid={!!fieldErrors.productTypeId}
                    />
                    {fieldErrors.productTypeId && <span className="field-error-text">{fieldErrors.productTypeId}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Category <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.categories}
                      value={formData.categoryId}
                      onChange={(val) => {
                        clearFieldError('categoryId');
                        const matched = attributes.categories.find(c => c.value === val);
                        handleTypeOrCategoryChange({ 
                          categoryId: val,
                          categoryName: matched ? matched.label : ''
                        });
                      }}
                      placeholder="Select category..."
                      style={{ input: controlStyle('categoryId') }}
                      invalid={!!fieldErrors.categoryId}
                      onAddNew={() => setMasterModal({ kind: 'category' })}
                    />
                    {fieldErrors.categoryId && <span className="field-error-text">{fieldErrors.categoryId}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Item Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="code" 
                      value={formData.code} 
                      onChange={handleInputChange} 
                      placeholder="e.g. MAT-1002" 
                      className={fieldErrors.code ? 'field-invalid' : undefined}
                      style={controlStyle('code')}
                      required 
                    />
                    {fieldErrors.code && <span className="field-error-text">{fieldErrors.code}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Item Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Copper Wire" 
                      className={fieldErrors.name ? 'field-invalid' : undefined}
                      style={controlStyle('name')}
                      required 
                    />
                    {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Stock UOM <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.uoms}
                      value={formData.stockUomId}
                      onChange={(val) => {
                        clearFieldError('stockUomId');
                        setFormData(prev => ({ ...prev, stockUomId: val }));
                      }}
                      placeholder="Select Stock UOM..."
                      style={{ input: controlStyle('stockUomId') }}
                      invalid={!!fieldErrors.stockUomId}
                      onAddNew={() => setMasterModal({ kind: 'uom', target: 'stockUomId' })}
                    />
                    {fieldErrors.stockUomId && <span className="field-error-text">{fieldErrors.stockUomId}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Purchase UOM</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.uoms}
                      value={formData.purchaseUomId}
                      onChange={(val) => setFormData(prev => ({ ...prev, purchaseUomId: val }))}
                      placeholder="Select Purchase UOM..."
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'uom', target: 'purchaseUomId' })}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Sales UOM</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.uoms}
                      value={formData.salesUomId}
                      onChange={(val) => setFormData(prev => ({ ...prev, salesUomId: val }))}
                      placeholder="Select Sales UOM..."
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'uom', target: 'salesUomId' })}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Costing Method</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={[
                        { label: 'FIFO', value: 'FIFO' }
                      ]}
                      value={formData.costingMethod}
                      onChange={(val) => setFormData(prev => ({ ...prev, costingMethod: val }))}
                      placeholder="Select Costing Method..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: CONVERSIONS ==================== */}
          {activeTab === 'conversions' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>UOM Conversion Rates</h3>
              {(formData.purchaseUomId || formData.salesUomId) && (
                <div style={{ maxWidth: '550px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Purchase UOM Equation */}
                    {formData.purchaseUomId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                          Procurement Conversion
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>1</span>
                          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {attributes.uoms?.find(u => u.value === formData.purchaseUomId)?.label || 'Purchase UOM'}
                          </span>
                          <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'bold' }}>=</span>
                          <input 
                            type="number" 
                            step="any"
                            placeholder="1.0"
                            value={
                              formData.uomConversions?.find(
                                c => c.fromUomId === formData.purchaseUomId && c.toUomId === formData.stockUomId
                              )?.factor ?? ''
                            } 
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => {
                                const nextConvs = [...(prev.uomConversions || [])];
                                const idx = nextConvs.findIndex(
                                  c => c.fromUomId === prev.purchaseUomId && c.toUomId === prev.stockUomId
                                );
                                const factorVal = val === '' ? 1.0 : parseFloat(val);
                                const entry = {
                                  fromUomId: prev.purchaseUomId,
                                  toUomId: prev.stockUomId,
                                  factor: isNaN(factorVal) ? 1.0 : factorVal
                                };
                                if (idx > -1) {
                                  nextConvs[idx] = entry;
                                } else {
                                  nextConvs.push(entry);
                                }
                                return { ...prev, uomConversions: nextConvs };
                              });
                            }}
                            style={{ 
                              width: '100px', 
                              height: '36px', 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '6px', 
                              border: '1px solid #cbd5e1', 
                              outline: 'none', 
                              fontSize: '0.9rem', 
                              textAlign: 'center' 
                            }}
                          />
                          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {attributes.uoms?.find(u => u.value === formData.stockUomId)?.label || 'Stock UOM'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Sales UOM Equation */}
                    {formData.salesUomId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                          Sales Conversion
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>1</span>
                          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {attributes.uoms?.find(u => u.value === formData.salesUomId)?.label || 'Sales UOM'}
                          </span>
                          <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'bold' }}>=</span>
                          <input 
                            type="number" 
                            step="any"
                            placeholder="1.0"
                            value={
                              formData.uomConversions?.find(
                                c => c.fromUomId === formData.salesUomId && c.toUomId === formData.stockUomId
                              )?.factor ?? ''
                            } 
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => {
                                const nextConvs = [...(prev.uomConversions || [])];
                                const idx = nextConvs.findIndex(
                                  c => c.fromUomId === prev.salesUomId && c.toUomId === prev.stockUomId
                                );
                                const factorVal = val === '' ? 1.0 : parseFloat(val);
                                const entry = {
                                  fromUomId: prev.salesUomId,
                                  toUomId: prev.stockUomId,
                                  factor: isNaN(factorVal) ? 1.0 : factorVal
                                };
                                if (idx > -1) {
                                  nextConvs[idx] = entry;
                                } else {
                                  nextConvs.push(entry);
                                }
                                return { ...prev, uomConversions: nextConvs };
                              });
                            }}
                            style={{ 
                              width: '100px', 
                              height: '36px', 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '6px', 
                              border: '1px solid #cbd5e1', 
                              outline: 'none', 
                              fontSize: '0.9rem', 
                              textAlign: 'center' 
                            }}
                          />
                          <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {attributes.uoms?.find(u => u.value === formData.stockUomId)?.label || 'Stock UOM'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 2: MANUFACTURING ==================== */}
          {activeTab === 'manufacturing' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Manufacturing & Stock Limits</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Standard Cost</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="standardCost" 
                      value={formData.standardCost} 
                      onChange={handleInputChange} 
                      placeholder="0.00" 
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Scrap %</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="scrapPercent" 
                      value={formData.scrapPercent} 
                      onChange={handleInputChange} 
                      placeholder="0.00" 
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Reorder Level</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      name="reorderLevel" 
                      value={formData.reorderLevel} 
                      onChange={handleInputChange} 
                      placeholder="0" 
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Safety Stock</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      name="safetyStock" 
                      value={formData.safetyStock} 
                      onChange={handleInputChange} 
                      placeholder="0" 
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>SKU</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input name="sku" value={formData.sku || ''} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Barcode</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input name="barcode" value={formData.barcode || ''} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Variant</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input name="variant" value={formData.variant || ''} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Size / weight</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input name="sizeLabel" value={formData.sizeLabel || ''} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Weight</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input type="number" name="weight" value={formData.weight || ''} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Volume</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input type="number" name="volume" value={formData.volume || ''} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Lead time (days)</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input type="number" name="leadTimeDays" value={formData.leadTimeDays || '0'} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Daily demand</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}><input type="number" name="dailyDemand" value={formData.dailyDemand || '0'} onChange={handleInputChange} style={inputStyle} /></div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Pick rule</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <select name="pickRule" value={formData.pickRule || 'FIFO'} onChange={handleInputChange} style={inputStyle}>
                      <option value="FIFO">FIFO</option>
                      <option value="FEFO">FEFO</option>
                    </select>
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Batch tracked</label>
                  <button type="button" onClick={() => handleToggleChange('batchTracked')} style={{ width: '46px', height: '24px', borderRadius: '12px', backgroundColor: formData.batchTracked ? 'var(--accent)' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '3px', left: formData.batchTracked ? '25px' : '3px' }} />
                  </button>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Expiry tracked</label>
                  <button type="button" onClick={() => handleToggleChange('expiryTracked')} style={{ width: '46px', height: '24px', borderRadius: '12px', backgroundColor: formData.expiryTracked ? 'var(--accent)' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '3px', left: formData.expiryTracked ? '25px' : '3px' }} />
                  </button>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>BOM Applicable</label>
                  <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleChange('bomApplicable')}
                      style={{
                        width: '46px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: formData.bomApplicable ? 'var(--accent)' : '#cbd5e1',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color 0.2s',
                        padding: 0
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '3px',
                        left: formData.bomApplicable ? '25px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                      }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: FINANCE ==================== */}
          {activeTab === 'finance' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Finance & Account Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Tax Group</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={taxGroups.map(tg => ({ label: tg.name, value: tg.name }))}
                      value={formData.taxGroup}
                      onChange={(val) => setFormData(prev => ({ ...prev, taxGroup: val }))}
                      placeholder="Select Tax Group..."
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'taxGroup' })}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Currency</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.currencies || []}
                      value={formData.currencyId}
                      onChange={(val) => {
                        const matched = attributes.currencies?.find(c => c.value === val);
                        setFormData(prev => ({
                          ...prev,
                          currencyId: val,
                          currency: matched ? matched.code : 'USD'
                        }));
                      }}
                      placeholder="Select Currency..."
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'currency' })}
                    />
                  </div>
                </div>
                 <div style={formRowStyle}>
                  <label style={labelStyle}>Inventory Account</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={assetAccounts}
                      value={formData.inventoryAccountId}
                      onChange={(val) => setFormData(prev => ({ ...prev, inventoryAccountId: val }))}
                      placeholder="Select Asset Account..."
                      columns={accountColumns}
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'account', target: 'inventoryAccountId', accountType: 'ASSET' })}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>COGS Account</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={expenseAccounts}
                      value={formData.cogsAccountId}
                      onChange={(val) => setFormData(prev => ({ ...prev, cogsAccountId: val }))}
                      placeholder="Select Expense Account..."
                      columns={accountColumns}
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'account', target: 'cogsAccountId', accountType: 'EXPENSE' })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: CLASSIFICATION ==================== */}
          {activeTab === 'classification' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Classification & Material Metadata</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Brand</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={attributes.brands}
                      value={formData.brandId}
                      onChange={(val) => setFormData(prev => ({ ...prev, brandId: val }))}
                      placeholder="Select Brand..."
                      style={{ input: inputStyle }}
                      onAddNew={() => setMasterModal({ kind: 'brand' })}
                    />
                  </div>
                </div>
                 <div style={formRowStyle}>
                  <label style={labelStyle}>Product Group</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <TreeSelect
                      categories={rawProductGroups}
                      value={formData.productGroupId}
                      onChange={(val) => {
                        const selectedGroup = rawProductGroups.find(g => g.id === val);
                        setFormData(prev => ({ 
                          ...prev, 
                          productGroupId: val,
                          productGroup: selectedGroup ? selectedGroup.name : ''
                        }));
                      }}
                      placeholder="Select Product Group"
                      showEmptyOption={true}
                      emptyLabel="None (Clear Selection)"
                      onAddNew={() => setMasterModal({ kind: 'productGroup' })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </form>

      {masterModal && (
        <QuickMasterModal
          key={`${masterModal.kind}-${masterModal.target || ''}`}
          kind={masterModal.kind}
          accountType={masterModal.accountType}
          parents={
            masterModal.kind === 'category' ? rawCategories
            : masterModal.kind === 'brand' ? rawBrands
            : masterModal.kind === 'productGroup' ? rawProductGroups
            : []
          }
          onClose={() => setMasterModal(null)}
          onCreated={handleMasterCreated}
        />
      )}

      {duplicateConfig.isOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', position: 'relative' }}>
              <button 
                onClick={() => setDuplicateConfig({ isOpen: false, productId: null, sourceCode: '' })}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Duplicate Product
                </h3>
                <input 
                  type="text"
                  value={newProductCode}
                  onChange={(e) => {
                    setNewProductCode(e.target.value);
                    if (duplicateCodeError) setDuplicateCodeError('');
                  }}
                  placeholder="e.g. ITEM-001-COPY"
                  className={duplicateCodeError ? 'field-invalid' : undefined}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDuplicate();
                  }}
                  autoFocus
                />
                {duplicateCodeError && <span className="field-error-text">{duplicateCodeError}</span>}
              </div>
            </div>
            <div style={{ 
              padding: '1.25rem 1.5rem', 
              backgroundColor: '#f8fafc', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '0.75rem',
              borderTop: '1px solid var(--border-color)'
            }}>
              <button 
                onClick={() => setDuplicateConfig({ isOpen: false, productId: null, sourceCode: '' })}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDuplicate}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: 'var(--accent, #3b82f6)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
