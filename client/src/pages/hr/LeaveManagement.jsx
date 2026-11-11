import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { CalendarDays, Plus, X, CheckCircle, Pencil, Trash2, Clock, Check, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { confirmDialog } from '../../components/ui/appDialog';

const FIELD_STYLE = { width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box' };
const LABEL_STYLE = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' };

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  APPROVED: { label: 'Approved', color: '#16a34a', bg: '#f0fdf4', icon: Check },
  REJECTED: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', icon: XCircle },
};

export default function LeaveManagement() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('applications');
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [appForm, setAppForm] = useState({ employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', days: '', reason: '' });
  const [typeForm, setTypeForm] = useState({ name: '', daysAllowed: '' });

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [typesRes, appsRes, empRes] = await Promise.all([
        axios.get('/api/hr/leave-types', authConfig()),
        axios.get('/api/hr/leave-applications', authConfig()),
        axios.get('/api/hr/employees', authConfig())
      ]);
      setLeaveTypes(typesRes.data);
      setApplications(appsRes.data);
      setEmployees(empRes.data);
    } catch { showToast('Failed to load leave data', 'error'); }
    finally { setLoading(false); }
  };

  const openNewApplication = () => {
    setAppForm({ employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', days: '1', reason: '' });
    setShowModal(true);
  };

  const handleSaveApp = async () => {
    if (!appForm.employeeId || !appForm.leaveTypeId || !appForm.fromDate || !appForm.toDate) {
      return showToast('Please fill all required fields', 'error');
    }
    setSaving(true);
    try {
      await axios.post('/api/hr/leave-applications', appForm, authConfig());
      showToast('Leave application submitted', 'success');
      setShowModal(false);
      fetchAll();
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await axios.put(`/api/hr/leave-applications/${id}/status`, { status }, authConfig());
      showToast(`Leave ${status.toLowerCase()}`, 'success');
      fetchAll();
    } catch (err) { showToast('Failed to update status', 'error'); }
  };

  const handleSaveType = async () => {
    if (!typeForm.name) return showToast('Name is required', 'error');
    setSaving(true);
    try {
      if (editingTypeId) {
        await axios.put(`/api/hr/leave-types/${editingTypeId}`, typeForm, authConfig());
        showToast('Leave type updated', 'success');
      } else {
        await axios.post('/api/hr/leave-types', typeForm, authConfig());
        showToast('Leave type created', 'success');
      }
      setShowTypeModal(false);
      fetchAll();
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteType = async (id, name) => {
    if (!(await confirmDialog({ title: 'Delete leave type', message: `Delete leave type "${name}"?` }))) return;
    try {
      await axios.delete(`/api/hr/leave-types/${id}`, authConfig());
      showToast('Leave type deleted', 'success');
      fetchAll();
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const tabStyle = (tab) => ({
    padding: '0.75rem 0', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--accent)' : '#64748b',
    display: 'flex', alignItems: 'center', gap: '8px'
  });

  return (
    <AppLayout title="Leave Management" icon={CalendarDays}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button type="button" style={tabStyle('applications')} onClick={() => setActiveTab('applications')}>
          <CalendarDays size={16} /> Leave Applications
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)' }}>({applications.length})</span>
        </button>
        <button type="button" style={tabStyle('types')} onClick={() => setActiveTab('types')}>
          <CheckCircle size={16} /> Leave Types
        </button>
      </div>

      {activeTab === 'applications' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={openNewApplication} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              <Plus size={16} /> New Application
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  {['Employee', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</td></tr>
                ) : applications.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No leave applications yet</td></tr>
                ) : applications.map(app => {
                  const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                  const Icon = sc.icon;
                  return (
                    <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                        {app.employee?.firstName} {app.employee?.lastName}
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{app.employee?.empCode}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#475569' }}>{app.leaveType?.name}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#475569' }}>{new Date(app.fromDate).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#475569' }}>{new Date(app.toDate).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{parseFloat(app.days)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.reason || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, color: sc.color }}>
                          <Icon size={13} /> {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {app.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button onClick={() => handleUpdateStatus(app.id, 'APPROVED')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', color: '#16a34a', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> Approve</button>
                            <button onClick={() => handleUpdateStatus(app.id, 'REJECTED')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'types' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={() => { setEditingTypeId(null); setTypeForm({ name: '', daysAllowed: '' }); setShowTypeModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              <Plus size={16} /> Add Leave Type
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {leaveTypes.map(lt => (
              <div key={lt.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{lt.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{lt.daysAllowed} days / year</div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button onClick={() => { setEditingTypeId(lt.id); setTypeForm({ name: lt.name, daysAllowed: lt.daysAllowed.toString() }); setShowTypeModal(true); }} style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}><Pencil size={13} /></button>
                  <button onClick={() => handleDeleteType(lt.id, lt.name)} style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Application Modal */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>New Leave Application</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}><label style={LABEL_STYLE}>Employee *</label>
                <select value={appForm.employeeId} onChange={e => setAppForm(f => ({ ...f, employeeId: e.target.value }))} style={FIELD_STYLE}>
                  <option value="">— Select Employee —</option>
                  {employees.filter(e => e.status === 'ACTIVE').map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empCode})</option>)}
                </select></div>
              <div style={{ gridColumn: 'span 2' }}><label style={LABEL_STYLE}>Leave Type *</label>
                <select value={appForm.leaveTypeId} onChange={e => setAppForm(f => ({ ...f, leaveTypeId: e.target.value }))} style={FIELD_STYLE}>
                  <option value="">— Select Leave Type —</option>
                  {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.daysAllowed} days/yr)</option>)}
                </select></div>
              <div><label style={LABEL_STYLE}>From Date *</label>
                <input type="date" value={appForm.fromDate} onChange={e => setAppForm(f => ({ ...f, fromDate: e.target.value }))} style={FIELD_STYLE} /></div>
              <div><label style={LABEL_STYLE}>To Date *</label>
                <input type="date" value={appForm.toDate} onChange={e => setAppForm(f => ({ ...f, toDate: e.target.value }))} style={FIELD_STYLE} /></div>
              <div><label style={LABEL_STYLE}>Days</label>
                <input type="number" value={appForm.days} onChange={e => setAppForm(f => ({ ...f, days: e.target.value }))} style={FIELD_STYLE} min="0.5" step="0.5" /></div>
              <div><label style={LABEL_STYLE}>Reason</label>
                <input value={appForm.reason} onChange={e => setAppForm(f => ({ ...f, reason: e.target.value }))} style={FIELD_STYLE} placeholder="Optional reason" autoComplete="off" /></div>
            </div>
            <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Cancel</button>
              <button onClick={handleSaveApp} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> {saving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Leave Type Modal */}
      {showTypeModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{editingTypeId ? 'Edit' : 'Add'} Leave Type</h3>
              <button onClick={() => setShowTypeModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={LABEL_STYLE}>Leave Type Name *</label>
                <input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} style={FIELD_STYLE} placeholder="e.g. Annual Leave" autoComplete="off" /></div>
              <div><label style={LABEL_STYLE}>Days Allowed Per Year</label>
                <input type="number" value={typeForm.daysAllowed} onChange={e => setTypeForm(f => ({ ...f, daysAllowed: e.target.value }))} style={FIELD_STYLE} placeholder="e.g. 20" /></div>
            </div>
            <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowTypeModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Cancel</button>
              <button onClick={handleSaveType} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
