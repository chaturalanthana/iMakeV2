import React from 'react';

export const fieldControlStyle = {
  width: '100%',
  height: '42px',
  padding: '0 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
  fontSize: '0.9rem',
  color: 'var(--text-main)',
  fontWeight: 500
};

export const modalControlStyle = {
  width: '100%',
  padding: '0.7rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: '0.9rem',
  backgroundColor: '#fff',
  color: 'var(--text-main)'
};

export function TextControl({ invalid = false, disabled = false, style = {}, ...props }) {
  return (
    <input
      disabled={disabled}
      className={invalid ? 'field-invalid' : undefined}
      style={{
        ...fieldControlStyle,
        backgroundColor: disabled ? '#f1f5f9' : '#fff',
        ...style
      }}
      {...props}
    />
  );
}

export function SelectControl({ invalid = false, disabled = false, style = {}, children, ...props }) {
  return (
    <select
      disabled={disabled}
      className={invalid ? 'field-invalid' : undefined}
      style={{
        ...fieldControlStyle,
        backgroundColor: disabled ? '#f1f5f9' : '#fff',
        ...style
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export default function FormField({
  label,
  required = false,
  error = '',
  hint = '',
  children,
  width,
  icon: Icon,
  variant = 'document',
  style = {}
}) {
  const modal = variant === 'modal';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: modal ? 0 : '0.5rem',
      width: width || undefined,
      minWidth: 0,
      flexBasis: width === '100%' ? '100%' : undefined,
      ...style
    }}>
      {label && (
        <label style={modal ? {
          display: 'block',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--text-main)',
          marginBottom: '0.5rem'
        } : {
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          minHeight: '20px'
        }}>
          {!modal && Icon && <Icon size={14} />}
          {label}
          {required && <span style={{ color: 'var(--error)' }}>*</span>}
        </label>
      )}
      {children}
      {error && <span className="field-error-text">{error}</span>}
      {hint && !error && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}
