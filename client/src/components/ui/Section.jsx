import React from 'react';

/** White report panel used by stock ledger, VAT breakdowns, and profit-and-loss sheets. */
export default function Section({ title, icon: Icon, children, padded = false, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', ...style }}>
      {title && (
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {Icon && <Icon size={18} color="var(--accent)" />}
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
        </div>
      )}
      <div style={padded ? { padding: '1.25rem 1.5rem' } : undefined}>{children}</div>
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      {children}
    </div>
  );
}
