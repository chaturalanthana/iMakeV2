import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, X, Check, Save } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';

const SYSTEM_MODULES = [
  { id: 'settings', name: 'Settings (Roles & Users)' },
  { id: 'products', name: 'Products & Catalogs' },
  { id: 'sales', name: 'Sales & Invoices' },
  { id: 'procurement', name: 'Procurement & Purchases' },
  { id: 'finance', name: 'Finance & Accounts' },
  { id: 'hr', name: 'Human Resources' },
  { id: 'warehouse', name: 'Inventory & Warehousing' },
  { id: 'production', name: 'Production & Manufacturing' },
  { id: 'costing', name: 'Costing' },
];

export default function Roles() {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  
  // form state
  const [formData, setFormData] = useState({ name: '', description: '', permissions: {} });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch roles');
      setRoles(data);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openForm = (role = null) => {
    if (role) {
      setCurrentRole(role);
      setFormData({ name: role.name, description: role.description || '', permissions: role.permissions || {} });
    } else {
      setCurrentRole(null);
      setFormData({ name: '', description: '', permissions: {} });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setCurrentRole(null);
  };

  const togglePermission = (moduleId, action) => {
    setFormData(prev => {
      const modulePerms = prev.permissions[moduleId] || [];
      let newModulePerms;
      
      if (modulePerms.includes(action)) {
        newModulePerms = modulePerms.filter(a => a !== action);
      } else {
        newModulePerms = [...modulePerms, action];
      }
      
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: newModulePerms
        }
      };
    });
  };

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!String(formData.name || '').trim()) {
      setFieldErrors({ name: 'Role name is required.' });
      addToast('Role name is required.', 'error');
      return;
    }
    setFieldErrors({});
    try {
      const url = currentRole ? `/api/roles/${currentRole.id}` : '/api/roles';
      const method = currentRole ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');
      
      addToast(`Role ${currentRole ? 'updated' : 'created'} successfully`, 'success');
      closeForm();
      fetchRoles();
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  const handleDeleteTrigger = (id) => {
    setDeleteTargetId(id);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/roles/${deleteTargetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete role');
      
      addToast('Role deleted successfully', 'success');
      fetchRoles();
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setIsConfirmOpen(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <AppLayout>
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Roles & Permissions</h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>Define employee levels and manage module access</p>
          </div>
          <button
            onClick={() => openForm()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: 'var(--accent)', color: 'white',
              border: 'none', padding: '0.6rem 1.2rem',
              borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
              boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)'
            }}
          >
            <Plus size={18} />
            Create Role
          </button>
        </div>

        <Modal
          isOpen={isFormOpen}
          onClose={closeForm}
          title={currentRole ? 'Edit Role' : 'New Role'}
          icon={Shield}
          maxWidth="850px"
        >
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Role Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  placeholder="e.g. Sales Manager"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  placeholder="Brief description of responsibilities"
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Permissions Matrix</h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', width: '40%' }}>Module</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', width: '30%' }}>Read Access</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', width: '30%' }}>Write Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SYSTEM_MODULES.map((module, index) => {
                      const canRead = formData.permissions[module.id]?.includes('read') || formData.permissions.all;
                      const canWrite = formData.permissions[module.id]?.includes('write') || formData.permissions.all;
                      const isSystemRole = currentRole?.isSystem;

                      return (
                        <tr key={module.id} style={{ borderBottom: index < SYSTEM_MODULES.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>
                            {module.name}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: isSystemRole ? 'not-allowed' : 'pointer', gap: '0.5rem' }}>
                              <input 
                                type="checkbox" 
                                checked={canRead}
                                disabled={isSystemRole || formData.permissions.all}
                                onChange={() => togglePermission(module.id, 'read')}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                              />
                              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Read</span>
                            </label>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: isSystemRole ? 'not-allowed' : 'pointer', gap: '0.5rem' }}>
                              <input 
                                type="checkbox" 
                                checked={canWrite}
                                disabled={isSystemRole || formData.permissions.all}
                                onChange={() => togglePermission(module.id, 'write')}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                              />
                              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Create/Edit</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {currentRole?.isSystem && (
                <p style={{ fontSize: '0.85rem', color: '#eab308', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Shield size={14} /> System roles have full access and cannot be modified.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <button type="button" onClick={closeForm} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={currentRole?.isSystem} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: currentRole?.isSystem ? '#cbd5e1' : 'var(--accent)', color: 'white', fontWeight: 600, cursor: currentRole?.isSystem ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Save size={16} /> Save Role
              </button>
            </div>
          </form>
        </Modal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {roles.map(role => (
            <div key={role.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {role.isSystem && <Shield size={16} color="#4f46e5" />}
                    {role.name}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{role.description || 'No description provided'}</p>
                </div>
                {!role.isSystem && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => openForm(role)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer' }} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteTrigger(role.id)} style={{ background: '#fef2f2', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                {role.isSystem && (
                   <button onClick={() => openForm(role)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer' }} title="View">
                    <Edit2 size={14} />
                 </button>
                )}
              </div>
              
              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Access Level</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {role.permissions?.all ? (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>Full System Access</span>
                  ) : (
                    Object.entries(role.permissions).map(([mod, actions]) => (
                      actions.length > 0 && (
                        <span key={mod} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 500, textTransform: 'capitalize' }}>
                          {mod} ({actions.join(', ')})
                        </span>
                      )
                    ))
                  )}
                  {(!role.permissions || Object.keys(role.permissions).length === 0) && (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No permissions assigned</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {roles.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <Shield size={40} color="#94a3b8" style={{ marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#475569', margin: '0 0 0.5rem 0' }}>No Roles Found</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Get started by creating a new role for your employees.</p>
            </div>
          )}
        </div>
        <ConfirmModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Delete Role"
          message="Are you sure you want to delete this role?"
        />
      </div>
    </AppLayout>
  );
}
