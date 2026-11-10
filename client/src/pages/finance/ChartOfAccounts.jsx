import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Network, Plus, Trash2, Wand2, Book, CornerDownRight, PlusCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE'
];

export default function ChartOfAccounts() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editId, setEditId] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'ASSET',
    parentId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/finance/accounts', config);
      setAccounts(res.data);
    } catch (error) {
      console.error(`Failed to fetch accounts:`, error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleGenerateTemplate = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Load Template',
      message: 'This will load a standard chart of accounts for a small business. Existing duplicate codes might cause issues. Continue?',
      onConfirm: async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const config = { headers: { Authorization: `Bearer ${token}` } };
          await axios.post('/api/finance/accounts/template', {}, config);
          showToast('Template chart of accounts loaded successfully', 'success');
          fetchData();
        } catch (error) {
          console.error('Failed to generate template:', error);
          showToast(error.response?.data?.error || 'Failed to generate template', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ code: '', name: '', type: 'ASSET', parentId: '' });
    setEditId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (account) => {
    setModalMode('edit');
    setFormData({ 
      code: account.code, 
      name: account.name, 
      type: account.type, 
      parentId: account.parentId || '' 
    });
    setEditId(account.id);
    setIsModalOpen(true);
  };

  const openCreateChildModal = (parentAccount) => {
    setModalMode('create');
    setFormData({ 
      code: '', 
      name: '', 
      type: parentAccount.type, 
      parentId: parentAccount.id 
    });
    setEditId(null);
    setIsModalOpen(true);
  };

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!String(formData.code || '').trim()) errors.code = 'Account code is required.';
    if (!String(formData.name || '').trim()) errors.name = 'Account name is required.';
    if (!String(formData.type || '').trim()) errors.type = 'Account type is required.';
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
        type: formData.type,
        parentId: formData.parentId || null
      };

      if (modalMode === 'create') {
        await axios.post('/api/finance/accounts', payload, config);
        showToast('Account created successfully', 'success');
      } else {
        await axios.put(`/api/finance/accounts/${editId}`, payload, config);
        showToast('Account updated successfully', 'success');
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save account:', error);
      showToast(error.response?.data?.error || 'Error saving account. Please check the fields and try again.', 'error');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Account',
      message: 'Are you sure you want to delete this account? This will fail if there are ledger entries associated with it.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/finance/accounts/${id}`, config);
      showToast('Account deleted successfully', 'success');
      fetchData();
    } catch (error) {
      console.error('Delete account error:', error);
      showToast(error.response?.data?.error || 'Failed to delete account', 'error');
    }
  };

  // Reusable columns definition
  const columns = [
    { header: 'Code', accessor: 'code', fontWeight: 500, color: 'var(--text-muted)' },
    { 
      header: 'Name', 
      accessor: 'name', 
      fontWeight: 600,
      render: (row) => {
        const hasParent = !!row.parentId;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: hasParent ? '1.25rem' : '0' }}>
              {hasParent && <CornerDownRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span>{row.name}</span>
            </div>
            <button 
              className="coa-row-action-btn"
              title={`Create sub-account under ${row.name}`}
              onClick={(e) => {
                e.stopPropagation();
                openCreateChildModal(row);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <PlusCircle size={14} />
            </button>
          </div>
        );
      }
    },
    { header: 'Type', accessor: 'type', fontWeight: 600 },
    { 
      header: 'Parent Account', 
      accessor: 'parentId', 
      render: (row) => {
        const parent = accounts.find(a => a.id === row.parentId);
        return parent ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {parent.code ? `${parent.code} - ` : ''}{parent.name}
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.025em', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '4px' }}>
            Root
          </span>
        );
      }
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem' }} title="Delete"><Trash2 size={16} /></button>
        </>
      )
    }
  ];

  const parentCandidates = accounts.filter(acc => 
    acc.type === formData.type && 
    (modalMode === 'create' || acc.id !== editId)
  );

  return (
    <AppLayout title="Chart of Accounts" icon={Network}>
      <style>{`
        .coa-row-action-btn {
          opacity: 0;
          transition: opacity 0.15s ease-in-out;
        }
        tr:hover .coa-row-action-btn {
          opacity: 1;
        }
      `}</style>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={accounts}
            loading={loading}
            searchPlaceholder="Search by name or code..."
            searchKeys={['name', 'code']}
            onRowClick={openEditModal}
            extraActions={
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {!loading && (
                  <button onClick={handleGenerateTemplate} style={{
                    padding: '0.55rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '7px',
                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
                    border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontWeight: 600,
                    transition: 'opacity 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <Wand2 size={15} /> Auto-Generate Defaults
                  </button>
                )}
                <button onClick={openCreateModal} style={{
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
                  <Plus size={16} /> Add Account
                </button>
              </div>
            }
          />

          <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
            onConfirm={confirmConfig.onConfirm}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText={confirmConfig.title === 'Load Template' ? "Load Template" : "Delete"}
          />

          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={modalMode === 'create' ? 'Add New Account' : 'Update Account'}
            subtitle="Configure the accounting record details"
            icon={Book}
            maxWidth="550px"
          >
            <form onSubmit={handleSubmit} autoComplete="off" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Account Category / Type</label>
                  <select 
                    name="type" value={formData.type} onChange={handleInputChange} 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', fontSize: '0.9rem', outline: 'none' }} required
                  >
                    {ACCOUNT_TYPES.map(type => (
                      <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Parent Account <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
                  <select 
                    name="parentId" value={formData.parentId} onChange={handleInputChange} 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    <option value="">None (Root Account)</option>
                    {parentCandidates.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code ? `${acc.code} - ` : ''}{acc.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Account Name <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input 
                      type="text" name="name" value={formData.name} 
                      onChange={handleInputChange} placeholder="e.g. Sales Revenue or Office Supplies" 
                      style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} required 
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Account Code <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
                    <input 
                      type="text" name="code" value={formData.code} 
                      onChange={handleInputChange} placeholder="e.g. 5000" 
                      style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} 
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', justifyContent: 'flex-end', gap: '1rem', 
                marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' 
              }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ 
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
                  {modalMode === 'create' ? 'Save Account' : 'Update Account'}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </AppLayout>
  );
}

