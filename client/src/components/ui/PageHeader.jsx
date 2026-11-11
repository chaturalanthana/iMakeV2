import React from 'react';
import { ArrowLeft } from 'lucide-react';

/** Document page header copied from Goods Receipt: back button, 1.5rem title, actions on the right. */
export default function PageHeader({ onBack, title, subtitle, extra, actions }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '0.75rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid var(--border-color)',
      gap: '1rem',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            {title}
          </h2>
          {(subtitle || extra) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {subtitle && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>}
              {extra}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
