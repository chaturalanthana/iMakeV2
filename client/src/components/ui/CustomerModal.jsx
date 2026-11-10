import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { User, X, FileText, DollarSign, MapPin, Briefcase, Plus, Trash2, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from './LiveSearchDropdown';
import AccountSearchDropdown from './AccountSearchDropdown';

// Helper to determine if current user has finance permissions
const hasFinancePermission = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return true;
    const user = JSON.parse(userStr);
    if (!user || !user.role) return true;
    const roleName = user.role?.name?.toLowerCase() || '';
    if (roleName.includes('standard') || roleName.includes('sales') || roleName.includes('agent')) {
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
};

export default function CustomerModal({ isOpen, onClose, customerToEdit = null, onSaved }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('mandatory');
  const isFinanceUser = hasFinancePermission();

  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [discountGroups, setDiscountGroups] = useState([]);
  const [taxGroups, setTaxGroups] = useState([]);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    customerType: 'Corporate',
    customerCategoryId: '',
    customerCategory: '',
    mobileNumber: '',
    activeStatus: 'ACTIVE',
    creditCustomer: false,
    creditLimit: '0.0',
    creditPeriod: '0',
    branches: [],
    salesRep: '',
    priceList: 'Standard Retail',
    industry: '',
    customerSegment: '',
    accountsReceivableId: '',
    revenueAccountId: '',
    taxGroup: '',
    discountGroup: '',
    salesTerritory: '',
    allowCreditSales: false
  });

  const selectableARAccounts = useMemo(() => {
    const parentIds = new Set(accounts.map(acc => acc.parentId).filter(Boolean));
    return accounts.filter(acc => acc.type?.toUpperCase() === 'ASSET' && !parentIds.has(acc.id));
  }, [accounts]);

  const selectableRevenueAccounts = useMemo(() => {
    const parentIds = new Set(accounts.map(acc => acc.parentId).filter(Boolean));
    return accounts.filter(acc => acc.type?.toUpperCase() === 'REVENUE' && !parentIds.has(acc.id));
  }, [accounts]);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const token = localStorage.getItem('token');
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const [catRes, accRes, plRes, dgRes, tgRes] = await Promise.all([
            axios.get('/api/customer-categories', config),
            axios.get('/api/finance/accounts', config),
            axios.get('/api/price-lists', config),
            axios.get('/api/discount-groups', config),
            axios.get('/api/finance/tax-groups', config)
          ]);
          setCategories(catRes.data.filter(c => c.status === 'ACTIVE'));
          setAccounts(accRes.data);
          setPriceLists(plRes.data.filter(pl => pl.status === 'ACTIVE'));
          setDiscountGroups(dgRes.data.filter(dg => dg.status === 'ACTIVE'));
          setTaxGroups(tgRes.data.filter(tg => tg.status === 'ACTIVE'));
        } catch (error) {
          console.error('Failed to fetch modal dropdown data:', error);
        }
      };
      fetchData();
      setActiveTab('mandatory');
    }
  }, [isOpen]);

  useEffect(() => {
    if (customerToEdit) {
      setFormData({
        code: customerToEdit.code || '',
        name: customerToEdit.name || '',
        email: customerToEdit.email || '',
        phone: customerToEdit.phone || '',
        address: customerToEdit.address || '',
        customerType: customerToEdit.customerType || 'Corporate',
        customerCategoryId: customerToEdit.customerCategoryId || '',
        customerCategory: customerToEdit.customerCategory || '',
        mobileNumber: customerToEdit.mobileNumber || '',
        activeStatus: customerToEdit.activeStatus || 'ACTIVE',
        creditCustomer: customerToEdit.creditCustomer || false,
        creditLimit: customerToEdit.creditLimit !== undefined ? customerToEdit.creditLimit.toString() : '0.0',
        creditPeriod: customerToEdit.creditPeriod !== undefined ? customerToEdit.creditPeriod.toString() : '0',
        branches: customerToEdit.branches || [],
        salesRep: customerToEdit.salesRep || '',
        priceList: customerToEdit.priceList || 'Standard Retail',
        industry: customerToEdit.industry || '',
        customerSegment: customerToEdit.customerSegment || '',
        accountsReceivableId: customerToEdit.accountsReceivableId || '',
        revenueAccountId: customerToEdit.revenueAccountId || '',
        taxGroup: customerToEdit.taxGroup || '',
        discountGroup: customerToEdit.discountGroup || '',
        salesTerritory: customerToEdit.salesTerritory || '',
        allowCreditSales: customerToEdit.allowCreditSales || false
      });
    } else {
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      setFormData({
        code: `CUS-${randSuffix}`,
        name: '',
        email: '',
        phone: '',
        address: '',
        customerType: 'Corporate',
        customerCategoryId: '',
        customerCategory: '',
        mobileNumber: '',
        activeStatus: 'ACTIVE',
        creditCustomer: false,
        creditLimit: '0.0',
        creditPeriod: '0',
        branches: [],
        salesRep: '',
        priceList: 'Standard Retail',
        industry: '',
        customerSegment: '',
        accountsReceivableId: '',
        revenueAccountId: '',
        taxGroup: '',
        discountGroup: '',
        salesTerritory: '',
        allowCreditSales: false
      });
    }
  }, [customerToEdit, isOpen]);

  const handleCategoryChange = (categoryId) => {
    const selectedCat = categories.find(cat => cat.id === categoryId);
    if (selectedCat) {
      setFormData(prev => ({
        ...prev,
        customerCategoryId: categoryId,
        customerCategory: selectedCat.name, // legacy sync
        priceList: selectedCat.priceList || prev.priceList,
        discountGroup: selectedCat.discountGroup || prev.discountGroup,
        salesTerritory: selectedCat.salesTerritory || prev.salesTerritory,
        salesRep: selectedCat.salesRep || prev.salesRep,
        creditLimit: selectedCat.creditLimit !== undefined ? selectedCat.creditLimit.toString() : prev.creditLimit,
        creditPeriod: selectedCat.creditPeriod !== undefined ? selectedCat.creditPeriod.toString() : prev.creditPeriod,
        creditCustomer: selectedCat.allowCreditSales || false,
        accountsReceivableId: selectedCat.accountsReceivableId || prev.accountsReceivableId,
        revenueAccountId: selectedCat.revenueAccountId || prev.revenueAccountId,
        taxGroup: selectedCat.taxGroup || prev.taxGroup,
        allowCreditSales: selectedCat.allowCreditSales || false
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customerCategoryId: '',
        customerCategory: ''
      }));
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
      if (name === 'creditCustomer' && !nextVal) {
        updates.creditLimit = '0.0';
        updates.creditPeriod = '0';
      }
      return { ...prev, ...updates };
    });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Customer Name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0.0,
        creditPeriod: formData.creditPeriod ? parseInt(formData.creditPeriod) : 0,
        phone: formData.phone || formData.mobileNumber
      };

      let savedCustomer;
      if (customerToEdit) {
        const res = await axios.put(`/api/customers/${customerToEdit.id}`, payload, config);
        savedCustomer = res.data;
        showToast('Customer updated successfully', 'success');
      } else {
        const res = await axios.post('/api/customers', payload, config);
        savedCustomer = res.data;
        showToast('Customer created successfully', 'success');
      }
      onSaved(savedCustomer);
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const sectionHeaderStyle = {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.65rem',
    marginBottom: '1.5rem',
    marginTop: '0.25rem'
  };

  const formRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    width: '100%',
    marginBottom: '1rem'
  };

  const formRowStyleTop = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.5rem',
    width: '100%',
    marginBottom: '1rem'
  };

  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    width: '220px',
    flexShrink: 0,
    margin: 0
  };

  const inputContainerStyle = {
    width: '380px',
    flexShrink: 0
  };

  const inputStyle = {
    width: '100%',
    height: '38px',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: '0.85rem',
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
    fontSize: '0.8rem',
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#0f172a'
  };

  return createPortal(
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 10000 
    }}>
      <div style={{ 
        backgroundColor: '#ffffff', borderRadius: '16px', width: '950px', 
        maxWidth: '95vw', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', minHeight: '550px'
      }}>
        {/* Modal Header */}
        <div style={{ 
          padding: '1.25rem 1.75rem', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '8px',
              backgroundColor: 'rgba(124, 58, 237, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <User size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {customerToEdit ? 'Update Customer' : 'Add New Customer'}
              </h3>
              <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                Quickly set details, limits, addresses, sales options, and accounts.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ 
            background: '#f1f5f9', border: 'none', cursor: 'pointer', 
            color: '#64748b', width: '32px', height: '32px', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Main Body (Vertical Tabs + Fields Pane) */}
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Left Tab Strip */}
          <div style={{ 
            width: '210px', 
            borderRight: '1px solid #e2e8f0', 
            padding: '1.5rem 1rem', 
            backgroundColor: '#f8fafc',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem',
            flexShrink: 0
          }}>
            {[
              { id: 'mandatory', label: 'Mandatory', icon: FileText },
              { id: 'financial', label: 'Financial', icon: DollarSign },
              { id: 'address', label: 'Branches', icon: MapPin },
              { id: 'sales', label: 'Sales Settings', icon: Briefcase }
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
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
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
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
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
                  <IconComponent size={16} style={{ color: isActive ? 'var(--accent)' : '#64748b', flexShrink: 0 }} />
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.025em',
                    color: isActive ? 'var(--accent)' : '#475569',
                  }}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Content Pane */}
          <div style={{ flexGrow: 1, padding: '1.75rem 2rem', overflowY: 'auto', maxHeight: '100%' }}>
            
            {/* TAB: MANDATORY */}
            {activeTab === 'mandatory' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h3 style={sectionHeaderStyle}>Mandatory Fields</h3>
                
                <div style={formRowStyle}>
                  <label style={labelStyle}>Customer Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="code" value={formData.code} 
                      onChange={handleInputChange} placeholder="e.g. CUS-1002" 
                      style={{ ...inputStyle, backgroundColor: '#f8fafc', fontWeight: 600 }}
                      disabled
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Customer Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="name" value={formData.name} 
                      onChange={handleInputChange} placeholder="e.g. Acme Corporation Ltd." 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Customer Type <span style={{ color: 'red' }}>*</span></label>
                  <div style={inputContainerStyle}>
                    <LiveSearchDropdown
                      options={[
                        { label: 'Corporate', value: 'Corporate' },
                        { label: 'Retail', value: 'Retail' },
                        { label: 'Wholesale', value: 'Wholesale' }
                      ]}
                      value={formData.customerType}
                      onChange={(val) => setFormData(prev => ({ ...prev, customerType: val }))}
                      placeholder="Select Customer Type..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Category <span style={{ color: 'red' }}>*</span></label>
                  <div style={inputContainerStyle}>
                    <LiveSearchDropdown
                      options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
                      value={formData.customerCategoryId}
                      onChange={(val) => handleCategoryChange(val)}
                      placeholder="Select Category..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Mobile Number</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="phone" value={formData.phone} 
                      onChange={handleInputChange} placeholder="e.g. +1 555-0199" 
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Email Address</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="email" name="email" value={formData.email} 
                      onChange={handleInputChange} placeholder="contact@example.com" 
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: FINANCIAL */}
            {activeTab === 'financial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h3 style={sectionHeaderStyle}>Financial Settings</h3>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Allow Credit Sales</label>
                  <div style={inputContainerStyle}>
                    <button
                      type="button"
                      onClick={() => handleToggleChange('creditCustomer')}
                      style={{
                        width: '46px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: formData.creditCustomer ? 'var(--accent)' : '#cbd5e1',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color 0.2s',
                        padding: 0,
                        display: 'block'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '3px',
                        left: formData.creditCustomer ? '25px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                      }} />
                    </button>
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Credit Limit (Rs)</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="number" step="0.01" name="creditLimit" value={formData.creditLimit} 
                      disabled={!formData.creditCustomer}
                      onChange={handleInputChange} placeholder="0.00" 
                      style={{ ...inputStyle, backgroundColor: formData.creditCustomer ? '#fff' : '#f1f5f9' }}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Credit Period (Days)</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="number" name="creditPeriod" value={formData.creditPeriod} 
                      disabled={!formData.creditCustomer}
                      onChange={handleInputChange} placeholder="0" 
                      style={{ ...inputStyle, backgroundColor: formData.creditCustomer ? '#fff' : '#f1f5f9' }}
                    />
                  </div>
                </div>

                {isFinanceUser && (
                  <>
                    <div style={formRowStyle}>
                      <label style={labelStyle}>Default AR Account</label>
                      <div style={inputContainerStyle}>
                        <AccountSearchDropdown 
                          accounts={selectableARAccounts}
                          value={formData.accountsReceivableId} 
                          onChange={(val) => setFormData(prev => ({ ...prev, accountsReceivableId: val }))}
                          placeholder="Select AR Account..."
                          style={{ 
                            wrapper: { ...inputStyle, display: 'flex', alignItems: 'center' },
                            input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.85rem' }
                          }}
                        />
                      </div>
                    </div>

                    <div style={formRowStyle}>
                      <label style={labelStyle}>Default Revenue Account</label>
                      <div style={inputContainerStyle}>
                        <AccountSearchDropdown 
                          accounts={selectableRevenueAccounts}
                          value={formData.revenueAccountId} 
                          onChange={(val) => setFormData(prev => ({ ...prev, revenueAccountId: val }))}
                          placeholder="Select Revenue Account..."
                          style={{ 
                            wrapper: { ...inputStyle, display: 'flex', alignItems: 'center' },
                            input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.85rem' }
                          }}
                        />
                      </div>
                    </div>

                    <div style={formRowStyle}>
                      <label style={labelStyle}>Default Tax Group</label>
                      <div style={inputContainerStyle}>
                        <LiveSearchDropdown
                          options={taxGroups.map(tg => ({ label: tg.name, value: tg.name }))}
                          value={formData.taxGroup}
                          onChange={(val) => setFormData(prev => ({ ...prev, taxGroup: val }))}
                          placeholder="Select Tax Group..."
                          style={{ input: inputStyle }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: ADDRESS & BRANCHES */}
            {activeTab === 'address' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.65rem' }}>
                  <h3 style={{ ...sectionHeaderStyle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Branches</h3>
                  <button 
                    type="button" 
                    onClick={handleAddSpreadsheetRow} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '0.35rem 0.75rem',
                      backgroundColor: 'var(--accent)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '30%' }}>Branch Name</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '30%' }}>Branch Phone</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: '#334155', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '30%' }}>Branch Address</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: '#334155', textAlign: 'center', width: '10%' }}>Del</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.branches.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                            No branches. Click "Add Row" to append.
                          </td>
                        </tr>
                      ) : (
                        formData.branches.map((row, index) => (
                          <tr key={row.id || index} style={{ borderBottom: index === formData.branches.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                            <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                              <input 
                                type="text"
                                value={row.branchName || ''}
                                onChange={e => handleSpreadsheetCellChange(row.id, 'branchName', e.target.value)}
                                placeholder="Branch Name..."
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                              <input 
                                type="text"
                                value={row.phone || ''}
                                onChange={e => handleSpreadsheetCellChange(row.id, 'phone', e.target.value)}
                                placeholder="Phone..."
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                              <input 
                                type="text"
                                value={row.address || ''}
                                onChange={e => handleSpreadsheetCellChange(row.id, 'address', e.target.value)}
                                placeholder="Address..."
                                style={cellInputStyle}
                              />
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.15rem 0' }}>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveBranch(row.id)} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.2rem' }}
                              >
                                <Trash2 size={14} />
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

            {/* TAB: SALES SETTINGS */}
            {activeTab === 'sales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h3 style={sectionHeaderStyle}>Sales Settings</h3>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Price List</label>
                  <div style={inputContainerStyle}>
                    <LiveSearchDropdown
                      options={priceLists.map(pl => ({ label: pl.name, value: pl.name }))}
                      value={formData.priceList}
                      onChange={(val) => setFormData(prev => ({ ...prev, priceList: val }))}
                      placeholder="Select Price List..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Discount Group</label>
                  <div style={inputContainerStyle}>
                    <LiveSearchDropdown
                      options={discountGroups.map(dg => ({ label: dg.name, value: dg.name }))}
                      value={formData.discountGroup}
                      onChange={(val) => setFormData(prev => ({ ...prev, discountGroup: val }))}
                      placeholder="Select Discount Group..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Sales Territory</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="salesTerritory" value={formData.salesTerritory} 
                      onChange={handleInputChange} placeholder="e.g. North Region" 
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Sales Rep</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="salesRep" value={formData.salesRep} 
                      onChange={handleInputChange} placeholder="e.g. Rep Agent 1" 
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Industry</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="industry" value={formData.industry} 
                      onChange={handleInputChange} placeholder="e.g. Retail / Manufacturing" 
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={formRowStyle}>
                  <label style={labelStyle}>Customer Segment</label>
                  <div style={inputContainerStyle}>
                    <input 
                      type="text" name="customerSegment" value={formData.customerSegment} 
                      onChange={handleInputChange} placeholder="e.g. Enterprise / SMB" 
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{ 
          padding: '1rem 1.75rem', 
          borderTop: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '1rem',
          backgroundColor: '#f8fafc',
          flexShrink: 0
        }}>
          <button type="button" onClick={onClose} style={{ 
            background: '#ffffff', color: '#64748b', border: '1px solid #e2e8f0', 
            padding: '0.55rem 1.5rem', borderRadius: '8px', cursor: 'pointer', 
            fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
            fontFamily: 'inherit'
          }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={saving}
            style={{ 
              padding: '0.55rem 2rem', borderRadius: '8px', border: 'none', 
              cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
              color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
              transition: 'opacity 0.2s',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'inherit'
            }} 
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} 
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {saving ? 'Saving...' : <><Check size={16} /> Save Customer</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
