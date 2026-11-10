import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Layers, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewStockMovement() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [type, setType] = useState('GI'); // 'GI' = Goods Issue, 'ADJ' = Adjustment
  const [description, setDescription] = useState('');
  
  // Lines
  const [items, setItems] = useState([
    { id: Date.now(), productId: '', quantity: 1 }
  ]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res.data);
    } catch (error) {
      console.error(`Failed to fetch products:`, error);
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addItem = () => setItems([...items, { id: Date.now(), productId: '', quantity: 1 }]);
  const removeItem = (id) => {
    if (items.length <= 1) return showToast("Must have at least 1 item.", "error");
    setItems(items.filter(item => item.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description) return showToast("Please provide a reason/description.", "error");
    for (let item of items) {
      if (!item.productId || parseFloat(item.quantity) <= 0) return showToast("All lines must have a valid product and positive quantity.", "error");
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        type,
        referenceType: type === 'GI' ? 'MANUAL_ISSUE' : 'MANUAL_ADJ',
        referenceId: description,
        description,
        items: items.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity)
        }))
      };
      await axios.post('/api/warehouse/movements', payload, { headers: { Authorization: `Bearer ${token}` } });
      showToast('Transaction completed successfully!', 'success');
      navigate('/warehouse/movements');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process transaction.', 'error');
      setLoading(false);
    }
  };

  return (
    <AppLayout title="New Stock Transaction" icon={Layers}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/warehouse/movements')} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1.25rem' }}>Manual Inventory Transaction</h3>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supplier returns, free giveaways, or stock balancing</p>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Transaction Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none' }} required>
                <option value="GI">Goods Issue (Deduct Stock - e.g., Return, Giveaway, Damage)</option>
                <option value="ADJ">Adjustment (Add Stock - e.g., Found Inventory)</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Reason / Reference *</label>
              <input type="text" placeholder="e.g., Return back to supplier (#SUP-12)" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none' }} autoComplete="off" required />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
             <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quantity to {type === 'GI' ? 'Issue (Deduct)' : 'Add'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <select value={item.productId} onChange={(e) => handleItemChange(item.id, 'productId', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none' }} required>
                      <option value="">Select...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}><input type="number" step="1" min="1" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none' }} required /></td>
                  <td style={{ padding: '0.75rem 1rem' }}><button type="button" onClick={() => removeItem(item.id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" style={{ padding: '1rem' }}><button type="button" onClick={addItem} style={{ background: 'var(--active-bg)', color: 'var(--accent)', border: '1px dashed var(--accent)', padding: '0.75rem', width: '100%', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}><Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> Add Item</button></td>
              </tr>
            </tfoot>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
             <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '8px', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', backgroundColor: type === 'GI' ? '#b91c1c' : '#059669', borderColor: type === 'GI' ? '#b91c1c' : '#059669' }}>
               {loading ? 'Processing...' : (type === 'GI' ? 'Confirm Issue (Deduct Stock)' : 'Confirm Adjustment (Add Stock)')}
             </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
