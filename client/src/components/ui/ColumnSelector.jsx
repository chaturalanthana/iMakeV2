import React, { useEffect, useRef, useState } from 'react';
import { Columns3 } from 'lucide-react';

export default function ColumnSelector({ columns, selectedKeys, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const allSelected = columns.length > 0 && columns.every((column) => selectedKeys.includes(column.key));
  const someSelected = selectedKeys.length > 0 && !allSelected;

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const toggleAll = () => {
    if (allSelected) {
      onChange(columns.slice(0, 2).map((column) => column.key));
      return;
    }
    onChange(columns.map((column) => column.key));
  };

  const toggleColumn = (key) => {
    if (selectedKeys.includes(key)) {
      if (selectedKeys.length === 1) return;
      onChange(selectedKeys.filter((item) => item !== key));
      return;
    }
    onChange(columns.map((column) => column.key).filter((item) => selectedKeys.includes(item) || item === key));
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '0.55rem 1rem',
          background: open ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
          border: 'none',
          borderRadius: '8px',
          color: 'var(--accent)',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit'
        }}
      >
        <Columns3 size={16} /> Columns
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: '230px',
          maxHeight: '360px',
          overflowY: 'auto',
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 16px 32px -18px rgba(15, 23, 42, 0.35)',
          zIndex: 40,
          padding: '0.35rem'
        }}>
          <ColumnCheck label="All" checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0.35rem' }} />
          {columns.map((column) => (
            <ColumnCheck
              key={column.key}
              label={column.header}
              checked={selectedKeys.includes(column.key)}
              onChange={() => toggleColumn(column.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnCheck({ label, checked, indeterminate = false, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.55rem',
      padding: '0.42rem 0.55rem',
      borderRadius: '6px',
      fontSize: '0.82rem',
      fontWeight: 600,
      color: 'var(--text-main)',
      cursor: 'pointer'
    }}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}
