import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import SupplierSearchDropdown from '../../components/ui/SupplierSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ArrowDownLeft, ArrowLeft, Plus, Trash2, Save, CheckCircle, Calendar, FileText, Package, Printer, Truck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewStockReceipt() {
  const { id } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('primary');
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Document State
  const [status, setStatus] = useState('DRAFT');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState('');

  const [items, setItems] = useState([
    { id: Date.now() + Math.random(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [prodRes, whRes, suppRes] = await Promise.all([
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/suppliers', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProducts(prodRes.data);
      setWarehouses(whRes.data);
      setSuppliers(suppRes.data);

      if (id) {
        const res = await axios.get('/api/warehouse/receipts', { headers: { Authorization: `Bearer ${token}` } });
        const existing = res.data.find(r => r.id === id);
        if (existing) {
          setReceiptNumber(existing.receiptNumber);
          setStatus(existing.status);
          setDate(new Date(existing.date).toISOString().split('T')[0]);
          setWarehouseId(existing.warehouseId || '');
          if (existing.warehouseId) {
            const wh = whRes.data.find(w => w.id === existing.warehouseId);
            if (wh) setWarehouseName(wh.name);
          }
          setSupplierId(existing.supplierId || '');
          setSupplierName(existing.supplier?.name || '');
          setReason(existing.reason || '');
          if (existing.items && existing.items.length > 0) {
            setItems(existing.items.map(item => ({
              id: item.id || Date.now() + Math.random(),
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: parseFloat(item.quantity) || 0,
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

        const q = parseFloat(updatedItem.quantity) || 0;
        const p = parseFloat(updatedItem.unitPrice) || 0;
        updatedItem.total = q * p;

        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => setItems([...items, { id: Date.now() + Math.random(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]);
  
  const removeItem = (itemId) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);

  const handleSubmit = async (submitStatus = 'DRAFT') => {
    if (!warehouseId) return showToast("Warehouse is required.", "error");
    const validLines = items.filter(l => l.productId);
    if (validLines.length === 0) return showToast("Please add at least one product.", "error");
    if (submitStatus === 'COMPLETED') {
      for (let item of validLines) {
        if (parseFloat(item.quantity) <= 0) return showToast("All product lines must have a positive receipt quantity before completing.", "error");
      }
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        warehouseId,
        supplierId: supplierId || null,
        date,
        reason,
        status: submitStatus,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };
      
      let res;
      if (id) {
        res = await axios.put(`/api/warehouse/receipts/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.post('/api/warehouse/receipts', payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      showToast('Saved successfully!', 'success');
      if (!id) navigate(`/warehouse/receipts/${res.data.id}`, { replace: true });
      else fetchInitialData();
      
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process receipt.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isReadOnly = status === 'COMPLETED' || status === 'RECEIVED';
  const isCompleted = isReadOnly;

  return (
    <AppLayout title={id ? `Stock Receipt - ${receiptNumber}` : "New Stock Receipt"} icon={ArrowDownLeft}>
      {isInitialLoad ? (
        <PageSkeleton type="form" />
      ) : (
        <>
          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/warehouse/receipts')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {id ? receiptNumber : 'New Stock Receipt (SR)'}
                  <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: isReadOnly ? '#ecfdf5' : '#fef3c7', color: isReadOnly ? '#059669' : '#d97706', fontWeight: 700, border: `1px solid ${isReadOnly ? '#a7f3d0' : '#fde68a'}` }}>
                    {status}
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receive stock manually or via return receipt</span>
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
                  <button onClick={() => handleSubmit('COMPLETED')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: '#059669', color: '#ffffff', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)', opacity: (loading) ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Confirm Receipt
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Truck size={14} /> Supplier (Optional)</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <SupplierSearchDropdown 
                  suppliers={suppliers}
                  value={supplierName}
                  onChange={(name, supp) => {
                    setSupplierName(name);
                    if (supp) setSupplierId(supp.id);
                    else setSupplierId('');
                  }}
                  placeholder="Search or select supplier..."
                  style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> Reference / Narration</label>
              </div>
              <div style={{ pointerEvents: isCompleted ? 'none' : 'auto', opacity: isCompleted ? 0.7 : 1 }}>
                <input 
                  type="text" 
                  placeholder="e.g. Return stock, purchase override, etc." 
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Items to Add</h3>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr style={{ height: '2.25rem' }}>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product Details</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>Unit Cost (Rs)</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Quantity</th>
                  <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>Total (Rs)</th>
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
                            productName: product.name,
                            unitPrice: product.costPrice || 0
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
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}
                      />
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
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {(parseFloat(item.total) || 0).toFixed(2)}
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
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: '#059669' }}>+{totalQty}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '1.0rem', color: 'var(--text-main)' }}>${totalAmount.toFixed(2)}</td>
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
