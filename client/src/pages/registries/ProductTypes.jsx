import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ProductTypes() {
  const { showToast } = useToast();
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchProductTypes();
  }, []);

  const fetchProductTypes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/product-types', config);
      setProductTypes(res.data);
    } catch (error) {
      console.error('Failed to fetch product types:', error);
      showToast(error.response?.data?.error || 'Failed to load product types', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        name: formData.name,
        description: formData.description
      };

      if (editingType) {
        await axios.put(`/api/product-types/${editingType.id}`, payload, config);
        showToast('Product Type updated successfully', 'success');
      } else {
        await axios.post('/api/product-types', payload, config);
        showToast('Product Type created successfully', 'success');
      }
      
      closeModal();
      fetchProductTypes();
    } catch (error) {
      console.error('Failed to save product type:', error);
      showToast(error.response?.data?.error || 'Failed to save product type', 'error');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Product Type',
      message: 'Are you sure you want to delete this product type? This action cannot be undone and will fail if any products are using it.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/product-types/${id}`, config);
      showToast('Product Type deleted successfully', 'success');
      fetchProductTypes();
    } catch (error) {
      console.error('Failed to delete product type:', error);
      showToast(error.response?.data?.error || 'Failed to delete product type', 'error');
    }
  };

  const openModal = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || ''
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
    setFormData({ name: '', description: '' });
  };

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      fontWeight: 700
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (row) => row.description || '-'
    },
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
    <button
      onClick={() => openModal()}
      style={{
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
      <Plus size={16} /> New Product Type
    </button>
  );

  return (
    <AppLayout title="Product Types" icon={Layers}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={productTypes}
            loading={loading}
            searchPlaceholder="Search product types..."
            searchKeys={['name', 'description']}
            extraActions={extraActions}
            onRowClick={(row) => openModal(row)}
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={closeModal}
            title={editingType ? 'Update Product Type' : 'Create Product Type'}
            subtitle={editingType ? 'Modify the details of this product classification.' : 'Define a new category type classification.'}
            icon={Layers}
          >
            <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Name <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Raw Material, Finished Good" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Description
                  </label>
                  <textarea 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    placeholder="Optional details about this type..." 
                    rows={3}
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', resize: 'vertical', backgroundColor: '#fff' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={closeModal} style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff' }}>
                  {editingType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </Modal>

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
