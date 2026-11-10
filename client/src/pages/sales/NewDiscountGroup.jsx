import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ArrowLeft, Check, Layers, FileText, Search, Percent } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewDiscountGroup() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'discounts'
  const [searchQuery, setSearchQuery] = useState('');

  // Form Metadata
  const [formData, setFormData] = useState({
    name: '',
    status: 'ACTIVE'
  });

  // Spreadsheet Discount Rows
  const [productDiscounts, setProductDiscounts] = useState([]);

  useEffect(() => {
    fetchDiscountGroupData();
  }, [id]);

  const fetchDiscountGroupData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (id) {
        // Edit mode - fetch specific discount group and its mapped product discounts
        const res = await axios.get(`/api/discount-groups/${id}`, config);
        setFormData({
          name: res.data.name || '',
          status: res.data.status || 'ACTIVE'
        });
        setProductDiscounts(res.data.products || []);
      } else {
        // Create mode - fetch all active products
        const prodRes = await axios.get('/api/products', config);
        const activeProds = prodRes.data.filter(p => p.activeStatus === 'ACTIVE');
        const rows = activeProds.map(p => ({
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          standardPrice: p.sellingPrice ? p.sellingPrice.toString() : '0.00',
          discountType: 'PERCENTAGE',
          discountValue: ''
        }));
        setProductDiscounts(rows);
      }
    } catch (error) {
      console.error('Failed to load discount group details:', error);
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

  const handleDiscountFieldChange = (productId, field, val) => {
    setProductDiscounts(prev =>
      prev.map(row => (row.productId === productId ? { ...row, [field]: val } : row))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Discount group name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        ...formData,
        discounts: productDiscounts.map(d => ({
          productId: d.productId,
          discountType: d.discountType,
          discountValue: d.discountValue !== '' ? d.discountValue : '0.00'
        }))
      };

      if (id) {
        await axios.put(`/api/discount-groups/${id}`, payload, config);
        showToast('Discount Group updated successfully', 'success');
      } else {
        await axios.post('/api/discount-groups', payload, config);
        showToast('Discount Group created successfully', 'success');
      }
      navigate('/sales/discount-groups');
    } catch (error) {
      console.error('Failed to save discount group:', error);
      showToast(error.response?.data?.error || 'Failed to save discount group', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filtered discount rows for spreadsheet
  const filteredRows = useMemo(() => {
    if (!searchQuery) return productDiscounts;
    const query = searchQuery.toLowerCase();
    return productDiscounts.filter(
      p => p.productCode?.toLowerCase().includes(query) || p.productName?.toLowerCase().includes(query)
    );
  }, [productDiscounts, searchQuery]);

  if (isInitialLoad) {
    return (
      <AppLayout title={id ? "Edit Discount Group" : "Create Discount Group"} icon={Layers}>
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
    <AppLayout title={id ? "Edit Discount Group" : "Create Discount Group"} icon={Layers}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/sales/discount-groups')} 
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
              {id ? 'Update Discount Group' : 'Create Discount Group'}
            </h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Define customized product discount percentage or fixed amount rules.
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
            onClick={() => navigate('/sales/discount-groups')} 
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
            {saving ? 'Saving...' : <><Check size={16} /> Save Discount Group</>}
          </button>
        </div>
      </div>

      {/* Main Tabbed Layout */}
      <form onSubmit={handleSubmit} style={{ width: '100%', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left vertical tab menu */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'general', label: 'Discount Group Info', icon: FileText },
            { id: 'discounts', label: 'Product Discount Override', icon: Percent }
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

        {/* Tab Content Panel */}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>General Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Discount Group Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. VIP Discount Group" 
                      style={inputStyle}
                      required 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DISCOUNTS */}
          {activeTab === 'discounts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
                <h3 style={{ ...sectionHeaderStyle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Product discount grid</h3>
                
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input 
                    type="text" 
                    placeholder="Filter products..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0.25rem 0.5rem 0.25rem 2rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Pricing spreadsheet grid */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '150px' }}>Code</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700 }}>Product Name</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '120px', textAlign: 'right' }}>Standard Price</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '180px' }}>Discount Type</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '180px' }}>Discount Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                          No sellable products found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => (
                        <tr key={row.productId} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfe' }}>
                          <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: '#334155' }}>
                            {row.productCode}
                          </td>
                          <td style={{ padding: '0.5rem 1rem', color: '#475569' }}>
                            {row.productName}
                          </td>
                          <td style={{ padding: '0.5rem 1rem', color: '#64748b', textAlign: 'right', fontWeight: 500 }}>
                            ${parseFloat(row.standardPrice).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.35rem 1rem' }}>
                            <select
                              value={row.discountType}
                              onChange={(e) => handleDiscountFieldChange(row.productId, 'discountType', e.target.value)}
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box',
                                backgroundColor: '#ffffff'
                              }}
                            >
                              <option value="PERCENTAGE">Percentage (%)</option>
                              <option value="AMOUNT">Flat Amount ($)</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.35rem 1rem' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <span style={{ position: 'absolute', right: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                {row.discountType === 'PERCENTAGE' ? '%' : '$'}
                              </span>
                              <input 
                                type="number" 
                                step="0.01" 
                                value={row.discountValue !== null && row.discountValue !== undefined ? row.discountValue : ''} 
                                onChange={(e) => handleDiscountFieldChange(row.productId, 'discountValue', e.target.value)} 
                                placeholder="0.00"
                                style={{
                                  width: '100%',
                                  height: '32px',
                                  padding: '0.25rem 1.4rem 0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  outline: 'none',
                                  fontSize: '0.85rem',
                                  boxSizing: 'border-box',
                                  backgroundColor: row.discountValue !== '' && parseFloat(row.discountValue) > 0 ? '#f8fafc' : '#ffffff'
                                }}
                              />
                            </div>
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
