import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import AccountSearchDropdown from '../../components/ui/AccountSearchDropdown';
import { ArrowLeft, Check, Truck, FileText, Briefcase, DollarSign, MapPin, Tag, Plus, Trash2, CreditCard } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewSupplier() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('mandatory'); // 'mandatory', 'procurement', 'finance', 'classification', 'address'

  const [currencies, setCurrencies] = useState([]);
  const [paymentTermsList, setPaymentTermsList] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [purchaseTaxGroups, setPurchaseTaxGroups] = useState([]);
  const [purchaseWithholdingTaxGroups, setPurchaseWithholdingTaxGroups] = useState([]);

  const selectableAPAccounts = useMemo(() => {
    const parentIds = new Set(accounts.map(acc => acc.parentId).filter(Boolean));
    return accounts.filter(acc => acc.type?.toUpperCase() === 'LIABILITY' && !parentIds.has(acc.id));
  }, [accounts]);

  const selectableAdvanceAccounts = useMemo(() => {
    const parentIds = new Set(accounts.map(acc => acc.parentId).filter(Boolean));
    return accounts.filter(acc => (acc.type?.toUpperCase() === 'ASSET' || acc.type?.toUpperCase() === 'EXPENSE') && !parentIds.has(acc.id));
  }, [accounts]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    supplierCategory: '',
    phone: '',
    email: '',
    activeStatus: 'ACTIVE',
    leadTime: '0',
    currency: 'USD',
    creditSupplier: false,
    creditPeriod: '0',
    paymentTerms: '',
    supplierGroup: '',
    address: '',
    branches: [],
    bankDetails: [],
    accountsPayableId: '',
    advancePaymentAccountId: '',
    withholdingTaxGroup: '',
    taxGroup: ''
  });

  useEffect(() => {
    fetchPageData();
  }, [id]);

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Fetch currencies list (if any)
      try {
        const currRes = await axios.get('/api/finance/currencies', config);
        setCurrencies(currRes.data);
      } catch (e) {
        console.warn('Failed to load currencies, defaulting to standard options', e);
      }

      // Fetch payment terms list
      try {
        const termsRes = await axios.get('/api/payment-terms', config);
        setPaymentTermsList(termsRes.data);
      } catch (e) {
        console.warn('Failed to load payment terms', e);
      }

      // Fetch accounts
      try {
        const accRes = await axios.get('/api/finance/accounts', config);
        setAccounts(accRes.data);
      } catch (e) {
        console.warn('Failed to load accounts', e);
      }

      // Fetch purchase tax groups
      try {
        const tgRes = await axios.get('/api/procurement/tax-groups', config);
        setPurchaseTaxGroups(tgRes.data);
      } catch (e) {
        console.warn('Failed to load purchase tax groups', e);
      }

      // Fetch purchase withholding tax groups
      try {
        const wtgRes = await axios.get('/api/procurement/withholding-tax-groups', config);
        setPurchaseWithholdingTaxGroups(wtgRes.data);
      } catch (e) {
        console.warn('Failed to load purchase withholding tax groups', e);
      }

      if (id) {
        const supRes = await axios.get('/api/suppliers', config);
        const supplier = supRes.data.find(s => s.id === id);

        if (supplier) {
          setFormData({
            code: supplier.code || '',
            name: supplier.name || '',
            email: supplier.email || '',
            phone: supplier.phone || '',
            address: supplier.address || '',
            activeStatus: supplier.activeStatus || 'ACTIVE',
            supplierCategory: supplier.supplierCategory || '',
            leadTime: supplier.leadTime !== undefined ? supplier.leadTime.toString() : '0',
            currency: supplier.currency || 'USD',
            creditSupplier: supplier.creditSupplier || false,
            creditPeriod: supplier.creditPeriod !== undefined ? supplier.creditPeriod.toString() : '0',
            paymentTerms: supplier.paymentTerms || '',
            supplierGroup: supplier.supplierGroup || '',
            branches: supplier.branches || [],
            bankDetails: supplier.bankDetails || [],
            accountsPayableId: supplier.accountsPayableId || '',
            advancePaymentAccountId: supplier.advancePaymentAccountId || '',
            withholdingTaxGroup: supplier.withholdingTaxGroup || '',
            taxGroup: supplier.taxGroup || ''
          });
        } else {
          showToast('Supplier not found', 'error');
          navigate('/procurement/suppliers');
        }
      } else {
        // Generate default supplier code
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        setFormData(prev => ({ ...prev, code: `SUP-${randSuffix}` }));
      }
    } catch (error) {
      console.error('Failed to load page details:', error);
      showToast('Error loading page details', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleChange = (name) => {
    setFormData(prev => {
      const nextVal = !prev[name];
      const updates = { [name]: nextVal };
      if (name === 'creditSupplier' && !nextVal) {
        updates.creditPeriod = '0';
        updates.paymentTerms = '';
      }
      return { ...prev, ...updates };
    });
  };

  // Branch builder helpers
  const handleAddSpreadsheetRow = () => {
    setFormData(prev => ({
      ...prev,
      branches: [...prev.branches, { id: Date.now(), branchName: '', phone: '', address: '' }]
    }));
  };

  const handleSpreadsheetCellChange = (rowId, field, value) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches.map(b => b.id === rowId ? { ...b, [field]: value } : b)
    }));
  };

  const handleRemoveBranch = (branchId) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches.filter(b => b.id !== branchId)
    }));
  };

  // Bank details builder helpers
  const handleAddBankRow = () => {
    setFormData(prev => ({
      ...prev,
      bankDetails: [...prev.bankDetails, { id: Date.now(), bankName: '', branchName: '', accountNumber: '', accountHolderName: '', swiftCode: '', iban: '' }]
    }));
  };

  const handleBankCellChange = (rowId, field, value) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.map(b => b.id === rowId ? { ...b, [field]: value } : b)
    }));
  };

  const handleRemoveBank = (bankId) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.filter(b => b.id !== bankId)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!formData.code) nextErrors.code = 'Supplier Code is required.';
    if (!formData.name) nextErrors.name = 'Supplier Name is required.';
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      showToast(Object.keys(nextErrors).length === 1 ? Object.values(nextErrors)[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        ...formData,
        leadTime: formData.leadTime ? parseInt(formData.leadTime) : 0,
        creditPeriod: formData.creditPeriod ? parseInt(formData.creditPeriod) : 0,
      };

      if (id) {
        await axios.put(`/api/suppliers/${id}`, payload, config);
        showToast('Supplier updated successfully', 'success');
      } else {
        await axios.post('/api/suppliers', payload, config);
        showToast('Supplier created successfully', 'success');
      }
      navigate('/procurement/suppliers');
    } catch (error) {
      console.error('Failed to save supplier:', error);
      showToast(error.response?.data?.error || 'Failed to save supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoad) {
    return (
      <AppLayout title={id ? "Edit Supplier" : "Create New Supplier"} icon={Truck}>
        <PageSkeleton type="form" />
      </AppLayout>
    );
  }

  // Label & Form styles matching Customer form
  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    width: '250px',
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

  const cellInputStyle = {
    width: '100%',
    height: '32px',
    border: 'none',
    outline: 'none',
    padding: '0.25rem 0.6rem',
    fontSize: '0.85rem',
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#0f172a'
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
    <AppLayout title={id ? "Edit Supplier" : "Create New Supplier"}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/procurement/suppliers')} 
            style={{ 
              background: '#fff', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              padding: '0.55rem', 
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
              {id ? 'Update Supplier' : 'Create New Supplier'}
            </h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Define procurement capabilities, credit accounts, branches, and active groups.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Active Status Toggle */}
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

          <button 
            type="button" 
            onClick={() => navigate('/procurement/suppliers')} 
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
            {saving ? 'Saving...' : <><Check size={16} /> Save Supplier</>}
          </button>
        </div>
      </div>

      {/* Tabbed Form Section */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '1200px', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left sidebar tab menu */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'mandatory', label: 'Mandatory', icon: FileText },
            { id: 'procurement', label: 'Procurement', icon: Briefcase },
            { id: 'finance', label: 'Finance', icon: DollarSign },
            { id: 'banking', label: 'Banking Information', icon: CreditCard },
            { id: 'classification', label: 'Classification', icon: Tag },
            { id: 'address', label: 'Address & Branches', icon: MapPin }
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
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : '#64748b',
                  width: '100%',
                  fontFamily: 'inherit'
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

        {/* Tab content */}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          {/* TAB: MANDATORY */}
          {activeTab === 'mandatory' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Mandatory Fields</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Supplier Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="code" 
                      value={formData.code} 
                      onChange={handleInputChange} 
                      placeholder="e.g. SUP-1002" 
                      style={inputStyle}
                      className={fieldErrors.code ? 'field-invalid' : undefined}
                      required 
                    />
                    {fieldErrors.code && <span className="field-error-text">{fieldErrors.code}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Supplier Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Globex Corp" 
                      style={inputStyle}
                      className={fieldErrors.name ? 'field-invalid' : undefined}
                      required 
                    />
                    {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Supplier Category <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="supplierCategory" 
                      value={formData.supplierCategory} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Raw Materials" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Contact Number <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleInputChange} 
                      placeholder="e.g. +1 555-0188" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Email Address <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      placeholder="e.g. sales@globex.com" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROCUREMENT */}
          {activeTab === 'procurement' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Procurement Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Lead Time (Days)</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      name="leadTime" 
                      value={formData.leadTime} 
                      onChange={handleInputChange} 
                      placeholder="0" 
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Currency</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={currencies.length > 0 ? currencies.map(c => ({ label: `${c.code} - ${c.name}`, value: c.code })) : [
                        { label: 'USD - US Dollar', value: 'USD' },
                        { label: 'EUR - Euro', value: 'EUR' },
                        { label: 'GBP - British Pound', value: 'GBP' },
                        { label: 'LKR - Sri Lankan Rupee', value: 'LKR' }
                      ]}
                      value={formData.currency}
                      onChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                      placeholder="Select Currency..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FINANCE */}
          {activeTab === 'finance' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Finance Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Credit Supplier</label>
                  <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleChange('creditSupplier')}
                      style={{
                        width: '46px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: formData.creditSupplier ? 'var(--accent)' : '#cbd5e1',
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
                        left: formData.creditSupplier ? '25px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                      }} />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                      {formData.creditSupplier ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Credit Period (Days)</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      name="creditPeriod" 
                      value={formData.creditPeriod} 
                      disabled={!formData.creditSupplier}
                      onChange={handleInputChange} 
                      placeholder="0" 
                      style={{ ...inputStyle, backgroundColor: formData.creditSupplier ? '#fff' : '#f1f5f9' }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Payment Terms</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={paymentTermsList.map(t => ({ label: `${t.code} - ${t.name}`, value: t.name }))}
                      value={formData.paymentTerms}
                      disabled={!formData.creditSupplier}
                      onChange={(val) => {
                        const term = paymentTermsList.find(t => t.name === val);
                        const days = term ? term.days.toString() : '0';
                        setFormData(prev => ({ 
                          ...prev, 
                          paymentTerms: val,
                          creditPeriod: prev.creditSupplier ? days : prev.creditPeriod
                        }));
                      }}
                      placeholder="Select Payment Term..."
                      style={{ 
                        input: { 
                          ...inputStyle, 
                          backgroundColor: formData.creditSupplier ? '#fff' : '#f1f5f9' 
                        } 
                      }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Accounts Payable (AP) Account</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <AccountSearchDropdown 
                      accounts={selectableAPAccounts}
                      value={formData.accountsPayableId} 
                      onChange={(val) => setFormData(prev => ({ ...prev, accountsPayableId: val }))}
                      placeholder="Select Default AP Account"
                      style={{ 
                        wrapper: { ...inputStyle, display: 'flex', alignItems: 'center' },
                        input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.9rem' }
                      }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Advance Payment Account</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <AccountSearchDropdown 
                      accounts={selectableAdvanceAccounts}
                      value={formData.advancePaymentAccountId} 
                      onChange={(val) => setFormData(prev => ({ ...prev, advancePaymentAccountId: val }))}
                      placeholder="Select Advance Payment Account"
                      style={{ 
                        wrapper: { ...inputStyle, display: 'flex', alignItems: 'center' },
                        input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.9rem' }
                      }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Withholding Tax Group</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={purchaseWithholdingTaxGroups.map(tg => ({ label: tg.name, value: tg.name }))}
                      value={formData.withholdingTaxGroup}
                      onChange={(val) => setFormData(prev => ({ ...prev, withholdingTaxGroup: val }))}
                      placeholder="Select Withholding Tax Group..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Tax Group</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={purchaseTaxGroups.map(tg => ({ label: tg.name, value: tg.name }))}
                      value={formData.taxGroup}
                      onChange={(val) => setFormData(prev => ({ ...prev, taxGroup: val }))}
                      placeholder="Select Tax Group..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* TAB: BANKING */}
          {activeTab === 'banking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
                <h3 style={{ ...sectionHeaderStyle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Banking Information</h3>
                <button 
                  type="button" 
                  onClick={handleAddBankRow} 
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '0.45rem 1rem',
                    backgroundColor: 'var(--accent)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover, #6d28d9)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              {/* Spreadsheet Table Container */}
              <div style={{ 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '18%' }}>Bank Name</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '18%' }}>Branch Name</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '18%' }}>Account Number</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '20%' }}>Account Holder</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '10%' }}>SWIFT</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '10%' }}>IBAN</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'center', width: '6%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.bankDetails.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          No bank details added. Click "Add Row" to start adding banking information.
                        </td>
                      </tr>
                    ) : (
                      formData.bankDetails.map((row, index) => (
                        <tr key={row.id || index} style={{ borderBottom: index === formData.bankDetails.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.bankName} 
                              onChange={e => handleBankCellChange(row.id, 'bankName', e.target.value)} 
                              placeholder="e.g. Standard Chartered" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.branchName} 
                              onChange={e => handleBankCellChange(row.id, 'branchName', e.target.value)} 
                              placeholder="e.g. Colombo Main" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.accountNumber} 
                              onChange={e => handleBankCellChange(row.id, 'accountNumber', e.target.value)} 
                              placeholder="e.g. 0102030405" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.accountHolderName} 
                              onChange={e => handleBankCellChange(row.id, 'accountHolderName', e.target.value)} 
                              placeholder="e.g. Globex Corp" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.swiftCode} 
                              onChange={e => handleBankCellChange(row.id, 'swiftCode', e.target.value)} 
                              placeholder="SCBLFXXX" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.iban} 
                              onChange={e => handleBankCellChange(row.id, 'iban', e.target.value)} 
                              placeholder="IBAN..." 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveBank(row.id)} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CLASSIFICATION */}
          {activeTab === 'classification' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Classification</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Supplier Group</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="supplierGroup" 
                      value={formData.supplierGroup} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Domestic, International" 
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ADDRESS & BRANCHES */}
          {activeTab === 'address' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
              <div>
                <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>General Address</h3>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Business Address</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <textarea 
                      name="address"
                      value={formData.address} 
                      onChange={handleInputChange} 
                      rows="3" 
                      placeholder="Enter supplier address..."
                      style={{ 
                        width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', 
                        border: '1px solid #cbd5e1', outline: 'none', 
                        boxSizing: 'border-box', resize: 'none', fontSize: '0.9rem', backgroundColor: '#fff',
                        fontFamily: 'inherit'
                      }} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem', marginTop: '1.5rem' }}>
                <h3 style={{ ...sectionHeaderStyle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Multiple Branches</h3>
                <button 
                  type="button" 
                  onClick={handleAddSpreadsheetRow} 
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '0.45rem 1rem',
                    backgroundColor: 'var(--accent)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover, #6d28d9)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              {/* Spreadsheet Table Container */}
              <div style={{ 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '25%' }}>Branch Name</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '25%' }}>Branch Phone</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '40%' }}>Branch Address</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#334155', textAlign: 'center', width: '10%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.branches.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          No branches added. Click "Add Row" to start adding branches.
                        </td>
                      </tr>
                    ) : (
                      formData.branches.map((row, index) => (
                        <tr key={row.id || index} style={{ borderBottom: index === formData.branches.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.branchName} 
                              onChange={e => handleSpreadsheetCellChange(row.id, 'branchName', e.target.value)} 
                              placeholder="e.g. Warehouse Branch" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.phone} 
                              onChange={e => handleSpreadsheetCellChange(row.id, 'phone', e.target.value)} 
                              placeholder="e.g. +1 555-0144" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #e2e8f0' }}>
                            <input 
                              type="text" 
                              value={row.address} 
                              onChange={e => handleSpreadsheetCellChange(row.id, 'address', e.target.value)} 
                              placeholder="e.g. 128 Industrial Pkwy" 
                              style={cellInputStyle} 
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveBranch(row.id)} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </form>
    </AppLayout>
  );
}
