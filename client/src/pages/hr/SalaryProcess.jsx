import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { DollarSign, Play, ChevronRight, Check, AlertCircle, Pencil } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SalaryProcess() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState('list'); // 'list' | 'preview' | 'confirm'
  const [salaryRuns, setSalaryRuns] = useState([]);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [runNumber, setRunNumber] = useState(`SAL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => { fetchRuns(); }, []);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/hr/salary-runs', authConfig());
      setSalaryRuns(res.data);
    } catch { showToast('Failed to load salary runs', 'error'); }
    finally { setLoading(false); }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await axios.get('/api/hr/payroll-preview', {
        ...authConfig(),
        params: { month: selectedMonth, year: selectedYear }
      });
      setPreview(res.data);
      setStep('preview');
    } catch { showToast('Failed to load payroll preview', 'error'); }
    finally { setPreviewLoading(false); }
  };

  const updateAmount = (empIndex, section, itemIndex, amount) => {
    setPreview(prev => prev.map((emp, ei) => {
      if (ei !== empIndex) return emp;
      const updated = { ...emp };
      updated[section] = updated[section].map((item, ii) => ii === itemIndex ? { ...item, amount } : item);
      return updated;
    }));
  };

  const handleProcess = async () => {
    if (!window.confirm(`Process payroll for ${MONTHS[selectedMonth - 1]} ${selectedYear}? This action cannot be undone.`)) return;
    setProcessing(true);
    try {
      await axios.post('/api/hr/salary-runs', {
        month: selectedMonth,
        year: selectedYear,
        runNumber,
        employeeData: preview
      }, authConfig());
      showToast(`Payroll for ${MONTHS[selectedMonth - 1]} ${selectedYear} processed successfully!`, 'success');
      setStep('list');
      fetchRuns();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to process payroll', 'error');
    } finally { setProcessing(false); }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const totalGross = preview.reduce((s, e) => s + e.additions.reduce((a, x) => a + parseFloat(x.amount || 0), 0), 0);
  const totalNet = preview.reduce((s, e) => {
    const g = e.additions.reduce((a, x) => a + parseFloat(x.amount || 0), 0);
    const d = e.deductions.reduce((a, x) => a + parseFloat(x.amount || 0), 0);
    return s + (g - d);
  }, 0);

  return (
    <AppLayout title="Salary Process" icon={DollarSign}>
      {step === 'list' && (
        <>
          {/* Run Payroll Card */}
          <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)', borderRadius: '16px', padding: '1.75rem', marginBottom: '1.5rem', color: '#fff' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 800 }}>Run Monthly Payroll</h3>
            <p style={{ margin: '0 0 1.25rem', opacity: 0.85, fontSize: '0.875rem' }}>Select the month and year, then preview and process payroll for all active employees</p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.85, display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Month</label>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ height: '40px', padding: '0 0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', backdropFilter: 'blur(10px)', outline: 'none' }}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1} style={{ color: '#1e293b' }}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.85, display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Year</label>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ height: '40px', padding: '0 0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', backdropFilter: 'blur(10px)', outline: 'none' }}>
                  {years.map(y => <option key={y} value={y} style={{ color: '#1e293b' }}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.85, display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Run Number</label>
                <input value={runNumber} onChange={e => setRunNumber(e.target.value)} style={{ height: '40px', padding: '0 0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', outline: 'none', width: '160px' }} />
              </div>
              <button onClick={handlePreview} disabled={previewLoading} style={{ height: '40px', padding: '0 1.5rem', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.4)', background: '#fff', color: 'var(--accent)', fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={16} /> {previewLoading ? 'Loading...' : 'Preview Payroll'}
              </button>
              <button type="button" onClick={() => navigate('/hr/statutory')} style={{ height: '40px', padding: '0 1rem', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>EPF / ETF</button>
            </div>
          </div>

          {/* Previous Runs */}
          <h3 style={{ margin: '0 0 1rem', fontWeight: 800, color: '#1e293b' }}>Payroll History</h3>
          {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>
            : salaryRuns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <DollarSign size={44} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                <p style={{ color: '#64748b', margin: 0 }}>No payroll runs yet. Run your first payroll above.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {salaryRuns.map(run => {
                  const totalNetRun = run.lines.reduce((s, l) => s + parseFloat(l.netPay || 0), 0);
                  return (
                    <div key={run.id} onClick={() => navigate(`/hr/payslips/${run.id}`)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <DollarSign size={22} color="#3b82f6" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{MONTHS[run.month - 1]} {run.year}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{run.runNumber}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a' }}>{run.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{run.lines.length} employees processed</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>${totalNetRun.toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Net Pay</div>
                      </div>
                      <ChevronRight size={18} color="#94a3b8" />
                    </div>
                  );
                })}
              </div>
            )}
        </>
      )}

      {step === 'preview' && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#1e293b' }}>Payroll Preview — {MONTHS[selectedMonth - 1]} {selectedYear}</h3>
              <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>{preview.length} employees · Review and adjust amounts before processing</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setStep('list')} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>← Back</button>
              <button onClick={handleProcess} disabled={processing || preview.length === 0} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={16} /> {processing ? 'Processing...' : 'Confirm & Process'}
              </button>
            </div>
          </div>

          {/* Summary Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Employees', value: preview.length, format: v => v },
              { label: 'Total Gross', value: totalGross, format: v => `$${v.toFixed(2)}` },
              { label: 'Total Net Pay', value: totalNet, format: v => `$${v.toFixed(2)}`, highlight: true },
            ].map(s => (
              <div key={s.label} style={{ background: s.highlight ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: s.highlight ? 'rgba(255,255,255,0.8)' : '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{s.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.highlight ? '#fff' : '#1e293b' }}>{s.format(s.value)}</div>
              </div>
            ))}
          </div>

          {/* Employee Lines */}
          {preview.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <AlertCircle size={40} style={{ color: '#fbbf24', marginBottom: '1rem' }} />
              <p style={{ color: '#64748b', margin: 0 }}>No active employees found. Please add employees first.</p>
            </div>
          ) : preview.map((emp, ei) => {
            const gross = emp.additions.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
            const totalDed = emp.deductions.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
            const net = gross - totalDed;
            return (
              <div key={emp.employeeId} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '0.75rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                    {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#1e293b' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{emp.empCode}{emp.department ? ` · ${emp.department}` : ''}</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>Employer EPF {Number(emp.epfEmployer || 0).toFixed(2)} · ETF {Number(emp.etfEmployer || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
                    <div><div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Gross</div><div style={{ fontWeight: 800, color: '#1e293b' }}>${gross.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#dc2626', textTransform: 'uppercase' }}>Deductions</div><div style={{ fontWeight: 800, color: '#dc2626' }}>-${totalDed.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: '0.72rem', color: '#16a34a', textTransform: 'uppercase' }}>Net</div><div style={{ fontWeight: 800, color: '#16a34a' }}>${net.toFixed(2)}</div></div>
                  </div>
                </div>
                <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Earnings</div>
                    {emp.additions.map((a, ai) => (
                      <div key={ai} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#475569', flex: 1 }}>{a.name}</span>
                        <input type="number" value={a.amount} onChange={e => updateAmount(ei, 'additions', ai, e.target.value)} style={{ width: '100px', height: '32px', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right', outline: 'none' }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Deductions</div>
                    {emp.deductions.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No deductions</span>
                      : emp.deductions.map((d, di) => (
                        <div key={di} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', color: '#475569', flex: 1 }}>
                            {d.name}
                            {d.type === 'LOAN_EMI' && <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '1px 5px', marginLeft: '4px' }}>EMI</span>}
                          </span>
                          <input type="number" value={d.amount} onChange={e => updateAmount(ei, 'deductions', di, e.target.value)} style={{ width: '100px', height: '32px', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right', outline: 'none' }} />
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </AppLayout>
  );
}
