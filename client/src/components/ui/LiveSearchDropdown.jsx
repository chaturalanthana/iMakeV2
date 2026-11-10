import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, CornerDownRight } from 'lucide-react';

export default function LiveSearchDropdown({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select...", 
  allowCustom = false,
  columns = null,
  disabled = false,
  style = {},
  onAddNew = null,
  addNewLabel = 'Add New +',
  invalid = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const wrapperRef = useRef(null);

  // Safely normalize options and preserve extra properties
  const normalizedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map(opt => {
      if (typeof opt === 'string') return { label: opt, value: opt };
      if (opt && typeof opt === 'object') {
        return { 
          ...opt,
          label: String(opt.label || ''), 
          value: opt.value 
        };
      }
      return { label: '', value: '' };
    });
  }, [options]);

  // Sync external value changes to display label
  useEffect(() => {
    if (!isOpen) {
      if (value) {
         const matchedOpt = normalizedOptions.find(o => o.value === value);
         setSearchTerm(matchedOpt ? matchedOpt.label : String(value));
      } else {
         setSearchTerm('');
      }
      setIsSearching(false);
    }
  }, [value, isOpen, normalizedOptions]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsSearching(false);
        if (!allowCustom) {
          // If custom free-text is not allowed, revert to matched label
          const matchedOpt = normalizedOptions.find(o => o.value === value);
          setSearchTerm(matchedOpt ? matchedOpt.label : (value ? String(value) : ''));
        } else {
          // If custom free-text is allowed, commit the typed text as value
          if (searchTerm !== value) {
            onChange(searchTerm);
          }
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, searchTerm, allowCustom, onChange, normalizedOptions]);

  const safeSearchTerm = String(searchTerm || '').toLowerCase();
  
  const matchedOpt = normalizedOptions.find(o => o.value === value);
  const isDefaultSearch = matchedOpt && searchTerm === matchedOpt.label;

  const filteredOptions = normalizedOptions.filter(opt => {
    if (!isSearching || isDefaultSearch || !searchTerm) return true;
    return opt && opt.label && opt.label.toLowerCase().includes(safeSearchTerm);
  });

  const handleSelect = (optionValue, optionLabel) => {
    setSearchTerm(optionLabel);
    setIsOpen(false);
    setIsSearching(false);
    if (onChange) onChange(optionValue);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    const internalVal = val.replaceAll(' / ', ' > ').replaceAll('/', '>');
    setSearchTerm(internalVal);
    setIsOpen(true);
    setIsSearching(true);
    if (allowCustom) {
      if (onChange) onChange(internalVal);
    } else if (val === '') {
      if (onChange) onChange(''); // Allow clearing out
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form from prematurely submitting!
      if (isOpen) {
        if (filteredOptions.length > 0 && !allowCustom) {
          handleSelect(filteredOptions[0].value, filteredOptions[0].label);
        } else {
          setIsOpen(false);
        }
      }
    }
  };

  const displayValue = useMemo(() => {
    return searchTerm ? searchTerm.replaceAll(' > ', ' / ') : '';
  }, [searchTerm]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: style.width || '100%', zIndex: isOpen ? 50 : 'auto', ...style.wrapper }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={(e) => { 
            if (disabled) return;
            setIsOpen(true); 
            setIsSearching(false); 
            e.target.select(); 
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`input-field${invalid ? ' field-invalid' : ''}`}
          style={{ width: '100%', paddingRight: '36px', ...style.input }}
          autoComplete="off"
        />
        <ChevronDown 
          size={18} 
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} 
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          minWidth: columns ? '450px' : '100%',
          width: 'max-content',
          maxWidth: '650px',
          right: columns ? 'auto' : 0,
          marginTop: '4px',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          zIndex: 50,
          ...style.dropdown
        }}>
          <div style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden', minWidth: '100%' }}>
            {filteredOptions.length > 0 ? (
              columns ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
                      {columns.map((col, idx) => (
                        <th 
                          key={idx} 
                          style={{ 
                            padding: '8px 12px', 
                            fontWeight: 600, 
                            color: '#475569', 
                            fontSize: '0.75rem', 
                            textTransform: 'uppercase',
                            width: col.width || 'auto'
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOptions.map((opt, i) => (
                      <tr 
                        key={i}
                        onClick={() => handleSelect(opt.value, opt.label)}
                        style={{
                          cursor: 'pointer',
                          borderBottom: i !== filteredOptions.length - 1 ? '1px solid #f1f5f9' : 'none',
                          backgroundColor: value === opt.value ? 'var(--accent-light)' : 'transparent',
                          color: value === opt.value ? 'var(--accent)' : 'var(--text-main)',
                          transition: 'background 0.2s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseOver={(e) => { if(value !== opt.value) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                        onMouseOut={(e) => { if(value !== opt.value) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        {columns.map((col, idx) => (
                          <td key={idx} style={{ padding: '10px 12px' }}>
                            {opt[col.key] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                filteredOptions.map((opt, i) => (
                  <div 
                    key={i}
                    onClick={() => handleSelect(opt.value, opt.label)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      borderBottom: i !== filteredOptions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      backgroundColor: value === opt.value ? 'var(--accent-light)' : 'transparent',
                      color: value === opt.value ? 'var(--accent)' : 'var(--text-main)',
                      transition: 'background 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => { if(value !== opt.value) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                    onMouseOut={(e) => { if(value !== opt.value) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {(() => {
                      if (opt.label && opt.label.includes(' > ')) {
                        const parts = opt.label.split(' > ');
                        const leaf = parts[parts.length - 1];
                        const path = parts.slice(0, parts.length - 1).join(' / ');
                        const depth = parts.length - 1;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: `${depth * 14}px` }}>
                            <CornerDownRight size={14} style={{ color: '#94a3b8', marginRight: '2px', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>{leaf}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 400 }}>in {path}</span>
                          </div>
                        );
                      }
                      return opt.label;
                    })()}
                  </div>
                ))
              )
            ) : (
              <div style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                {allowCustom ? 'Press Enter to create new' : 'No options found'}
              </div>
            )}
          </div>
          {onAddNew && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setIsOpen(false);
                setIsSearching(false);
                onAddNew();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                border: 'none',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            >
              <span>{addNewLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
