import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { FileText, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SupplierOutstanding() {
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
      const [suppliersRes, ordersRes, vouchersRes] = await Promise.all([
        axios.get('/api/suppliers', authConfig()),
        axios.get('/api/procurement/purchase-orders', authConfig()),
        axios.get('/api/finance/payment-vouchers', authConfig())
      ]);

      const suppliers = suppliersRes.data;
      const orders = ordersRes.data;
      const vouchers = vouchersRes.data;

      const today = new Date();
      const supplierMap = {};

      // Initialize map for each supplier
      suppliers.forEach(s => {
        supplierMap[s.id] = {
          id: s.id,
          supplierName: `${s.code} - ${s.name}`,
          outstanding: 0,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          days120: 0,
          ordersList: [],
          totalPaid: 0
        };
      });

      // Sum all payment vouchers for each supplier
      vouchers.forEach(v => {
        if (supplierMap[v.supplierId]) {
          supplierMap[v.supplierId].totalPaid += parseFloat(v.amount || 0);
        }
      });

      // Group active purchase orders (exclude CANCELLED status)
      orders.forEach(order => {
        if (order.status?.toUpperCase() === 'CANCELLED') return;
        const total = parseFloat(order.total || 0);
        if (total <= 0) return;

        if (!supplierMap[order.supplierId]) {
          supplierMap[order.supplierId] = {
            id: order.supplierId,
            supplierName: order.supplier?.name || 'Legacy Supplier',
            outstanding: 0,
            current: 0,
            days30: 0,
            days60: 0,
            days90: 0,
            days120: 0,
            ordersList: [],
            totalPaid: 0
          };
        }

        supplierMap[order.supplierId].ordersList.push({
          id: order.id,
          date: new Date(order.date),
          total: total,
        });
      });

      // Run FIFO allocation for each supplier to calculate aged outstanding
      Object.values(supplierMap).forEach(sup => {
        // Sort orders oldest to newest
        sup.ordersList.sort((a, b) => a.date - b.date);

        let remainingPayments = sup.totalPaid;

        sup.ordersList.forEach(order => {
          let outstandingForOrder = order.total;

          if (remainingPayments >= outstandingForOrder) {
            remainingPayments -= outstandingForOrder;
            outstandingForOrder = 0;
          } else {
            outstandingForOrder -= remainingPayments;
            remainingPayments = 0;
          }

          if (outstandingForOrder <= 0.01) return;

          const ageInDays = Math.floor((today - order.date) / (1000 * 60 * 60 * 24));

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

          sup.outstanding += outstandingForOrder;
          sup[bucket] += outstandingForOrder;
        });
      });

      // Filter out suppliers with no outstanding balances
      const list = Object.values(supplierMap).filter(s => s.outstanding > 0.01);
      setReportData(list);
    } catch (error) {
      console.error('Failed to generate supplier outstanding report:', error);
      showToast('Error generating supplier outstanding report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return '$' + parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const columns = [
    {
      header: 'Supplier',
      accessor: 'supplierName',
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
    <AppLayout title="Supplier Outstanding Report" icon={FileText}>
      {loading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={reportData}
          loading={loading}
          searchPlaceholder="Search supplier..."
          searchKeys={['supplierName']}
          itemsPerPage={15}
          extraActions={extraActions}
          noDataMessage="No outstanding supplier balances found."
        />
      )}
    </AppLayout>
  );
}
