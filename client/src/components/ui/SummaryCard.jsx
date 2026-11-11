import React from 'react';

const TONES = {
  blue: { bg: '#eff6ff', color: '#2563eb' },
  green: { bg: '#f0fdf4', color: '#16a34a' },
  red: { bg: '#fef2f2', color: '#dc2626' },
  pink: { bg: '#fdf2f8', color: '#db2777' },
  violet: { bg: '#f5f3ff', color: '#7c3aed' },
  amber: { bg: '#fff7ed', color: '#c2410c' }
};

/** Summary tile copied from Profit & Loss and the VAT report. */
export default function SummaryCard({ label, value, icon: Icon, tone = 'blue', valueColor }) {
  const toneStyle = TONES[tone] || TONES.blue;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: valueColor || '#1e293b', lineHeight: 1.1 }}>{value}</span>
      </div>
      {Icon && (
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: toneStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: toneStyle.color, flexShrink: 0 }}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}
