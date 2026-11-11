import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ArrowLeft, Check, Sliders, FileText, LayoutGrid } from 'lucide-react';
import MachineLayout from './MachineLayout';
import { useToast } from '../../context/ToastContext';
import { isUuid, workstationPath } from '../../utils/workstationPath';

export default function NewWorkstation() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [recordId, setRecordId] = useState(() => (isUuid(id) ? id : ''));

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    hourlyRate: '0.00',
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchWorkstation();
  }, [id]);

  const fetchWorkstation = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (id) {
        const res = await axios.get(`/api/workstations/${encodeURIComponent(id)}`, config);
        const ws = res.data;
        if (ws) {
          setRecordId(ws.id);
          setFormData({
            code: ws.code || '',
            name: ws.name || '',
            description: ws.description || '',
            hourlyRate: parseFloat(ws.hourlyRate || 0).toFixed(2),
            status: ws.status || 'ACTIVE'
          });
          const readable = workstationPath(ws);
          if (decodeURIComponent(id) !== ws.code) {
            navigate(readable, { replace: true });
          }
        } else {
          showToast('Workstation not found', 'error');
          navigate('/production/workstations');
        }
      } else {
        // Generate default code
        const randSuffix = Math.floor(100 + Math.random() * 900);
        setFormData(prev => ({ ...prev, code: `WS-${randSuffix}` }));
      }
    } catch (error) {
      console.error('Failed to load workstation data:', error);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!String(formData.code || '').trim() || !String(formData.name || '').trim()) {
      errors.code = 'Code and Name are required';
      errors.name = 'Code and Name are required';
    }
    if (parseFloat(formData.hourlyRate || 0) < 0) errors.hourlyRate = 'Hourly rate cannot be negative';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});

    const rateVal = Math.max(0, parseFloat(formData.hourlyRate || 0) || 0);

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        hourlyRate: rateVal,
        status: formData.status
      };

      if (recordId) {
        await axios.put(`/api/workstations/${recordId}`, payload, config);
        showToast('Workstation updated successfully', 'success');
      } else {
        await axios.post('/api/workstations', payload, config);
        showToast('Workstation created successfully', 'success');
      }
      navigate('/production/workstations');
    } catch (error) {
      console.error('Failed to save workstation:', error);
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to save workstation', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoad) {
    return (
      <AppLayout title={id ? "Edit Workstation" : "Create Workstation"} icon={Sliders}>
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
    width: '200px',
    flexShrink: 0,
    margin: 0
  };

  const formRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    width: '100%',
    maxWidth: '650px'
  };

  const inputStyle = {
    width: '100%',
    height: '40px',
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
    <AppLayout title={id ? "Edit Workstation" : "Create Workstation"} icon={Sliders}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/production/workstations')} 
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
              {id ? 'Update Workstation' : 'Create New Workstation'}
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
            onClick={() => navigate('/production/workstations')} 
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
            {saving ? 'Saving...' : <><Check size={16} /> Save Workstation</>}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: activeTab === 'layout' ? '100%' : '1200px', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'info', label: 'Workstation Information', icon: FileText },
            { id: 'layout', label: 'Machine Layout', icon: LayoutGrid }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'layout' && !recordId) {
                    showToast('Save the workstation to plan its machines', 'error');
                    return;
                  }
                  setActiveTab(tab.id);
                }}
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

        <div style={{ flexGrow: 1, minWidth: 0 }}>
          {activeTab === 'info' && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Workstation Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '550px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Workstation Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      placeholder="e.g. CUT-01"
                      className={fieldErrors.code ? 'field-invalid' : undefined}
                      style={inputStyle}
                      required
                    />
                    {fieldErrors.code && <span className="field-error-text">{fieldErrors.code}</span>}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Workstation Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Primary Laser Cutting Station"
                      className={fieldErrors.name ? 'field-invalid' : undefined}
                      style={inputStyle}
                      required
                    />
                    {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
                  </div>
                </div>
                <div style={{ ...formRowStyle, alignItems: 'flex-start' }}>
                  <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Description</label>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter workstation details, location or operator assignments..."
                      rows="3"
                      style={{ ...inputStyle, height: 'auto', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'layout' && recordId && (
            <MachineLayout workstationId={recordId} />
          )}
        </div>
      </form>
    </AppLayout>
  );
}
