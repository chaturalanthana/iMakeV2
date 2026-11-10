import React from 'react';
import { X, Printer, Download } from 'lucide-react';

export default function OrderPrintModal({ isOpen, onClose, order }) {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatWithCommas = (val) => {
    if (val === null || val === undefined) return '0.00';
    let s = val.toString();
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts.length === 1) parts.push('00');
    else if (parts[1].length === 1) parts[1] += '0';
    return parts.join('.');
  };

  const calculateTotal = () => {
    return order.items?.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0) || 0;
  };

  return (
    <>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-container, .print-container * {
              visibility: visible;
            }
            .print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
              box-shadow: none;
              border: none;
            }
            @page { margin: 0.5cm; }
          }
        `}
      </style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
        
        {/* Modal Window */}
        <div style={{ width: '900px', maxWidth: '95vw', height: '90vh', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          
          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.1rem' }}>
              <ShoppingCartIcon style={{ color: 'var(--accent)' }} /> 
              Sales Order Preview <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'normal' }}>({order.orderNumber})</span>
            </h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>
                <Printer size={16} /> Print / Save as PDF
              </button>
              <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* PDF Viewer Canvas Area (A4 specific layout) */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1.5rem', display: 'flex', justifyContent: 'center', backgroundColor: '#94a3b8' }}>
            <div className="print-container" style={{ width: '100%', maxWidth: '210mm', boxSizing: 'border-box', minHeight: '297mm', backgroundColor: '#fff', padding: '12mm 15mm', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', flexShrink: 0, color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
              
              {/* Document Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--accent)', fontWeight: 800, letterSpacing: '-0.02em' }}>SALES ORDER</h1>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>#{order.orderNumber}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 800 }}>iMake</h2>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Business District, Tower A<br/>finance@imake.com<br/>+1 (555) 019-2837</p>
                </div>
              </div>

              {/* Document Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order For</h4>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: 700 }}>{order.customer?.name || order.customerName || 'Walk-in Customer'}</h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                     {order.customer?.address || 'Address provided upon fulfillment.'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date of Issue</h4>
                  <p style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>{new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', fontSize: '0.8rem', color: '#334155', textTransform: 'uppercase' }}>Description / Item</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem', color: '#334155', textTransform: 'uppercase', width: '15%' }}>Qty</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', fontSize: '0.8rem', color: '#334155', textTransform: 'uppercase', width: '20%' }}>Unit Price</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', fontSize: '0.8rem', color: '#334155', textTransform: 'uppercase', width: '25%' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', color: '#0f172a', fontWeight: 500, fontSize: '0.9rem' }}>
                        {item.product?.name || item.productName || `Item #${item.productId}`}
                      </td>
                      <td style={{ padding: '1rem', color: '#475569', textAlign: 'center', fontSize: '0.9rem' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '1rem', color: '#475569', textAlign: 'right', fontSize: '0.9rem' }}>
                        ${formatWithCommas(item.unitPrice)}
                      </td>
                      <td style={{ padding: '1rem', color: '#0f172a', textAlign: 'right', fontWeight: '600', fontSize: '0.95rem' }}>
                        ${formatWithCommas(item.total)}
                      </td>
                    </tr>
                  ))}
                  {(!order.items || order.items.length === 0) && (
                     <tr>
                        <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No items listed properly.</td>
                     </tr>
                  )}
                </tbody>
              </table>

              {/* Totals Box */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4rem' }}>
                <div style={{ width: '40%', backgroundColor: '#f8fafc', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Subtotal</span>
                    <span style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 600 }}>${formatWithCommas(calculateTotal())}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #cbd5e1' }}>
                    <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Tax / VAT</span>
                    <span style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 600 }}>$0.00</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                    <span style={{ color: 'var(--accent)', fontSize: '1.1rem', fontWeight: 800 }}>Total Due</span>
                    <span style={{ color: 'var(--accent)', fontSize: '1.1rem', fontWeight: 800 }}>${formatWithCommas(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 'auto', borderTop: '2px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'center', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                  Generated by iMake • {new Date().toLocaleDateString()}
                </p>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ShoppingCartIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
  );
}
