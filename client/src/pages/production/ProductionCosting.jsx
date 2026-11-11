import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { DollarSign } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { TextControl } from '../../components/ui/FormField';
import ActionButton from '../../components/ui/ActionButton';
import Section, { EmptyState } from '../../components/ui/Section';

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
      <FilterBar actions={<ActionButton onClick={rollup}>Roll up</ActionButton>}>
        <FormField label="Product" width="320px" required error={fieldErrors.productId}>
          <LiveSearchDropdown
            options={products.map((product) => ({ label: `${product.code} - ${product.name}`, value: product.id }))}
            value={productId}
            invalid={!!fieldErrors.productId}
            onChange={setProductId}
            placeholder="Search product..."
          />
        </FormField>
        <FormField label="Quantity" width="140px" required error={fieldErrors.quantity}>
          <TextControl type="number" min="0" step="any" value={quantity} invalid={!!fieldErrors.quantity} onChange={(event) => setQuantity(event.target.value)} />
        </FormField>
      </FilterBar>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
        Rolls the active BOM and routing up for a quantity. Use the unit cost on a quotation.
      </p>

      {sheet && (
        <Section title="Quote cost sheet">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
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
                  <tr key={label}>
                    <td style={{ fontWeight: label === 'Total' || label === 'Unit cost' ? 800 : 600 }}>{label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.note && <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sheet.note}</div>}
        </Section>
      )}

      <Section title="Product cost variance">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '640px' }}>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Orders</th>
                <th style={{ textAlign: 'right' }}>Material</th>
                <th style={{ textAlign: 'right' }}>Labour</th>
                <th style={{ textAlign: 'right' }}>Overhead</th>
                <th style={{ textAlign: 'right' }}>Scrap</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(report.products || []).length === 0 ? (
                <tr><td colSpan={7}><EmptyState>No released work orders yet.</EmptyState></td></tr>
              ) : report.products.map((product) => (
                <tr key={product.productId}>
                  <td style={{ fontWeight: 600 }}>{product.code} — {product.name}</td>
                  <td style={{ textAlign: 'right' }}>{product.orderCount}</td>
                  {['material', 'labour', 'overhead', 'scrap'].map((key) => (
                    <td key={key} style={{ textAlign: 'right', color: product.variance.buckets[key].variance > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                      {money(product.variance.buckets[key].variance)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(product.variance.variance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Planned cost is the full roll-up pro-rated to confirmed quantity (good plus scrap). Labour includes machine time and subcontract.
        </div>
      </Section>
    </AppLayout>
  );
}
