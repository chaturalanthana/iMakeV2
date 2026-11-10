import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import { Layers, ArrowDownRight, ArrowUpRight, BarChart2, Search, FileText, Calendar } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

import WarehouseSearchDropdown from '../../components/ui/WarehouseSearchDropdown';

export default function StockMovements() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Products and Warehouses for dropdown
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');

  // Filters
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);

  // Ledger Data
  const [ledger, setLedger] = useState({ openingBalance: 0, movements: [] });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchLedger();
    } else {
      setLedger({ openingBalance: 0, movements: [] });
    }
  }, [selectedProduct, startDate, endDate, warehouseId]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [prodRes, whRes] = await Promise.all([
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/warehouses', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProducts(prodRes.data);
      setWarehouses(whRes.data);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const fetchLedger = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        productId: selectedProduct.id,
      };
      if (warehouseId) params.warehouseId = warehouseId;
      if (startDate) {
        // Date object to string
        const startStr = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        params.startDate = startStr;
      }
      if (endDate) {
        const endStr = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        params.endDate = endStr;
      }

      const res = await axios.get('/api/warehouse/ledger', { 
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLedger(res.data);
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
      showToast('Failed to load stock ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'GR': return { label: 'Goods Receipt', icon: <ArrowDownRight size={14} />, color: '#059669', bg: '#ecfdf5' };
      case 'GI': return { label: 'Goods Issue', icon: <ArrowUpRight size={14} />, color: '#b91c1c', bg: '#fef2f2' };
      case 'ADJ': return { label: 'Adjustment', icon: <BarChart2 size={14} />, color: '#d97706', bg: '#fffbeb' };
      default: return { label: type, icon: null, color: '#334155', bg: '#f1f5f9' };
    }
  };

  // Calculate Running Balances
  let currentBalance = ledger.openingBalance || 0;
  const ledgerRows = ledger.movements.map(m => {
    const qty = parseFloat(m.quantity);
    const isIn = m.type === 'GR' || (m.type === 'ADJ' && qty > 0);
    const isOut = m.type === 'GI' || (m.type === 'ADJ' && qty < 0);
    
    // quantity for ADJ might be negative or positive
    const absQty = Math.abs(qty);

    if (isIn) currentBalance += absQty;
    if (isOut) currentBalance -= absQty;

    return {
      ...m,
      inQty: isIn ? absQty : 0,
      outQty: isOut ? absQty : 0,
      balance: currentBalance
    };
  });

  const closingBalance = currentBalance;

  return (
    <AppLayout title="Stock Ledger" icon={Layers}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Filters Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '1.5rem', backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={14} /> Select Product</label>
              <ProductSearchDropdown 
                products={products}
                value={selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : ''}
                onChange={setSelectedProduct}
                placeholder="Search product..."
                style={{ wrapper: { width: '100%' }, input: { height: '42px', padding: '0 1rem', border: '1px solid #e2e8f0', borderRadius: '8px' } }}
              />
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '200px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Date From</label>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <DatePicker 
                  value={startDate} 
                  onChange={(v) => setStartDate(v ? new Date(v) : null)} 
                  placeholder="Start Date" 
                  style={{ height: '42px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '200px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Date To</label>
              <div style={{ position: 'relative', zIndex: 9 }}>
                <DatePicker 
                  value={endDate} 
                  onChange={(v) => setEndDate(v ? new Date(v) : null)} 
                  placeholder="End Date" 
                  style={{ height: '42px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Main Table Panel */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '120px' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Reference</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '100px' }}>In</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '100px' }}>Out</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-main)', fontWeight: 800, textAlign: 'right', width: '120px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {!selectedProduct ? (
                  <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please select a product to view its stock ledger.</td></tr>
                ) : loading ? (
                  <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading ledger...</td></tr>
                ) : (
                  <>
                    {/* Opening Balance Row */}
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td colSpan="5" style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Opening Balance</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', textAlign: 'right' }}>{ledger.openingBalance}</td>
                    </tr>

                    {/* Ledger Rows */}
                    {ledgerRows.length === 0 ? (
                      <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No movements in this period.</td></tr>
                    ) : (
                      ledgerRows.map(m => {
                        const style = getTypeStyle(m.type);
                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: style.color }}>
                                {style.icon} {style.label}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.referenceId || m.referenceType || '-'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#059669', textAlign: 'center' }}>
                              {m.inQty > 0 ? `+${m.inQty}` : '-'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#b91c1c', textAlign: 'center' }}>
                              {m.outQty > 0 ? `-${m.outQty}` : '-'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', textAlign: 'right' }}>
                              {m.balance}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Closing Balance Row */}
                    <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #e2e8f0' }}>
                      <td colSpan="5" style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 800, color: '#065f46', textAlign: 'right', textTransform: 'uppercase' }}>End Balance</td>
                      <td style={{ padding: '1rem', fontSize: '1rem', fontWeight: 800, color: '#065f46', textAlign: 'right' }}>{closingBalance}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
