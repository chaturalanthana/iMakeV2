import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Package, Search, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';

export default function InventoryReport() {
  const { showToast } = useToast();
  const token = localStorage.getItem('token');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [token]);

  useEffect(() => {
    fetchReport();
  }, [warehouseId, token]);

  const fetchInitialData = async () => {
    if (!token) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/warehouses', config);
      setWarehouses(res.data);
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  };

  const fetchReport = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/warehouse/inventory-report', {
        ...config,
        params: warehouseId ? { warehouseId } : {}
      });
      setReportData(res.data);
    } catch (error) {
      console.error('Failed to fetch inventory report:', error);
      showToast('Failed to fetch inventory report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = reportData.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCost = filteredData.reduce((acc, item) => acc + item.totalCostValue, 0);
  const totalRetail = filteredData.reduce((acc, item) => acc + item.totalRetailValue, 0);

  return (
    <AppLayout title="Inventory Report" icon={Package}>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Search size={14} /> Search Products
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    placeholder="Search by name, code, category, brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '250px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Warehouse Filter
                </label>
                <WarehouseSearchDropdown
                  warehouses={warehouses}
                  value={warehouseName}
                  onChange={(name, wh) => {
                    setWarehouseName(name);
                    if (wh) setWarehouseId(wh.id);
                    else setWarehouseId('');
                  }}
                  placeholder="All Warehouses"
                  style={{ wrapper: { height: '42px', boxSizing: 'border-box' } }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => window.print()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '10px 16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <Download size={16} /> Export
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '100px' }}>Code</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product Name</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Category</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '100px' }}>Brand</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', textAlign: 'right', width: '100px' }}>Stock</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>FIFO Value</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>Retail Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No products found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map(item => (
                      <tr 
                        key={item.id} 
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.code}</td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 700 }}>{item.name}</td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {item.category || '-'}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.brand}</td>
                        <td style={{ padding: '1rem', fontSize: '0.95rem', fontWeight: 800, color: item.currentStock < 0 ? '#ef4444' : item.currentStock > 0 ? '#10b981' : 'var(--text-muted)', textAlign: 'right' }}>
                          {item.currentStock} {item.uom !== '-' ? <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.uom}</span> : ''}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>
                          {item.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>
                          {item.totalRetailValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Footer Totals */}
                {filteredData.length > 0 && (
                  <tfoot style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #e2e8f0' }}>
                    <tr>
                      <td colSpan="5" style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 800, color: '#065f46', textAlign: 'right', textTransform: 'uppercase' }}>
                        Total Valuation
                      </td>
                      <td style={{ padding: '1rem', fontSize: '1rem', fontWeight: 800, color: '#065f46', textAlign: 'right' }}>
                        {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '1rem', fontWeight: 800, color: '#065f46', textAlign: 'right' }}>
                        {totalRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
