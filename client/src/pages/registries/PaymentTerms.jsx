import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function PaymentTerms() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    days: '0'
  });

  useEffect(() => {
    fetchPaymentTerms();
  }, []);

  const fetchPaymentTerms = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/payment-terms', config);
      setTerms(res.data);
    } catch (error) {
      console.error('Failed to fetch payment terms:', error);
      showToast(error.response?.data?.error || 'Failed to load Payment Terms', 'error');
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
    const errors = {};
    if (!String(formData.code || '').trim()) errors.code = 'Payment term code is required.';
    if (!String(formData.name || '').trim()) errors.name = 'Payment term name is required.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }
    setFieldErrors({});
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        code: formData.code,
        name: formData.name,
        days: parseInt(formData.days) || 0
      };

      if (editingTerm) {
        await axios.put(`/api/payment-terms/${editingTerm.id}`, payload, config);
        showToast('Payment term updated successfully', 'success');
      } else {
        await axios.post('/api/payment-terms', payload, config);
        showToast('Payment term created successfully', 'success');
      }
      
      closeModal();
      fetchPaymentTerms();
    } catch (error) {
      console.error('Failed to save payment term:', error);
      showToast(error.response?.data?.error || 'Failed to save payment term', 'error');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Payment Term',
      message: 'Are you sure you want to delete this Payment Term? This action cannot be undone.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/payment-terms/${id}`, config);
      showToast('Payment term deleted successfully', 'success');
      fetchPaymentTerms();
    } catch (error) {
      console.error('Failed to delete payment term:', error);
      showToast(error.response?.data?.error || 'Failed to delete payment term', 'error');
    }
  };

  const openModal = (term = null) => {
    if (term) {
      setEditingTerm(term);
      setFormData({
        code: term.code,
        name: term.name,
        days: term.days.toString()
      });
    } else {
      setEditingTerm(null);
      setFormData({
        code: '',
        name: '',
        days: '0'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTerm(null);
    setFormData({ code: '', name: '', days: '0' });
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'code',
      fontWeight: 700,
      render: (row) => row.code || '-'
    },
    {
      header: 'Name',
      accessor: 'name',
      fontWeight: 500
    },
    {
      header: 'Credit Days',
      accessor: 'days',
      color: 'var(--text-muted)',
      render: (row) => `${row.days} Day(s)`
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
      <Plus size={16} /> New Payment Term
    </button>
  );

  return (
    <AppLayout title="Payment Terms" icon={CreditCard}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={terms}
            loading={loading}
            searchPlaceholder="Search Payment Terms..."
            searchKeys={['code', 'name']}
            extraActions={extraActions}
            onRowClick={(row) => openModal(row)}
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={closeModal}
            title={editingTerm ? 'Update Payment Term' : 'Create Payment Term'}
            subtitle={editingTerm ? 'Modify the details of this payment term.' : 'Define a new payment term.'}
            icon={CreditCard}
          >
            <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Term Code <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    name="code" 
                    value={formData.code} 
                    onChange={handleInputChange} 
                    placeholder="e.g. NET-30" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Term Name <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Net 30 Days" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Credit Days <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    type="number" 
                    name="days" 
                    value={formData.days} 
                    onChange={handleInputChange} 
                    placeholder="0" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={closeModal} style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff' }}>
                  {editingTerm ? 'Update' : 'Create'}
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
