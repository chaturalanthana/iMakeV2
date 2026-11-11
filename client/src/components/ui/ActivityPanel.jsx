import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function ActivityPanel({ entity, entityId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entityId) return undefined;
    let cancelled = false;
    setLoading(true);
    axios.get('/api/audit', {
      params: { entity, entityId, page: 1, pageSize: 50 },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then((res) => {
      if (!cancelled) setRows(res.data.items || res.data || []);
    }).catch(() => {
      if (!cancelled) setRows([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entity, entityId]);

  if (!entityId) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Save the document to see its history.</p>;
  }
  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading history...</p>;
  }
  if (!rows.length) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activity yet.</p>;
  }

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>When</th>
            <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
            <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{new Date(row.createdAt).toLocaleString()}</td>
              <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>{row.action}</td>
              <td style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'normal' }}>
                {JSON.stringify(row.after || row.before || {})}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
