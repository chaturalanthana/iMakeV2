import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ArrowUpRight, ArrowLeft, Plus, Trash2, Briefcase, Package, Printer, Save, CheckCircle, Calendar, FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewStockAdjustment() {
  const { id } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('primary');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Document State
  const [status, setStatus] = useState('DRAFT');
  const [adjNumber, setAdjNumber] = useState('');
  const [date, setDate] = useState(new Date());
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [reason, setReason] = useState('');

  const [items, setItems] = useState([
    { id: Date.now() + Math.random(), productId: '', productName: '', systemQty: 0, actualQty: 0, diffQty: 0, unitPrice: 0, total: 0 }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [prodRes, movRes, whRes] = await Promise.all([
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/warehouse/movements', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProducts(prodRes.data);
      setMovements(movRes.data);
      setWarehouses(whRes.data);

      if (id) {
        const res = await axios.get('/api/warehouse/adjustments', { headers: { Authorization: `Bearer ${token}` } });
        const existing = res.data.find(a => a.id === id);
        if (existing) {
          setAdjNumber(existing.adjNumber);
          setStatus(existing.status);
          setDate(new Date(existing.date));
          setWarehouseId(existing.warehouseId || '');
          if (existing.warehouseId) {
            const wh = whRes.data.find(w => w.id === existing.warehouseId);
            if (wh) setWarehouseName(wh.name);
          }
          setReason(existing.reason || '');
          if (existing.items && existing.items.length > 0) {
            setItems(existing.items.map(item => ({
              id: item.id || Date.now() + Math.random(),
              productId: item.productId,
              productName: item.product?.name || '',
              systemQty: parseFloat(item.systemQty) || 0,
              actualQty: parseFloat(item.actualQty) || 0,
              diffQty: parseFloat(item.diffQty) || 0,
              unitPrice: parseFloat(item.unitPrice) || 0,
              total: parseFloat(item.total) || 0
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

  const getSystemQty = (productId) => {
    if (!productId || !warehouseId) return 0;
    return movements
      .filter(m => m.productId === productId && m.warehouseId === warehouseId)
      .reduce((sum, m) => {
        const qty = parseFloat(m.quantity) || 0;
        if (m.type === 'GR') return sum + qty;
        if (m.type === 'GI') return sum - qty;
        if (m.type === 'ADJ') return sum + qty; 
        return sum;
      }, 0);
  };

  // Re-calculate system quantities when warehouse changes
  useEffect(() => {
    setItems(prevItems => prevItems.map(item => {
      if (!item.productId) return item;
      const sysQty = getSystemQty(item.productId);
      const diff = item.actualQty - sysQty;
      return { ...item, systemQty: sysQty, diffQty: diff, total: diff * item.unitPrice };
    }));
  }, [warehouseId]);

  const handleItemChange = (itemId, field, value) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === itemId) {
        let updatedItem = { ...item };

        if (typeof field === 'object' && field !== null) {
          Object.keys(field).forEach(k => {
            updatedItem[k] = field[k];
          });
          if (field.productId) {
            updatedItem.systemQty = getSystemQty(field.productId);
            updatedItem.actualQty = updatedItem.systemQty;
          }
        } else {
          updatedItem[field] = value;
        }

        // Auto calculate diff and total
        const system = parseFloat(updatedItem.systemQty) || 0;
        const actual = parseFloat(updatedItem.actualQty) || 0;
        const price = parseFloat(updatedItem.unitPrice) || 0;
        
        updatedItem.diffQty = actual - system;
        updatedItem.total = updatedItem.diffQty * price;

        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => setItems([...items, { id: Date.now() + Math.random(), productId: '', productName: '', systemQty: 0, actualQty: 0, diffQty: 0, unitPrice: 0, total: 0 }]);
  
  const removeItem = (itemId) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const totalDiff = items.reduce((sum, item) => sum + (parseFloat(item.diffQty) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);

  const handleSubmit = async (submitStatus = 'DRAFT') => {
    if (!warehouseId) return showToast("Warehouse is required.", "error");
    const validLines = items.filter(l => l.productId);
    if (validLines.length === 0) return showToast("Please add at least one product.", "error");
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        date,
        warehouseId,
        reason,
        status: submitStatus,
        items: validLines.map(l => ({
          productId: l.productId,
          systemQty: parseFloat(l.systemQty),
          actualQty: parseFloat(l.actualQty),
          diffQty: parseFloat(l.diffQty),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };
      
      let res;
      if (id) {
        res = await axios.put(`/api/warehouse/adjustments/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.post('/api/warehouse/adjustments', payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      showToast('Saved successfully!', 'success');
      if (!id) navigate(`/warehouse/adjustments/${res.data.id}`, { replace: true });
      else fetchInitialData();
      
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process adjustment.', 'error');
      setLoading(false);
    }
  };

  const isReadOnly = status === 'COMPLETED';
  const isCompleted = isReadOnly;

  return (
    <AppLayout title={id ? `Stock Adjustment - ${adjNumber}` : "New Stock Adjustment"} icon={ArrowUpRight}>
      {isInitialLoad ? (
        <PageSkeleton type="form" />
      ) : (
        <>


          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/warehouse/adjustments')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {id ? adjNumber : 'New Stock Adjustment (ADJ)'}
                  <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: isReadOnly ? '#ecfdf5' : '#fef3c7', color: isReadOnly ? '#059669' : '#d97706', fontWeight: 700, border: `1px solid ${isReadOnly ? '#a7f3d0' : '#fde68a'}` }}>
                    {status}
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Audit or reconcile actual physical stock vs system stock</span>
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
                  <button onClick={() => handleSubmit('COMPLETED')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)', opacity: (loading) ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Confirm Adjustment
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Header Details */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Date *</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <DatePicker 
                  value={date} 
                  onChange={setDate} 
                  placeholder="Select Date" 
                  style={{ height: '42px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>Warehouse *</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <WarehouseSearchDropdown
                  warehouses={warehouses}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '450px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> Reason / Reference</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <input 
                  type="text" 
                  placeholder="e.g., Annual inventory audit, found missing boxes..." 
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Items to Adjust</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product Details</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Unit Cost</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '100px' }}>System Qty</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-main)', fontWeight: 800, textAlign: 'center', width: '120px' }}>Physical Qty</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '100px' }}>Diff. Qty</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '140px' }}>Impact Value</th>
                  {!isReadOnly && <th style={{ border: '1px solid var(--border-color)', width: '40px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={{ transition: 'all 0.2s', backgroundColor: item.diffQty > 0 ? '#f0fdf4' : item.diffQty < 0 ? '#fef2f2' : 'transparent' }} onMouseEnter={e => e.currentTarget.style.backgroundColor=item.diffQty > 0 ? '#ecfdf5' : item.diffQty < 0 ? '#fef2f2' : '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor=item.diffQty > 0 ? '#f0fdf4' : item.diffQty < 0 ? '#fef2f2' : 'transparent'}>
                    <td style={{ border: '1px solid var(--border-color)', padding: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid var(--border-color)', padding: 0 }}>
                      <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', padding: '0.25rem 0.5rem' }}>
                        <ProductSearchDropdown 
                          products={products}
                          value={item.productName}
                          onChange={(product) => handleItemChange(item.id, {
                            productId: product.id,
                            productName: product.name,
                            unitPrice: product.costPrice || 0
                          })}
                          placeholder="Type to search..."
                          style={{ input: { border: 'none', background: 'transparent', padding: '0', fontSize: '0.9rem', fontWeight: 500, boxShadow: 'none', width: '100%', height: '32px' } }}
                        />
                      </div>
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: 0 }}>
                      <input 
                        type="number" 
                        disabled={isCompleted}
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        style={{ width: '100%', height: '38px', boxSizing: 'border-box', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', outline: 'none', padding: '0 0.5rem' }}
                        onFocus={e => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; }}
                        onBlur={e => { e.target.style.backgroundColor = 'transparent'; }}
                      />
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '0 0.5rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {item.systemQty}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: 0 }}>
                      <input 
                        type="number" 
                        disabled={isCompleted}
                        value={item.actualQty === 0 && item.systemQty === 0 && item.productId === '' ? '' : item.actualQty}
                        onChange={(e) => handleItemChange(item.id, 'actualQty', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', height: '38px', boxSizing: 'border-box', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', outline: 'none', padding: '0 0.5rem' }}
                        onFocus={e => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; }}
                        onBlur={e => { e.target.style.backgroundColor = 'transparent'; }}
                      />
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '0 0.5rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: item.diffQty > 0 ? '#059669' : item.diffQty < 0 ? '#b91c1c' : 'var(--text-muted)' }}>
                      {item.diffQty > 0 ? '+' : ''}{item.diffQty}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '0 0.5rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: item.total > 0 ? '#059669' : item.total < 0 ? '#b91c1c' : 'var(--text-main)' }}>
                      ${(parseFloat(item.total) || 0).toFixed(2)}
                    </td>
                    {!isReadOnly && (
                      <td style={{ border: '1px solid var(--border-color)', padding: 0, textAlign: 'center' }}>
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!isReadOnly && (
                  <tr style={{ cursor: 'text' }}>
                    <td style={{ border: '1px solid var(--border-color)', padding: '0.5rem', textAlign: 'center' }}></td>
                    <td colSpan="6" style={{ border: '1px solid var(--border-color)', padding: 0 }}>
                      <button onClick={addItem} type="button" style={{ width: '100%', background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.8rem', padding: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Plus size={14} /> Add Line Item
                      </button>
                    </td>
                    <td style={{ border: '1px solid var(--border-color)' }}></td>
                  </tr>
                )}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
                <tr style={{ fontWeight: 800 }}>
                  <td colSpan="5" style={{ padding: '1.25rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Adjustment Totals:</td>
                  <td style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '1rem', color: totalDiff > 0 ? '#059669' : totalDiff < 0 ? '#b91c1c' : 'var(--text-muted)' }}>
                    {totalDiff > 0 ? '+' : ''}{totalDiff}
                  </td>
                  <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontSize: '1rem', color: totalAmount > 0 ? '#059669' : totalAmount < 0 ? '#b91c1c' : 'var(--text-main)' }}>
                    ${totalAmount.toFixed(2)}
                  </td>
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
