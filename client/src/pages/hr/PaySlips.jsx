import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { FileText, Printer, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PaySlips() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState(null);
  const [tenantInfo] = useState(JSON.parse(localStorage.getItem('user') || '{}')?.tenant || {});

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    if (runId) {
      fetchRun();
    } else {
      fetchAllRuns();
    }
  }, [runId]);

  const fetchRun = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/hr/salary-runs/${runId}`, authConfig());
      setRun(res.data);
    } catch { showToast('Failed to load salary run', 'error'); }
    finally { setLoading(false); }
  };

  const [allRuns, setAllRuns] = useState([]);
  const fetchAllRuns = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/hr/salary-runs', authConfig());
      setAllRuns(res.data);
    } catch { showToast('Failed to load runs', 'error'); }
    finally { setLoading(false); }
  };

  const handlePrint = (line) => {
    const printContent = document.getElementById(`payslip-${line.id}`);
    if (!printContent) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head>
        <title>Pay Slip — ${line.employee?.firstName} ${line.employee?.lastName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1e293b; padding: 20px; }
          .slip { max-width: 720px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .header { background: #1e293b; color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; }
          .section { padding: 16px 24px; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 7px 10px; text-align: left; font-size: 11px; }
          th { background: #f8fafc; color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px; }
          .earn td { border-bottom: 1px solid #f1f5f9; }
          .net-row { background: #1e293b; color: #fff; }
          .net-row td { font-weight: 700; font-size: 13px; }
          hr { border: none; border-top: 1px solid #e2e8f0; }
          .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .emp-item label { font-size: 10px; color: #64748b; display: block; }
          .emp-item span { font-weight: 600; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    w.document.close();
    w.print();
  };

  if (!runId) {
    return (
      <AppLayout title="Pay Slips" icon={FileText}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>Payroll Runs</h2>
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading...</div>
          : allRuns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <FileText size={44} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <p style={{ color: '#64748b', margin: 0 }}>No payroll runs available. Process payroll first.</p>
              <button onClick={() => navigate('/hr/salary-process')} style={{ marginTop: '1rem', padding: '0.55rem 1.25rem', borderRadius: '8px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Go to Salary Process</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {allRuns.map(r => {
                const totalNet = r.lines.reduce((s, l) => s + parseFloat(l.netPay || 0), 0);
                return (
                  <div key={r.id} onClick={() => navigate(`/hr/payslips/${r.id}`)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={22} color="#3b82f6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>{MONTHS[r.month - 1]} {r.year}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.runNumber} · {r.lines.length} employees</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>${totalNet.toFixed(2)}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Net</div>
                    </div>
                    <ChevronRight size={18} color="#94a3b8" />
                  </div>
                );
              })}
            </div>
          )}
      </AppLayout>
    );
  }

  if (loading || !run) {
    return <AppLayout title="Pay Slips" icon={FileText}><div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout title={`Pay Slips — ${MONTHS[run.month - 1]} ${run.year}`} icon={FileText}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/hr/payslips')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{run.runNumber}</span>
          <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>{run.lines.length} pay slips</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {run.lines.map(line => {
          const isOpen = selectedLine === line.id;
          return (
            <div key={line.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Employee Header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', gap: '1rem', background: isOpen ? '#f8fafc' : '#fff' }} onClick={() => setSelectedLine(isOpen ? null : line.id)}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                  {line.employee?.firstName?.[0]}{line.employee?.lastName?.[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#1e293b' }}>{line.employee?.firstName} {line.employee?.lastName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{line.employee?.empCode}{line.employee?.designation ? ` · ${line.employee.designation}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
                  <div><div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Gross</div><div style={{ fontWeight: 700, color: '#1e293b' }}>${parseFloat(line.grossEarnings).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: '0.7rem', color: '#dc2626', textTransform: 'uppercase' }}>Deductions</div><div style={{ fontWeight: 700, color: '#dc2626' }}>-${parseFloat(line.totalDeductions).toFixed(2)}</div></div>
                  <div><div style={{ fontSize: '0.7rem', color: '#16a34a', textTransform: 'uppercase' }}>Net Pay</div><div style={{ fontWeight: 800, color: '#16a34a', fontSize: '1rem' }}>${parseFloat(line.netPay).toFixed(2)}</div></div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); handlePrint(line); }} style={{ padding: '0.4rem 0.8rem', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Printer size={14} /> Print
                  </button>
                  {isOpen ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
                </div>
              </div>

              {/* Pay Slip Detail — hidden from view but used for printing */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #f1f5f9' }}>
                  <div id={`payslip-${line.id}`}>
                    <div className="slip">
                      <div className="header" style={{ background: '#1e293b', color: '#fff', padding: '20px 24px', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem' }}>{tenantInfo.name || 'Company Name'}</div>
                          <div style={{ opacity: 0.75, fontSize: '0.8rem', marginTop: '4px' }}>Pay Slip — {MONTHS[run.month - 1]} {run.year}</div>
                          <div style={{ opacity: 0.6, fontSize: '0.75rem' }}>{run.runNumber}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>${parseFloat(line.netPay).toFixed(2)}</div>
                          <div style={{ opacity: 0.75, fontSize: '0.8rem' }}>Net Pay</div>
                        </div>
                      </div>

                      {/* Employee Details */}
                      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>Employee Details</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {[
                            { label: 'Employee Name', value: `${line.employee?.firstName} ${line.employee?.lastName}` },
                            { label: 'Employee Code', value: line.employee?.empCode },
                            { label: 'Designation', value: line.employee?.designation || '—' },
                            { label: 'Department', value: line.employee?.department || '—' },
                          ].map(item => (
                            <div key={item.label}>
                              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{item.label}</div>
                              <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Earnings / Deductions Table */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '16px 24px', gap: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#16a34a', marginBottom: '8px' }}>Earnings</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {line.additions?.map((a, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 0', fontSize: '12px', color: '#475569' }}>{a.name}</td>
                                  <td style={{ padding: '6px 0', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: '#1e293b' }}>${parseFloat(a.amount).toFixed(2)}</td>
                                </tr>
                              ))}
                              <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                                <td style={{ padding: '8px 0', fontWeight: 800, fontSize: '12px', color: '#16a34a' }}>Total Earnings</td>
                                <td style={{ padding: '8px 0', fontWeight: 800, textAlign: 'right', color: '#16a34a' }}>${parseFloat(line.grossEarnings).toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#dc2626', marginBottom: '8px' }}>Deductions</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {line.deductions?.length === 0 ? <tr><td style={{ padding: '6px 0', color: '#94a3b8', fontSize: '12px' }}>None</td></tr>
                                : line.deductions?.map((d, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px 0', fontSize: '12px', color: '#475569' }}>{d.name}</td>
                                    <td style={{ padding: '6px 0', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: '#dc2626' }}>-${parseFloat(d.amount).toFixed(2)}</td>
                                  </tr>
                                ))}
                              <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                                <td style={{ padding: '8px 0', fontWeight: 800, fontSize: '12px', color: '#dc2626' }}>Total Deductions</td>
                                <td style={{ padding: '8px 0', fontWeight: 800, textAlign: 'right', color: '#dc2626' }}>-${parseFloat(line.totalDeductions).toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Net Pay */}
                      <div style={{ background: '#1e293b', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Net Pay</span>
                        <span style={{ fontWeight: 900, fontSize: '1.5rem' }}>${parseFloat(line.netPay).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
