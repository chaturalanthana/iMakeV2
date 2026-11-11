import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageSkeleton from '../components/ui/PageSkeleton';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/ui/StatusBadge';
import { Bell } from 'lucide-react';

const LABELS = {
  MATERIAL_SHORTAGE: 'Material shortage',
  WORKSTATION_OVERLOAD: 'Overload',
  OVERDUE_PURCHASE_ORDER: 'Overdue purchase',
  OVERDUE_SALES_ORDER: 'Overdue sales',
  OVERDUE_WORK_ORDER: 'Overdue work order',
  CREDIT_LIMIT: 'Credit limit',
  PENDING_APPROVAL: 'Approval',
  LOW_STOCK: 'Low stock'
};

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/alerts', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((res) => setAlerts(res.data.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  const rows = alerts.map((alert) => ({
    ...alert,
    typeLabel: LABELS[alert.type] || alert.type
  }));

  return (
    <AppLayout title="Alerts" icon={Bell}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={[
            { header: 'Type', accessor: 'typeLabel', fontWeight: 600 },
            { header: 'Title', accessor: 'title' },
            { header: 'Detail', accessor: 'detail', color: 'var(--text-muted)' },
            {
              header: 'Severity',
              accessor: 'severity',
              render: (row) => <StatusBadge status={row.severity} />
            }
          ]}
          data={rows}
          searchKeys={['typeLabel', 'title', 'detail']}
          searchPlaceholder="Search alerts..."
          noDataMessage="Nothing needs attention."
          onRowClick={(row) => row.href && navigate(row.href)}
        />
      )}
    </AppLayout>
  );
}
