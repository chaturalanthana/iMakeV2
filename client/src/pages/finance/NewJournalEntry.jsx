import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { BookOpen, Plus, Trash2, CheckCircle, AlertCircle, ArrowLeft, Save, Briefcase, FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import AccountSearchDropdown from '../../components/ui/AccountSearchDropdown';

export default function NewJournalEntry() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('primary');

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryNumber, setEntryNumber] = useState(`JE-${Date.now().toString().slice(-6)}`);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([
    { id: Date.now() + 1, accountId: '', description: '', debit: '', credit: '' },
    { id: Date.now() + 2, accountId: '', description: '', debit: '', credit: '' }
  ]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/finance/accounts', config);
      setAccounts(res.data);
    } catch (error) {
      console.error(`Failed to fetch accounts:`, error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const handleLineChange = (id, field, value) => {
    setLines(lines.map(line => {
      if (line.id === id) {
        const newLine = { ...line, [field]: value };
        // Mutual inclusivity rule
        if (field === 'debit' && value !== '') newLine.credit = '';
        if (field === 'credit' && value !== '') newLine.debit = '';
        return newLine;
      }
      return line;
    }));
  };

  const addLine = () => {
    setLines([...lines, { id: Date.now(), accountId: '', description: '', debit: '', credit: '' }]);
  };

  const removeLine = (id) => {
    if (lines.length <= 2) return showToast("A journal entry must have at least 2 lines.", "error");
    setLines(lines.filter(line => line.id !== id));
  };

  const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const handleSubmit = async () => {
    if (!description || !entryNumber || !date) return showToast("Please fill header fields.", "error");
    for (let line of lines) {
      if (!line.accountId) return showToast("All lines must have an account selected.", "error");
      if (!line.debit && !line.credit) return showToast("All lines must have a debit or credit amount.", "error");
    }
    if (!isBalanced) return showToast("Journal entry MUST balance before submitting.", "error");

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        entryNumber,
        date,
        description,
        lines: lines.map(l => ({
          accountId: l.accountId,
          description: l.description,
          debit: parseFloat(l.debit || 0),
          credit: parseFloat(l.credit || 0)
        }))
      };
      await axios.post('/api/finance/journal-entries', payload, config);
      
      showToast('Journal entry posted successfully!', 'success');
      setTimeout(() => {
        navigate('/finance/journals');
      }, 1500);

    } catch (error) {
      console.error('Failed to create journal entry:', error);
      showToast(error.response?.data?.error || 'Failed to create journal entry.', 'error');
      setLoading(false);
    }
  };

  return (
    <AppLayout title="New Journal Entry" icon={BookOpen}>
      {isInitialLoad ? (
        <PageSkeleton type="form" />
      ) : (
        <>

          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/finance/journals')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  New Journal Entry
                  <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', fontWeight: 700, border: '1px solid #fde68a' }}>
                    DRAFT
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Record a manual financial transaction</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => navigate('/finance/journals')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Discard
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={!isBalanced || totalDebit === 0 || loading} 
                style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: (!isBalanced || totalDebit === 0 || loading) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)', opacity: (!isBalanced || totalDebit === 0 || loading) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {loading ? 'Posting...' : <><CheckCircle size={16} /> Post Journal</>}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button onClick={() => setActiveTab('primary')} style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'primary' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'primary' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={16} /> Primary Details
            </button>
          </div>

          {activeTab === 'primary' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date *</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entry Number *</label>
                <input 
                  type="text" 
                  value={entryNumber} 
                  onChange={e => setEntryNumber(e.target.value)} 
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                  required 
                  autoComplete="off"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '300px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description *</label>
                <input 
                  type="text" 
                  placeholder="e.g. End of Month Adjustments" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                  required 
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Lines Table Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Transaction Lines</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '40px' }}>#</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '35%' }}>Account</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>Debit</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>Credit</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <AccountSearchDropdown 
                        accounts={accounts}
                        value={line.accountId} 
                        onChange={(accountId) => handleLineChange(line.id, 'accountId', accountId)}
                        placeholder="Select Account"
                        style={{ 
                          wrapper: { border: 'none', padding: '0.25rem 0', background: 'transparent' }, 
                          input: { border: 'none', background: 'transparent', padding: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' },
                          chevronRight: '0px'
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <input 
                        type="text" 
                        value={line.description} 
                        onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                        placeholder="Memo..." 
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 500, outline: 'none', color: 'var(--text-main)' }}
                        autoComplete="off"
                      />
                    </td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <input 
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={line.debit} 
                        onChange={(e) => handleLineChange(line.id, 'debit', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <input 
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={line.credit} 
                        onChange={(e) => handleLineChange(line.id, 'credit', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                      <button type="button" onClick={() => removeLine(line.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='var(--error)'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ cursor: 'pointer' }} onClick={addLine}>
                  <td style={{ padding: '1rem', textAlign: 'center' }}></td>
                  <td colSpan={2} style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Add new line
                  </td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
             <div style={{ display: 'flex', backgroundColor: isBalanced && totalDebit > 0 ? '#f0fdf4' : (totalDebit > 0 || totalCredit > 0) ? '#fef2f2' : '#f8fafc', borderRadius: '12px', border: `1px solid ${isBalanced && totalDebit > 0 ? '#bbf7d0' : (totalDebit > 0 || totalCredit > 0) ? '#fecaca' : '#e2e8f0'}`, overflow: 'hidden', minWidth: '450px' }}>
                <div style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Debits</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>${totalDebit.toFixed(2)}</span>
                </div>
                <div style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Credits</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>${totalCredit.toFixed(2)}</span>
                </div>
                <div style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isBalanced && totalDebit > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700, fontSize: '1rem' }}>
                      <CheckCircle size={20} /> Balanced
                    </div>
                  ) : (totalDebit > 0 || totalCredit > 0) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 700, fontSize: '1rem' }}>
                      <AlertCircle size={20} /> Out of Balance
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem' }}>
                      Awaiting Input
                    </div>
                  )}
                </div>
             </div>
          </div>

        </>
      )}
    </AppLayout>
  );
}

