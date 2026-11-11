import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  Trash2, ShieldCheck, CheckCircle2, RefreshCw, Database, 
  UserCheck, ArrowRight, AlertTriangle, Package, ShoppingCart, 
  Users, Layers, ArrowRightCircle, X
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function SystemSettings() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const adminEmail = currentUser.email || 'Admin';

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const res = await axios.post('/api/system/flush', {}, authHeader());
      setShowConfirmModal(false);
      setFlushResult(res.data);
      showToast(res.data.message || 'System data flushed successfully.', 'success', 6000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to flush system data';
      showToast(msg, 'error');
    } finally {
      setFlushing(false);
    }
  };

  return (
    <AppLayout title="System Maintenance" icon={Database}>
      <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
        
        {/* Header Bar */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '0.625rem', borderRadius: '8px', color: 'var(--accent)' }}>
              <Database size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                System Data Flush
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Reset workspace data while retaining the primary administrator
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.45rem 0.85rem', borderRadius: '8px' }}>
            <UserCheck size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {adminEmail}
            </span>
          </div>
        </div>

        {/* Flush Success Notice */}
        {flushResult && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--success)', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <CheckCircle2 size={24} color="var(--success)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.95rem' }}>System Flushed</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Retained Admin: <strong>{flushResult.keptUser?.email}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => navigate('/settings/users')}
                style={{
                  padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600,
                  borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: '#ffffff', color: 'var(--text-main)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.35rem'
                }}
              >
                Users <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600,
                  borderRadius: '8px', border: '1px solid var(--accent)',
                  background: 'var(--accent)', color: '#ffffff', cursor: 'pointer'
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Icon-driven Flush Overview Card */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Visual Data Flow Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
            
            {/* Cleared Section */}
            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <Trash2 size={16} />
                <span>CLEARED DATA</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: '#991b1b', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <ShoppingCart size={15} /> Orders & Invoices
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: '#991b1b', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <Package size={15} /> Inventory & Stock
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: '#991b1b', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <Layers size={15} /> Products & BOMs
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: '#991b1b', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <Users size={15} /> Staff Users
                </div>
              </div>
            </div>

            {/* Transition Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
              <ArrowRightCircle size={26} />
            </div>

            {/* Preserved Section */}
            <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <ShieldCheck size={16} />
                <span>PRESERVED ASSETS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: '#166534', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  <UserCheck size={15} /> Admin: <strong>{adminEmail}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: '#166534', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  <Database size={15} /> Super Admin Role & Standard Chart of Accounts
                </div>
              </div>
            </div>

          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={flushing}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: '1px solid #dc2626',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: flushing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'none'
              }}
            >
              {flushing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Flushing System Data...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Execute System Data Flush</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Clean Icon-Driven Confirmation Modal */}
      {showConfirmModal && createPortal(
        <div className="modal-backdrop">
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <AlertTriangle size={20} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  System Data Flush
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Icon Driven Action Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              
              {/* Purged Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#dc2626', padding: '0.4rem', borderRadius: '6px', display: 'flex' }}>
                  <Trash2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991b1b' }}>Purge Operational Data</div>
                  <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Orders, inventory, products & staff accounts</div>
                </div>
              </div>

              {/* Retained Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', color: '#16a34a', padding: '0.4rem', borderRadius: '6px', display: 'flex' }}>
                  <UserCheck size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>Retain Admin Account</div>
                  <div style={{ fontSize: '0.75rem', color: '#15803d' }}>{adminEmail}</div>
                </div>
              </div>

            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                disabled={flushing}
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: flushing ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={flushing}
                onClick={handleFlush}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #dc2626',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: flushing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                {flushing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Flushing...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Flush System Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
