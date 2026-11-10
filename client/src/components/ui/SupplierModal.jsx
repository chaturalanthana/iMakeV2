import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Truck, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SupplierModal({ isOpen, onClose, supplierToEdit = null, onSaved }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (supplierToEdit) {
      setFormData({
        name: supplierToEdit.name || '',
        code: supplierToEdit.code || '',
        email: supplierToEdit.email || '',
        phone: supplierToEdit.phone || '',
        address: supplierToEdit.address || ''
      });
    } else {
      setFormData({ name: '', code: '', email: '', phone: '', address: '' });
    }
  }, [supplierToEdit, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      let savedSupplier;
      if (supplierToEdit) {
        const res = await axios.put(`/api/suppliers/${supplierToEdit.id}`, formData, config);
        savedSupplier = res.data;
        showToast('Supplier updated successfully', 'success');
      } else {
        const res = await axios.post('/api/suppliers', formData, config);
        savedSupplier = res.data;
        showToast('Supplier created successfully', 'success');
      }
      
      onSaved(savedSupplier);
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.error || 'Failed to save supplier', 'error');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 10000 
    }}>
      <div style={{ 
        backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', 
        maxWidth: '650px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
        border: '1px solid var(--border-color)', overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ 
          padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '8px',
              backgroundColor: 'rgba(124, 58, 237, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <Truck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {supplierToEdit ? 'Update Supplier' : 'Add New Supplier'}
              </h3>
              <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Enter supplier organizational and contact details
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ 
            background: '#f1f5f9', border: 'none', cursor: 'pointer', 
            color: 'var(--text-muted)', width: '32px', height: '32px', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Company Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input 
                  type="text" name="name" value={formData.name} 
                  onChange={handleInputChange} placeholder="Tech Sources Inc." 
                  style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                  required 
                  autoComplete="off"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Supplier Code</label>
                <input 
                  type="text" name="code" value={formData.code} 
                  onChange={handleInputChange} placeholder="SUP-001" 
                  style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                  autoComplete="off"
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Email Address</label>
                <input 
                  type="email" name="email" value={formData.email} 
                  onChange={handleInputChange} placeholder="orders@supplier.com" 
                  style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                  autoComplete="off"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Phone Number</label>
                <input 
                  type="text" name="phone" value={formData.phone} 
                  onChange={handleInputChange} placeholder="+1 555-0192" 
                  style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Business Address</label>
              <textarea 
                name="address" value={formData.address} 
                onChange={handleInputChange} rows="3" 
                placeholder="Enter full business address..." 
                style={{ 
                  width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', 
                  border: '1px solid var(--border-color)', outline: 'none', 
                  boxSizing: 'border-box', resize: 'none', fontSize: '0.9rem', backgroundColor: '#fff',
                  fontFamily: 'inherit'
                }} 
                autoComplete="off"
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" onClick={onClose} style={{ 
              background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', 
              padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', 
              fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
              Cancel
            </button>
            <button type="submit" style={{ 
              padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', 
              cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
              color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
              transition: 'opacity 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              {supplierToEdit ? 'Update Supplier' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
