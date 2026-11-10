import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import AccountSearchDropdown from '../../components/ui/AccountSearchDropdown';
import { ArrowLeft, Check, Layers, FileText, DollarSign, Briefcase } from 'lucide-react';
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

export default function NewCustomerCategory() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'finance', 'sales'

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
    description: '',
    status: 'ACTIVE',
    accountsReceivableId: '',
    revenueAccountId: '',
    taxGroup: 'Standard VAT',
    creditLimit: '0.00',
    creditPeriod: '0',
    allowCreditSales: false,
    priceList: 'Standard Retail',
    discountGroup: '',
    salesTerritory: '',
    salesRep: ''
  });

  useEffect(() => {
    fetchAccountsAndCategory();
  }, [id]);

  const fetchAccountsAndCategory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [accRes, plRes, dgRes, tgRes] = await Promise.all([
        axios.get('/api/finance/accounts', config),
        axios.get('/api/price-lists', config),
        axios.get('/api/discount-groups', config),
        axios.get('/api/finance/tax-groups', config)
      ]);
      setAccounts(accRes.data);
      setPriceLists(plRes.data.filter(pl => pl.status === 'ACTIVE'));
      setDiscountGroups(dgRes.data.filter(dg => dg.status === 'ACTIVE'));
      setTaxGroups(tgRes.data.filter(tg => tg.status === 'ACTIVE'));

      if (id) {
        const catRes = await axios.get('/api/customer-categories', config);
        const category = catRes.data.find(c => c.id === id);

        if (category) {
          setFormData({
            code: category.code || '',
            name: category.name || '',
            description: category.description || '',
            status: category.status || 'ACTIVE',
            accountsReceivableId: category.accountsReceivableId || '',
            revenueAccountId: category.revenueAccountId || '',
            taxGroup: category.taxGroup || 'Standard VAT',
            creditLimit: category.creditLimit !== undefined ? category.creditLimit.toString() : '0.00',
            creditPeriod: category.creditPeriod !== undefined ? category.creditPeriod.toString() : '0',
            allowCreditSales: category.allowCreditSales || false,
            priceList: category.priceList || 'Standard Retail',
            discountGroup: category.discountGroup || '',
            salesTerritory: category.salesTerritory || '',
            salesRep: category.salesRep || ''
          });
        } else {
          showToast('Category not found', 'error');
          navigate('/sales/categories');
        }
      } else {
        // Generate default customer category code
        const randSuffix = Math.floor(100 + Math.random() * 900);
        setFormData(prev => ({ ...prev, code: `CAT-${randSuffix}` }));
      }
    } catch (error) {
      console.error('Failed to load page data:', error);
      showToast('Error loading details', 'error');
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
      if (name === 'allowCreditSales' && !nextVal) {
        updates.creditLimit = '0.00';
        updates.creditPeriod = '0';
      }
      return { ...prev, ...updates };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('Please fill in Category Code and Category Name.', 'error');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0.0,
        creditPeriod: formData.creditPeriod ? parseInt(formData.creditPeriod) : 0
      };

      if (id) {
        await axios.put(`/api/customer-categories/${id}`, payload, config);
        showToast('Customer Category updated successfully', 'success');
      } else {
        await axios.post('/api/customer-categories', payload, config);
        showToast('Customer Category created successfully', 'success');
      }
      navigate('/sales/categories');
    } catch (error) {
      console.error('Failed to save category:', error);
      showToast(error.response?.data?.error || 'Failed to save customer category', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoad) {
    return (
      <AppLayout title={id ? "Edit Customer Category" : "Create Customer Category"} icon={Layers}>
        <PageSkeleton type="form" />
      </AppLayout>
    );
  }

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
    <AppLayout title={id ? "Edit Customer Category" : "Create Customer Category"} icon={Layers}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/sales/categories')} 
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
              {id ? 'Update Category' : 'Create New Category'}
            </h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Define default finance, sales, and credit configurations for customer classifications.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Status Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginRight: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Active Status</span>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ 
                ...prev, 
                status: prev.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' 
              }))}
              style={{
                width: '46px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: formData.status === 'ACTIVE' ? 'var(--accent)' : '#cbd5e1',
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
                left: formData.status === 'ACTIVE' ? '25px' : '3px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </button>
          </div>

          <div style={{ height: '24px', width: '1px', backgroundColor: '#cbd5e1', marginRight: '0.75rem' }} />

          <button 
            type="button" 
            onClick={() => navigate('/sales/categories')} 
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
            {saving ? 'Saving...' : <><Check size={16} /> Save Category</>}
          </button>
        </div>
      </div>

      {/* Tabbed Form Section */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '1200px', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left sidebar tab menu */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'general', label: 'General Info', icon: FileText },
            ...(isFinanceUser ? [{ id: 'finance', label: 'Finance Rules', icon: DollarSign }] : []),
            { id: 'sales', label: 'Sales Default Settings', icon: Briefcase }
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
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>General Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Category Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="code" 
                      value={formData.code} 
                      onChange={handleInputChange} 
                      placeholder="e.g. CAT-VIP" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Category Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. VIP Customers" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
                <div style={{ ...formRowStyle, alignItems: 'flex-start' }}>
                  <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Description</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="Enter a brief description..." 
                      rows="3"
                      style={{ ...inputStyle, height: 'auto', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FINANCE */}
          {activeTab === 'finance' && isFinanceUser && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Finance Configuration</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
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
                <div style={formRowStyle}>
                  <label style={labelStyle}>Allow Credit Sales</label>
                  <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleChange('allowCreditSales')}
                      style={{
                        width: '46px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: formData.allowCreditSales ? 'var(--accent)' : '#cbd5e1',
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
                        left: formData.allowCreditSales ? '25px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                      }} />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                      {formData.allowCreditSales ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Default Credit Limit</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      step="0.01"
                      name="creditLimit" 
                      value={formData.creditLimit} 
                      disabled={!formData.allowCreditSales}
                      onChange={handleInputChange} 
                      placeholder="0.00" 
                      style={{ ...inputStyle, backgroundColor: formData.allowCreditSales ? '#fff' : '#f1f5f9', cursor: formData.allowCreditSales ? 'text' : 'not-allowed' }}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Default Credit Period (Days)</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="number" 
                      name="creditPeriod" 
                      value={formData.creditPeriod} 
                      disabled={!formData.allowCreditSales}
                      onChange={handleInputChange} 
                      placeholder="0" 
                      style={{ ...inputStyle, backgroundColor: formData.allowCreditSales ? '#fff' : '#f1f5f9', cursor: formData.allowCreditSales ? 'text' : 'not-allowed' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SALES */}
          {activeTab === 'sales' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Sales Configuration</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Default Price List</label>
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
