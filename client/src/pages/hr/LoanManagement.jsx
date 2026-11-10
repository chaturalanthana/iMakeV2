import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { Banknote, Plus, X, CheckCircle, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const FIELD_STYLE = { width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box' };
const LABEL_STYLE = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' };

export default function LoanManagement() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [form, setForm] = useState({ employeeId: '', loanNumber: '', amount: '', tenureMonths: '', startDate: '', notes: '' });

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [loansRes, empRes] = await Promise.all([
        axios.get('/api/hr/loans', authConfig()),
        axios.get('/api/hr/employees', authConfig())
      ]);
      setLoans(loansRes.data);
      setEmployees(empRes.data);
    } catch { showToast('Failed to load loan data', 'error'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ employeeId: '', loanNumber: `LOAN-${Date.now().toString().slice(-5)}`, amount: '', tenureMonths: '', startDate: new Date().toISOString().split('T')[0], notes: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employeeId || !form.amount || !form.tenureMonths || !form.startDate) {
      return showToast('Please fill required fields', 'error');
    }
    setSaving(true);
    try {
      await axios.post('/api/hr/loans', form, authConfig());
      showToast('Loan registered successfully', 'success');
      setShowModal(false);
      fetchAll();
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleClose = async (id) => {
    if (!window.confirm('Mark this loan as CLOSED?')) return;
    try {
      await axios.put(`/api/hr/loans/${id}/status`, { status: 'CLOSED' }, authConfig());
      showToast('Loan closed', 'success');
      fetchAll();
    } catch (err) { showToast('Failed', 'error'); }
  };

  const filtered = loans.filter(l => activeTab === 'active' ? l.status === 'ACTIVE' : l.status === 'CLOSED');

  const tabStyle = (tab) => ({
    padding: '0.75rem 0', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--accent)' : '#64748b',
    display: 'flex', alignItems: 'center', gap: '8px'
  });

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <AppLayout title="Loan Management" icon={Banknote}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0' }}>
          <button type="button" style={tabStyle('active')} onClick={() => setActiveTab('active')}>
            Active Loans <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '10px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{loans.filter(l => l.status === 'ACTIVE').length}</span>
          </button>
          <button type="button" style={tabStyle('closed')} onClick={() => setActiveTab('closed')}>
            Closed Loans
          </button>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
          <Plus size={16} /> New Loan
        </button>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>
          : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <Banknote size={44} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <p style={{ color: '#64748b', margin: 0 }}>No {activeTab} loans found</p>
            </div>
          ) : filtered.map(loan => {
            const paidInstallments = loan.installments?.filter(i => i.status === 'PAID').length || 0;
            const progress = loan.tenureMonths > 0 ? (paidInstallments / loan.tenureMonths) * 100 : 0;
            const isExpanded = expandedLoan === loan.id;
            return (
              <div key={loan.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
                {/* Loan Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', gap: '1rem' }} onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: loan.status === 'ACTIVE' ? '#eff6ff' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Banknote size={20} color={loan.status === 'ACTIVE' ? '#3b82f6' : '#94a3b8'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{loan.employee?.firstName} {loan.employee?.lastName}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{loan.loanNumber}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', background: loan.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9', color: loan.status === 'ACTIVE' ? '#16a34a' : '#64748b' }}>{loan.status}</span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
                      <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #4f46e5)', borderRadius: '6px', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{paidInstallments}/{loan.tenureMonths} EMIs</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>${parseFloat(loan.outstanding).toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>outstanding of ${parseFloat(loan.amount).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {loan.status === 'ACTIVE' && (
                      <button onClick={e => { e.stopPropagation(); handleClose(loan.id); }} style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>Close</button>
                    )}
                    {isExpanded ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
                  </div>
                </div>

                {/* Installment Schedule */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Installment Schedule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                      {loan.installments?.map(inst => (
                        <div key={inst.id} style={{ padding: '0.625rem', borderRadius: '8px', border: `1px solid ${inst.status === 'PAID' ? '#bbf7d0' : '#e2e8f0'}`, background: inst.status === 'PAID' ? '#f0fdf4' : '#fff', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Calendar size={11} color={inst.status === 'PAID' ? '#16a34a' : '#94a3b8'} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: inst.status === 'PAID' ? '#16a34a' : '#64748b' }}>{MONTHS[inst.month - 1]} {inst.year}</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>${parseFloat(inst.amount).toFixed(2)}</div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: inst.status === 'PAID' ? '#16a34a' : '#f59e0b' }}>{inst.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Register New Loan</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}><label style={LABEL_STYLE}>Employee *</label>
                <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} style={FIELD_STYLE}>
                  <option value="">— Select Employee —</option>
                  {employees.filter(e => e.status === 'ACTIVE').map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empCode})</option>)}
                </select></div>
              <div><label style={LABEL_STYLE}>Loan Number</label>
                <input value={form.loanNumber} onChange={e => setForm(f => ({ ...f, loanNumber: e.target.value }))} style={FIELD_STYLE} autoComplete="off" /></div>
              <div><label style={LABEL_STYLE}>Loan Amount *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={FIELD_STYLE} placeholder="0.00" /></div>
              <div><label style={LABEL_STYLE}>Tenure (Months) *</label>
                <input type="number" value={form.tenureMonths} onChange={e => setForm(f => ({ ...f, tenureMonths: e.target.value }))} style={FIELD_STYLE} placeholder="e.g. 12" min="1" /></div>
              <div><label style={LABEL_STYLE}>Start Date *</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={FIELD_STYLE} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={LABEL_STYLE}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={FIELD_STYLE} placeholder="Optional notes" autoComplete="off" /></div>
              {form.amount && form.tenureMonths && (
                <div style={{ gridColumn: 'span 2', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1d4ed8' }}>Monthly EMI: ${(parseFloat(form.amount || 0) / parseInt(form.tenureMonths || 1)).toFixed(2)}</span>
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> {saving ? 'Registering...' : 'Register Loan'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
