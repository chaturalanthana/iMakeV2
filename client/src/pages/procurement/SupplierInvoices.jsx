import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ActionButton from '../../components/ui/ActionButton';
import StatusBadge from '../../components/ui/StatusBadge';
import { FileText, Plus } from 'lucide-react';

export default function SupplierInvoices() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
        const res = await axios.get('/api/procurement/supplier-invoices', config);
        setRows((res.data || []).map((row) => ({
          ...row,
          supplierName: row.supplier?.name || ''
        })));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = [
    { header: 'Date', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
    { header: 'Invoice', accessor: 'invoiceNumber', fontWeight: 600 },
    { header: 'Supplier ref', accessor: 'supplierReference', render: (row) => row.supplierReference || '-' },
    { header: 'Supplier', accessor: 'supplierName' },
    { header: 'Status', accessor: 'status', render: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Total',
      accessor: 'total',
      align: 'right',
      render: (row) => `Rs ${Number(row.total || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  ];

  return (
    <AppLayout title="Supplier Invoices" icon={FileText}>
      {loading ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search supplier invoices..."
          searchKeys={['invoiceNumber', 'supplierName', 'supplierReference', 'status']}
          onRowClick={(row) => navigate(`/procurement/supplier-invoices/${row.id}`)}
          noDataMessage="No supplier invoices found."
          extraActions={(
            <ActionButton icon={Plus} onClick={() => navigate('/procurement/supplier-invoices/new')}>
              New Invoice
            </ActionButton>
          )}
        />
      )}
    </AppLayout>
  );
}
