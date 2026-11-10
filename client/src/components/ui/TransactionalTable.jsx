import React, { useState } from 'react';
import ProductSearchDropdown from './ProductSearchDropdown';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Reusable Transactional Table Component
 * Used for spreadsheet-like line item editing (Quotations, Orders, Invoices, etc.).
 * Standardized to lock UI input elements when disabled.
 * Supports checkbox row selection and batch process actions (e.g. Delete Selected).
 */
export default function TransactionalTable({
  items = [],
  products = [],
  onChange,
  disabled = false,
  currencySymbol = '$',
  unitPriceLabel = 'Unit Price',
  totalLabel = 'Total',
  showPricing = true,
  showFulfillment = false,
  lockLines = false
}) {
  const [selectedIds, setSelectedIds] = useState([]);

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

  const handleItemChange = (id, field, value) => {
    const updated = items.map(item => {
      if (item.id === id) {
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
    });
    onChange(updated);
  };

  const addItem = () => {
    const newItem = {
      id: Date.now() + Math.random(),
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    onChange([...items, newItem]);
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    onChange(items.filter(item => item.id !== id));
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    const allValidIds = items.map(item => item.id);
    const areAllSelected = allValidIds.length > 0 && allValidIds.every(id => selectedIds.includes(id));
    if (areAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allValidIds);
    }
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    const remaining = items.filter(item => !selectedIds.includes(item.id));
    onChange(remaining.length > 0 ? remaining : [{
      id: Date.now() + Math.random(),
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }]);
    setSelectedIds([]);
  };

  const grandTotal = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const labelColSpan = (disabled || lockLines) ? 2 : 3;

  // Compile inline validation errors
  const errors = [];
  items.forEach((item, index) => {
    if (item.productId) {
      const qty = parseFloat(item.quantity);
      
      if (isNaN(qty) || qty <= 0) {
        errors.push({
          itemId: item.id,
          field: 'quantity',
          message: `Line ${index + 1}: Quantity must be greater than zero.`
        });
      }
      
      if (showPricing) {
        const price = parseFloat(item.unitPrice);
        if (isNaN(price) || price < 0) {
          errors.push({
            itemId: item.id,
            field: 'unitPrice',
            message: `Line ${index + 1}: Unit price cannot be negative.`
          });
        }
      }
    }
  });

  return (
    <div>
      {/* Validation Warning Panel */}
      {errors.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#fffbeb',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontWeight: 700, color: '#b45309', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠️ Validation Warnings ({errors.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#78350f', fontWeight: 500 }}>
            {errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && !disabled && !lockLines && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          transition: 'all 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
              {selectedIds.length} item(s) selected
            </span>
          </div>
          <button
            type="button"
            onClick={deleteSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.15)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            <Trash2 size={14} /> Delete Selected
          </button>
        </div>
      )}

      {/* Main Table Wrapper */}
      <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
            <tr style={{ height: '2.25rem' }}>
              {!disabled && !lockLines && (
                <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={items.length > 0 && items.every(item => selectedIds.includes(item.id))}
                    onChange={handleSelectAllToggle}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
              <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product Details</th>
              {showPricing && <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>{unitPriceLabel} ({currencySymbol})</th>}
              <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Quantity</th>
              {showFulfillment && <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '100px' }}>Shipped</th>}
              {showFulfillment && <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '100px' }}>Invoiced</th>}
              {showPricing && <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right', width: '150px' }}>{totalLabel} ({currencySymbol})</th>}
              {!disabled && !lockLines && <th style={{ borderBottom: '1px solid var(--border-color)', width: '40px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isQtyInvalid = errors.some(err => err.itemId === item.id && err.field === 'quantity');
              const isPriceInvalid = errors.some(err => err.itemId === item.id && err.field === 'unitPrice');
              
              return (
                <tr key={item.id} style={{ height: '2.25rem', transition: 'all 0.2s', borderBottom: '1px solid var(--border-color)' }} onMouseEnter={e => !disabled && !lockLines && (e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)')} onMouseLeave={e => !disabled && !lockLines && (e.currentTarget.style.backgroundColor='transparent')}>
                  {!disabled && !lockLines && (
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleSelectRow(item.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: '#000' }} className={(disabled || lockLines) ? "" : "spreadsheet-cell"}>
                    {(disabled || lockLines) ? (
                      item.productName || '-'
                    ) : (
                      <div style={{ pointerEvents: 'auto', height: '2.25rem' }}>
                        <ProductSearchDropdown 
                          products={products}
                          value={item.productName}
                          onChange={(product) => handleItemChange(item.id, {
                            productId: product.id,
                            productName: product.name,
                            unitPrice: product.sellingPrice || 0
                          })}
                          placeholder="Type to search..."
                          className="spreadsheet-input"
                          style={{
                            wrapper: { height: '100%', width: '100%' },
                            input: { height: '100%', padding: '0 1rem', fontSize: '0.85rem', fontWeight: 500, borderRadius: '0px' }
                          }}
                        />
                      </div>
                    )}
                  </td>
                  {showPricing && (
                    <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700, color: '#000' }} className={disabled ? "" : "spreadsheet-cell"}>
                      {disabled ? (
                        formatWithCommas(item.unitPrice)
                      ) : (
                        <input 
                          type="text" 
                          className="spreadsheet-input"
                          disabled={disabled}
                          value={formatWithCommas(item.unitPrice)}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                          style={{ 
                            textAlign: 'right', 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            color: isPriceInvalid ? '#ef4444' : 'var(--accent)',
                            backgroundColor: isPriceInvalid ? '#fef2f2' : 'transparent',
                            border: isPriceInvalid ? '1.5px solid #ef4444' : 'none',
                            boxSizing: 'border-box',
                            height: '100%',
                            width: '100%',
                            padding: '0 1rem'
                          }}
                        />
                      )}
                    </td>
                  )}
                  <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: 800, color: '#000' }} className={disabled ? "" : "spreadsheet-cell"}>
                    {disabled ? (
                      formatWithCommas(item.quantity)
                    ) : (
                      <input 
                        type="text" 
                        className="spreadsheet-input"
                        disabled={disabled}
                        value={formatWithCommas(item.quantity)}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        style={{ 
                          textAlign: 'center', 
                          fontSize: '0.85rem', 
                          fontWeight: 800, 
                          color: isQtyInvalid ? '#ef4444' : 'var(--text-main)',
                          backgroundColor: isQtyInvalid ? '#fef2f2' : 'transparent',
                          border: isQtyInvalid ? '1.5px solid #ef4444' : 'none',
                          boxSizing: 'border-box',
                          height: '100%',
                          width: '100%',
                          padding: '0 1rem'
                        }}
                      />
                    )}
                  </td>
                  {showFulfillment && (
                    <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: '#f8fafc' }}>
                      {formatWithCommas(item.shippedQty || 0)}
                    </td>
                  )}
                  {showFulfillment && (
                    <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: '#f8fafc' }}>
                      {formatWithCommas(item.invoicedQty || 0)}
                    </td>
                  )}
                  {showPricing && (
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: '#000' }}>
                      {parseFloat(item.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  {!disabled && !lockLines && (
                    <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', textAlign: 'center' }}>
                      <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }} onMouseEnter={e => e.currentTarget.style.color='var(--error)'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {/* Empty Interaction Row */}
            {!disabled && !lockLines && (
              <tr style={{ height: '2.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={addItem} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(37, 99, 235, 0.03)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                {!disabled && !lockLines && <td style={{ borderBottom: '1px solid var(--border-color)' }}></td>}
                <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}><Plus size={14} color="#cbd5e1" style={{ margin: '0 auto' }} /></td>
                <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Click here to add another line...</td>
                {showPricing && <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)' }}>0.00</td>}
                <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>0</td>
                {showFulfillment && <td style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}></td>}
                {showFulfillment && <td style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}></td>}
                {showPricing && <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>0.00</td>}
                <td style={{ borderBottom: '1px solid var(--border-color)' }}></td>
              </tr>
            )}
          </tbody>
          <tfoot style={{ borderTop: '2px solid var(--border-color)', backgroundColor: '#fff' }}>
            <tr style={{ fontWeight: 800, height: '2.25rem' }}>
              <td colSpan={labelColSpan} style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Document Totals:</td>
              {showPricing && (
                <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{items.filter(i => i.productId).length} Line(s)</td>
              )}
              <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: '#000' }}>{totalQty.toLocaleString()}</td>
              {showFulfillment && <td></td>}
              {showFulfillment && <td></td>}
              {showPricing && (
                <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '1rem', color: '#000' }}>
                  {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              )}
              {!disabled && !lockLines && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
