import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { findByRouteKey, isUuid, routeKeyOf, showRecord } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SupplierSearchDropdown from '../../components/ui/SupplierSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import { ArrowLeft, FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const emptyLine = () => ({ productId: '', productName: '', quantity: 1, unitPrice: 0 });

export default function NewSupplierInvoice() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const routeKey = routeKeyOf(useParams());
  const [searchParams] = useSearchParams();
  const poKey = searchParams.get('poId') || '';
  const grnKey = searchParams.get('grnId') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [poId, setPoId] = useState(() => (isUuid(poKey) ? poKey : ''));
  const [grnId, setGrnId] = useState(() => (isUuid(grnKey) ? grnKey : ''));
  const [exchangeRate, setExchangeRate] = useState('1');
  const [reference, setReference] = useState('');
  const [items, setItems] = useState([emptyLine()]);
  const [receipts, setReceipts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const readOnly = Boolean(routeKey || saved);

  useEffect(() => {
    const load = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
        const [supplierRes, grnRes, poRes, invoiceRes] = await Promise.all([
          axios.get('/api/suppliers', config),
          axios.get('/api/procurement/grn', config),
          axios.get('/api/procurement/purchase-orders', config),
          axios.get('/api/procurement/supplier-invoices', config)
        ]);
        setSuppliers(supplierRes.data);
        setReceipts(grnRes.data || []);
        if (routeKey) {
          const current = findByRouteKey(invoiceRes.data, routeKey, 'invoiceNumber');
          if (current) {
            setSaved(current);
            showRecord(navigate, '/procurement/supplier-invoices', current, 'invoiceNumber');
            setSupplierId(current.supplierId);
            setSupplierName(current.supplier?.name || '');
            setDate(new Date(current.date).toISOString().split('T')[0]);
            setExchangeRate(String(current.exchangeRate || 1));
            setReference(current.supplierReference || '');
            setItems((current.items || []).map((item) => ({
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice)
            })));
          }
        } else if (grnKey) {
          const grn = findByRouteKey(grnRes.data, grnKey, 'grnNumber');
          if (grn) {
            setGrnId(grn.id);
            setSupplierId(grn.supplierId);
            setSupplierName(grn.supplier?.name || '');
            setPoId(grn.poId || '');
            setExchangeRate(String(grn.exchangeRate || 1));
            const po = poRes.data.find((row) => row.id === grn.poId);
            setItems((grn.items || []).map((item) => {
              const poLine = po?.items?.find((line) => line.productId === item.productId);
              return {
                productId: item.productId,
                productName: item.product?.name || '',
                quantity: Number(item.quantityReceived),
                unitPrice: Number(poLine?.unitPrice || item.unitPrice || 0)
              };
            }));
          }
        } else if (poKey) {
          const order = findByRouteKey(poRes.data, poKey, 'poNumber');
          if (order) {
            setPoId(order.id);
            setSupplierId(order.supplierId);
            setSupplierName(order.supplier?.name || '');
            setExchangeRate(String(order.exchangeRate || 1));
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [routeKey, grnKey]);

  const save = async () => {
    const errors = {};
    if (!supplierId) errors.supplierId = 'Supplier is required.';
    if (!date) errors.date = 'Date is required.';
    if (!poId && !grnId) errors.grnId = 'Link a goods receipt or a purchase order.';
    const lines = items.filter((item) => item.productId);
    if (!lines.length) errors.items = 'Add at least one product.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      const res = await axios.post('/api/procurement/supplier-invoices', {
        supplierId,
        poId: poId || null,
        grnId: grnId || null,
        date,
        supplierReference: reference,
        exchangeRate: parseFloat(exchangeRate) || 1,
        items: lines.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice)
        }))
      }, config);
      setSaved(res.data);
      showRecord(navigate, '/procurement/supplier-invoices', res.data, 'invoiceNumber');
      showToast(res.data.matchStatus === 'MATCHED_WITH_VARIANCE'
        ? 'Invoice saved. Price variance posted.'
        : 'Supplier invoice saved.', 'success');
    } catch (error) {
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to save supplier invoice.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const total = (saved ? Number(saved.total) : items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0));

  return (
    <AppLayout title="Supplier Invoice" icon={FileText}>
      {loading ? <PageSkeleton type="form" /> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate('/procurement/supplier-invoices')} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ margin: 0 }}>{saved?.invoiceNumber || 'Supplier Invoice'}</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{saved ? saved.status : 'Created from the goods receipt'}</span>
              </div>
            </div>
            {!readOnly && (
              <button onClick={save} disabled={saving} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Post Invoice'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 320 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Supplier</label>
              <SupplierSearchDropdown
                suppliers={suppliers}
                value={supplierName}
                invalid={!!fieldErrors.supplierId}
                error={fieldErrors.supplierId || ''}
                onChange={(name, supplier) => { setSupplierName(name); setSupplierId(supplier?.id || ''); }}
                placeholder="Supplier"
              />
            </div>
            <div style={{ width: 180 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Date</label>
              <DatePicker value={date} onChange={setDate} invalid={!!fieldErrors.date} error={fieldErrors.date || ''} />
            </div>
            <div style={{ width: 180 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Exchange rate</label>
              <input className="input-field" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} disabled={readOnly} />
            </div>
            <div style={{ width: 220 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Supplier reference</label>
              <input className="input-field" value={reference} onChange={(event) => setReference(event.target.value)} disabled={readOnly} />
            </div>
          </div>
          {!id && !grnId && (
            <div style={{ marginBottom: '1rem', maxWidth: 420 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Goods receipt</label>
              <select
                value=""
                onChange={(event) => {
                  const receipt = receipts.find((row) => row.id === event.target.value);
                  if (receipt) navigate(`/procurement/supplier-invoices/new?grnId=${encodeURIComponent(receipt.grnNumber)}`);
                }}
                style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid var(--border-color)', padding: '0 0.75rem' }}
              >
                <option value="">Choose the goods receipt to invoice</option>
                {receipts.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>{receipt.grnNumber} — {receipt.supplier?.name || 'Supplier'}</option>
                ))}
              </select>
              {fieldErrors.grnId && <div style={{ color: 'var(--error)', marginTop: 6 }}>{fieldErrors.grnId}</div>}
            </div>
          )}
          {fieldErrors.grnId && grnId && <div style={{ color: 'var(--error)', marginBottom: '0.75rem' }}>{fieldErrors.grnId}</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr>
                {['Product', 'Quantity', 'Unit price', 'Total'].map((heading) => (
                  <th key={heading} style={{ textAlign: heading === 'Product' ? 'left' : 'right', padding: '0.6rem', borderBottom: '1px solid var(--border-color)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.productId}-${index}`}>
                  <td style={{ padding: '0.6rem' }}>{item.productName || item.productId}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right' }}>{readOnly ? item.quantity : <input value={item.quantity} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: event.target.value } : line))} style={{ width: 90, textAlign: 'right' }} />}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right' }}>{readOnly ? item.unitPrice : <input value={item.unitPrice} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, unitPrice: event.target.value } : line))} style={{ width: 110, textAlign: 'right' }} />}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right' }}>{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: '1rem', fontWeight: 700 }}>
            {saved ? `Subtotal Rs ${Number(saved.subtotal).toFixed(2)} · Tax Rs ${Number(saved.taxAmount).toFixed(2)} · Payable Rs ${Number(saved.total).toFixed(2)}` : `Goods total Rs ${total.toFixed(2)}`}
          </div>
        </>
      )}
    </AppLayout>
  );
}
