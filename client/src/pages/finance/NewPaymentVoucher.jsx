import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import StatusBadge from '../../components/ui/StatusBadge';
import { ArrowUpFromLine, ArrowLeft, Plus, Trash2, CheckCircle, Briefcase, FileText, CreditCard } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import AccountSearchDropdown from '../../components/ui/AccountSearchDropdown';
import SupplierSearchDropdown from '../../components/ui/SupplierSearchDropdown';

export default function NewPaymentVoucher() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('primary');

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNumber, setVoucherNumber] = useState(`PV-${Date.now().toString().slice(-6)}`);
  const [supplierId, setSupplierId] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const supplierName = selectedSupplier ? selectedSupplier.name : '';

  // Lines
  const [lines, setLines] = useState([
    { id: Date.now(), accountId: '', description: '', amount: '' }
  ]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [allocations, setAllocations] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!supplierId) {
        setOpenInvoices([]);
        setAllocations({});
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`/api/procurement/supplier-invoices?supplierId=${supplierId}&open=1`, config);
        setOpenInvoices(res.data || []);
        const next = {};
        (res.data || []).forEach((invoice) => {
          next[invoice.id] = Math.max(0, Number(invoice.total) - Number(invoice.amountPaid || 0)).toFixed(2);
        });
        setAllocations(next);
      } catch (error) {
        console.error(error);
      }
    };
    loadInvoices();
  }, [supplierId]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [suppRes, accRes] = await Promise.all([
        axios.get('/api/suppliers', config),
        axios.get('/api/finance/accounts', config)
      ]);
      
      setSuppliers(suppRes.data);
      setAccounts(accRes.data);
    } catch (error) {
      console.error(`Failed to fetch data:`, error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const handleLineChange = (id, field, value) => {
    setLines(lines.map(line => {
      if (line.id === id) {
        return { ...line, [field]: value };
      }
      return line;
    }));
  };

  const addLine = () => {
    setLines([...lines, { id: Date.now(), accountId: '', description: '', amount: '' }]);
  };

  const removeLine = (id) => {
    if (lines.length <= 1) return showToast("A voucher must have at least 1 expense line.", "error");
    setLines(lines.filter(line => line.id !== id));
  };

  const allocatedTotal = Object.values(allocations).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);
  const lineTotal = lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const payingInvoices = allocatedTotal > 0;
  const totalAmount = payingInvoices ? allocatedTotal : lineTotal;

  const handleSubmit = async () => {
    if (!supplierId || !voucherNumber || !date) return showToast("Please fill required header fields.", "error");
    if (!payingInvoices) {
      for (let line of lines) {
        if (!line.accountId) return showToast("All lines must have an account selected.", "error");
        if (!line.amount || parseFloat(line.amount) <= 0) return showToast("All lines must have a valid amount.", "error");
      }
    }
    if (totalAmount <= 0) return showToast("Total voucher amount must be greater than 0.", "error");

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        supplierId,
        voucherNumber,
        amount: totalAmount,
        date,
        method,
        reference,
        bankName,
        chequeNumber,
        ...(payingInvoices ? {
          allocations: openInvoices
            .map((invoice) => ({ supplierInvoiceId: invoice.id, amount: parseFloat(allocations[invoice.id] || 0) }))
            .filter((row) => row.amount > 0)
        } : {
          lines: lines.map(l => ({
            accountId: l.accountId,
            description: l.description,
            amount: parseFloat(l.amount || 0)
          }))
        })
      };
      await axios.post('/api/finance/payment-vouchers', payload, config);
      
      showToast('Voucher saved successfully!', 'success');
      setTimeout(() => {
        navigate('/finance/vouchers');
      }, 1500);

    } catch (error) {
      console.error('Failed to create payment voucher:', error);
      showToast(error.response?.data?.error || 'Failed to create payment voucher.', 'error');
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Payment Vouchers (Out)" icon={ArrowUpFromLine}>
      {isInitialLoad ? (
        <PageSkeleton type="form" />
      ) : (
        <>

          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/finance/vouchers')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  New Payment Voucher
                  <StatusBadge status="DRAFT" />
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Record outgoing payment and associated expenses</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => navigate('/finance/vouchers')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Discard
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={totalAmount === 0 || loading} 
                style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: (totalAmount === 0 || loading) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)', opacity: (totalAmount === 0 || loading) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {loading ? 'Saving...' : <><CheckCircle size={16} /> Save Voucher</>}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button 
              type="button"
              onClick={() => setActiveTab('primary')} 
              style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'primary' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'primary' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Briefcase size={16} /> Primary Details
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('payment')} 
              style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'payment' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'payment' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CreditCard size={16} /> Payment Info
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('memo')} 
              style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'memo' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'memo' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FileText size={16} /> Memo / Reference
            </button>
          </div>

          {activeTab === 'primary' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date *</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  style={{ width: '100%', height: '46px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Voucher Number *</label>
                <input 
                  type="text" 
                  value={voucherNumber} 
                  onChange={e => setVoucherNumber(e.target.value)} 
                  style={{ width: '100%', height: '46px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                  required 
                  autoComplete="off"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supplier *</label>
                <SupplierSearchDropdown 
                  suppliers={suppliers}
                  value={supplierName}
                  onChange={(name, sup) => setSupplierId(sup ? sup.id : '')}
                  placeholder="Search or select supplier..."
                  style={{
                    wrapper: { 
                      width: '100%', 
                      padding: '0.75rem 1rem', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px', 
                      backgroundColor: '#ffffff', 
                      boxSizing: 'border-box', 
                      height: '46px', 
                      display: 'flex', 
                      alignItems: 'center' 
                    },
                    input: { fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Method *</label>
                <select 
                  value={method} 
                  onChange={(e) => setMethod(e.target.value)}
                  style={{ width: '100%', height: '46px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }}
                  required
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </select>
              </div>

              {(method === 'BANK_TRANSFER' || method === 'CHEQUE') && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bank Name</label>
                    <input 
                      type="text" 
                      value={bankName} 
                      onChange={e => setBankName(e.target.value)} 
                      placeholder="e.g. Chase Bank" 
                      style={{ width: '100%', height: '46px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cheque / Transfer Number</label>
                    <input 
                      type="text" 
                      value={chequeNumber} 
                      onChange={e => setChequeNumber(e.target.value)} 
                      placeholder="00012345" 
                      style={{ width: '100%', height: '46px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'memo' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: 'span 3' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reference / Memo</label>
                <input 
                  type="text" 
                  value={reference} 
                  onChange={e => setReference(e.target.value)} 
                  placeholder="Additional ref..." 
                  style={{ width: '100%', height: '46px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', outline: 'none', fontWeight: 500, boxSizing: 'border-box' }} 
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {openInvoices.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Allocate to open invoices</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead>
                  <tr>
                    {['Invoice', 'Outstanding', 'Pay now'].map((heading) => (
                      <th key={heading} style={{ textAlign: heading === 'Invoice' ? 'left' : 'right', padding: '0.6rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td style={{ padding: '0.6rem' }}>{invoice.invoiceNumber}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'right' }}>{(Number(invoice.total) - Number(invoice.amountPaid || 0)).toFixed(2)}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                        <input value={allocations[invoice.id] || ''} onChange={(event) => setAllocations({ ...allocations, [invoice.id]: event.target.value })} style={{ width: 120, textAlign: 'right' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lines Table Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Expense Lines</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '40px' }}>#</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '35%' }}>Expense Account</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '200px' }}>Amount</th>
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
                        placeholder="Expense detail..." 
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 500, outline: 'none', color: 'var(--text-main)' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <input 
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={line.amount} 
                        onChange={(e) => handleLineChange(line.id, 'amount', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', outline: 'none' }}
                        required
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
                    <Plus size={16} /> Add Expense Line
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
                <tr style={{ fontWeight: 800 }}>
                  <td colSpan="3" style={{ padding: '1.25rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Voucher Amount:</td>
                  <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontSize: '1.2rem', color: '#dc2626' }}>${totalAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

        </>
      )}
    </AppLayout>
  );
}

