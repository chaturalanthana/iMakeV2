import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Uoms() {
  const { showToast } = useToast();
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUom, setEditingUom] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Form states
  const [formData, setFormData] = useState({
    name: ''
  });

  useEffect(() => {
    fetchUoms();
  }, []);

  const fetchUoms = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/uoms', config);
      setUoms(res.data);
    } catch (error) {
      console.error('Failed to fetch UOMs:', error);
      showToast(error.response?.data?.error || 'Failed to load Units of Measure', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!String(formData.name || '').trim()) {
      setFieldErrors({ name: 'UOM name is required.' });
      showToast('UOM name is required.', 'error');
      return;
    }
    setFieldErrors({});
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        name: formData.name
      };

      if (editingUom) {
        await axios.put(`/api/uoms/${editingUom.id}`, payload, config);
        showToast('UOM updated successfully', 'success');
      } else {
        await axios.post('/api/uoms', payload, config);
        showToast('UOM created successfully', 'success');
      }
      
      closeModal();
      fetchUoms();
    } catch (error) {
      console.error('Failed to save UOM:', error);
      setFieldErrors(error.response?.data?.fields || {});
      showToast(error.response?.data?.error || 'Failed to save Unit of Measure', 'error');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Unit of Measure',
      message: 'Are you sure you want to delete this Unit of Measure? This action cannot be undone and will fail if any products are using it.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/uoms/${id}`, config);
      showToast('Unit of Measure deleted successfully', 'success');
      fetchUoms();
    } catch (error) {
      console.error('Failed to delete UOM:', error);
      showToast(error.response?.data?.error || 'Failed to delete Unit of Measure', 'error');
    }
  };

  const openModal = (uom = null) => {
    if (uom) {
      setEditingUom(uom);
      setFormData({
        name: uom.name
      });
    } else {
      setEditingUom(null);
      setFormData({
        name: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUom(null);
    setFormData({ name: '' });
  };

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      fontWeight: 700
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
      <Plus size={16} /> New UOM
    </button>
  );

  return (
    <AppLayout title="Units of Measure" icon={RefreshCw}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={uoms}
            loading={loading}
            searchPlaceholder="Search Units of Measure..."
            searchKeys={['name']}
            extraActions={extraActions}
            onRowClick={(row) => openModal(row)}
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={closeModal}
            title={editingUom ? 'Update Unit of Measure' : 'Create Unit of Measure'}
            subtitle={editingUom ? 'Modify the details of this Unit of Measure.' : 'Define a new Unit of Measure.'}
            icon={RefreshCw}
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
                    placeholder="e.g. PCS, BOX, KG" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: fieldErrors.name ? '1px solid var(--error)' : '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                  {fieldErrors.name && <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.35rem' }}>{fieldErrors.name}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={closeModal} style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff' }}>
                  {editingUom ? 'Update' : 'Create'}
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
