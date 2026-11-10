import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown } from 'lucide-react';

export default function WarehouseSearchDropdown({ 
  warehouses = [], 
  value, 
  onChange, 
  placeholder = "Search or select warehouse...",
  disabled = false,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredWarehouses = useMemo(() => {
    if (!searchTerm) return warehouses;
    const s = searchTerm.toLowerCase();
    return warehouses.filter(w => 
      w.name?.toLowerCase().includes(s) || 
      w.code?.toLowerCase().includes(s)
    );
  }, [warehouses, searchTerm]);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownEl = dropdownRef.current;
      const dHeight = dropdownEl ? dropdownEl.offsetHeight : 400;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUpward = spaceBelow < dHeight && spaceAbove > spaceBelow;

      setCoords({
        top: shouldOpenUpward
          ? rect.top + window.scrollY - dHeight - 8
          : rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 400)
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
  }, [isOpen, filteredWarehouses]);

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
      {/* Trigger */}
      <div 
        ref={triggerRef}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{ 
          position: 'relative', 
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0.65rem 0.85rem',
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          backgroundColor: disabled ? '#f8fafc' : '#fff',
          opacity: disabled ? 0.7 : 1,
          ...style.wrapper
        }}
      >
        <input
          type="text"
          readOnly
          value={value || ''}
          placeholder={placeholder}
          style={{ 
            width: '100%', 
            cursor: disabled ? 'not-allowed' : 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.9rem',
            pointerEvents: 'none',
            ...style.input
          }}
        />
        <ChevronDown 
          size={16} 
          style={{ 
            position: 'absolute', 
            right: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }} 
        />
      </div>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: coords.top + 'px',
            left: coords.left + 'px',
            width: coords.width + 'px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-color)',
            zIndex: 20000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '400px',
            visibility: coords.top === 0 ? 'hidden' : 'visible'
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Search Header */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                autoFocus
                type="text"
                placeholder="Search warehouses by name or code..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoComplete="off"
                style={{ 
                  width: '100%', 
                  padding: '0.6rem 1rem 0.6rem 2.2rem', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Table Content */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 2 }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', width: '80px' }}>
                    Code
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                    Warehouse Name
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No warehouses found matching "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((warehouse, idx) => (
                    <tr 
                      key={warehouse.id || idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(warehouse.name, warehouse);
                        setIsOpen(false);
                      }}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {warehouse.code}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {warehouse.name}
                      </td>
                    </tr>
                  ))
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
