import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Banknote, Plus, Trash2, CheckCircle, Circle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Currencies() {
  const { showToast } = useToast();
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    symbol: '',
    name: '',
    exchangeRate: '1.0',
    isBase: false
  });

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/finance/currencies', config);
      setCurrencies(res.data);
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
      showToast(error.response?.data?.error || 'Failed to load currencies', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        code: formData.code,
        symbol: formData.symbol,
        name: formData.name,
        exchangeRate: parseFloat(formData.exchangeRate),
        isBase: formData.isBase
      };

      if (editingCurrency) {
        await axios.put(`/api/finance/currencies/${editingCurrency.id}`, payload, config);
        showToast('Currency updated successfully', 'success');
      } else {
        await axios.post('/api/finance/currencies', payload, config);
        showToast('Currency created successfully', 'success');
      }
      
      closeModal();
      fetchCurrencies();
    } catch (error) {
      console.error('Failed to save currency:', error);
      showToast(error.response?.data?.error || 'Failed to save currency', 'error');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Currency',
      message: 'Are you sure you want to delete this currency? This action cannot be undone and will fail if the currency is used by any products or transactions.',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/finance/currencies/${id}`, config);
      showToast('Currency deleted successfully', 'success');
      fetchCurrencies();
    } catch (error) {
      console.error('Failed to delete currency:', error);
      showToast(error.response?.data?.error || 'Failed to delete currency', 'error');
    }
  };

  const openModal = (currency = null) => {
    if (currency) {
      setEditingCurrency(currency);
      setFormData({
        code: currency.code,
        symbol: currency.symbol || '',
        name: currency.name,
        exchangeRate: currency.exchangeRate.toString(),
        isBase: currency.isBase
      });
    } else {
      setEditingCurrency(null);
      setFormData({
        code: '',
        symbol: '',
        name: '',
        exchangeRate: '1.0',
        isBase: false
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCurrency(null);
    setFormData({
      code: '',
      symbol: '',
      name: '',
      exchangeRate: '1.0',
      isBase: false
    });
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'code',
      fontWeight: 700
    },
    {
      header: 'Name',
      accessor: 'name'
    },
    {
      header: 'Symbol',
      accessor: 'symbol',
      align: 'center'
    },
    {
      header: 'Exchange Rate',
      accessor: 'exchangeRate',
      align: 'right',
      render: (row) => parseFloat(row.exchangeRate).toFixed(4)
    },
    {
      header: 'Base Currency',
      accessor: 'isBase',
      align: 'center',
      render: (row) => (
        <span style={{ 
          color: row.isBase ? 'var(--accent)' : 'var(--text-muted)', 
          fontWeight: 700, 
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.02em'
        }}>
          {row.isBase ? 'BASE' : 'SECONDARY'}
        </span>
      )
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
      <Plus size={16} /> New Currency
    </button>
  );

  return (
    <AppLayout title="Currencies" icon={Banknote}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={currencies}
            loading={loading}
            searchPlaceholder="Search Currencies..."
            searchKeys={['code', 'name']}
            extraActions={extraActions}
            onRowClick={(row) => openModal(row)}
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={closeModal}
            title={editingCurrency ? 'Update Currency' : 'Create Currency'}
            subtitle={editingCurrency ? 'Modify currency configurations.' : 'Define a new transaction currency.'}
            icon={Banknote}
          >
            <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Currency Code <span style={{ color: 'var(--error)' }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      name="code" 
                      value={formData.code} 
                      onChange={handleInputChange} 
                      placeholder="e.g. USD, EUR, INR" 
                      style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                      required 
                      disabled={!!editingCurrency}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Symbol
                    </label>
                    <input 
                      type="text" 
                      name="symbol" 
                      value={formData.symbol} 
                      onChange={handleInputChange} 
                      placeholder="e.g. $, €, ₹" 
                      style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Currency Name <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    placeholder="e.g. US Dollar, Euro, Indian Rupee" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Exchange Rate <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    type="number" 
                    step="0.0001"
                    name="exchangeRate" 
                    value={formData.exchangeRate} 
                    onChange={handleInputChange} 
                    placeholder="1.0" 
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                    required 
                  />
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Exchange rate relative to base currency.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isBase: !prev.isBase }))}
                    style={{
                      width: '46px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: formData.isBase ? 'var(--accent)' : '#cbd5e1',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      padding: 0,
                      display: 'block'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: '3px',
                      left: formData.isBase ? '25px' : '3px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                    }} />
                  </button>
                  <label 
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                    onClick={() => setFormData(prev => ({ ...prev, isBase: !prev.isBase }))}
                  >
                    Set as Base Currency
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={closeModal} style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#ffffff' }}>
                  {editingCurrency ? 'Update' : 'Create'}
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

