import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { ClipboardList } from 'lucide-react';

export default function Allocations() {
  const [rows, setRows] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/inventory/allocations', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setRows(res.data.map((row) => ({
        ...row,
        code: row.product?.code,
        name: row.product?.name,
        quantity: Number(row.quantity),
        released: Number(row.releasedQty)
      }))))
      .finally(() => setIsInitialLoad(false));
  }, []);

  const columns = [
    { header: 'Item', accessor: 'code', fontWeight: 700 },
    { header: 'Name', accessor: 'name' },
    { header: 'Source', accessor: 'sourceType' },
    { header: 'Kind', accessor: 'kind' },
    { header: 'Qty', accessor: 'quantity' },
    { header: 'Released', accessor: 'released' },
    { header: 'Status', accessor: 'status', render: (row) => <span style={{ fontSize: '0.75rem', fontWeight: 700, color: row.status === 'OPEN' ? '#d97706' : '#059669' }}>{row.status}</span> }
  ];

  return (
    <AppLayout title="Allocations" icon={ClipboardList}>
      {isInitialLoad ? <PageSkeleton type="table" /> : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search by item or source..." searchKeys={['code', 'name', 'sourceType', 'kind', 'status']} />
      )}
    </AppLayout>
  );
}
