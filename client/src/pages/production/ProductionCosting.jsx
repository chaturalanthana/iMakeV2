import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { DollarSign } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';

const FIELD = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};
const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProductionCosting() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sheet, setSheet] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [report, setReport] = useState({ orders: [], products: [] });

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const loadReport = useCallback(async () => {
    try {
      const [productsRes, varianceRes] = await Promise.all([
        axios.get('/api/products', authConfig()),
        axios.get('/api/costing/variances', authConfig())
      ]);
      setProducts(productsRes.data.filter((product) => product.bomApplicable));
      setReport(varianceRes.data);
    } catch (error) {
      showToast('Failed to load costing', 'error');
    }
  }, [authConfig, showToast]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const rollup = async () => {
    const errors = {};
    if (!productId) errors.productId = 'Product is required';
    if (!(parseFloat(quantity) > 0)) errors.quantity = 'Quantity must be greater than zero';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});
    try {
      const res = await axios.get('/api/costing/rollup', {
        ...authConfig(),
        params: { productId, quantity }
      });
      setSheet(res.data);
    } catch (error) {
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to roll up cost', 'error');
    }
  };

  return (
    <AppLayout title="Production Costing" icon={DollarSign}>
      <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 800, marginBottom: '0.35rem' }}>Quote cost sheet</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.8rem' }}>
          Rolls the active BOM and routing up for a quantity. Use the unit cost on a quotation.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 140px auto', gap: '0.6rem', alignItems: 'end' }}>
          <LiveSearchDropdown
            options={products.map((product) => ({ label: `${product.code} - ${product.name}`, value: product.id }))}
            value={productId}
            invalid={!!fieldErrors.productId}
            onChange={setProductId}
            placeholder="Product"
          />
          <input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={fieldErrors.quantity ? 'field-invalid' : undefined} style={FIELD} />
          <button onClick={rollup} style={{ height: '42px', border: 'none', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 800, padding: '0 1rem', cursor: 'pointer' }}>
            Roll up
          </button>
        </div>
        {sheet && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.85rem' }}>
            <tbody>
              {[
                ['Material', sheet.material],
                ['Scrap allowance', sheet.scrap],
                ['Labour', sheet.labour],
                ['Machine', sheet.machine],
                ['Subcontract', sheet.subcontract],
                ['Overhead', sheet.overhead],
                ['Total', sheet.total],
                ['Unit cost', sheet.unitCost]
              ].map(([label, value]) => (
                <tr key={label} style={{ borderTop: '1px solid #f1f5f9', height: '36px' }}>
                  <td style={{ fontWeight: label === 'Total' || label === 'Unit cost' ? 800 : 600 }}>{label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sheet?.note && <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>{sheet.note}</div>}
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', overflow: 'auto' }}>
        <div style={{ fontWeight: 800, marginBottom: '0.7rem' }}>Product cost variance</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '640px' }}>
          <thead>
            <tr style={{ textAlign: 'right', color: '#64748b', height: '36px' }}>
              <th style={{ textAlign: 'left' }}>Product</th>
              <th>Orders</th>
              <th>Material</th>
              <th>Labour</th>
              <th>Overhead</th>
              <th>Scrap</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(report.products || []).length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '1rem 0', color: '#64748b' }}>No released work orders yet.</td></tr>
            ) : report.products.map((product) => (
              <tr key={product.productId} style={{ borderTop: '1px solid #f1f5f9', height: '40px' }}>
                <td style={{ textAlign: 'left', fontWeight: 700 }}>{product.code} — {product.name}</td>
                <td style={{ textAlign: 'right' }}>{product.orderCount}</td>
                {['material', 'labour', 'overhead', 'scrap'].map((key) => (
                  <td key={key} style={{ textAlign: 'right', color: product.variance.buckets[key].variance > 0 ? '#b91c1c' : '#15803d' }}>
                    {money(product.variance.buckets[key].variance)}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(product.variance.variance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '0.55rem', fontSize: '0.75rem', color: '#64748b' }}>
          Planned cost is the full roll-up pro-rated to confirmed quantity (good plus scrap). Labour includes machine time and subcontract.
        </div>
      </div>
    </AppLayout>
  );
}
