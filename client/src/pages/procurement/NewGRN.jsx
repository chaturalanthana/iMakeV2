import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import SupplierSearchDropdown from '../../components/ui/SupplierSearchDropdown';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import ScanCapture, { lookupScan, mergeScannedProduct } from '../../components/ui/ScanCapture';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import SupplierModal from '../../components/ui/SupplierModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Package, ArrowLeft, Plus, Trash2, Calendar, Truck, Briefcase, Banknote } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewGRN() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryPoId = searchParams.get('poId');

  const [activeTab, setActiveTab] = useState('primary');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [grnId, setGrnId] = useState(id || null);
  const [grnNumber, setGrnNumber] = useState('Drafting...');
  const [poId, setPoId] = useState(queryPoId || null);
  const [poNumber, setPoNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [warehouseName, setWarehouseName] = useState('');
  const [status, setStatus] = useState('RECEIVED');
  
  // Currency States
  const [currencies, setCurrencies] = useState([]);
  const [currencyId, setCurrencyId] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1.0');
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Lines
  const [items, setItems] = useState([
    { id: Date.now(), productId: '', productName: '', quantityOrdered: 0, quantityReceived: 1 }
  ]);

  const isCompleted = !!grnId; // A GRN is considered read-only if it's already created/saved.

  const onScan = async (code) => {
    try {
      const hit = await lookupScan(code);
      if (!hit.product) {
        showToast('Scan an item or a lot.', 'error');
        return;
      }
      setItems((current) => {
        const merged = mergeScannedProduct(current, hit.product, 'quantityReceived', { onlyExisting: !!poId });
        if (merged.error) {
          showToast(merged.error, 'error');
          return current;
        }
        return merged.items;
      });
      if (hit.lotNumber) showToast(`Lot ${hit.lotNumber}`, 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Nothing matched that scan', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, queryPoId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [supRes, prodRes, poRes, whRes, curRes] = await Promise.all([
        axios.get('/api/suppliers', config),
        axios.get('/api/products', config),
        axios.get('/api/procurement/purchase-orders', config),
        axios.get('/api/warehouses', config),
        axios.get('/api/finance/currencies', config)
      ]);
      
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
      setWarehouses(whRes.data);
      setCurrencies(curRes.data);

      if (id) {
        // Load an existing GRN
        const grnRes = await axios.get('/api/procurement/grn', config);
        const currentGrn = grnRes.data.find(g => g.id === id);
        if (currentGrn) {
          setGrnNumber(currentGrn.grnNumber);
          setSupplierId(currentGrn.supplierId);
          setSupplierName(currentGrn.supplier?.name || '');
          setDate(new Date(currentGrn.date).toISOString().split('T')[0]);
          setWarehouseId(currentGrn.warehouseId || '');
          if (currentGrn.warehouseId) {
            const wh = whRes.data.find(w => w.id === currentGrn.warehouseId);
            if (wh) setWarehouseName(wh.name);
          }
          setStatus(currentGrn.status || 'RECEIVED');
          setPoId(currentGrn.poId || null);
          setPoNumber(currentGrn.purchaseOrder?.poNumber || '');
          setCurrencyId(currentGrn.currencyId || '');
          setExchangeRate((currentGrn.exchangeRate || 1.0).toString());
          
          if (currentGrn.items && currentGrn.items.length > 0) {
            setItems(currentGrn.items.map(item => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || '',
              quantityOrdered: parseFloat(item.quantityOrdered || 0),
              quantityReceived: parseFloat(item.quantityReceived || 0)
            })));
          }
        }
      } else if (queryPoId) {
        // Load PO context
        const order = poRes.data.find(q => q.id === queryPoId);
        if (order) {
           setSupplierId(order.supplierId);
           setSupplierName(order.supplier?.name || '');
           setPoNumber(order.poNumber || '');
           setCurrencyId(order.currencyId || '');
           setExchangeRate((order.exchangeRate || 1.0).toString());
           if (order.items && order.items.length > 0) {
             setItems(order.items.map(qi => ({
               id: qi.id || Date.now() + Math.random(),
               productId: qi.productId,
               productName: qi.product?.name || '',
               quantityOrdered: parseFloat(qi.quantity),
               unitPrice: parseFloat(qi.unitPrice || 0),
               quantityReceived: Math.max(parseFloat(qi.quantity) - (order.grns || []).reduce((sum, grn) => sum + (grn.status === 'CANCELLED' ? 0 : (grn.items || []).filter(line => line.productId === qi.productId).reduce((qty, line) => qty + parseFloat(line.quantityReceived || 0), 0)), 0), 0)
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
            updatedItem[k] = val;
          });
        } else {
          updatedItem[field] = value;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => setItems([...items, { id: Date.now() + Math.random(), productId: '', productName: '', quantityOrdered: 0, quantityReceived: 1 }]);
  
  const removeItem = (itemId) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const totalOrdered = items.reduce((sum, item) => sum + (parseFloat(item.quantityOrdered) || 0), 0);
  const totalReceived = items.reduce((sum, item) => sum + (parseFloat(item.quantityReceived) || 0), 0);

  const handleSubmit = async () => {
    const errors = {};
    if (!supplierId) errors.supplierId = 'Supplier is required.';
    if (!date) errors.date = 'Date is required.';
    if (!warehouseId) errors.warehouseId = 'Warehouse is required.';
    const validLines = items.filter(l => l.productId);
    if (validLines.length === 0) errors.items = 'Add at least one product.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      return showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
    }
    setFieldErrors({});
    for (let item of validLines) {
      if (parseFloat(item.quantityReceived) <= 0) return showToast("All product lines must have a received quantity greater than 0.", "error");
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        supplierId,
        poId: poId || null,
        date,
        warehouseId,
        status: 'RECEIVED',
        currencyId: currencyId || null,
        exchangeRate: parseFloat(exchangeRate) || 1.0,
        items: validLines.map(l => ({
          productId: l.productId,
          quantityReceived: parseFloat(l.quantityReceived),
          quantityOrdered: parseFloat(l.quantityOrdered || l.quantityReceived),
          unitPrice: parseFloat(l.unitPrice || 0)
        }))
      };

      const res = await axios.post('/api/procurement/grn', payload, config);
      setGrnId(res.data.id);
      setGrnNumber(res.data.grnNumber);
      setStatus('RECEIVED');
      
      setLoading(false);
      showToast('GRN confirmed and saved successfully! Stock updated.', 'success');
    } catch (error) {
      console.error('Failed to create GRN:', error);
      showToast(error.response?.data?.error || 'Failed to create GRN.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteGRN = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this Goods Receipt Note? Stock adjustments will need to be made manually if completed. This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/procurement/grn/${grnId}`, config);
      showToast('Goods Receipt Note deleted successfully', 'success');
      navigate('/procurement/grn');
    } catch (error) {
      console.error('Failed to delete GRN:', error);
      showToast(error.response?.data?.error || 'Failed to delete GRN.', 'error');
    }
  };

  return (
    <AppLayout title="Goods Receipt Note" icon={Package}>
      {isInitialLoad && (id || queryPoId) ? (
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
            }} 
          />



          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/procurement/grn')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                  {isCompleted ? 'View Goods Receipt Note' : 'Create Goods Receipt Note'}
                  {grnNumber && grnNumber !== 'Drafting...' && <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{grnNumber}</span>}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receive physical goods into stock</span>
                  {poNumber && <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontWeight: 600 }}>Ref: {poNumber}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {isCompleted ? (
                <>
                  <button type="button" onClick={handleDeleteGRN} style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor='#fecaca' }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor='#fee2e2' }}>
                    <Trash2 size={16} /> Delete
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => navigate('/procurement/grn')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Discard</button>
                  <button onClick={handleSubmit} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)', opacity: (loading) ? 0.7 : 1 }}>
                    {loading ? 'Processing...' : 'Confirm Receipt'}
                  </button>
                </>
              )}
            </div>
          </div>

          {!isCompleted && <ScanCapture onScan={onScan} placeholder="Scan item or lot" />}

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
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Truck size={14} /> Supplier Name</label>
                  {!isCompleted && !poId && (
                    <button type="button" onClick={() => setIsSupplierModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      <Plus size={14} /> New
                    </button>
                  )}
                </div>
                <div style={{ pointerEvents: (isCompleted || poId) ? 'none' : 'auto', opacity: (isCompleted || poId) ? 0.7 : 1 }}>
                  <SupplierSearchDropdown 
                    suppliers={suppliers}
                    invalid={!!fieldErrors.supplierId}
                    error={fieldErrors.supplierId || ''}
                    value={supplierName}
                    onChange={(name, sup) => {
                      setSupplierName(name);
                      if (sup) setSupplierId(sup.id);
                    }}
                    placeholder="Search or select supplier..."
                    style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '180px' }}>
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
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>Warehouse</label>
                </div>
                <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                  <WarehouseSearchDropdown
                    warehouses={warehouses}
                    invalid={!!fieldErrors.warehouseId}
                    error={fieldErrors.warehouseId || ''}
                    value={warehouseName}
                    onChange={(name, wh) => {
                      setWarehouseName(name);
                      if (wh) setWarehouseId(wh.id);
                      else setWarehouseId('');
                    }}
                    placeholder="Search or select warehouse..."
                    disabled={isCompleted}
                    style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Banknote size={14} /> Currency</label>
                </div>
                <div style={{ pointerEvents: (isCompleted || poId) ? 'none' : 'auto', opacity: (isCompleted || poId) ? 0.7 : 1 }}>
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
                    disabled={isCompleted || !!poId}
                    value={exchangeRate} 
                    onChange={(e) => setExchangeRate(e.target.value)} 
                    style={{ width: '100%', height: '42px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', backgroundColor: (isCompleted || !!poId) ? '#f1f5f9' : '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Product Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Received Lines</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr style={{ height: '2.25rem' }}>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product Details</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '150px' }}>Ordered Qty</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '150px' }}>Received Qty</th>
                  {!isCompleted && <th style={{ borderBottom: '1px solid var(--border-color)', width: '50px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={{ height: '2.25rem', transition: 'all 0.2s', borderBottom: '1px solid var(--border-color)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ pointerEvents: (isCompleted || poId) ? 'none' : 'auto', height: '2.25rem' }}>
                        <ProductSearchDropdown 
                          products={products}
                          value={item.productName}
                          onChange={(product) => handleItemChange(item.id, {
                            productId: product.id,
                            productName: product.name
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
                        type="number" 
                        className="spreadsheet-input"
                        disabled={isCompleted || poId}
                        value={item.quantityOrdered}
                        onChange={(e) => handleItemChange(item.id, 'quantityOrdered', e.target.value)}
                        style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}
                      />
                    </td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <input 
                        type="number" 
                        className="spreadsheet-input"
                        disabled={isCompleted}
                        value={item.quantityReceived}
                        onChange={(e) => handleItemChange(item.id, 'quantityReceived', e.target.value)}
                        style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}
                      />
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
                {!isCompleted && !poId && (
                  <tr style={{ height: '2.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={addItem} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}><Plus size={14} color="#cbd5e1" style={{ margin: '0 auto' }} /></td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Click here to add another line...</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>0</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>0</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)' }}></td>
                  </tr>
                )}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
                <tr style={{ fontWeight: 800, height: '2.25rem' }}>
                  <td colSpan="2" style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Document Totals:</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{totalOrdered.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-main)' }}>{totalReceived.toLocaleString()}</td>
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
