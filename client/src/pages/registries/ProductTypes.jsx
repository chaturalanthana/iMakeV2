import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Layers } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const CLASSES = [
  { value: 'FINISHED_GOOD', label: 'Finished Good' },
  { value: 'SEMI_FINISHED', label: 'Semi-Finished Good' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKAGING', label: 'Packaging Material' },
  { value: 'CONSUMABLE', label: 'Consumable' },
  { value: 'SERVICE', label: 'Service' }
];

const classLabel = (kind) => CLASSES.find((item) => item.value === kind)?.label || kind || '-';

export default function ProductTypes() {
  const { showToast } = useToast();
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    fetchProductTypes();
  }, []);

  const fetchProductTypes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/product-types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductTypes(res.data);
    } catch (error) {
      console.error('Failed to fetch product types:', error);
      showToast(error.response?.data?.error || 'Failed to load product types', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const columns = [
    { header: 'Name', accessor: 'name', fontWeight: 700 },
    { header: 'Class', accessor: 'kind', render: (row) => classLabel(row.kind) },
    { header: 'Description', accessor: 'description', render: (row) => row.description || '-' }
  ];

  return (
    <AppLayout title="Product Types" icon={Layers}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={productTypes}
          loading={loading}
          searchPlaceholder="Search product types..."
          searchKeys={['name', 'description', 'kind']}
        />
      )}
    </AppLayout>
  );
}
