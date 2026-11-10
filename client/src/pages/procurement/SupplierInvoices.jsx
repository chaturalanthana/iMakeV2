import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
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
        setRows(res.data);
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
    { header: 'Supplier', accessor: 'supplier', render: (row) => row.supplier?.name },
    { header: 'Status', accessor: 'status' },
    {
      header: 'Total',
      accessor: 'total',
      align: 'right',
      render: (row) => `Rs ${Number(row.total || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  ];

  return (
    <AppLayout title="Supplier Invoices" icon={FileText}>
      {loading ? <PageSkeleton /> : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search supplier invoices..."
          searchKeys={['invoiceNumber', 'supplier.name', 'supplierReference']}
          onRowClick={(row) => navigate(`/procurement/supplier-invoices/${row.id}`)}
          extraActions={(
            <button onClick={() => navigate('/procurement/supplier-invoices/new')} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={16} /> New Invoice
            </button>
          )}
        />
      )}
    </AppLayout>
  );
}
