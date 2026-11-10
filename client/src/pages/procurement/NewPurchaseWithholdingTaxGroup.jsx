import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import AccountSearchDropdown from '../../components/ui/AccountSearchDropdown';
import { ArrowLeft, Check, Landmark, FileText, Percent, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewPurchaseWithholdingTaxGroup() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'slabs'
  const [accounts, setAccounts] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE'
  });

  // Slabs state
  const [slabs, setSlabs] = useState([]);

  useEffect(() => {
    fetchPageData();
  }, [id]);

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const accRes = await axios.get('/api/finance/accounts', config);
      setAccounts(accRes.data);

      if (id) {
        const res = await axios.get(`/api/procurement/withholding-tax-groups/${id}`, config);
        setFormData({
          name: res.data.name || '',
          description: res.data.description || '',
          status: res.data.status || 'ACTIVE'
        });
        
        // Map slabs
        const dbSlabs = (res.data.slabs || []).map(s => ({
          id: s.id,
          name: s.name || '',
          rate: s.rate !== undefined ? parseFloat(s.rate).toString() : '0.00',
          calculationType: s.calculationType || 'ADDITIVE',
          calculationOrder: s.calculationOrder !== undefined ? s.calculationOrder.toString() : '1',
          accountId: s.accountId || ''
        }));
        setSlabs(dbSlabs);
      } else {
        // Default slab row
        setSlabs([
          { id: 'initial-1', name: 'WHT', rate: '5.00', calculationType: 'ADDITIVE', calculationOrder: '1', accountId: '' }
        ]);
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

  const handleAddSlabRow = () => {
    const nextOrder = slabs.length + 1;
    setSlabs(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: '',
        rate: '0.00',
        calculationType: 'ADDITIVE',
        calculationOrder: nextOrder.toString(),
        accountId: ''
      }
    ]);
  };

  const handleSlabCellChange = (slabId, field, val) => {
    setSlabs(prev =>
      prev.map(row => (row.id === slabId ? { ...row, [field]: val } : row))
    );
  };

  const handleRemoveSlabRow = (slabId) => {
    setSlabs(prev => prev.filter(row => row.id !== slabId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Purchase withholding tax group name is required.', 'error');
      return;
    }

    // Validation for slabs
    for (const slab of slabs) {
      if (!slab.name) {
        showToast('Each tax slab must have a component name.', 'error');
        return;
      }
      if (isNaN(parseFloat(slab.rate)) || parseFloat(slab.rate) < 0) {
        showToast(`Tax rate for component "${slab.name}" must be a valid positive number.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        ...formData,
        slabs: slabs.map(s => ({
          name: s.name,
          rate: parseFloat(s.rate) || 0,
          calculationType: s.calculationType,
          calculationOrder: parseInt(s.calculationOrder) || 1,
          accountId: s.accountId || null
        }))
      };

      if (id) {
        await axios.put(`/api/procurement/withholding-tax-groups/${id}`, payload, config);
        showToast('Purchase Withholding Tax Group updated successfully', 'success');
      } else {
        await axios.post('/api/procurement/withholding-tax-groups', payload, config);
        showToast('Purchase Withholding Tax Group created successfully', 'success');
      }
      navigate('/procurement/withholding-tax-groups');
    } catch (error) {
      console.error('Failed to save purchase withholding tax group:', error);
      showToast(error.response?.data?.error || 'Failed to save purchase withholding tax group', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoad) {
    return (
      <AppLayout title={id ? "Edit Purchase Withholding Tax Group" : "Create Purchase Withholding Tax Group"} icon={Landmark}>
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
    <AppLayout title={id ? "Edit Purchase Withholding Tax Group" : "Create Purchase Withholding Tax Group"} icon={Landmark}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/procurement/withholding-tax-groups')} 
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
              {id ? 'Update Purchase Withholding Tax Group' : 'Create Purchase Withholding Tax Group'}
            </h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Define customized purchase withholding tax group components (e.g. WHT 5%) with compounding options.
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
            onClick={() => navigate('/procurement/withholding-tax-groups')} 
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
            {saving ? 'Saving...' : <><Check size={16} /> Save Tax Group</>}
          </button>
        </div>
      </div>

      {/* Main Tabbed Layout */}
      <form onSubmit={handleSubmit} style={{ width: '100%', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left vertical tab menu */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'general', label: 'Tax Group Info', icon: FileText },
            { id: 'slabs', label: 'Tax Slab Components', icon: Percent }
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
                  <label style={labelStyle}>Tax Group Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Purchase standard WHT" 
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
                      placeholder="WHT 5%" 
                      rows="3"
                      style={{ ...inputStyle, height: 'auto', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SLABS */}
          {activeTab === 'slabs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
                <h3 style={{ ...sectionHeaderStyle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Tax Component Slabs</h3>
                
                <button
                  type="button"
                  onClick={handleAddSlabRow}
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
                >
                  <Plus size={14} /> Add Slab Row
                </button>
              </div>

              {/* Slab Grid Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '150px' }}>Component Name</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '120px' }}>Rate (%)</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '150px' }}>Calculation Type</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '110px' }}>Calculation Order</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700 }}>Ledger Account</th>
                      <th style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700, width: '80px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slabs.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                          No slabs defined yet. Click "Add Slab Row" to add tax components.
                        </td>
                      </tr>
                    ) : (
                      slabs.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.35rem 0.5rem' }}>
                            <input 
                              type="text"
                              value={row.name}
                              onChange={(e) => handleSlabCellChange(row.id, 'name', e.target.value)}
                              placeholder="e.g. VAT"
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem' }}>
                            <input 
                              type="number"
                              step="0.01"
                              value={row.rate}
                              onChange={(e) => handleSlabCellChange(row.id, 'rate', e.target.value)}
                              placeholder="0.00"
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem' }}>
                            <select
                              value={row.calculationType}
                              onChange={(e) => handleSlabCellChange(row.id, 'calculationType', e.target.value)}
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
                              <option value="ADDITIVE">Additive (On Base)</option>
                              <option value="COMPOUNDED">Compounded</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem' }}>
                            <input 
                              type="number"
                              value={row.calculationOrder}
                              onChange={(e) => handleSlabCellChange(row.id, 'calculationOrder', e.target.value)}
                              placeholder="1"
                              min="1"
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem' }}>
                            <AccountSearchDropdown 
                              accounts={accounts}
                              value={row.accountId}
                              onChange={(val) => handleSlabCellChange(row.id, 'accountId', val)}
                              placeholder="Select Ledger..."
                              style={{
                                wrapper: {
                                  width: '100%',
                                  height: '32px',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  backgroundColor: '#ffffff'
                                },
                                input: { border: 'none', background: 'transparent', width: '100%', fontSize: '0.85rem', outline: 'none' }
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveSlabRow(row.id)}
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
