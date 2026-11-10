import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import AccountSearchDropdown from '../../components/ui/AccountSearchDropdown';
import DataTable from '../../components/ui/DataTable';
import { ArrowLeft, Check, User, FileText, DollarSign, MapPin, Briefcase, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

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

export default function NewCustomer() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('mandatory'); // 'mandatory', 'financial', 'address', 'sales'

  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [discountGroups, setDiscountGroups] = useState([]);
  const [taxGroups, setTaxGroups] = useState([]);
  const isFinanceUser = hasFinancePermission();

  const selectableARAccounts = useMemo(() => {
    const parentIds = new Set(accounts.map(acc => acc.parentId).filter(Boolean));
    return accounts.filter(acc => acc.type?.toUpperCase() === 'ASSET' && !parentIds.has(acc.id));
  }, [accounts]);

  const selectableRevenueAccounts = useMemo(() => {
    const parentIds = new Set(accounts.map(acc => acc.parentId).filter(Boolean));
    return accounts.filter(acc => acc.type?.toUpperCase() === 'REVENUE' && !parentIds.has(acc.id));
  }, [accounts]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    customerType: 'Corporate',
    customerCategory: '', // legacy category string
    customerCategoryId: '', // new relation Category ID
    mobileNumber: '',
    email: '',
    activeStatus: 'ACTIVE',
    creditCustomer: false,
    creditLimit: '0.0',
    creditPeriod: '0',
    address: '',
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

  useEffect(() => {
    fetchPageData();
  }, [id]);

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Load categories, accounts, price lists, discount groups, and tax groups
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

      if (id) {
        const custRes = await axios.get('/api/customers', config);
        const customer = custRes.data.find(c => c.id === id);

        if (customer) {
          setFormData({
            code: customer.code || '',
            name: customer.name || '',
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
            creditLimit: customer.creditLimit !== undefined ? customer.creditLimit.toString() : '0.0',
            customerType: customer.customerType || 'Corporate',
            customerCategory: customer.customerCategory || '',
            customerCategoryId: customer.customerCategoryId || '',
            mobileNumber: customer.mobileNumber || '',
            activeStatus: customer.activeStatus || 'ACTIVE',
            creditCustomer: customer.creditCustomer || false,
            creditPeriod: customer.creditPeriod !== undefined ? customer.creditPeriod.toString() : '0',
            branches: customer.branches || [],
            salesRep: customer.salesRep || '',
            priceList: customer.priceList || 'Standard Retail',
            industry: customer.industry || '',
            customerSegment: customer.customerSegment || '',
            accountsReceivableId: customer.accountsReceivableId || '',
            revenueAccountId: customer.revenueAccountId || '',
            taxGroup: customer.taxGroup || '',
            discountGroup: customer.discountGroup || '',
            salesTerritory: customer.salesTerritory || '',
            allowCreditSales: customer.allowCreditSales || false
          });
        } else {
          showToast('Customer not found', 'error');
          navigate('/sales/customers');
        }
      } else {
        // Generate default customer code
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        setFormData(prev => ({ ...prev, code: `CUS-${randSuffix}` }));
      }
    } catch (error) {
      console.error('Failed to load page details:', error);
      showToast('Error loading page details', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleCategoryChange = (categoryId) => {
    const selectedCat = categories.find(cat => cat.id === categoryId);
    if (selectedCat) {
      setFormData(prev => ({
        ...prev,
        customerCategoryId: categoryId,
        customerCategory: selectedCat.name, // sync legacy field
        // Inherited Sales defaults
        priceList: selectedCat.priceList || prev.priceList,
        discountGroup: selectedCat.discountGroup || prev.discountGroup,
        salesTerritory: selectedCat.salesTerritory || prev.salesTerritory,
        salesRep: selectedCat.salesRep || prev.salesRep,
        // Inherited Credit defaults
        creditLimit: selectedCat.creditLimit !== undefined ? selectedCat.creditLimit.toString() : prev.creditLimit,
        creditPeriod: selectedCat.creditPeriod !== undefined ? selectedCat.creditPeriod.toString() : prev.creditPeriod,
        creditCustomer: selectedCat.allowCreditSales || false,
        // Inherited Finance defaults
        accountsReceivableId: selectedCat.accountsReceivableId || prev.accountsReceivableId,
        revenueAccountId: selectedCat.revenueAccountId || prev.revenueAccountId,
        taxGroup: selectedCat.taxGroup || prev.taxGroup,
        allowCreditSales: selectedCat.allowCreditSales || false
      }));
      showToast(`Inherited defaults from category "${selectedCat.name}"`, 'success');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('Please fill in Customer Code and Customer Name.', 'error');
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
        // Sync original phone field with mobileNumber for backwards compatibility
        phone: formData.mobileNumber
      };

      if (id) {
        await axios.put(`/api/customers/${id}`, payload, config);
        showToast('Customer updated successfully', 'success');
      } else {
        await axios.post('/api/customers', payload, config);
        showToast('Customer created successfully', 'success');
      }
      navigate('/sales/customers');
    } catch (error) {
      console.error('Failed to save customer:', error);
      showToast(error.response?.data?.error || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoad) {
    return (
      <AppLayout title={id ? "Edit Customer" : "Create New Customer"} icon={User}>
        <PageSkeleton type="form" />
      </AppLayout>
    );
  }

  // Label & Form styles matching Product form
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

  const branchColumns = [
    { header: 'Branch Name', accessor: 'branchName', fontWeight: 600 },
    { header: 'Branch Phone', accessor: 'phone', color: 'var(--text-muted)' },
    { header: 'Branch Address', accessor: 'address', color: 'var(--text-muted)' },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button 
          type="button" 
          onClick={() => handleRemoveBranch(row.id)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  return (
    <AppLayout title={id ? "Edit Customer" : "Create New Customer"}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/sales/customers')} 
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
              {id ? 'Update Customer' : 'Create New Customer'}
            </h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Define primary details, financial limits, addresses, sales reps, and classifications.
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
            onClick={() => navigate('/sales/customers')} 
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
            {saving ? 'Saving...' : <><Check size={16} /> Save Customer</>}
          </button>
        </div>
      </div>

      {/* Tabbed Form Section */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '1200px', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left sidebar tab menu */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'mandatory', label: 'Mandatory', icon: FileText },
            { id: 'financial', label: 'Financial', icon: DollarSign },
            { id: 'address', label: 'Address & Branches', icon: MapPin },
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
                  <label style={labelStyle}>Customer Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="code" 
                      value={formData.code} 
                      onChange={handleInputChange} 
                      placeholder="e.g. CUS-1002" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Customer Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Acme Corporation" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Customer Type <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
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
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
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
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="mobileNumber" 
                      value={formData.mobileNumber} 
                      onChange={handleInputChange} 
                      placeholder="e.g. +1 555-0199" 
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Email Address</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      placeholder="e.g. billing@acme.com" 
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FINANCIAL */}
          {activeTab === 'financial' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Financial Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Allow Credit Sales</label>
                  <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        left: formData.creditCustomer ? '25px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                      }} />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                      {formData.creditCustomer ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Credit Limit</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      step="0.01"
                      name="creditLimit" 
                      value={formData.creditLimit} 
                      disabled={!formData.creditCustomer}
                      onChange={handleInputChange} 
                      placeholder="0.00" 
                      style={{ ...inputStyle, backgroundColor: formData.creditCustomer ? '#fff' : '#f1f5f9' }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Credit Period (Days)</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      name="creditPeriod" 
                      value={formData.creditPeriod} 
                      disabled={!formData.creditCustomer}
                      onChange={handleInputChange} 
                      placeholder="0" 
                      style={{ ...inputStyle, backgroundColor: formData.creditCustomer ? '#fff' : '#f1f5f9' }}
                    />
                  </div>
                </div>

                {isFinanceUser && (
                  <>
                    <div style={formRowStyle}>
                      <label style={labelStyle}>Default AR Account</label>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <AccountSearchDropdown 
                          accounts={selectableARAccounts}
                          value={formData.accountsReceivableId} 
                          onChange={(val) => setFormData(prev => ({ ...prev, accountsReceivableId: val }))}
                          placeholder="Select Default AR Account"
                          style={{ 
                            wrapper: { ...inputStyle, display: 'flex', alignItems: 'center' },
                            input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.9rem' }
                          }}
                        />
                      </div>
                    </div>
                    <div style={formRowStyle}>
                      <label style={labelStyle}>Default Revenue Account</label>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <AccountSearchDropdown 
                          accounts={selectableRevenueAccounts}
                          value={formData.revenueAccountId} 
                          onChange={(val) => setFormData(prev => ({ ...prev, revenueAccountId: val }))}
                          placeholder="Select Default Revenue Account"
                          style={{ 
                            wrapper: { ...inputStyle, display: 'flex', alignItems: 'center' },
                            input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.9rem' }
                          }}
                        />
                      </div>
                    </div>
                    <div style={formRowStyle}>
                      <label style={labelStyle}>Default Tax Group</label>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <LiveSearchDropdown
                          options={taxGroups.map(tg => ({ label: tg.name, value: tg.name }))}
                          value={formData.taxGroup}
                          onChange={(val) => setFormData(prev => ({ ...prev, taxGroup: val }))}
                          placeholder="Select Default Tax Group..."
                          style={{ input: inputStyle }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB: ADDRESS & BRANCHES */}
          {activeTab === 'address' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
                <h3 style={{ ...sectionHeaderStyle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Addresses & Branches</h3>
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
                          <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                            <input 
                              type="text"
                              value={row.branchName || ''}
                              onChange={e => handleSpreadsheetCellChange(row.id, 'branchName', e.target.value)}
                              placeholder="Enter Branch Name..."
                              style={cellInputStyle}
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                            <input 
                              type="text"
                              value={row.phone || ''}
                              onChange={e => handleSpreadsheetCellChange(row.id, 'phone', e.target.value)}
                              placeholder="Enter Branch Phone..."
                              style={cellInputStyle}
                            />
                          </td>
                          <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                            <input 
                              type="text"
                              value={row.address || ''}
                              onChange={e => handleSpreadsheetCellChange(row.id, 'address', e.target.value)}
                              placeholder="Enter Branch Address..."
                              style={cellInputStyle}
                            />
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.25rem' }}>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveBranch(row.id)} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem', fontFamily: 'inherit' }}
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

          {/* TAB: SALES SETTINGS */}
          {activeTab === 'sales' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Sales Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Price List</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
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
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <LiveSearchDropdown
                      options={discountGroups.map(dg => ({ label: dg.name, value: dg.name }))}
                      value={formData.discountGroup}
                      onChange={(val) => setFormData(prev => ({ ...prev, discountGroup: val }))}
                      placeholder="Select Discount Group..."
                      style={{ input: inputStyle }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </form>
    </AppLayout>
  );
}
