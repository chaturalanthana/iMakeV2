import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, subtitle, icon: Icon, children, maxWidth = '650px', overflow = 'hidden' }) {
  if (!isOpen) return null;

  return createPortal(
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(15, 23, 42, 0.4)', 
      backdropFilter: 'blur(8px)', 
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 9999 
    }}>
      <div style={{ 
        backgroundColor: '#ffffff', borderRadius: '16px', width: '90%', 
        maxWidth: maxWidth, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '1px solid var(--border-color)', overflow,
        animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        {/* Modal Header */}
        <div style={{ 
          padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: overflow === 'visible' ? '16px' : 0,
          borderTopRightRadius: overflow === 'visible' ? '16px' : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {Icon && (
              <div style={{
                width: '38px', height: '38px', borderRadius: '8px',
                backgroundColor: 'var(--accent-light, rgba(37, 99, 235, 0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)'
              }}>
                <Icon size={20} />
              </div>
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ 
            background: '#f1f5f9', border: 'none', cursor: 'pointer', 
            color: 'var(--text-muted)', width: '32px', height: '32px', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
            <X size={18} />
          </button>
        </div>
        
        {children}
      </div>
      <style>
        {`
          @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}
      </style>
    </div>,
    document.body
  );
}
