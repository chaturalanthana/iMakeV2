import React from 'react';
import { X, Printer, Truck } from 'lucide-react';

export default function DeliveryPrintModal({ isOpen, onClose, delivery }) {
  if (!isOpen || !delivery) return null;

  const handlePrint = () => {
    window.print();
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
              <Truck style={{ color: 'var(--accent)' }} size={20} /> 
              Delivery Docket Preview <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'normal' }}>({delivery.deliveryNumber})</span>
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
                  <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--accent)', fontWeight: 800, letterSpacing: '-0.02em' }}>DELIVERY DOCKET</h1>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>#{delivery.deliveryNumber}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 800 }}>iMake</h2>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Business District, Tower A<br/>finance@imake.com<br/>+1 (555) 019-2837</p>
                </div>
              </div>

              {/* Document Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deliver To</h4>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: 700 }}>{delivery.customer?.name || delivery.customerName || 'Walk-in Customer'}</h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                     {delivery.customer?.address || 'Address provided upon fulfillment.'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date of Dispatch</h4>
                  <p style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>{new Date(delivery.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', fontSize: '0.8rem', color: '#334155', textTransform: 'uppercase' }}>Description / Item</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem', color: '#334155', textTransform: 'uppercase', width: '20%' }}>Shipped Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', color: '#0f172a', fontWeight: 500, fontSize: '0.9rem' }}>
                        {item.product?.name || item.productName || `Item #${item.productId}`}
                      </td>
                      <td style={{ padding: '1rem', color: '#475569', textAlign: 'center', fontSize: '0.9rem' }}>
                        {item.quantity}
                      </td>
                    </tr>
                  ))}
                  {(!delivery.items || delivery.items.length === 0) && (
                     <tr>
                        <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No items listed properly.</td>
                     </tr>
                  )}
                </tbody>
              </table>

              {/* Signature Box instead of Totals Box */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ width: '40%' }}>
                  <h4 style={{ margin: '0 0 2.5rem 0', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authorized Dispatcher</h4>
                  <div style={{ borderBottom: '1px solid #1e293b', width: '100%' }}></div>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Signature & Date</p>
                </div>
                <div style={{ width: '40%' }}>
                  <h4 style={{ margin: '0 0 2.5rem 0', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Received By</h4>
                  <div style={{ borderBottom: '1px solid #1e293b', width: '100%' }}></div>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Recipient Signature & Date</p>
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
