import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { Truck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const FIELD = {
  height: '38px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 0.6rem', background: '#fff'
};

export default function ContractManufacturing() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ supplierId: '', virtualWarehouseId: '', fgWarehouseId: '', productId: '', quantity: '', serviceCharge: '' });

  const authConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }), []);

  const load = useCallback(async () => {
    const config = authConfig();
    const [orderRes, supplierRes, warehouseRes, productRes] = await Promise.all([
      axios.get('/api/production/contracts', config),
      axios.get('/api/suppliers', config),
      axios.get('/api/warehouses', config),
      axios.get('/api/products', config)
    ]);
    setOrders(orderRes.data);
    setSuppliers(supplierRes.data);
    setWarehouses(warehouseRes.data);
    setProducts(productRes.data);
  }, [authConfig]);

  useEffect(() => {
    load().catch(() => showToast('Failed to load contract manufacturing', 'error'));
  }, [load, showToast]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const create = async () => {
    try {
      await axios.post('/api/production/contracts', {
        ...form,
        quantity: Number(form.quantity),
        serviceCharge: Number(form.serviceCharge || 0)
      }, authConfig());
      showToast('Contract order created', 'success');
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to create the contract order', 'error');
    }
  };

  const act = async (id, path, body, message) => {
    try {
      await axios.post(`/api/production/contracts/${id}/${path}`, body, authConfig());
      showToast(message, 'success');
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || 'Action failed', 'error');
    }
  };

  const virtuals = warehouses.filter((row) => row.locationRole === 'VIRTUAL');
  const stores = warehouses.filter((row) => row.locationRole !== 'VIRTUAL');

  return (
    <AppLayout title="Contract Manufacturing" icon={Truck}>
      <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
        <select style={FIELD} value={form.supplierId} onChange={set('supplierId')}><option value="">Subcontractor</option>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select style={FIELD} value={form.virtualWarehouseId} onChange={set('virtualWarehouseId')}><option value="">Virtual warehouse</option>{virtuals.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}</select>
        <select style={FIELD} value={form.fgWarehouseId} onChange={set('fgWarehouseId')}><option value="">FG warehouse</option>{stores.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}</select>
        <select style={FIELD} value={form.productId} onChange={set('productId')}><option value="">Finished good</option>{products.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}</select>
        <input style={FIELD} placeholder="Quantity" value={form.quantity} onChange={set('quantity')} />
        <input style={FIELD} placeholder="Service charge" value={form.serviceCharge} onChange={set('serviceCharge')} />
        <button type="button" onClick={create} style={{ ...FIELD, background: 'var(--accent)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Create</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {orders.map((order) => (
          <div key={order.id} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{order.orderNumber} · {order.product?.code}</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{order.supplier?.name} · {order.virtualWarehouse?.code} · {order.status} · qty {Number(order.quantity)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {order.status !== 'INVOICED' && order.status !== 'RECEIVED' && (
                <button type="button" onClick={() => act(order.id, 'issue', { warehouseId: stores[0]?.id, productId: products.find((row) => !row.bomApplicable)?.id, quantity: 1 }, 'Issued to subcontractor')} style={FIELD}>Issue</button>
              )}
              {order.status === 'ISSUED' && (
                <button type="button" onClick={() => act(order.id, 'receive', { quantity: Number(order.quantity) }, 'Finished goods received')} style={FIELD}>Receive FG</button>
              )}
              {['ISSUED', 'RECEIVED'].includes(order.status) && (
                <button type="button" onClick={() => act(order.id, 'charge', {}, 'Service charge posted to AP')} style={FIELD}>Service charge</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
