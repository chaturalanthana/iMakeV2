import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SupplierSearchDropdown from '../../components/ui/SupplierSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import PageHeader from '../../components/ui/PageHeader';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import { FileText, Package } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const emptyLine = () => ({ productId: '', productName: '', quantity: 1, unitPrice: 0 });

export default function NewSupplierInvoice() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [poId, setPoId] = useState(searchParams.get('poId') || '');
  const [grnId, setGrnId] = useState(searchParams.get('grnId') || '');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [reference, setReference] = useState('');
  const [items, setItems] = useState([emptyLine()]);
  const [receipts, setReceipts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const readOnly = Boolean(id || saved);

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
        if (id) {
          const current = invoiceRes.data.find((row) => row.id === id);
          if (current) {
            setSaved(current);
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
        } else if (grnId) {
          const grn = grnRes.data.find((row) => row.id === grnId);
          if (grn) {
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
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, grnId]);

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

  const goodsTotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);

  return (
    <AppLayout title="Supplier Invoice" icon={FileText}>
      {loading ? <PageSkeleton type="form" /> : (
        <>
          <PageHeader
            onBack={() => navigate('/procurement/supplier-invoices')}
            title={saved?.invoiceNumber ? `View Supplier Invoice` : 'Create Supplier Invoice'}
            subtitle={saved ? saved.status : 'Created from the goods receipt'}
            extra={saved?.invoiceNumber ? (
              <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontWeight: 600 }}>#{saved.invoiceNumber}</span>
            ) : null}
            actions={!readOnly && (
              <>
                <ActionButton variant="discard" onClick={() => navigate('/procurement/supplier-invoices')}>Discard</ActionButton>
                <ActionButton variant="submit" disabled={saving} onClick={save}>
                  {saving ? 'Processing...' : 'Post Invoice'}
                </ActionButton>
              </>
            )}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
            <FormField label="Supplier" icon={FileText} width="350px" required error={fieldErrors.supplierId}>
              <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.7 : 1 }}>
                <SupplierSearchDropdown
                  suppliers={suppliers}
                  value={supplierName}
                  invalid={!!fieldErrors.supplierId}
                  error=""
                  onChange={(name, supplier) => { setSupplierName(name); setSupplierId(supplier?.id || ''); }}
                  placeholder="Search or select supplier..."
                  style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                />
              </div>
            </FormField>
            <FormField label="Date" width="200px" required error={fieldErrors.date}>
              <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.7 : 1 }}>
                <DatePicker value={date} onChange={setDate} invalid={!!fieldErrors.date} placeholder="Select Date" style={{ height: '42px', boxSizing: 'border-box' }} />
              </div>
            </FormField>
            <FormField label="Exchange rate" width="160px">
              <TextControl value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Supplier reference" width="240px">
              <TextControl value={reference} onChange={(event) => setReference(event.target.value)} disabled={readOnly} />
            </FormField>
            {!id && !grnId && (
              <FormField label="Goods receipt" width="350px" error={fieldErrors.grnId}>
                <SelectControl
                  value=""
                  onChange={(event) => { if (event.target.value) navigate(`/procurement/supplier-invoices/new?grnId=${event.target.value}`); }}
                  invalid={!!fieldErrors.grnId}
                >
                  <option value="">Choose the goods receipt to invoice</option>
                  {receipts.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>{receipt.grnNumber} — {receipt.supplier?.name || 'Supplier'}</option>
                  ))}
                </SelectControl>
              </FormField>
            )}
          </div>
          {fieldErrors.grnId && grnId && <div className="field-error-text" style={{ marginBottom: '0.75rem' }}>{fieldErrors.grnId}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Package size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Invoice Lines</h3>
          </div>
          {fieldErrors.items && <div className="field-error-text" style={{ marginBottom: '0.75rem' }}>{fieldErrors.items}</div>}
          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'center', width: '150px' }}>Quantity</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>Unit price</th>
                  <th style={{ textAlign: 'right', width: '140px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
                    <td>{item.productName || item.productId || '—'}</td>
                    <td className="spreadsheet-cell">
                      {readOnly ? item.quantity : (
                        <input className="spreadsheet-input" value={item.quantity} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: event.target.value } : line))} style={{ textAlign: 'center', fontWeight: 700 }} />
                      )}
                    </td>
                    <td className="spreadsheet-cell">
                      {readOnly ? item.unitPrice : (
                        <input className="spreadsheet-input" value={item.unitPrice} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, unitPrice: event.target.value } : line))} style={{ textAlign: 'right', fontWeight: 600 }} />
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ borderTop: '2px solid var(--border-color)' }}>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>
                    {saved ? `Subtotal Rs ${Number(saved.subtotal).toFixed(2)} · Tax Rs ${Number(saved.taxAmount).toFixed(2)} · Payable` : 'Goods total'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>
                    Rs {saved ? Number(saved.total).toFixed(2) : goodsTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
