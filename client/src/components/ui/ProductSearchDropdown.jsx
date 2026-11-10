import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown } from 'lucide-react';

export default function ProductSearchDropdown({ 
  products = [], 
  value, 
  onChange, 
  placeholder = "Search product...",
  className = "",
  style = {},
  hideCost = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const s = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(s) || 
      p.code?.toLowerCase().includes(s)
    );
  }, [products, searchTerm]);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownEl = dropdownRef.current;
      const dHeight = dropdownEl ? dropdownEl.offsetHeight : 370;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUpward = spaceBelow < dHeight && spaceAbove > spaceBelow;

      setCoords({
        top: shouldOpenUpward
          ? rect.top + window.scrollY - dHeight - 8
          : rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, hideCost ? 480 : 600)
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen, filteredProducts]);

  useEffect(() => {
    function handleClickOutside(event) {
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(event.target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target);
      
      if (isOutsideWrapper && isOutsideDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ width: '100%' }}>
      {/* Trigger Input */}
      <div 
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ 
          position: 'relative', 
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          ...style.wrapper
        }}
      >
        <input
          type="text"
          readOnly
          className={className}
          value={value || ''}
          placeholder={placeholder}
          style={{ 
            width: '100%', 
            cursor: disabled ? 'not-allowed' : 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.9rem',
            padding: '0.25rem 0',
            pointerEvents: 'none',
            ...style.input
          }}
        />
        <ChevronDown 
          size={16} 
          style={{ 
            position: 'absolute', 
            right: '0px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-muted)',
            opacity: 0.5
          }} 
        />
      </div>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: hideCost ? '560px' : '700px', // Wider table view
            backgroundColor: '#fff',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            zIndex: 9999,
            overflow: 'hidden',
            visibility: coords.top === 0 ? 'hidden' : 'visible'
          }}
        >
          {/* Inner Search Bar */}
          <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                autoFocus
                placeholder="Search by code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Table View */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Code</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>UOM</th>
                  {!hideCost && <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Cost</th>}
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Pack Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <tr 
                      key={product.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Fire immediately and stop focus shift
                        onChange(product);
                        setIsOpen(false);
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        borderBottom: '1px solid #f8fafc',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{product.code}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 700 }}>{product.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{product.uom?.name || '-'}</td>
                      {!hideCost && (
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 700, textAlign: 'right' }}>
                          {parseFloat(product.standardCost || product.costPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {product.packSize || '1'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={hideCost ? "4" : "5"} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                      No matching products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
