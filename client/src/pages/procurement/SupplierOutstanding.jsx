import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { statementPath } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { FileText, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SupplierOutstanding() {
  const navigate = useNavigate();
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
      const agingRes = await axios.get('/api/procurement/supplier-aging', authConfig());
      setReportData(agingRes.data || []);
    } catch (error) {
      console.error('Failed to generate supplier outstanding report:', error);
      showToast('Error generating supplier outstanding report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return 'Rs ' + parseFloat(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          onRowClick={(row) => navigate(statementPath('/procurement/suppliers', row))}
          itemsPerPage={15}
          extraActions={extraActions}
          noDataMessage="No outstanding supplier balances found."
        />
      )}
    </AppLayout>
  );
}
