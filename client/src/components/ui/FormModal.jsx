import React from 'react';
import Modal from './Modal';

const cancelStyle = {
  background: '#f8fafc',
  color: '#64748b',
  border: '1px solid #e2e8f0',
  padding: '0.65rem 1.5rem',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem'
};

const submitStyle = {
  padding: '0.65rem 2rem',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
  color: '#ffffff'
};

/**
 * Modal form shell copied from Payment Terms: padded body, 1.25rem field stack,
 * footer rule, Cancel on the left of the gradient submit.
 */
export default function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  children,
  maxWidth = '650px',
  busy = false
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} icon={icon} maxWidth={maxWidth}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit?.(event);
        }}
        style={{ padding: '1.75rem' }}
        autoComplete="off"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {children}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={onClose}
            style={cancelStyle}
            onMouseEnter={(event) => { event.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={(event) => { event.currentTarget.style.background = '#f8fafc'; }}
          >
            {cancelLabel}
          </button>
          <button type="submit" disabled={busy} style={{ ...submitStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
