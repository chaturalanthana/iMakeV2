import React from 'react';

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
    border: 'none',
    color: '#ffffff'
  },
  submit: {
    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
    border: 'none',
    color: '#ffffff',
    fontWeight: 700,
    padding: '0.5rem 1.5rem',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
  },
  secondary: {
    backgroundColor: '#fff',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)'
  },
  discard: {
    background: '#fff',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    padding: '0.5rem 1.25rem'
  },
  ghost: {
    background: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0'
  },
  danger: {
    background: '#fee2e2',
    color: '#ef4444',
    border: '1px solid #fca5a5'
  }
};

export function actionButtonStyle(variant = 'primary', disabled = false, extra = {}) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    padding: '0.55rem 1.25rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s',
    opacity: disabled ? 0.7 : 1,
    lineHeight: 1.2,
    ...(VARIANTS[variant] || VARIANTS.primary),
    ...extra
  };
}

export default function ActionButton({
  variant = 'primary',
  icon: Icon,
  children,
  disabled = false,
  type = 'button',
  style = {},
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={actionButtonStyle(variant, disabled, style)}
      onMouseEnter={(event) => {
        if (!disabled && (variant === 'primary' || variant === 'submit')) event.currentTarget.style.opacity = '0.88';
        if (!disabled && variant === 'danger') event.currentTarget.style.backgroundColor = '#fecaca';
      }}
      onMouseLeave={(event) => {
        if (variant === 'primary' || variant === 'submit') event.currentTarget.style.opacity = disabled ? '0.7' : '1';
        if (variant === 'danger') event.currentTarget.style.backgroundColor = '#fee2e2';
      }}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
