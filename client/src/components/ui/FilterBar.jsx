import React from 'react';

/**
 * Filter bar copied from the stock ledger card and the profit-and-loss date row.
 * variant="card"  — white panel, 1.5rem padding, 12px radius, 2rem gap (Stock Ledger).
 * variant="inline" — border-bottom toolbar with the action on the right (P&L, VAT).
 */
export default function FilterBar({ children, actions, variant = 'card', style = {} }) {
  if (variant === 'inline') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.5rem',
        ...style
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {children}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '2rem',
      marginBottom: '1.5rem',
      backgroundColor: '#fff',
      padding: '1.5rem',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      alignItems: 'flex-end',
      ...style
    }}>
      {children}
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}
