import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import Modal from '../../components/ui/Modal';
import { 
  Landmark, Calendar, Upload, CheckCircle2, AlertTriangle, 
  Unlink, PlusCircle, Printer, Link2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function BankReconciliation() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Selection and period config
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementClosingBalance, setStatementClosingBalance] = useState('0.00');
  
  // Active reconciliation
  const [activeReconciliation, setActiveReconciliation] = useState(null);
  
  // Workspace datasets
  const [statementLines, setStatementLines] = useState([]);
  const [ledgerLines, setLedgerLines] = useState([]);
  const [matches, setMatches] = useState([]);
  
  // Checking/Selection for manual matching
  const [selectedStmtIds, setSelectedStmtIds] = useState(new Set());
  const [selectedLedgerIds, setSelectedLedgerIds] = useState(new Set());
  
  // Modals status
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawFileContent, setRawFileContent] = useState('');
  const [parsedLines, setParsedLines] = useState([]);
  const [importHeaders, setImportHeaders] = useState({ date: 0, ref: 1, chq: 2, desc: 3, amt: 4 });
  
  // Adjustments form
  const [adjType, setAdjType] = useState('BANK_CHARGES');
  const [adjContraAccount, setAdjContraAccount] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDate, setAdjDate] = useState('');
  const [adjDescription, setAdjDescription] = useState('');
  const [adjStmtLineId, setAdjStmtLineId] = useState('');
  
  // Report tab states
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace', 'report', 'history'
  const [reconciliationHistory, setReconciliationHistory] = useState([]);
  const [reportData, setReportData] = useState(null);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const res = await axios.get('/api/finance/accounts', authConfig());
      const assetAccs = res.data.filter(acc => acc.type === 'ASSET');
      setAccounts(assetAccs);
      if (assetAccs.length > 0) {
        setSelectedAccountId(assetAccs[0].id);
        fetchHistory(assetAccs[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load accounts list', 'error');
    } finally {
      setIsInitialLoad(false);
    }
  };

  const fetchHistory = async (accId) => {
    try {
      const res = await axios.get(`/api/finance/reconciliation/list/${accId}`, authConfig());
      setReconciliationHistory(res.data);
      const draft = res.data.find(r => r.status === 'DRAFT');
      if (draft) {
        setActiveReconciliation(draft);
        setStartDate(draft.startDate.split('T')[0]);
        setEndDate(draft.endDate.split('T')[0]);
        setStatementClosingBalance(parseFloat(draft.statementClosingBalance).toFixed(2));
        loadWorkspace(draft.id);
      } else {
        setActiveReconciliation(null);
        setStatementLines([]);
        setLedgerLines([]);
        setMatches([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAccountChange = (e) => {
    const accId = e.target.value;
    setSelectedAccountId(accId);
    fetchHistory(accId);
  };

  const startReconciliationSession = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/finance/reconciliation/start', {
        accountId: selectedAccountId,
        startDate,
        endDate,
        statementClosingBalance: parseFloat(statementClosingBalance)
      }, authConfig());

      showToast('Reconciliation session started/loaded', 'success');
      setActiveReconciliation(res.data);
      loadWorkspace(res.data.id);
      fetchHistory(selectedAccountId);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to initialize session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspace = async (reconId) => {
    try {
      const res = await axios.get(`/api/finance/reconciliation/workspace/${reconId}`, authConfig());
      setStatementLines(res.data.statementLines);
      setLedgerLines(res.data.ledgerLines);
      setMatches(res.data.matches);
      setSelectedStmtIds(new Set());
      setSelectedLedgerIds(new Set());
    } catch (err) {
      console.error(err);
      showToast('Failed to load reconciliation workspace', 'error');
    }
  };

  const runAutoMatch = async () => {
    if (!activeReconciliation) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/finance/reconciliation/auto-match', {
        reconciliationId: activeReconciliation.id
      }, authConfig());
      showToast(res.data.message, 'success');
      loadWorkspace(activeReconciliation.id);
    } catch (err) {
      console.error(err);
      showToast('Auto matching failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualMatch = async () => {
    if (!activeReconciliation) return;
    setLoading(true);
    try {
      await axios.post('/api/finance/reconciliation/manual-match', {
        reconciliationId: activeReconciliation.id,
        statementLineIds: Array.from(selectedStmtIds),
        journalLineIds: Array.from(selectedLedgerIds)
      }, authConfig());
      showToast('Manual match saved successfully', 'success');
      loadWorkspace(activeReconciliation.id);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Manual match mismatch/failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnmatch = async (matchId) => {
    if (!activeReconciliation) return;
    try {
      await axios.post('/api/finance/reconciliation/unmatch', {
        reconciliationId: activeReconciliation.id,
        matchId
      }, authConfig());
      showToast('Match unlinked', 'success');
      loadWorkspace(activeReconciliation.id);
    } catch (err) {
      console.error(err);
      showToast('Failed to unlink matched items', 'error');
    }
  };

  const handleFinalize = async (force = false) => {
    if (!activeReconciliation) return;
    setLoading(true);
    try {
      await axios.post('/api/finance/reconciliation/finalize', {
        reconciliationId: activeReconciliation.id,
        forceApprove: force
      }, authConfig());
      showToast('Reconciliation finalized & locked!', 'success');
      setActiveReconciliation(null);
      fetchHistory(selectedAccountId);
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      if (err.response?.data?.difference) {
        if (window.confirm(`${err.response.data.error}\nDo you want to FORCE approve as authorized manager?`)) {
          handleFinalize(true);
          return;
        }
      } else {
        showToast(err.response?.data?.error || 'Failed to finalize', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const parseFileContents = (fileName, content) => {
    const isOfx = fileName.toLowerCase().endsWith('.ofx');
    const lines = [];

    if (isOfx) {
      const stmtBlockRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
      let match;
      while ((match = stmtBlockRegex.exec(content)) !== null) {
        const block = match[1];
        
        const typeMatch = /<TRNTYPE>(.*)/.exec(block);
        const dateMatch = /<DTPOSTED>(\d{8})/.exec(block);
        const amtMatch = /<TRNAMT>([\d.-]+)/.exec(block);
        const fitidMatch = /<FITID>(.*)/.exec(block);
        const chqMatch = /<CHECKNUM>(.*)/.exec(block);
        const nameMatch = /<(?:NAME|MEMO)>(.*)/.exec(block);

        let parsedDate = '';
        if (dateMatch) {
          const dStr = dateMatch[1];
          parsedDate = `${dStr.substring(0, 4)}-${dStr.substring(4, 6)}-${dStr.substring(6, 8)}`;
        }

        lines.push({
          date: parsedDate || new Date().toISOString().split('T')[0],
          reference: fitidMatch ? fitidMatch[1].trim() : '',
          chequeNumber: chqMatch ? chqMatch[1].trim() : '',
          description: nameMatch ? nameMatch[1].trim() : (typeMatch ? typeMatch[1].trim() : 'OFX Tx'),
          amount: amtMatch ? parseFloat(amtMatch[1]) : 0
        });
      }
    } else {
      const rows = content.split('\n').map(row => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2 || !row[importHeaders.amt]) continue;

        lines.push({
          date: row[importHeaders.date] || '',
          reference: row[importHeaders.ref] || '',
          chequeNumber: row[importHeaders.chq] || '',
          description: row[importHeaders.desc] || '',
          amount: parseFloat(row[importHeaders.amt] || 0)
        });
      }
    }

    setParsedLines(lines);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setRawFileContent(text);
      parseFileContents(file.name, text);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (uploadedFile && rawFileContent) {
      parseFileContents(uploadedFile.name, rawFileContent);
    }
  }, [importHeaders]);

  const handleUploadConfirm = async () => {
    if (parsedLines.length === 0) {
      showToast('No valid rows parsed from the uploaded file', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/finance/reconciliation/import', {
        accountId: selectedAccountId,
        lines: parsedLines
      }, authConfig());

      showToast(`${res.data.message} (${res.data.importedCount} new lines)`, 'success');
      setShowImportModal(false);
      resetImportStates();
      if (activeReconciliation) {
        loadWorkspace(activeReconciliation.id);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to import statement lines', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetImportStates = () => {
    setUploadedFile(null);
    setRawFileContent('');
    setParsedLines([]);
  };

  const handleCreateAdjustment = async () => {
    try {
      await axios.post('/api/finance/reconciliation/adjustment', {
        reconciliationId: activeReconciliation.id,
        statementLineId: adjStmtLineId,
        adjustmentType: adjType,
        contraAccountId: adjContraAccount,
        amount: parseFloat(adjAmount),
        date: adjDate,
        description: adjDescription
      }, authConfig());

      showToast('Adjustment entry posted & matched', 'success');
      setShowAdjModal(false);
      loadWorkspace(activeReconciliation.id);
    } catch (err) {
      console.error(err);
      showToast('Failed to create adjustment entry', 'error');
    }
  };

  const loadReport = async () => {
    try {
      const res = await axios.get(`/api/finance/reconciliation/reports?accountId=${selectedAccountId}&startDate=${startDate}&endDate=${endDate}`, authConfig());
      setReportData(res.data);
    } catch (err) {
      console.error(err);
      showToast('Failed loading report values', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'report') {
      loadReport();
    }
  }, [activeTab, selectedAccountId, startDate, endDate]);

  const totalMatched = matches.reduce((sum, m) => sum + parseFloat(m.statementLine.amount), 0);
  const unmatchedDebitsSum = ledgerLines.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
  const unmatchedCreditsSum = ledgerLines.filter(l => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0);
  const ledgerClosingBal = activeReconciliation ? parseFloat(activeReconciliation.ledgerClosingBalance) : 0;
  const reconciledBal = ledgerClosingBal + unmatchedCreditsSum - unmatchedDebitsSum;
  const closingStmtBal = activeReconciliation ? parseFloat(activeReconciliation.statementClosingBalance) : 0;
  const difference = closingStmtBal - reconciledBal;

  const toggleStmtSelect = (id) => {
    const next = new Set(selectedStmtIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStmtIds(next);
  };

  const toggleLedgerSelect = (id) => {
    const next = new Set(selectedLedgerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLedgerIds(next);
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num < 0) {
      return `($${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const openAdjustmentModal = (line) => {
    setAdjStmtLineId(line.id);
    setAdjAmount(Math.abs(parseFloat(line.amount)).toString());
    setAdjDate(line.date.split('T')[0]);
    setAdjDescription(line.description || '');
    setAdjType(parseFloat(line.amount) < 0 ? 'BANK_CHARGES' : 'DIRECT_DEPOSITS');
    setShowAdjModal(true);
  };

  return (
    <AppLayout title="Bank Reconciliation" icon={Landmark}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-main)' }}>
          
          {/* Header configuration panel */}
          <div style={{ 
            paddingBottom: '1.25rem', 
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-end', 
            flexWrap: 'wrap', 
            gap: '1rem',
            marginBottom: '0.5rem'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bank Account</label>
                <select 
                  value={selectedAccountId} 
                  onChange={handleAccountChange} 
                  style={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-main)', 
                    height: '36px', 
                    padding: '0 10px', 
                    borderRadius: '8px', 
                    fontSize: '0.85rem', 
                    outline: 'none', 
                    width: '240px' 
                  }}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reconciliation Period</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    disabled={!!activeReconciliation}
                    style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '36px', padding: '0 10px', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    disabled={!!activeReconciliation}
                    style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '36px', padding: '0 10px', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statement Ending Balance</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={statementClosingBalance} 
                  onChange={e => setStatementClosingBalance(e.target.value)} 
                  disabled={activeReconciliation?.status === 'COMPLETED'}
                  style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '36px', padding: '0 10px', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', width: '150px',  textAlign: 'right' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setShowImportModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
              >
                <Upload size={14} /> Import Statement
              </button>
              
              {!activeReconciliation ? (
                <button 
                  onClick={startReconciliationSession}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                >
                  <Calendar size={14} /> Start Reconciliation
                </button>
              ) : (
                <button 
                  onClick={() => handleFinalize()}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', backgroundColor: Math.abs(difference) < 0.02 ? 'var(--success)' : 'var(--warning)', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                >
                  <CheckCircle2 size={14} /> Finalize & Lock
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('workspace')} 
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'workspace' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'workspace' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Reconciliation Workspace
            </button>
            <button 
              onClick={() => setActiveTab('report')} 
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'report' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'report' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Statement Report
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'history' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Reconciliation History
            </button>
          </div>

          {activeTab === 'workspace' && (
            <>
              {/* Summary Dashboard Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ERP Ledger Balance</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800,  }}>{formatCurrency(ledgerClosingBal)}</span>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statement Balance</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800,  }}>{formatCurrency(closingStmtBal)}</span>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800,  color: 'var(--success)' }}>+{formatCurrency(unmatchedCreditsSum)}</span>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding Cheques</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800,  color: 'var(--warning)' }}>-{formatCurrency(unmatchedDebitsSum)}</span>
                </div>
                <div style={{ 
                  background: Math.abs(difference) < 0.02 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)', 
                  border: `1px solid ${Math.abs(difference) < 0.02 ? 'var(--success)' : 'var(--warning)'}`, 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)' 
                }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unresolved Difference</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 850,  color: Math.abs(difference) < 0.02 ? 'var(--success)' : 'var(--warning)' }}>
                      {formatCurrency(difference)}
                    </span>
                    {Math.abs(difference) < 0.02 ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                    )}
                  </div>
                </div>
              </div>

              {!activeReconciliation ? (
                <div style={{ 
                  background: '#fff', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '3rem', 
                  textAlign: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <Landmark size={40} style={{ color: 'var(--text-muted)' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>No Active Reconciliation Period</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: 0 }}>Select a date range and input the bank statement ending balance to open or start reconciliation matching workspace.</p>
                  <button 
                    onClick={startReconciliationSession}
                    style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '6px', fontWeight: 600, color: '#fff', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem' }}
                  >
                    Start reconciliation now
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                  
                  {/* Panel 1: Bank Statement Lines */}
                  <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Statement Transactions</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{statementLines.filter(s => !s.isMatched).length} unmatched items</span>
                      </div>
                      <button 
                        onClick={runAutoMatch}
                        disabled={loading}
                        style={{ padding: '4px 10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--accent)', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Auto-Match
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
                            <th style={{ padding: '6px 12px', width: '28px' }}></th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date</th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ref</th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Desc</th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '6px 12px', width: '28px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {statementLines.filter(s => !s.isMatched).length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>No unmatched items.</td>
                            </tr>
                          ) : (
                            statementLines.filter(s => !s.isMatched).map(line => (
                              <tr 
                                key={line.id} 
                                style={{ 
                                  borderBottom: '1px solid #f1f5f9', 
                                  backgroundColor: selectedStmtIds.has(line.id) ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                                  cursor: 'pointer' 
                                }}
                                onClick={() => toggleStmtSelect(line.id)}
                              >
                                <td style={{ padding: '8px 12px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedStmtIds.has(line.id)} 
                                    onChange={() => {}} 
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem',  }}>{new Date(line.date).toLocaleDateString()}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.reference || '-'}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.description}>{line.description || '-'}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem', textAlign: 'right',  fontWeight: 700, color: parseFloat(line.amount) < 0 ? '#dc2626' : '#16a34a' }}>
                                  {formatCurrency(line.amount)}
                                </td>
                                <td style={{ padding: '8px 12px' }} onClick={(e) => { e.stopPropagation(); openAdjustmentModal(line); }}>
                                  <button title="Post adjustment entry" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '2px' }}>
                                    <PlusCircle size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Panel 2: ERP Ledger Lines */}
                  <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>ERP Ledger Entries</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ledgerLines.length} unmatched entries</span>
                      </div>
                      <button 
                        onClick={handleManualMatch}
                        disabled={selectedStmtIds.size === 0 || selectedLedgerIds.size === 0 || loading}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          padding: '4px 10px', 
                          backgroundColor: selectedStmtIds.size > 0 && selectedLedgerIds.size > 0 ? 'var(--success)' : 'var(--bg-secondary)', 
                          color: selectedStmtIds.size > 0 && selectedLedgerIds.size > 0 ? '#fff' : 'var(--text-muted)', 
                          border: 'none', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          cursor: 'pointer' 
                        }}
                      >
                        <Link2 size={12} /> Match ({selectedStmtIds.size} vs {selectedLedgerIds.size})
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
                            <th style={{ padding: '6px 12px', width: '28px' }}></th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date</th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Doc #</th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Desc</th>
                            <th style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerLines.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>No unmatched ledger items.</td>
                            </tr>
                          ) : (
                            ledgerLines.map(line => (
                              <tr 
                                key={line.id} 
                                style={{ 
                                  borderBottom: '1px solid #f1f5f9', 
                                  backgroundColor: selectedLedgerIds.has(line.id) ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                                  cursor: 'pointer' 
                                }}
                                onClick={() => toggleLedgerSelect(line.id)}
                              >
                                <td style={{ padding: '8px 12px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedLedgerIds.has(line.id)} 
                                    onChange={() => {}} 
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem',  }}>{new Date(line.date).toLocaleDateString()}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600 }}>{line.entryNumber}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.description}>{line.description || '-'}</td>
                                <td style={{ padding: '8px 12px', fontSize: '0.75rem', textAlign: 'right',  fontWeight: 700, color: parseFloat(line.amount) < 0 ? '#dc2626' : '#16a34a' }}>
                                  {formatCurrency(line.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Panel 3: Matched Entries */}
                  <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Reconciled & Matched Pairs</span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{matches.length} matches (Total: {formatCurrency(totalMatched)})</div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {matches.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>No matched entries.</div>
                        ) : (
                          matches.map(m => (
                            <div key={m.id} style={{ 
                              background: '#fafafa', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '6px', 
                              padding: '10px', 
                              fontSize: '0.75rem', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '6px' 
                            }}>
                              <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                                <span style={{ 
                                  fontSize: '0.65rem', 
                                  fontWeight: 700, 
                                  backgroundColor: m.matchType === 'AUTO' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(124, 58, 237, 0.08)', 
                                  color: m.matchType === 'AUTO' ? 'var(--accent)' : '#7c3aed', 
                                  padding: '2px 6px', 
                                  borderRadius: '3px' 
                                }}>
                                  {m.matchType} ({m.confidenceScore}%)
                                </span>
                                <button 
                                  onClick={() => handleUnmatch(m.id)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justify: 'center', padding: '2px', borderRadius: '4px' }}
                                  title="Unlink match"
                                >
                                  <Unlink size={11} />
                                </button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div style={{ borderRight: '1px solid #eee', paddingRight: '4px' }}>
                                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Statement</div>
                                  <div style={{  margin: '2px 0' }}>{new Date(m.statementLine.date).toLocaleDateString()}</div>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{m.statementLine.description}</div>
                                  <div style={{  fontWeight: 700, marginTop: '2px' }}>{formatCurrency(m.statementLine.amount)}</div>
                                </div>
                                <div style={{ paddingLeft: '4px' }}>
                                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Ledger</div>
                                  <div style={{  margin: '2px 0' }}>{new Date(m.journalLine.journalEntry.date).toLocaleDateString()}</div>
                                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.journalLine.journalEntry.entryNumber}</div>
                                  <div style={{  fontWeight: 700, marginTop: '2px' }}>
                                    {formatCurrency(parseFloat(m.journalLine.debit) - parseFloat(m.journalLine.credit))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

          {activeTab === 'report' && (
            <div style={{ 
              background: '#fff', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              padding: '2rem', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              maxWidth: '850px',
              margin: '0 auto',
              width: '100%'
            }}>
              <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Bank Reconciliation Statement</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Period: {startDate} to {endDate}</p>
                </div>
                <button 
                  onClick={() => window.print()} 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <Printer size={12} /> Print Report
                </button>
              </div>

              {!reportData ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>No data loaded. Please start/run a reconciliation session.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Aggregations list */}
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justify: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>Balance as per ERP Ledger:</span>
                      <span style={{ fontWeight: 750,  }}>{formatCurrency(reportData.erpBalance)}</span>
                    </div>
                    
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--success)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Add: Outstanding Deposits / Deposits in Transit</span>
                      {reportData.outstandingDepositsList.map(item => (
                        <div key={item.id} style={{ display: 'flex', justify: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '2px 0' }}>
                          <span>{new Date(item.date).toLocaleDateString()} - {item.entryNumber} - {item.description}</span>
                          <span style={{  color: 'var(--success)' }}>+{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justify: 'space-between', fontWeight: 700, borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '4px', fontSize: '0.75rem' }}>
                        <span>Total Outstanding Deposits</span>
                        <span style={{  color: 'var(--success)' }}>+{formatCurrency(reportData.outstandingDeposits)}</span>
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(245, 158, 11, 0.02)' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--warning)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Less: Unpresented Cheques / Outstanding Payments</span>
                      {reportData.unpresentedChequesList.map(item => (
                        <div key={item.id} style={{ display: 'flex', justify: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '2px 0' }}>
                          <span>{new Date(item.date).toLocaleDateString()} - {item.entryNumber} - {item.description}</span>
                          <span style={{  color: 'var(--warning)' }}>-{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justify: 'space-between', fontWeight: 700, borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '4px', fontSize: '0.75rem' }}>
                        <span>Total Unpresented Cheques</span>
                        <span style={{  color: 'var(--warning)' }}>-{formatCurrency(reportData.unpresentedCheques)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justify: 'space-between', padding: '12px', backgroundColor: 'var(--bg-secondary)', fontWeight: 800, fontSize: '0.9rem' }}>
                      <span>Calculated Bank Statement Ending Balance:</span>
                      <span style={{  }}>
                        {formatCurrency(parseFloat(reportData.erpBalance) + parseFloat(reportData.outstandingDeposits) - parseFloat(reportData.unpresentedCheques))}
                      </span>
                    </div>
                  </div>

                  {/* Unmatched statement entries */}
                  <div>
                    <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', uppercase: 'true', tracking: 'true', marginBottom: '6px' }}>Unmatched Bank Statement lines (Requires adjustment/ledger post)</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid var(--border-color)' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Date</th>
                          <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Reference</th>
                          <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Description</th>
                          <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.unmatchedStatementsList.length === 0 ? (
                          <tr><td colSpan="4" style={{ padding: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', fontSize: '0.75rem' }}>No unmatched statement lines found.</td></tr>
                        ) : (
                          reportData.unmatchedStatementsList.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', fontSize: '0.75rem',  }}>{new Date(item.date).toLocaleDateString()}</td>
                              <td style={{ padding: '8px 12px', fontSize: '0.75rem' }}>{item.reference || '-'}</td>
                              <td style={{ padding: '8px 12px', fontSize: '0.75rem' }}>{item.description}</td>
                              <td style={{ padding: '8px 12px', fontSize: '0.75rem', textAlign: 'right',  fontWeight: 700, color: parseFloat(item.amount) < 0 ? '#dc2626' : '#16a34a' }}>
                                {formatCurrency(item.amount)}
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
          )}

          {activeTab === 'history' && (
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem' }}>Reconciliation Audit Trail</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Start Date</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>End Date</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Statement Balance</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Ledger Balance</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Reconciled At</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Auditor</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationHistory.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>No past reconciliations recorded.</td>
                    </tr>
                  ) : (
                    reconciliationHistory.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem',  }}>{new Date(row.startDate).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem',  }}>{new Date(row.endDate).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', textAlign: 'right',  fontWeight: 700 }}>{formatCurrency(row.statementClosingBalance)}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', textAlign: 'right',  }}>{formatCurrency(row.ledgerClosingBalance)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            backgroundColor: row.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', 
                            color: row.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)', 
                            padding: '2px 6px', 
                            borderRadius: '3px' 
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.reconciledAt ? new Date(row.reconciledAt).toLocaleString() : '-'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.reconciledBy || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Statement File Upload & Mapping */}
          <Modal 
            isOpen={showImportModal} 
            onClose={() => { setShowImportModal(false); resetImportStates(); }} 
            title="Import Bank Statement" 
            subtitle="Select or drag a statement file to import transactions"
            icon={Upload}
            maxWidth="650px"
          >
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* File Upload drag/drop zone */}
              <div 
                style={{ 
                  border: '2px dashed var(--border-color)', 
                  borderRadius: '12px', 
                  padding: '2.5rem', 
                  textAlign: 'center', 
                  backgroundColor: '#f8fafc', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.5rem', 
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }} 
                onClick={() => document.getElementById('statementFile').click()}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              >
                <Upload size={32} style={{ color: 'var(--accent)', marginBottom: '0.25rem' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {uploadedFile ? uploadedFile.name : 'Select or drag bank statement file (.csv, .ofx)'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : 'Supports standard CSV and OFX structures'}
                </span>
                <input 
                  type="file" 
                  id="statementFile" 
                  accept=".csv,.ofx" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                />
              </div>

              {/* Column Mapping (Only for CSV files) */}
              {uploadedFile && !uploadedFile.name.toLowerCase().endsWith('.ofx') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>CSV Column Indexes Mapping:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date Col</label>
                      <input type="number" style={{ width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '32px', padding: '0 8px', fontSize: '0.8rem', borderRadius: '6px', textAlign: 'center', outline: 'none' }} value={importHeaders.date} onChange={e => setImportHeaders({...importHeaders, date: parseInt(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ref Col</label>
                      <input type="number" style={{ width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '32px', padding: '0 8px', fontSize: '0.8rem', borderRadius: '6px', textAlign: 'center', outline: 'none' }} value={importHeaders.ref} onChange={e => setImportHeaders({...importHeaders, ref: parseInt(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cheque Col</label>
                      <input type="number" style={{ width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '32px', padding: '0 8px', fontSize: '0.8rem', borderRadius: '6px', textAlign: 'center', outline: 'none' }} value={importHeaders.chq} onChange={e => setImportHeaders({...importHeaders, chq: parseInt(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Desc Col</label>
                      <input type="number" style={{ width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '32px', padding: '0 8px', fontSize: '0.8rem', borderRadius: '6px', textAlign: 'center', outline: 'none' }} value={importHeaders.desc} onChange={e => setImportHeaders({...importHeaders, desc: parseInt(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Amount Col</label>
                      <input type="number" style={{ width: '100%', backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '32px', padding: '0 8px', fontSize: '0.8rem', borderRadius: '6px', textAlign: 'center', outline: 'none' }} value={importHeaders.amt} onChange={e => setImportHeaders({...importHeaders, amt: parseInt(e.target.value)})} />
                    </div>
                  </div>
                </div>
              )}

              {/* Parsed Preview Section */}
              {parsedLines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Parsed Rows Preview ({parsedLines.length} lines detected):</span>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Date</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Ref</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Cheque</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Description</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedLines.slice(0, 15).map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px',  }}>{row.date}</td>
                            <td style={{ padding: '8px 12px' }}>{row.reference || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{row.chequeNumber || '-'}</td>
                            <td style={{ padding: '8px 12px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right',  fontWeight: 700, color: row.amount < 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedLines.length > 15 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>Showing first 15 rows...</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => { setShowImportModal(false); resetImportStates(); }}
                  style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUploadConfirm}
                  disabled={parsedLines.length === 0 || loading}
                  style={{ 
                    padding: '8px 20px', 
                    backgroundColor: parsedLines.length > 0 ? 'var(--accent)' : 'var(--bg-secondary)', 
                    color: parsedLines.length > 0 ? '#fff' : 'var(--text-muted)', 
                    border: 'none', 
                    borderRadius: '6px', 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    cursor: parsedLines.length > 0 ? 'pointer' : 'default',
                    transition: 'all 0.2s' 
                  }}
                  onMouseEnter={e => { if (parsedLines.length > 0) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                  onMouseLeave={e => { if (parsedLines.length > 0) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                >
                  Confirm & Import
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal: Adjustment Journal Entry creator */}
          <Modal
            isOpen={showAdjModal}
            onClose={() => setShowAdjModal(false)}
            title="Create Adjustment Journal"
            subtitle="Post and match direct adjustment transaction"
            icon={PlusCircle}
            maxWidth="420px"
          >
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Adjustment Type</label>
                <select 
                  value={adjType} 
                  onChange={e => setAdjType(e.target.value)}
                  style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '32px', padding: '0 8px', borderRadius: '6px', outline: 'none' }}
                >
                  <option value="BANK_CHARGES">Bank Charges (Expense)</option>
                  <option value="INTEREST_INCOME">Interest Income (Revenue)</option>
                  <option value="DIRECT_DEPOSITS">Direct Deposits</option>
                  <option value="DIRECT_DEBITS">Direct Debits</option>
                  <option value="MISC_ADJUSTMENTS">Misc Adjustment</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Contra Account (Ledger Account)</label>
                <select 
                  value={adjContraAccount} 
                  onChange={e => setAdjContraAccount(e.target.value)}
                  style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '32px', padding: '0 8px', borderRadius: '6px', outline: 'none' }}
                >
                  <option value="">-- Select Contra Account --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={adjAmount} 
                    onChange={e => setAdjAmount(e.target.value)}
                    style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '32px', padding: '0 8px', borderRadius: '6px', outline: 'none',  textAlign: 'right' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Date</label>
                  <input 
                    type="date" 
                    value={adjDate} 
                    onChange={e => setAdjDate(e.target.value)}
                    style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '32px', padding: '0 8px', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Description</label>
                <input 
                  type="text" 
                  value={adjDescription} 
                  onChange={e => setAdjDescription(e.target.value)}
                  style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '32px', padding: '0 8px', borderRadius: '6px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setShowAdjModal(false)}
                  style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateAdjustment}
                  style={{ padding: '8px 20px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#10b981'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#059669'}
                >
                  Post & Match
                </button>
              </div>
            </div>
          </Modal>

        </div>
      )}
    </AppLayout>
  );
}

