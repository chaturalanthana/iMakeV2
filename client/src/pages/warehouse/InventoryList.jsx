import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
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
      { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
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
      { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
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
      { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
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
      { header: 'Finance', accessor: 'financeStatus', render: (row) => <StatusBadge status={row.financeStatus} /> },
      { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
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
    <ActionButton icon={Plus} onClick={() => navigate(`${config.path}/new`)}>{config.button}</ActionButton>
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

