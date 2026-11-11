import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DataTable from './DataTable';
import StatusBadge from './StatusBadge';

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

  return (
    <DataTable
      columns={[
        { header: 'When', accessor: 'createdAt', render: (row) => new Date(row.createdAt).toLocaleString() },
        { header: 'Action', accessor: 'action', render: (row) => <StatusBadge status={row.action} /> },
        { header: 'Change', accessor: 'after', render: (row) => JSON.stringify(row.after || row.before || {}) }
      ]}
      data={rows}
      loading={loading}
      searchKeys={[]}
      noDataMessage="No activity yet."
    />
  );
}
