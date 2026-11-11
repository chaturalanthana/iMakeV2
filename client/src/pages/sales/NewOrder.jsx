import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { findByRouteKey, isUuid, queryRef, routeKeyOf, showRecord } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import CustomerSearchDropdown from '../../components/ui/CustomerSearchDropdown';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import CustomerModal from '../../components/ui/CustomerModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import OrderPrintModal from '../../components/ui/OrderPrintModal';
import TransactionalTable from '../../components/ui/TransactionalTable';
import { ShoppingCart, ArrowLeft, Plus, Trash2, Search, Filter, Calendar, User, Package, Calculator, UserPlus, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewOrder() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const routeKey = routeKeyOf(useParams());
  const [searchParams] = useSearchParams();
  const quotationKey = searchParams.get('quotationId') || '';

  const [activeTab, setActiveTab] = useState('primary');
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState(() => (isUuid(routeKey) ? routeKey : null));
  const [linkedQuotationId, setLinkedQuotationId] = useState(() => (isUuid(quotationKey) ? quotationKey : null));
  const [isInitialLoad, setIsInitialLoad] = useState(!!routeKey || !!quotationKey);
  const [orderNumber, setOrderNumber] = useState('Drafting...');
  const [lastSaved, setLastSaved] = useState(null);
  const [orderStatus, setOrderStatus] = useState('PENDING');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [productAttributes, setProductAttributes] = useState({ categories: [], brands: [] });

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [customerName, setCustomerName] = useState('');

  // Lines
  const [items, setItems] = useState([
    { id: Date.now(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  // Debounced Auto-Save Logic
  useEffect(() => {
    if (!orderId || !customerId) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [items, customerId, date]);

  const autoSave = async () => {
    if (!orderId || !customerId || orderStatus !== 'PENDING') return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const validLines = items.filter(l => l.productId);
      
      const payload = {
        customerId,
        quotationId: linkedQuotationId,
        date,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      await axios.put(`/api/sales/orders/${orderId}`, payload, config);
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaving(false);
    }
  };

  const createInitialDraft = async (selectedCustomerId) => {
    if (orderId || !selectedCustomerId) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const validLines = items.filter(l => l.productId);
      const payload = {
        customerId: selectedCustomerId,
        quotationId: linkedQuotationId,
        date,
        status: 'PENDING',
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      const res = await axios.post('/api/sales/orders', payload, config);
      setOrderId(res.data.id);
      setOrderNumber(res.data.orderNumber);
      showRecord(navigate, '/sales/orders', res.data, 'orderNumber');
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Failed to create initial draft:', error);
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [quotationKey, routeKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [custRes, prodRes, attrRes] = await Promise.all([
        axios.get('/api/customers', config),
        axios.get('/api/products', config),
        axios.get('/api/products/attributes', config)
      ]);
      
      setCustomers(custRes.data);
      setProducts(prodRes.data);
      setProductAttributes(attrRes.data);

      if (routeKey) {
        // Load an existing order
        const ordRes = await axios.get('/api/sales/orders', config);
        const currentOrd = findByRouteKey(ordRes.data, routeKey, 'orderNumber');
        if (currentOrd) {
          setOrderId(currentOrd.id);
          showRecord(navigate, '/sales/orders', currentOrd, 'orderNumber');
          setOrderNumber(currentOrd.orderNumber);
          setCustomerId(currentOrd.customerId);
          setCustomerName(currentOrd.customer?.name || '');
          setDate(new Date(currentOrd.date).toISOString().split('T')[0]);
          setOrderStatus(currentOrd.status || 'PENDING');
          
          const shippedQtyMap = {};
          if (currentOrd.deliveries) {
            currentOrd.deliveries.forEach(d => {
              if (d.status === 'DELIVERED') {
                d.items.forEach(i => {
                  shippedQtyMap[i.productId] = (shippedQtyMap[i.productId] || 0) + parseFloat(i.quantity);
                });
              }
            });
          }

          const invoicedQtyMap = {};
          if (currentOrd.salesInvoices) {
             currentOrd.salesInvoices.forEach(inv => {
               if (['UNPAID', 'PAID', 'PENDING'].includes(inv.status)) {
                 inv.items.forEach(i => {
                   invoicedQtyMap[i.productId] = (invoicedQtyMap[i.productId] || 0) + parseFloat(i.quantity);
                 });
               }
             });
          }

          if (currentOrd.items && currentOrd.items.length > 0) {
            setItems(currentOrd.items.map(item => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: parseFloat(item.quantity),
              shippedQty: shippedQtyMap[item.productId] || 0,
              invoicedQty: invoicedQtyMap[item.productId] || 0,
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total)
            })));
          }
        }
      } else if (quotationKey) {
        // Instantiate order dynamically directly from a quotation transfer
        const quoRes = await axios.get('/api/sales/quotations', config);
        const refQuote = findByRouteKey(quoRes.data, quotationKey, 'quotationNumber');
        if (refQuote) {
          setLinkedQuotationId(refQuote.id);
          setCustomerId(refQuote.customerId);
          setCustomerName(refQuote.customer?.name || '');
          if (refQuote.items && refQuote.items.length > 0) {
            setItems(refQuote.items.map(item => ({
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



  const handleSubmit = async (finalStatus = 'COMPLETED') => {
    const errors = {};
    if (!customerId) errors.customerId = 'Customer is required.';
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
        customerId,
        quotationId: linkedQuotationId,
        orderNumber,
        date,
        status: finalStatus,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      const res = orderId
        ? await axios.put(`/api/sales/orders/${orderId}`, payload, config)
        : await axios.post('/api/sales/orders', payload, config);
      if (!orderId) setOrderId(res.data.id);
      setOrderStatus(finalStatus);
      setLoading(false);
      showToast(res.data.creditWarning ? `Order saved. ${res.data.creditWarning}` : 'Order saved successfully!', res.data.creditWarning ? 'error' : 'success');
      navigate('/sales/orders');
    } catch (error) {
      console.error('Failed to save order:', error);
      showToast(error.response?.data?.error || 'Failed to save order.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this sales order? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/sales/orders/${orderId}`, config);
      navigate('/sales/orders');
    } catch (error) {
      console.error('Failed to delete order:', error);
      showToast(error.response?.data?.error || 'Failed to delete order.', 'error');
    }
  };

  const isCompleted = !['DRAFT', 'PENDING'].includes((orderStatus || '').toUpperCase());

  return (
    <AppLayout title="Sales Order" icon={ShoppingCart}>
      {isInitialLoad && (routeKey || quotationKey) ? (
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
              <button onClick={() => navigate('/sales/orders')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                  {isCompleted ? (
                    orderNumber
                  ) : (
                    <>
                      Create Order
                      {orderNumber && orderNumber !== 'Drafting...' && <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{orderNumber}</span>}
                    </>
                  )}
                </h2>
                {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>Saving Changes...</span>}
                {lastSaved && !saving && !isCompleted && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last saved at {lastSaved}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <>
                {orderId && (
                  <button
                    type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor='#f8fafc' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor='#fff' }}
                      title="Print Order"
                    >
                      <Printer size={18} />
                    </button>
                  )}
                  {orderId && orderStatus !== 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={handleDeleteOrder}
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
                      <button type="button" onClick={() => navigate(`/sales/deliveries/new?orderId=${queryRef(orderNumber)}`)} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid var(--accent)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: '#fff', color: 'var(--accent)', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor='#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor='#fff'}>
                        Create Delivery
                      </button>
                      <button type="button" onClick={() => navigate(`/sales/invoices/new?orderId=${queryRef(orderNumber)}`)} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)' }}>
                        Create Invoice
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => navigate('/sales/orders')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Discard</button>
                      <button onClick={() => handleSubmit('PENDING')} disabled={loading} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent-light)', color: 'var(--accent)', opacity: (loading) ? 0.7 : 1 }}>
                        Save Draft
                      </button>
                      <button onClick={() => handleSubmit('COMPLETED')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)', opacity: (loading) ? 0.7 : 1 }}>
                        {loading ? 'Processing...' : 'Complete Order'}
                      </button>
                    </>
                  )}
                </>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button onClick={() => setActiveTab('primary')} style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'primary' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'primary' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={16} /> Primary Details
            </button>
          </div>

          {activeTab === 'primary' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> Customer Name</label>
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
                      invalid={!!fieldErrors.customerId}
                      error={fieldErrors.customerId || ''}
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
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Date</label>
                </div>
                {isCompleted ? (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#000', padding: '0.55rem 0', borderBottom: '1px solid #e2e8f0' }}>
                    {new Date(date).toLocaleDateString()}
                  </div>
                ) : (
                  <div style={{ pointerEvents: 'auto', opacity: 1 }}>
                    <DatePicker 
                      invalid={!!fieldErrors.date}
                      error={fieldErrors.date || ''}
                      value={date} 
                      onChange={setDate} 
                      placeholder="Select Date" 
                      style={{ height: '42px', boxSizing: 'border-box' }}
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
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Add Products</h3>
              </div>
            </div>
          )}

          <div style={{ marginTop: isCompleted ? '2.5rem' : '0' }}>
            <TransactionalTable
              items={items}
              products={products}
              onChange={setItems}
              disabled={isCompleted}
              currencySymbol="Rs"
              unitPriceLabel="Unit Price"
              totalLabel="Total"
              showFulfillment={!!orderId}
            />
          </div>

          {/* Print PDF Modal */}
          <OrderPrintModal
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            order={{
              orderNumber,
              date,
              customer: { name: customerName },
              items,
            }}
          />
        </>
      )}
    </AppLayout>
  );
}
