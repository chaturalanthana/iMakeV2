import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Layers, Plus, Search, Edit2, Trash2, X, MapPin } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';

export default function Warehouses() {
  const { showToast } = useToast();
  const token = localStorage.getItem('token');
  
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: ''
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    fetchWarehouses();
  }, [token]);

  const fetchWarehouses = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/warehouses', config);
      setWarehouses(res.data);
    } catch (error) {
      console.error('Failed to fetch warehouses', error);
      showToast('Failed to fetch warehouses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = (warehouse = null) => {
    if (warehouse) {
      setEditingId(warehouse.id);
      setFormData({
        code: warehouse.code || '',
        name: warehouse.name || '',
        address: warehouse.address || ''
      });
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '', address: '' });
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('Code and Name are required', 'error');
      return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (editingId) {
        await axios.put(`/api/warehouses/${editingId}`, formData, config);
        showToast('Warehouse updated successfully', 'success');
      } else {
        await axios.post('/api/warehouses', formData, config);
        showToast('Warehouse created successfully', 'success');
      }
      fetchWarehouses();
      handleCloseDrawer();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save warehouse', 'error');
    }
  };

  const handleDeleteTrigger = (id) => {
    setDeleteTargetId(id);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/warehouses/${deleteTargetId}`, config);
      showToast('Warehouse deleted successfully', 'success');
      fetchWarehouses();
    } catch (error) {
      showToast('Failed to delete warehouse', 'error');
    } finally {
      setIsConfirmOpen(false);
      setDeleteTargetId(null);
    }
  };

  const filteredData = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.address && w.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout title="Warehouses" icon={Layers}>
      {loading ? (
        <PageSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
          
          {/* Header Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Search size={14} /> Search Warehouses
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text"
                  placeholder="Search by code, name, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
            </div>

            <button 
              onClick={() => handleOpenDrawer()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '10px 16px', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
            >
              <Plus size={18} /> Add Warehouse
            </button>
          </div>

          {/* Grid of Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredData.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                No warehouses found matching your search.
              </div>
            ) : (
              filteredData.map(w => (
                <div key={w.id} style={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border-color)', 
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                }}>
                  {/* Decorative top bar */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, var(--accent) 0%, #818cf8 100%)' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{w.code}</span>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{w.name}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <button onClick={() => handleOpenDrawer(w)} style={{ padding: '6px', backgroundColor: 'transparent', color: '#3b82f6', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteTrigger(w.id)} style={{ padding: '6px', backgroundColor: 'transparent', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                    <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#94a3b8' }} />
                    <span style={{ lineHeight: '1.4' }}>{w.address || 'No address provided'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Warehouse Form Modal */}
          <Modal
            isOpen={isDrawerOpen}
            onClose={handleCloseDrawer}
            title={editingId ? 'Edit Warehouse' : 'Add New Warehouse'}
            icon={Layers}
            maxWidth="450px"
          >
            <div style={{ padding: '1.5rem' }}>
              <form id="warehouse-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Warehouse Code <span style={{color: '#ef4444'}}>*</span></label>
                  <input 
                    type="text" 
                    value={formData.code} 
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', transition: 'border-color 0.2s', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                    required
                    placeholder="e.g. WH-01"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Warehouse Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', transition: 'border-color 0.2s', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                    required
                    placeholder="e.g. Main Distribution Center"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Full Address</label>
                  <textarea 
                    value={formData.address} 
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', transition: 'border-color 0.2s', outline: 'none', resize: 'vertical', minHeight: '80px' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                    placeholder="Physical location details"
                  />
                </div>
              </form>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#f8fafc' }}>
              <button onClick={handleCloseDrawer} style={{ padding: '10px 16px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '8px', fontWeight: 600, color: '#475569', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                Cancel
              </button>
              <button type="submit" form="warehouse-form" style={{ padding: '10px 20px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.1s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                {editingId ? 'Save Changes' : 'Create Warehouse'}
              </button>
            </div>
          </Modal>

          <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={handleDelete}
            title="Delete Warehouse"
            message="Are you sure you want to delete this warehouse?"
          />
        </div>
      )}
    </AppLayout>
  );
}
