import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import PageSkeleton from '../../components/ui/PageSkeleton';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../context/ToastContext';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Losses() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/production/losses', auth())
      .then((res) => setRows(res.data || []))
      .catch((error) => showToast(error.response?.data?.error || 'Could not load losses', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Abnormal losses" icon={AlertTriangle}>
      <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
        Scrap above the product-line tolerance waits in Approvals. Kamani posts it to the abnormal loss account. This list is the history.
      </p>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Work order', accessor: 'workOrder', fontWeight: 600, render: (row) => row.workOrder?.orderNumber || '—' },
            { header: 'Line', accessor: 'productLine' },
            { header: 'Scrap %', accessor: 'actualScrapPercent' },
            { header: 'Limit %', accessor: 'threshold' },
            { header: 'Amount', accessor: 'amount', align: 'right', render: (row) => money(row.amount) },
            { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> }
          ]}
          data={rows}
          searchKeys={['productLine', 'status']}
          searchPlaceholder="Search losses..."
          noDataMessage="No abnormal losses."
        />
      )}
    </AppLayout>
  );
}
