import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  type = 'danger',
  children
}) {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const accentColor = isDanger ? 'var(--error, #ef4444)' : 'var(--accent, #3b82f6)';
  const hoverColor = isDanger ? '#dc2626' : 'var(--accent-secondary, #2563eb)';

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '400px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', position: 'relative' }}>
          <button 
            onClick={onClose}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ 
              backgroundColor: isDanger ? '#fee2e2' : '#dbeafe', 
              color: accentColor, 
              padding: '0.6rem', 
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertCircle size={22} />
            </div>
            <div style={{ flex: 1, marginTop: '0.25rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {title}
              </h3>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {message}
              </p>
              {children}
            </div>
          </div>
        </div>
        <div style={{ 
          padding: '1.25rem 1.5rem', 
          backgroundColor: '#f8fafc', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.75rem',
          borderTop: '1px solid var(--border-color)'
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#fff',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: accentColor,
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = hoverColor}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = accentColor}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </div>,
    document.body
  );
}
