import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import CustomerSearchDropdown from '../../components/ui/CustomerSearchDropdown';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import CustomerModal from '../../components/ui/CustomerModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import OrderPrintModal from '../../components/ui/OrderPrintModal';
import TransactionalTable from '../../components/ui/TransactionalTable';
import { Receipt, ArrowLeft, Plus, Trash2, Search, Filter, Calendar, User, Package, Calculator, UserPlus, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewInvoice() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const baseOrderId = searchParams.get('orderId');
  const baseDeliveryId = searchParams.get('deliveryId');

  const [activeTab, setActiveTab] = useState('primary');
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoiceId, setInvoiceId] = useState(id || null);
  const [isInitialLoad, setIsInitialLoad] = useState(!!id || !!baseOrderId || !!baseDeliveryId);
  const [invoiceNumber, setInvoiceNumber] = useState('Drafting...');
  const [lastSaved, setLastSaved] = useState(null);
  const [invoiceStatus, setInvoiceStatus] = useState('PENDING'); // PENDING acts as DRAFT
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [customerName, setCustomerName] = useState('');

  // Lines
  const [items, setItems] = useState([
    { id: Date.now(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  // Debounced Auto-Save Logic
  useEffect(() => {
    if (!invoiceId || !customerId) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [items, customerId, date]);

  const autoSave = async () => {
    if (!invoiceId || !customerId || invoiceStatus !== 'PENDING') return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const validLines = items.filter(l => l.productId);
      
      const payload = {
        customerId,
        orderId: baseOrderId || null,
        deliveryId: baseDeliveryId || null,
        date,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      await axios.put(`/api/sales/invoices/${invoiceId}`, payload, config);
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaving(false);
    }
  };

  const createInitialDraft = async (selectedCustomerId) => {
    if (invoiceId || !selectedCustomerId) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const validLines = items.filter(l => l.productId);
      const payload = {
        customerId: selectedCustomerId,
        orderId: baseOrderId || null,
        deliveryId: baseDeliveryId || null,
        date,
        status: 'PENDING',
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      const res = await axios.post('/api/sales/invoices', payload, config);
      setInvoiceId(res.data.id);
      setInvoiceNumber(res.data.invoiceNumber);
      setLastSaved(new Date().toLocaleTimeString());
      setSaving(false);
    } catch (error) {
      console.error('Failed to create initial draft:', error);
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [baseOrderId, baseDeliveryId, id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [custRes, prodRes] = await Promise.all([
        axios.get('/api/customers', config),
        axios.get('/api/products', config)
      ]);
      
      setCustomers(custRes.data);
      setProducts(prodRes.data);

      if (id) {
        // Load an existing invoice
        const invRes = await axios.get('/api/sales/invoices', config);
        const currentInv = invRes.data.find(o => o.id === id);
        if (currentInv) {
          setInvoiceNumber(currentInv.invoiceNumber);
          setCustomerId(currentInv.customerId);
          setCustomerName(currentInv.customer?.name || '');
          setDate(new Date(currentInv.date).toISOString().split('T')[0]);
          setInvoiceStatus(currentInv.status || 'PENDING');
          
          if (currentInv.items && currentInv.items.length > 0) {
            setItems(currentInv.items.map(item => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.total)
            })));
          }
        }
      } else if (baseOrderId || baseDeliveryId) {
        // Instantiate invoice dynamically from order or delivery
        // Prefer fetching specific details via orders API route (often returns order items)
        const ordRes = await axios.get('/api/sales/orders', config);
        
        let refOrder = null;
        let refDel = null;
        
        if (baseDeliveryId) {
          const delRes = await axios.get('/api/sales/deliveries', config);
          refDel = delRes.data.find(d => d.id === baseDeliveryId);
        }
        
        if (baseOrderId) {
          refOrder = ordRes.data.find(o => o.id === baseOrderId);
        } else if (refDel && refDel.orderId) {
          refOrder = ordRes.data.find(o => o.id === refDel.orderId);
        }

        if (refOrder || refDel) {
          if (refOrder) {
            setCustomerId(refOrder.customerId);
            setCustomerName(refOrder.customer?.name || '');
          } else if (refDel) {
            setCustomerId(refDel.customerId);
            setCustomerName(refDel.customer?.name || '');
          }
          
          const invoicedQtyMap = {};
          
          // Determine where to pull existing invoices from (order or delivery)
          const sourceInvoices = baseDeliveryId && refDel ? refDel.invoices : (refOrder ? refOrder.salesInvoices : null);
          if (sourceInvoices) {
             sourceInvoices.forEach(inv => {
               if (['UNPAID', 'PAID', 'PENDING'].includes(inv.status)) {
                 inv.items.forEach(i => {
                   invoicedQtyMap[i.productId] = (invoicedQtyMap[i.productId] || 0) + parseFloat(i.quantity);
                 });
               }
             });
          }

          const sourceItems = baseDeliveryId && refDel ? refDel.items : (refOrder ? refOrder.items : []);

          if (sourceItems && sourceItems.length > 0) {
            const remainingItems = sourceItems.map(item => {
              const invoiced = invoicedQtyMap[item.productId] || 0;
              const remaining = Math.max(0, parseFloat(item.quantity) - invoiced);
              
              let unitPrice = item.unitPrice;
              if (baseDeliveryId && refDel && refOrder) {
                  const ordItem = refOrder.items.find(oi => oi.productId === item.productId);
                  if (ordItem) unitPrice = ordItem.unitPrice;
              }
              
              return {
                id: item.id,
                productId: item.productId,
                productName: item.product?.name || '',
                quantity: remaining,
                unitPrice: parseFloat(unitPrice || 0),
                total: (remaining * parseFloat(unitPrice || 0)).toFixed(2)
              };
            }).filter(item => item.quantity > 0);

            if (remainingItems.length === 0) {
              setItems([{ id: Date.now(), productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]);
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



  const handleSubmit = async (finalStatus = 'UNPAID') => {
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
        orderId: baseOrderId || null,
        deliveryId: baseDeliveryId || null,
        invoiceNumber,
        date,
        status: finalStatus,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          total: parseFloat(l.total)
        }))
      };

      if (invoiceId) {
        await axios.put(`/api/sales/invoices/${invoiceId}`, payload, config);
      } else {
        const res = await axios.post('/api/sales/invoices', payload, config);
        setInvoiceId(res.data.id);
      }
      setInvoiceStatus(finalStatus);
      setLoading(false);
      showToast('Invoice saved successfully!', 'success');
      navigate('/sales/invoices');
    } catch (error) {
      console.error('Failed to save invoice:', error);
      showToast(error.response?.data?.error || 'Failed to save invoice.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this sales invoice? This action cannot be undone. Consider appending a credit note instead if this was finalized.")) return;
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/sales/invoices/${invoiceId}`, config);
      navigate('/sales/invoices');
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      showToast(error.response?.data?.error || 'Failed to delete invoice.', 'error');
    }
  };

  const isCompleted = !['DRAFT', 'PENDING'].includes((invoiceStatus || '').toUpperCase());

  return (
    <AppLayout title="Sales Invoice" icon={Receipt}>
      {isInitialLoad && (id || baseOrderId || baseDeliveryId) ? (
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
              <button onClick={() => navigate('/sales/invoices')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                  {isCompleted ? (
                    invoiceNumber
                  ) : (
                    <>
                      Create Invoice
                      {invoiceNumber && invoiceNumber !== 'Drafting...' && <span style={{ marginLeft: '12px', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{invoiceNumber}</span>}
                    </>
                  )}
                </h2>
                {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>Saving Changes...</span>}
                {lastSaved && !saving && !isCompleted && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last saved at {lastSaved}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <>
                {invoiceId && (
                  <button
                    type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor='#f8fafc' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor='#fff' }}
                      title="Print Invoice"
                    >
                      <Printer size={18} />
                    </button>
                  )}
                  {invoiceId && invoiceStatus === 'PENDING' && (
                    <button
                      type="button"
                      onClick={handleDeleteInvoice}
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
                       {invoiceStatus !== 'PAID' && (
                         <button type="button" onClick={() => navigate(`/finance/payment-receipts/new?invoiceId=${invoiceId}`)} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)' }}>
                           Collect Payment
                         </button>
                       )}
                     </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => navigate('/sales/invoices')} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Discard</button>
                      <button onClick={() => handleSubmit('PENDING')} disabled={loading} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent-light)', color: 'var(--accent)', opacity: (loading) ? 0.7 : 1 }}>
                        Save Draft
                      </button>
                      <button onClick={() => handleSubmit('UNPAID')} disabled={loading} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)', opacity: (loading) ? 0.7 : 1 }}>
                        {loading ? 'Processing...' : 'Issue Invoice (Bill Client)'}
                      </button>
                    </>
                  )}
                </>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <button onClick={() => setActiveTab('primary')} style={{ padding: '0.75rem 0', border: 'none', background: 'none', borderBottom: activeTab === 'primary' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'primary' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={16} /> Primary Details
            </button>
          </div>

          {activeTab === 'primary' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '20px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> Bill To</label>
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
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Items to Bill</h3>
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
              lockLines={!!baseOrderId || !!baseDeliveryId}
            />
          </div>

          <OrderPrintModal 
            isOpen={isPrintModalOpen} 
            onClose={() => setIsPrintModalOpen(false)} 
            order={{
              orderNumber: invoiceNumber,
              date,
              customer: customers.find(c => c.id === customerId) || { name: customerName },
              items: items.map(i => ({
                product: products.find(p => p.id === i.productId) || { name: i.productName },
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.total
              })),
              isInvoice: true
            }} 
          />
        </>
      )}
    </AppLayout>
  );
}
