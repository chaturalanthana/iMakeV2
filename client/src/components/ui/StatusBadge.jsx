import React from 'react';

const COLORS = {
  PENDING: '#d97706',
  PENDING_APPROVAL: '#d97706',
  RETURNED: '#d97706',
  SOFT_CLOSED: '#d97706',
  REJECTED: '#dc2626',
  REVERSED: '#dc2626',
  CREATED: '#475569',
  DRAFT: '#64748b',
  CONFIRMED: '#0369a1',
  RELEASED: '#0369a1',
  PROCESSING: '#7c3aed',
  IN_PROGRESS: '#7c3aed',
  WIP: '#7c3aed',
  TECO: '#d97706',
  DELIVERED: '#059669',
  SHIPPED: '#059669',
  CLOSED: '#059669',
  COMPLETE: '#059669',
  COMPLETED: '#059669',
  POSTED: '#059669',
  RECEIVED: '#059669',
  MATCHED: '#059669',
  PAID: '#059669',
  ACTIVE: '#059669',
  OPEN: '#0369a1',
  APPROVED: '#059669',
  MATCHED_WITH_VARIANCE: '#d97706',
  PARTIAL: '#d97706',
  WARNING: '#d97706',
  MEDIUM: '#d97706',
  HIGH: '#dc2626',
  OVERLOAD: '#dc2626',
  CANCELLED: '#dc2626',
  INACTIVE: '#dc2626',
  LOW: '#0369a1',
  BLOCK: '#dc2626',
  WARN: '#d97706',
  MANUAL: '#475569',
  BACKFLUSH: '#0369a1'
};

export default function StatusBadge({ status, label }) {
  const key = String(status || '').toUpperCase().replace(/\s+/g, '_');
  const color = COLORS[key] || 'var(--text-main)';
  const text = label || String(status || '').replace(/_/g, ' ');
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 700, color, letterSpacing: '0.01em' }}>
      {String(text).toUpperCase()}
    </span>
  );
}
