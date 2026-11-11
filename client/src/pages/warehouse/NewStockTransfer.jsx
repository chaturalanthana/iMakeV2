import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import ScanCapture, { lookupScan, mergeScannedProduct } from '../../components/ui/ScanCapture';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { RefreshCw, ArrowLeft, Plus, Trash2, Save, CheckCircle, Calendar, FileText, Package, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewStockTransfer() {
  const { id } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('primary');
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Document State
  const [status, setStatus] = useState('DRAFT');
  const [transferNumber, setTransferNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [fromWarehouseName, setFromWarehouseName] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [toWarehouseName, setToWarehouseName] = useState('');
  const [reason, setReason] = useState('');

  const [items, setItems] = useState([
    { id: Date.now() + Math.random(), productId: '', productName: '', quantity: 1 }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [prodRes, whRes] = await Promise.all([
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProducts(prodRes.data);
      setWarehouses(whRes.data);

      if (id) {
        const res = await axios.get('/api/warehouse/transfers', { headers: { Authorization: `Bearer ${token}` } });
        const existing = res.data.find(t => t.id === id);
        if (existing) {
          setTransferNumber(existing.transferNumber);
          setStatus(existing.status);
          setDate(new Date(existing.date).toISOString().split('T')[0]);
          setFromWarehouseId(existing.fromWarehouseId || '');
          if (existing.fromWarehouseId) {
            const wh = whRes.data.find(w => w.id === existing.fromWarehouseId);
            if (wh) setFromWarehouseName(wh.name);
          }
          setToWarehouseId(existing.toWarehouseId || '');
          if (existing.toWarehouseId) {
            const wh = whRes.data.find(w => w.id === existing.toWarehouseId);
            if (wh) setToWarehouseName(wh.name);
          }
          setReason(existing.reason || '');
          if (existing.items && existing.items.length > 0) {
            setItems(existing.items.map(item => ({
              id: item.id || Date.now() + Math.random(),
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: parseFloat(item.quantity) || 0
            })));
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch initial data:`, error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const handleItemChange = (itemId, field, value) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === itemId) {
        let updatedItem = { ...item };
        if (typeof field === 'object' && field !== null) {
          Object.keys(field).forEach(k => {
            updatedItem[k] = field[k];
          });
        } else {
          updatedItem[field] = value;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => setItems([...items, { id: Date.now() + Math.random(), productId: '', productName: '', quantity: 1 }]);
  
  const removeItem = (itemId) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

  const handleSubmit = async (submitStatus = 'DRAFT') => {
    const errors = {};
    if (!date) errors.date = 'Date is required.';
    if (!fromWarehouseId) errors.fromWarehouseId = 'Source warehouse is required.';
    if (!toWarehouseId) errors.toWarehouseId = 'Destination warehouse is required.';
    if (fromWarehouseId && fromWarehouseId === toWarehouseId) errors.toWarehouseId = 'Source and destination warehouses cannot be the same.';
    const validLines = items.filter(l => l.productId);
    if (validLines.length === 0) errors.items = 'Add at least one product.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      return showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
    }
    setFieldErrors({});
    if (submitStatus === 'COMPLETED') {
      for (let item of validLines) {
        if (parseFloat(item.quantity) <= 0) return showToast("All product lines must have a positive transfer quantity before completing.", "error");
      }
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        fromWarehouseId,
        toWarehouseId,
        date,
        reason,
        status: submitStatus,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity)
        }))
      };
      
      let res;
      if (id) {
        res = await axios.put(`/api/warehouse/transfers/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.post('/api/warehouse/transfers', payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      showToast('Saved successfully!', 'success');
      if (!id) navigate(`/warehouse/transfers/${res.data.id}`, { replace: true });
      else fetchInitialData();
      
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process transfer.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isReadOnly = status === 'COMPLETED';
  const isCompleted = isReadOnly;

  const onScan = async (code) => {
    try {
      const hit = await lookupScan(code);
      if (!hit.product) {
        showToast('Scan an item or a lot.', 'error');
        return;
      }
      setItems((current) => mergeScannedProduct(current, hit.product, 'quantity').items);
    } catch (error) {
      showToast(error.response?.data?.error || 'Nothing matched that scan', 'error');
    }
  };

  return (
    <AppLayout title={id ? `Stock Transfer - ${transferNumber}` : "New Stock Transfer"} icon={RefreshCw}>
      {isInitialLoad ? (
        <PageSkeleton type="form" />
      ) : (
        <>
          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/warehouse/transfers')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {id ? transferNumber : 'New Stock Transfer (ST)'}
                  <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: isReadOnly ? '#ecfdf5' : '#fef3c7', color: isReadOnly ? '#059669' : '#d97706', fontWeight: 700, border: `1px solid ${isReadOnly ? '#a7f3d0' : '#fde68a'}` }}>
                    {status}
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Move stock between locations</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {id && (
                <button type="button" onClick={() => window.print()} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Printer size={16} /> Print
                </button>
              )}
              {!isReadOnly && (
                <>
                  <button onClick={() => handleSubmit('DRAFT')} disabled={loading} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={16} /> Save Draft
                  </button>
                  <button onClick={() => handleSubmit('COMPLETED')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)', opacity: (loading) ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Confirm Transfer
                  </button>
                </>
              )}
            </div>
          </div>

          {!isReadOnly && <ScanCapture onScan={onScan} placeholder="Scan item or lot to transfer" />}

          {/* Header Details */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Date *</label>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>From Warehouse *</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <WarehouseSearchDropdown
                  warehouses={warehouses}
                  invalid={!!fieldErrors.fromWarehouseId}
                  error={fieldErrors.fromWarehouseId || ''}
                  value={fromWarehouseName}
                  onChange={(name, wh) => {
                    setFromWarehouseName(name);
                    if (wh) setFromWarehouseId(wh.id);
                    else setFromWarehouseId('');
                  }}
                  placeholder="Source warehouse..."
                  disabled={isCompleted}
                  style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>To Warehouse *</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <WarehouseSearchDropdown
                  warehouses={warehouses}
                  invalid={!!fieldErrors.toWarehouseId}
                  error={fieldErrors.toWarehouseId || ''}
                  value={toWarehouseName}
                  onChange={(name, wh) => {
                    setToWarehouseName(name);
                    if (wh) setToWarehouseId(wh.id);
                    else setToWarehouseId('');
                  }}
                  placeholder="Destination warehouse..."
                  disabled={isCompleted}
                  style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> Description / Reason</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <input 
                  type="text" 
                  placeholder="e.g. Move inventory to showroom, etc." 
                  value={reason} 
                  onChange={e => setReason(e.target.value)} 
                  style={{ width: '100%', height: '42px', padding: '0 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', outline: 'none', fontWeight: 500, boxSizing: 'border-box', color: 'var(--text-main)', fontSize: '0.85rem' }} 
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          {/* Product Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Items to Transfer</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr style={{ height: '2.25rem' }}>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product Details</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Quantity</th>
                  {!isReadOnly && <th style={{ borderBottom: '1px solid var(--border-color)', width: '50px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={{ height: '2.25rem', transition: 'all 0.2s', borderBottom: '1px solid var(--border-color)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
                    <td className="spreadsheet-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', height: '2.25rem' }}>
                        <ProductSearchDropdown 
                          products={products}
                          value={item.productName}
                          onChange={(product) => handleItemChange(item.id, {
                            productId: product.id,
                            productName: product.name
                          })}
                          placeholder="Type to search..."
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
                        disabled={isCompleted}
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}
                      />
                    </td>
                    {!isReadOnly && (
                      <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}>
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!isReadOnly && (
                  <tr style={{ height: '2.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={addItem} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}><Plus size={14} color="#cbd5e1" style={{ margin: '0 auto' }} /></td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Click here to add another line...</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>0</td>
                    <td style={{ borderBottom: '1px solid var(--border-color)' }}></td>
                  </tr>
                )}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
                <tr style={{ fontWeight: 800, height: '2.25rem' }}>
                  <td colSpan="2" style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Document Totals:</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent)' }}>{totalQty}</td>
                  {!isReadOnly && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
