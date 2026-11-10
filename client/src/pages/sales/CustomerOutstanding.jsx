import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { FileText, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CustomerOutstanding() {
  const { showToast } = useToast();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => {
    fetchAgingReport();
  }, []);

  const fetchAgingReport = async () => {
    setLoading(true);
    try {
      const [customersRes, invoicesRes] = await Promise.all([
        axios.get('/api/customers', authConfig()),
        axios.get('/api/sales/invoices', authConfig())
      ]);

      const customers = customersRes.data;
      const invoices = invoicesRes.data;

      // Group outstanding balances by customer and age bucket
      const today = new Date();
      const customerMap = {};

      customers.forEach(c => {
        customerMap[c.id] = {
          id: c.id,
          customerName: `${c.code} - ${c.name}`,
          outstanding: 0,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          days120: 0
        };
      });

      invoices.forEach(inv => {
        // Only process unpaid or partially paid invoices
        const total = parseFloat(inv.total || 0);
        const paid = parseFloat(inv.amountPaid || 0);
        const outstanding = total - paid;

        if (outstanding <= 0.01) return; // fully paid

        const invDate = new Date(inv.date);
        const ageInDays = Math.floor((today - invDate) / (1000 * 60 * 60 * 24));

        let bucket = 'current';
        if (ageInDays > 120) {
          bucket = 'days120';
        } else if (ageInDays > 90) {
          bucket = 'days90';
        } else if (ageInDays > 60) {
          bucket = 'days60';
        } else if (ageInDays > 30) {
          bucket = 'days30';
        }

        // If customer is not in map (e.g. deleted customer but legacy invoice exists)
        if (!customerMap[inv.customerId]) {
          customerMap[inv.customerId] = {
            id: inv.customerId,
            customerName: inv.customer?.name || 'Legacy Customer',
            outstanding: 0,
            current: 0,
            days30: 0,
            days60: 0,
            days90: 0,
            days120: 0
          };
        }

        customerMap[inv.customerId].outstanding += outstanding;
        customerMap[inv.customerId][bucket] += outstanding;
      });

      // Convert map to list and filter out customers with 0 outstanding
      const list = Object.values(customerMap).filter(c => c.outstanding > 0.01);
      setReportData(list);
    } catch (error) {
      console.error('Failed to generate outstanding report:', error);
      showToast('Error generating outstanding report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return '$' + parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const columns = [
    {
      header: 'Customer',
      accessor: 'customerName',
      width: '30%',
      fontWeight: 600
    },
    {
      header: 'Outstanding',
      accessor: 'outstanding',
      width: '12%',
      align: 'right',
      render: (row) => formatCurrency(row.outstanding)
    },
    {
      header: 'Current',
      accessor: 'current',
      width: '11%',
      align: 'right',
      render: (row) => formatCurrency(row.current)
    },
    {
      header: '30 Days',
      accessor: 'days30',
      width: '11%',
      align: 'right',
      render: (row) => formatCurrency(row.days30)
    },
    {
      header: '60 Days',
      accessor: 'days60',
      width: '11%',
      align: 'right',
      render: (row) => formatCurrency(row.days60)
    },
    {
      header: '90 Days',
      accessor: 'days90',
      width: '11%',
      align: 'right',
      render: (row) => formatCurrency(row.days90)
    },
    {
      header: '120+',
      accessor: 'days120',
      width: '14%',
      align: 'right',
      render: (row) => formatCurrency(row.days120)
    }
  ];

  const extraActions = (
    <button 
      onClick={() => window.print()}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
    >
      <Printer size={14} /> Print Report
    </button>
  );

  return (
    <AppLayout title="Customer Outstanding Report" icon={FileText}>
      {loading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={reportData}
          loading={loading}
          searchPlaceholder="Search customer..."
          searchKeys={['customerName']}
          itemsPerPage={15}
          extraActions={extraActions}
          noDataMessage="No outstanding customer balances found."
        />
      )}
    </AppLayout>
  );
}
