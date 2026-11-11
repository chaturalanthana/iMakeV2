import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { 
  RefreshCw, Plus, Trash2, Scale, Ruler, Maximize2, 
  Droplet, Package, Clock, Check, Layers
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const UOM_TYPES = [
  {
    id: 'MASS',
    label: 'Mass',
    icon: Scale,
    color: '#d97706',
    bgColor: '#fef3c7',
    borderColor: '#fde68a'
  },
  {
    id: 'LENGTH',
    label: 'Length',
    icon: Ruler,
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  {
    id: 'AREA',
    label: 'Area',
    icon: Maximize2,
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe'
  },
  {
    id: 'VOLUME',
    label: 'Volume',
    icon: Droplet,
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc'
  },
  {
    id: 'COUNT',
    label: 'Count',
    icon: Package,
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
  {
    id: 'TIME',
    label: 'Time',
    icon: Clock,
    color: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0'
  }
];

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
    name: '',
    type: 'COUNT'
  });

  const [fieldErrors, setFieldErrors] = useState({});

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
        name: formData.name.trim(),
        type: formData.type || 'COUNT'
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
        name: uom.name,
        type: uom.type || 'COUNT'
      });
    } else {
      setEditingUom(null);
      setFormData({
        name: '',
        type: 'COUNT'
      });
    }
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUom(null);
    setFormData({ name: '', type: 'COUNT' });
    setFieldErrors({});
  };

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      fontWeight: 700
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (row) => {
        const typeInfo = UOM_TYPES.find(t => t.id === row.type) || UOM_TYPES[4];
        const Icon = typeInfo.icon;
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: typeInfo.color,
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Icon size={15} />
            {typeInfo.label}
          </span>
        );
      }
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
          title="Delete UOM"
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
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '0.55rem 1.15rem',
        backgroundColor: 'var(--accent)',
        border: '1px solid var(--accent)',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: 'none',
        whiteSpace: 'nowrap'
      }}
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
            searchKeys={['name', 'type']}
            extraActions={extraActions}
            onRowClick={(row) => openModal(row)}
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={closeModal}
            title={editingUom ? 'Update Unit of Measure' : 'Create Unit of Measure'}
            maxWidth="480px"
            icon={RefreshCw}
          >
            <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} autoComplete="off">
              
              {/* Type Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Type <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {UOM_TYPES.map(t => {
                    const isSelected = formData.type === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                          boxShadow: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <Icon size={16} color={isSelected ? 'var(--accent)' : t.color} />
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: isSelected ? 'var(--accent)' : 'var(--text-main)' }}>
                            {t.label}
                          </span>
                        </div>
                        {isSelected && <Check size={14} color="var(--accent)" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UOM Name Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  placeholder="e.g. PCS, KG, METER" 
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: fieldErrors.name ? '1px solid var(--error)' : '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                  required 
                />
                {fieldErrors.name && <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.35rem' }}>{fieldErrors.name}</div>}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={closeModal} style={{ background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.6rem 1.75rem', borderRadius: '8px', border: '1px solid var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: 'var(--accent)', color: '#ffffff' }}>
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
