import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { findByRouteKey, isUuid, queryRef, routeKeyOf, showRecord } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import SupplierSearchDropdown from '../../components/ui/SupplierSearchDropdown';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import SupplierModal from '../../components/ui/SupplierModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ClipboardList, ArrowLeft, Plus, Trash2, Calendar, Truck, Package, Briefcase, Banknote, ArrowUpRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewPurchaseRequisition() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const routeKey = routeKeyOf(useParams());

  const [activeTab, setActiveTab] = useState('primary');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prId, setPrId] = useState(() => (isUuid(routeKey) ? routeKey : null));
  const [isInitialLoad, setIsInitialLoad] = useState(!!routeKey);
  const [prNumber, setPrNumber] = useState('Drafting...');
  const [lastSaved, setLastSaved] = useState(null);
  const [status, setStatus] = useState('PENDING'); // PENDING, APPROVED, CONVERTED
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  
  // Currency States
  const [currencies, setCurrencies] = useState([]);
  const [currencyId, setCurrencyId] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1.0');

  const formatWithCommas = (val) => {
    if (val === null || val === undefined || val === '') return '';
    let s = val.toString().replace(/,/g, '');
    if (isNaN(s)) return s;
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const unformatNumber = (val) => {
    if (!val) return '0';
    return val.toString().replace(/,/g, '');
  };

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [supplierName, setSupplierName] = useState('');

  // Lines
  const [items, setItems] = useState([
    { id: Date.now(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  // Debounced Auto-Save Logic
  useEffect(() => {
    if (!prId) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [items, supplierId, date, currencyId, exchangeRate]);

  const autoSave = async () => {
    if (!prId || status === 'CONVERTED') return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const validLines = items.filter(l => l.productId);
      
      const payload = {
        supplierId: supplierId || null,
        date,
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      await axios.put(`/api/procurement/purchase-requisitions/${prId}`, payload, config);
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaving(false);
    }
  };

  const createInitialDraft = async (selectedSupplierId) => {
    if (prId) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const validLines = items.filter(l => l.productId);
      const payload = {
        supplierId: selectedSupplierId || null,
        date,
        status: 'PENDING',
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      const res = await axios.post('/api/procurement/purchase-requisitions', payload, config);
      setPrId(res.data.id);
      setPrNumber(res.data.prNumber);
      showRecord(navigate, '/procurement/purchase-requisitions', res.data, 'prNumber');
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Failed to create initial draft:', error);
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [routeKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [supRes, prodRes, curRes] = await Promise.all([
        axios.get('/api/suppliers', config),
        axios.get('/api/products', config),
        axios.get('/api/finance/currencies', config)
      ]);
      
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
      setCurrencies(curRes.data);

      if (routeKey) {
        // Load an existing PR
        let currentId = isUuid(routeKey) ? routeKey : null;
        if (!currentId) {
          const list = await axios.get('/api/procurement/purchase-requisitions', config);
          currentId = findByRouteKey(list.data, routeKey, 'prNumber')?.id || null;
        }
        if (!currentId) return;
        setPrId(currentId);
        const res = await axios.get(`/api/procurement/purchase-requisitions/${currentId}`, config);
        const currentPr = res.data;
        if (currentPr) {
          showRecord(navigate, '/procurement/purchase-requisitions', currentPr, 'prNumber');
          setPrNumber(currentPr.prNumber);
          setSupplierId(currentPr.supplierId || '');
          setSupplierName(currentPr.supplier?.name || '');
          setDate(new Date(currentPr.date).toISOString().split('T')[0]);
          setStatus(currentPr.status || 'PENDING');
          setCurrencyId(currentPr.currencyId || '');
          setExchangeRate((currentPr.exchangeRate || 1.0).toString());
          
          if (currentPr.items && currentPr.items.length > 0) {
            setItems(currentPr.items.map(item => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total)
            })));
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch data:`, error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleItemChange = (itemId, field, value) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === itemId) {
        let updatedItem = { ...item };
        
        if (typeof field === 'object' && field !== null) {
          Object.keys(field).forEach(k => {
            const val = field[k];
            updatedItem[k] = (k === 'unitPrice' || k === 'quantity') ? unformatNumber(val) : val;
          });
        } else {
          const cleanValue = (field === 'unitPrice' || field === 'quantity') ? unformatNumber(value) : value;
          updatedItem[field] = cleanValue;
        }

        const qty = parseFloat(updatedItem.quantity || 0);
        const price = parseFloat(updatedItem.unitPrice || 0);
        updatedItem.total = (qty * price).toFixed(2);
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems([...items, { id: Date.now() + Math.random(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (itemId) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const grandTotal = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

  const isCompleted = status === 'CONVERTED';

  const handleSubmit = async (finalStatus = 'PENDING') => {
    const errors = {};
    if (!date) errors.date = 'Date is required.';
    const validLines = items.filter(l => l.productId);
    if (validLines.length === 0) errors.items = 'Add at least one product.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      return showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
    }
    setFieldErrors({});
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        supplierId: supplierId || null,
        prNumber,
        date,
        status: finalStatus,
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      if (prId) {
        await axios.put(`/api/procurement/purchase-requisitions/${prId}`, payload, config);
      } else {
        const res = await axios.post('/api/procurement/purchase-requisitions', payload, config);
        setPrId(res.data.id);
      }
      setStatus(finalStatus);
      setLoading(false);
      showToast('Purchase requisition saved successfully!', 'success');
      navigate('/procurement/purchase-requisitions');
    } catch (error) {
      console.error('Failed to save requisition:', error);
      showToast(error.response?.data?.error || 'Failed to save requisition.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteRequisition = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this purchase requisition? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/procurement/purchase-requisitions/${prId}`, config);
      showToast('Purchase requisition deleted successfully', 'success');
      navigate('/procurement/purchase-requisitions');
    } catch (error) {
      console.error('Failed to delete requisition:', error);
      showToast(error.response?.data?.error || 'Failed to delete requisition.', 'error');
    }
  };

  return (
    <AppLayout title="Purchase Requisition" icon={ClipboardList}>
      {isInitialLoad && routeKey ? (
        <PageSkeleton type="form" />
      ) : (
        <>
          <SupplierModal 
            isOpen={isSupplierModalOpen} 
            onClose={() => setIsSupplierModalOpen(false)} 
            onSaved={(newSupplier) => {
              setSuppliers(prev => [...prev, newSupplier]);
              setSupplierName(newSupplier.name);
              setSupplierId(newSupplier.id);
              setIsSupplierModalOpen(false);
              createInitialDraft(newSupplier.id);
            }} 
          />

          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/procurement/purchase-requisitions')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                  {isCompleted ? 'View Purchase Requisition' : 'Create Purchase Requisition'}
                  {prNumber && prNumber !== 'Drafting...' && <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{prNumber}</span>}
                </h2>
                {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>Saving Changes...</span>}
                {lastSaved && !saving && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last saved at {lastSaved}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {prId && !isCompleted && (
                <button
                  type="button"
                  onClick={handleDeleteRequisition}
                  style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor='#fecaca' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor='#fee2e2' }}
                  title="Permanent Delete"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
              {isCompleted ? (
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5' }}>
                  Already Converted to PO
                </span>
              ) : (
                <>
                  {prId && (
                    <button 
                      onClick={() => navigate(`/procurement/purchase-orders/new?prId=${queryRef(prNumber)}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)' }}
                    >
                      <ArrowUpRight size={16} /> Convert to PO
                    </button>
                  )}
                  <button type="button" onClick={() => navigate('/procurement/purchase-requisitions')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Discard</button>
                  <button onClick={() => handleSubmit('PENDING')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: '1px solid var(--accent)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: '#f8fafc', color: 'var(--accent)', opacity: (loading) ? 0.7 : 1 }}>
                    Save Requisition
                  </button>
                </>
              )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Truck size={14} /> Supplier Name (Optional)</label>
                  {!isCompleted && (
                    <button type="button" onClick={() => setIsSupplierModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      <Plus size={14} /> New
                    </button>
                  )}
                </div>
                <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                  <SupplierSearchDropdown 
                    suppliers={suppliers}
                    value={supplierName}
                    onChange={(name, sup) => {
                      setSupplierName(name);
                      if (sup) {
                        setSupplierId(sup.id);
                        createInitialDraft(sup.id);
                      } else {
                        setSupplierId('');
                      }
                    }}
                    placeholder="Search or select supplier..."
                    style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Date</label>
                </div>
                <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                  <DatePicker 
                    invalid={!!fieldErrors.date}
                    error={fieldErrors.date || ''}
                    value={date} 
                    onChange={setDate} 
                    placeholder="Select Date" 
                    style={{ height: '42px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Banknote size={14} /> Currency</label>
                </div>
                <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                  <select 
                    value={currencyId} 
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setCurrencyId(selectedId);
                      const matched = currencies.find(c => c.id === selectedId);
                      if (matched) setExchangeRate(matched.exchangeRate.toString());
                    }} 
                    style={{ width: '100%', height: '42px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff', fontSize: '0.9rem' }}
                  >
                    <option value="">Select Currency...</option>
                    {currencies.map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '140px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>Exchange Rate</label>
                </div>
                <div>
                  <input 
                    type="number" 
                    step="0.0001"
                    disabled={isCompleted}
                    value={exchangeRate} 
                    onChange={(e) => setExchangeRate(e.target.value)} 
                    style={{ width: '100%', height: '42px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', backgroundColor: isCompleted ? '#f1f5f9' : '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Product Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Add Products</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr style={{ height: '2.25rem' }}>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product Details</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>Est. Cost (Rs)</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Quantity</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>Total (Rs)</th>
                  {!isCompleted && <th style={{ borderBottom: '1px solid var(--border-color)', width: '50px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={{ height: '2.25rem', transition: 'all 0.2s', borderBottom: '1px solid var(--border-color)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', height: '2.25rem' }}>
                        <ProductSearchDropdown 
                          products={products}
                          value={item.productName}
                          onChange={(product) => handleItemChange(item.id, {
                            productId: product.id,
                            productName: product.name,
                            unitPrice: product.costPrice || 0
                          })}
                          placeholder="Search product..."
                          className="spreadsheet-input"
                          style={{
                            wrapper: { height: '100%', width: '100%' },
                            input: { height: '100%', padding: '0 1rem', fontSize: '0.85rem', fontWeight: 500, borderRadius: '0px' }
                          }}
                        />
                      </div>
                    </td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <input 
                        type="text" 
                        className="spreadsheet-input"
                        disabled={isCompleted}
                        value={formatWithCommas(item.unitPrice)}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}
                      />
                    </td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <input 
                        type="text" 
                        className="spreadsheet-input"
                        disabled={isCompleted}
                        value={formatWithCommas(item.quantity)}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}
                      />
                    </td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {parseFloat(item.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {!isCompleted && (
                      <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}>
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }} onMouseEnter={e => e.currentTarget.style.color='var(--error)'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!isCompleted && (
                  <tr style={{ height: '2.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={addItem} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}><Plus size={14} color="#cbd5e1" style={{ margin: '0 auto' }} /></td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Click here to add another line...</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)' }}>0.00</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>0</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>0.00</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)' }}></td>
                  </tr>
                )}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
                <tr style={{ fontWeight: 800, height: '2.25rem' }}>
                  <td colSpan="2" style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Document Totals:</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{items.filter(i => i.productId).length} Line(s)</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-main)' }}>{totalQty.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '1rem', color: 'var(--accent)' }}>
                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {!isCompleted && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
