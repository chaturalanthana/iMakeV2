import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { recordPath } from '../utils/recordPath';
import AppLayout from '../components/layout/AppLayout';
import LiveSearchDropdown from '../components/ui/LiveSearchDropdown';
import ConfirmModal from '../components/ui/ConfirmModal';
import PageSkeleton from '../components/ui/PageSkeleton';
import DataTable from '../components/ui/DataTable';
import ExportButton from '../components/ui/ExportButton';
import ProductBatchModal from '../components/ui/ProductBatchModal';
import ColumnSelector from '../components/ui/ColumnSelector';
import { Plus, Archive, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const COLUMN_DEFS = [
  { key: 'code', header: 'Item Code', accessor: 'code', fontWeight: 500 },
  { key: 'name', header: 'Item Name', accessor: 'name', fontWeight: 600 },
  { key: 'productType', header: 'Item Type', accessor: 'productType', render: (row) => row.productType?.name || '-' },
  { key: 'category', header: 'Category', accessor: 'category', render: (row) => row.category?.name || '-' },
  { key: 'brand', header: 'Brand', accessor: 'brand', render: (row) => row.brand?.name || '-' },
  { key: 'productGroup', header: 'Product Group', accessor: 'productGroup', render: (row) => row.productGroupRel?.name || row.productGroup || '-' },
  { key: 'supplier', header: 'Supplier', accessor: 'supplier', render: (row) => row.supplier?.name || '-' },
  { key: 'stockUom', header: 'Stock UOM', accessor: 'stockUom', render: (row) => row.stockUom?.name || '-' },
  { key: 'purchaseUom', header: 'Purchase UOM', accessor: 'purchaseUom', render: (row) => row.purchaseUom?.name || '-' },
  { key: 'salesUom', header: 'Sales UOM', accessor: 'salesUom', render: (row) => row.salesUom?.name || '-' },
  { key: 'costingMethod', header: 'Costing Method', accessor: 'costingMethod', render: (row) => row.costingMethod || '-' },
  { key: 'standardCost', header: 'Standard Cost', accessor: 'standardCost', render: (row) => `$${row.standardCost || '0.00'}`, fontWeight: 600 },
  { key: 'costPrice', header: 'Cost Price', accessor: 'costPrice', render: (row) => `$${row.costPrice || '0.00'}` },
  { key: 'sellingPrice', header: 'Selling Price', accessor: 'sellingPrice', render: (row) => `$${row.sellingPrice || '0.00'}` },
  { key: 'reorderLevel', header: 'Reorder Level', accessor: 'reorderLevel' },
  { key: 'safetyStock', header: 'Safety Stock', accessor: 'safetyStock' },
  { key: 'scrapPercent', header: 'Scrap %', accessor: 'scrapPercent' },
  { key: 'taxGroup', header: 'Tax Group', accessor: 'taxGroup', render: (row) => row.taxGroup || '-' },
  { key: 'activeStatus', header: 'Status', accessor: 'activeStatus', render: (row) => row.activeStatus || '-' },
  { key: 'currency', header: 'Currency', accessor: 'currency', render: (row) => row.currencyRel?.code || row.currency || '-' },
  { key: 'bomApplicable', header: 'BOM', accessor: 'bomApplicable', render: (row) => row.bomApplicable ? 'Yes' : 'No' }
];

const DEFAULT_COLUMN_KEYS = ['code', 'name', 'productType', 'category', 'stockUom', 'standardCost'];

export default function Products() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [attributes, setAttributes] = useState({ categories: [], brands: [], uoms: [] });
  const [taxGroups, setTaxGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchOpen, setBatchOpen] = useState(false);
  
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [columnKeys, setColumnKeys] = useState(DEFAULT_COLUMN_KEYS);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [query, setQuery] = useState({ page: 1, q: '', sort: 'createdAt', dir: 'desc' });
  const [total, setTotal] = useState(0);
  const columnSaveTimer = useRef(null);

  useEffect(() => {
    fetchData();
  }, [query, filterCategory, filterBrand]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [prodRes, attrRes, taxRes, columnRes] = await Promise.all([
        axios.get('/api/products', { ...config, params: { page: query.page, pageSize: 15, q: query.q || undefined, sort: query.sort || undefined, dir: query.dir || undefined, categoryId: filterCategory || undefined, brand: filterBrand || undefined } }),
        axios.get('/api/products/attributes', config),
        axios.get('/api/finance/tax-groups', config).catch(() => ({ data: [] })),
        axios.get('/api/me/preferences/products-columns', config).catch(() => ({ data: { value: null } }))
      ]);
      
      setProducts(prodRes.data.items || []);
      setTotal(prodRes.data.total || 0);
      setAttributes(attrRes.data);
      setTaxGroups(taxRes.data || []);
      const savedColumns = Array.isArray(columnRes.data?.value)
        ? columnRes.data.value.filter((key) => COLUMN_DEFS.some((column) => column.key === key))
        : [];
      if (savedColumns.length > 0) setColumnKeys(savedColumns);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Item',
      message: 'Are you sure you want to delete this product? This action cannot be undone and may affect transaction history.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Product deleted successfully', 'success');
      fetchData();
    } catch (error) {
      console.error('Failed to delete product:', error);
      showToast(error.response?.data?.error || 'Failed to delete record', 'error');
    }
  };

  const handleColumnChange = (keys) => {
    setColumnKeys(keys);
    clearTimeout(columnSaveTimer.current);
    columnSaveTimer.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        await axios.put('/api/me/preferences/products-columns', { value: keys }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        showToast(error.response?.data?.error || 'Could not save columns', 'error');
      }
    }, 400);
  };

  // Pre-filtering for DataTable
  const filteredProducts = products;

  const columns = [
    ...columnKeys.map((key) => COLUMN_DEFS.find((column) => column.key === key)).filter(Boolean),
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            handleDeleteClick(row.id); 
          }} 
          style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }}
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  const extraActions = (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <LiveSearchDropdown 
        options={attributes.categories}
        value={filterCategory}
        onChange={setFilterCategory}
        placeholder="All Categories"
        style={{ width: '180px', input: { backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '38px', fontSize: '0.85rem' } }}
      />

      <LiveSearchDropdown 
        options={attributes.brands}
        value={filterBrand}
        onChange={setFilterBrand}
        placeholder="All Brands"
        style={{ width: '180px', input: { backgroundColor: '#fff', border: '1px solid var(--border-color)', height: '38px', fontSize: '0.85rem' } }}
      />
      <ColumnSelector
        columns={COLUMN_DEFS}
        selectedKeys={columnKeys}
        onChange={handleColumnChange}
      />
      {selectedIds.length > 0 && (
        <button
          type="button"
          onClick={() => setBatchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '0.55rem 1rem',
            background: 'rgba(37, 99, 235, 0.08)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--accent)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <SlidersHorizontal size={16} /> Update {selectedIds.length}
        </button>
      )}
      <ExportButton url="/api/products" filename="items.xlsx" params={{ q: query.q, sort: query.sort, dir: query.dir, categoryId: filterCategory, brand: filterBrand }} />
      <button onClick={() => navigate('/products/new')} style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '0.55rem 1.25rem',
        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        whiteSpace: 'nowrap',
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <Plus size={16} /> Add New Item
      </button>
    </div>
  );

  return (
    <AppLayout title="Products" icon={Archive}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filteredProducts}
            loading={loading}
            searchPlaceholder="Search by name or SKU..."
            searchKeys={['name', 'code']}
            onServerQuery={(next) => setQuery((prev) => ({ ...prev, q: next.q ?? prev.q, page: next.page || 1, sort: next.sort || prev.sort, dir: next.dir || prev.dir }))}
            serverTotal={total}
            serverPage={query.page}
            extraActions={extraActions}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={(row) => navigate(recordPath('/products', row, 'code'))}
          />

          <ProductBatchModal
            isOpen={batchOpen}
            products={products.filter((product) => selectedIds.includes(product.id))}
            attributes={attributes}
            taxGroups={taxGroups}
            onClose={() => setBatchOpen(false)}
            onUpdated={() => {
              setBatchOpen(false);
              setSelectedIds([]);
              fetchData();
            }}
          />

          <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
            onConfirm={confirmConfig.onConfirm}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText="Delete"
          />
        </>
      )}
    </AppLayout>
  );
}
