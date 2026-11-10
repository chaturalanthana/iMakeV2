import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import CustomerSearchDropdown from '../../components/ui/CustomerSearchDropdown';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import CustomerModal from '../../components/ui/CustomerModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DeliveryPrintModal from '../../components/ui/DeliveryPrintModal';
import TransactionalTable from '../../components/ui/TransactionalTable';
import { Truck, ArrowLeft, Plus, Trash2, Search, Filter, Calendar, User, Package, Calculator, UserPlus, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewDelivery() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const baseOrderId = searchParams.get('orderId');

  const [activeTab, setActiveTab] = useState('primary');
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveryId, setDeliveryId] = useState(id || null);
  const [isInitialLoad, setIsInitialLoad] = useState(!!id || !!baseOrderId);
  const [deliveryNumber, setDeliveryNumber] = useState('Drafting...');
  const [lastSaved, setLastSaved] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('PENDING');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

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
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');

  // Lines
  const [items, setItems] = useState([
    { id: Date.now(), productId: '', productName: '', quantity: 1 }
  ]);

  // Debounced Auto-Save Logic
  useEffect(() => {
    if (!deliveryId || !customerId || !warehouseId) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [items, customerId, date, warehouseId]);

  const autoSave = async () => {
    if (!deliveryId || !customerId || !warehouseId || deliveryStatus !== 'PENDING') return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const validLines = items.filter(l => l.productId);
      
      const payload = {
        customerId,
        warehouseId,
        orderId: baseOrderId,
        date,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity)
        }))
      };

      await axios.put(`/api/sales/deliveries/${deliveryId}`, payload, config);
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaving(false);
    }
  };

  const createInitialDraft = async (selectedCustomerId) => {
    if (deliveryId || !selectedCustomerId || !warehouseId) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const validLines = items.filter(l => l.productId);
      const payload = {
        customerId: selectedCustomerId,
        warehouseId,
        orderId: baseOrderId || null,
        date,
        status: 'PENDING',
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity)
        }))
      };

      const res = await axios.post('/api/sales/deliveries', payload, config);
      setDeliveryId(res.data.id);
      setDeliveryNumber(res.data.deliveryNumber);
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Failed to create initial draft:', error);
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [baseOrderId, id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [custRes, prodRes, whRes] = await Promise.all([
        axios.get('/api/customers', config),
        axios.get('/api/products', config),
        axios.get('/api/warehouses', config)
      ]);
      
      setCustomers(custRes.data);
      setProducts(prodRes.data);
      setWarehouses(whRes.data);

      if (id) {
        const delRes = await axios.get('/api/sales/deliveries', config);
        const currentDel = delRes.data.find(o => o.id === id);
        if (currentDel) {
          setDeliveryNumber(currentDel.deliveryNumber);
          setCustomerId(currentDel.customerId);
          setCustomerName(currentDel.customer?.name || '');
          setDate(new Date(currentDel.date).toISOString().split('T')[0]);
          setWarehouseId(currentDel.warehouseId || '');
          if (currentDel.warehouseId) {
            const wh = whRes.data.find(w => w.id === currentDel.warehouseId);
            if (wh) setWarehouseName(wh.name);
          }
          setDeliveryStatus(currentDel.status || 'PENDING');
          
          if (currentDel.items && currentDel.items.length > 0) {
            setItems(currentDel.items.map(item => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: parseFloat(item.quantity)
            })));
          }
        }
      } else if (baseOrderId) {
        const ordRes = await axios.get('/api/sales/orders', config);
        const refOrder = ordRes.data.find(o => o.id === baseOrderId);
        if (refOrder) {
          setCustomerId(refOrder.customerId);
          setCustomerName(refOrder.customer?.name || '');
          
          const shippedQtyMap = {};
          if (refOrder.deliveries) {
            refOrder.deliveries.forEach(d => {
              if (d.status === 'DELIVERED') {
                d.items.forEach(i => {
                  shippedQtyMap[i.productId] = (shippedQtyMap[i.productId] || 0) + parseFloat(i.quantity);
                });
              }
            });
          }

          if (refOrder.items && refOrder.items.length > 0) {
            const remainingItems = refOrder.items.map(item => {
              const shipped = shippedQtyMap[item.productId] || 0;
              const remaining = Math.max(0, parseFloat(item.quantity) - shipped);
              return {
                id: item.id,
                productId: item.productId,
                productName: item.product?.name || '',
                quantity: remaining
              };
            }).filter(item => item.quantity > 0);

            if (remainingItems.length === 0) {
              // Optional: If you have showToast in scope, you could show it, but here we just leave items empty or single default.
              setItems([{ id: Date.now(), productId: '', productName: '', quantity: 1 }]);
            } else {
              setItems(remainingItems);
            }
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
            updatedItem[k] = (k === 'quantity') ? unformatNumber(val) : val;
          });
        } else {
          const cleanValue = (field === 'quantity') ? unformatNumber(value) : value;
          updatedItem[field] = cleanValue;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems([...items, { id: Date.now() + Math.random(), productId: '', productName: '', quantity: 1 }]);
  };

  const removeItem = (itemId) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);



  const handleSubmit = async (finalStatus = 'DELIVERED') => {
    if (!customerId || !date || !warehouseId) return showToast("Please fill required header fields including Warehouse.", "error");
    const validLines = items.filter(l => l.productId);
    if (validLines.length === 0) return showToast("Please add at least one product.", "error");
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        customerId,
        warehouseId,
        orderId: baseOrderId,
        deliveryNumber,
        date,
        status: finalStatus,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity)
        }))
      };

      if (deliveryId) {
        await axios.put(`/api/sales/deliveries/${deliveryId}`, payload, config);
      } else {
        const res = await axios.post('/api/sales/deliveries', payload, config);
        setDeliveryId(res.data.id);
      }
      setDeliveryStatus(finalStatus);
      setLoading(false);
      showToast('Delivery completed successfully!', 'success');
      navigate('/sales/deliveries');
    } catch (error) {
      console.error('Failed to save delivery:', error);
      showToast(error.response?.data?.error || 'Failed to save delivery.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteDelivery = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this delivery document? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/sales/deliveries/${deliveryId}`, config);
      navigate('/sales/deliveries');
    } catch (error) {
      console.error('Failed to delete delivery:', error);
      showToast(error.response?.data?.error || 'Failed to delete delivery.', 'error');
    }
  };

  const isCompleted = !['DRAFT', 'PENDING'].includes((deliveryStatus || '').toUpperCase());

  return (
    <AppLayout title="Sales Delivery" icon={Truck}>
      {isInitialLoad && (id || baseOrderId) ? (
        <PageSkeleton type="form" />
      ) : (
        <>
          <CustomerModal 
            isOpen={isCustomerModalOpen} 
            onClose={() => setIsCustomerModalOpen(false)} 
            onSaved={(newCustomer) => {
              setCustomers(prev => [...prev, newCustomer]);
              setCustomerName(newCustomer.name);
              setCustomerId(newCustomer.id);
              setIsCustomerModalOpen(false);
              createInitialDraft(newCustomer.id);
            }} 
          />
          
          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/sales/deliveries')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                  {isCompleted ? (
                    deliveryNumber
                  ) : (
                    <>
                      Create Delivery Docket
                      {deliveryNumber && deliveryNumber !== 'Drafting...' && <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{deliveryNumber}</span>}
                    </>
                  )}
                </h2>
                {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>Saving Changes...</span>}
                {lastSaved && !saving && !isCompleted && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last saved at {lastSaved}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <>
                {deliveryId && (
                  <button
                    type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor='#f8fafc' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor='#fff' }}
                      title="Print Delivery"
                    >
                      <Printer size={18} />
                    </button>
                  )}
                  {deliveryId && deliveryStatus === 'PENDING' && (
                    <button
                      type="button"
                      onClick={handleDeleteDelivery}
                      style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor='#fecaca' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor='#fee2e2' }}
                      title="Permanent Delete"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  )}
                  {isCompleted ? (
                     <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                       <button type="button" onClick={() => {}} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'not-allowed', fontWeight: 700, fontSize: '0.85rem', background: '#e2e8f0', color: '#94a3b8' }}>
                         Stock Deducted (Locked)
                       </button>
                       <button type="button" onClick={() => navigate(`/sales/invoices/new?deliveryId=${deliveryId}`)} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)' }}>
                         Create Invoice
                       </button>
                     </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => navigate('/sales/deliveries')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Discard</button>
                      <button onClick={() => handleSubmit('PENDING')} disabled={loading} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent-light)', color: 'var(--accent)', opacity: (loading) ? 0.7 : 1 }}>
                        Save Draft
                      </button>
                      <button onClick={() => handleSubmit('DELIVERED')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)', opacity: (loading) ? 0.7 : 1 }}>
                        {loading ? 'Processing...' : 'Complete & Deduct Stock'}
                      </button>
                    </>
                  )}
                </>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button onClick={() => setActiveTab('primary')} style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'primary' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'primary' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={16} /> Primary Details
            </button>
          </div>

          {activeTab === 'primary' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> Delivering To</label>
                  {!isCompleted && (
                    <button type="button" onClick={() => setIsCustomerModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      <UserPlus size={14} /> New
                    </button>
                  )}
                </div>
                {isCompleted ? (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#000', padding: '0.55rem 0', borderBottom: '1px solid #e2e8f0' }}>
                    {customerName || '-'}
                  </div>
                ) : (
                  <div style={{ pointerEvents: 'auto', opacity: 1 }}>
                    <CustomerSearchDropdown 
                      customers={customers}
                      value={customerName}
                      onChange={(name, cus) => {
                        setCustomerName(name);
                        if (cus) {
                          setCustomerId(cus.id);
                          createInitialDraft(cus.id);
                        }
                      }}
                      placeholder="Search or select customer..."
                      style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Dispatch Date</label>
                </div>
                {isCompleted ? (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#000', padding: '0.55rem 0', borderBottom: '1px solid #e2e8f0' }}>
                    {new Date(date).toLocaleDateString()}
                  </div>
                ) : (
                  <div style={{ pointerEvents: 'auto', opacity: 1 }}>
                    <DatePicker 
                      value={date} 
                      onChange={setDate} 
                      placeholder="Select Date" 
                      style={{ height: '42px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>Warehouse *</label>
                </div>
                {isCompleted ? (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#000', padding: '0.55rem 0', borderBottom: '1px solid #e2e8f0' }}>
                    {warehouseName || '-'}
                  </div>
                ) : (
                  <div style={{ pointerEvents: 'auto', opacity: 1 }}>
                    <WarehouseSearchDropdown
                      warehouses={warehouses}
                      value={warehouseName}
                      onChange={(name, wh) => {
                        setWarehouseName(name);
                        if (wh) {
                          setWarehouseId(wh.id);
                          if (customerId) createInitialDraft(customerId);
                        } else {
                          setWarehouseId('');
                        }
                      }}
                      placeholder="Search or select warehouse..."
                      disabled={isCompleted}
                      style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product Section Header */}
          {!isCompleted && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Items to Dispatch</h3>
              </div>
            </div>
          )}

          <div style={{ marginTop: isCompleted ? '2.5rem' : '0' }}>
            <TransactionalTable
              items={items}
              products={products}
              onChange={setItems}
              disabled={isCompleted}
              showPricing={false}
              lockLines={!!baseOrderId}
            />
          </div>

          <DeliveryPrintModal 
            isOpen={isPrintModalOpen} 
            onClose={() => setIsPrintModalOpen(false)} 
            delivery={{
              deliveryNumber,
              date,
              customer: customers.find(c => c.id === customerId) || { name: customerName },
              items: items.map(i => ({
                product: products.find(p => p.id === i.productId) || { name: i.productName },
                quantity: i.quantity
              }))
            }} 
          />
        </>
      )}
    </AppLayout>
  );
}
