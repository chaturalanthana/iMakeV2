import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Package, Plus } from 'lucide-react';

const LISTS = {
  mr: {
    title: 'Material Requests',
    path: '/warehouse/material-requests',
    endpoint: '/api/inventory/material-requests',
    button: 'New Request',
    search: 'Search by document or party...',
    keys: ['number', 'requestingParty', 'purpose', 'status'],
    columns: [
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Document', accessor: 'number', fontWeight: 600 },
      { header: 'Party', accessor: 'requestingParty' },
      { header: 'Kind', accessor: 'kind' },
      { header: 'Status', accessor: 'status', render: (row) => <Status value={row.status} /> }
    ]
  },
  transfer: {
    title: 'Goods Transfers',
    path: '/warehouse/goods-transfers',
    endpoint: '/api/inventory/transfers',
    button: 'New Transfer',
    search: 'Search by document...',
    keys: ['number', 'status', 'mode', 'reason'],
    columns: [
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Document', accessor: 'number', fontWeight: 600 },
      { header: 'From', accessor: 'fromWarehouse', render: (row) => row.fromWarehouse?.name || '-' },
      { header: 'To', accessor: 'toWarehouse', render: (row) => row.toWarehouse?.name || '-' },
      { header: 'Mode', accessor: 'mode' },
      { header: 'Status', accessor: 'status', render: (row) => <Status value={row.status} /> }
    ]
  },
  return: {
    title: 'Returns',
    path: '/warehouse/returns',
    endpoint: '/api/inventory/returns',
    button: 'New Return',
    search: 'Search by document or type...',
    keys: ['number', 'kind', 'status', 'reference'],
    columns: [
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Document', accessor: 'number', fontWeight: 600 },
      { header: 'Type', accessor: 'kind' },
      { header: 'Warehouse', accessor: 'warehouse', render: (row) => row.warehouse?.name || '-' },
      { header: 'Status', accessor: 'status', render: (row) => <Status value={row.status} /> }
    ]
  },
  count: {
    title: 'Cycle Counts',
    path: '/warehouse/cycle-counts',
    endpoint: '/api/inventory/cycle-counts',
    button: 'New Count',
    search: 'Search by document...',
    keys: ['number', 'status', 'financeStatus', 'kind'],
    columns: [
      { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
      { header: 'Document', accessor: 'number', fontWeight: 600 },
      { header: 'Warehouse', accessor: 'warehouse', render: (row) => row.warehouse?.name || '-' },
      { header: 'Finance', accessor: 'financeStatus' },
      { header: 'Status', accessor: 'status', render: (row) => <Status value={row.status} /> }
    ]
  }
};

export default function InventoryList({ kind }) {
  const config = LISTS[kind];
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(config.endpoint, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setRows(res.data))
      .catch(() => setRows([]))
      .finally(() => { setLoading(false); setIsInitialLoad(false); });
    setLoading(true);
  }, [kind]);

  const extraActions = (
    <button onClick={() => navigate(`${config.path}/new`)}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      <Plus size={16} /> {config.button}
    </button>
  );

  return (
    <AppLayout title={config.title} icon={Package}>
      {isInitialLoad ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={config.columns}
          data={rows}
          loading={loading}
          searchPlaceholder={config.search}
          searchKeys={config.keys}
          extraActions={extraActions}
          onRowClick={(row) => navigate(`${config.path}/${row.id}`)}
        />
      )}
    </AppLayout>
  );
}

function Status({ value }) {
  const done = ['POSTED', 'FULFILLED', 'RECEIVED', 'APPROVED'].includes(value);
  return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: done ? '#059669' : '#d97706' }}>{value}</span>;
}
