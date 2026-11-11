import React, { useState, useEffect } from 'react';
import { Plus, Users as UsersIcon, X, Save, Lock } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';

export default function Users() {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: '',
    status: 'ACTIVE'
  });

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/roles', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      ]);
      
      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      
      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to fetch users');
      if (!rolesRes.ok) throw new Error(rolesData.error || 'Failed to fetch roles');
      
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openForm = (user = null) => {
    if (user) {
      setCurrentUser(user);
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email,
        password: '', // Blank when editing
        roleId: user.roleId || '',
        status: user.status || 'ACTIVE'
      });
    } else {
      setCurrentUser(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roleId: '',
        status: 'ACTIVE'
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setCurrentUser(null);
  };

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!String(formData.email || '').trim()) errors.email = 'Email is required.';
    if (!currentUser && !String(formData.password || '').trim()) errors.password = 'Password is required.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      addToast(Object.values(errors)[0], 'error');
      return;
    }
    setFieldErrors({});
    try {
      const url = currentUser ? `/api/users/${currentUser.id}` : '/api/users';
      const method = currentUser ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      if (currentUser && !payload.password) {
        delete payload.password; // Don't send empty password if editing
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');
      
      addToast(`User ${currentUser ? 'updated' : 'created'} successfully`, 'success');
      closeForm();
      fetchData();
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  const columns = [
    {
      header: 'User',
      accessor: 'firstName',
      fontWeight: 600,
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
            {(row.firstName?.[0] || '')}{(row.lastName?.[0] || '')}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>{row.firstName} {row.lastName}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Email',
      accessor: 'email',
      color: '#64748b'
    },
    {
      header: 'Role',
      accessor: 'role.name',
      render: (row) => (
        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
          {row.role?.name || 'No Role'}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span style={{ 
          fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600,
          backgroundColor: row.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
          color: row.status === 'ACTIVE' ? '#166534' : '#991b1b'
        }}>
          {row.status}
        </span>
      )
    }
  ];

  const extraActions = (
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
      Create User
    </button>
  );

  return (
    <AppLayout title="System Users" icon={UsersIcon}>
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>System Users</h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>Manage system access and user accounts</p>
          </div>
        </div>

        {isFormOpen && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', marginBottom: '2rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{currentUser ? 'Edit User' : 'New User'}</h2>
              <button onClick={closeForm} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={!!currentUser}
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', backgroundColor: currentUser ? '#f8fafc' : 'white' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                    {currentUser ? 'Reset Password (optional)' : 'Password'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="password"
                      required={!currentUser}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      placeholder={currentUser ? 'Leave blank to keep current' : 'Enter strong password'}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Assign Role</label>
                  <select
                    required
                    value={formData.roleId}
                    onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', backgroundColor: 'white' }}
                  >
                    <option value="">Select a role...</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', backgroundColor: 'white' }}
                  >
                    <option value="ACTIVE">Active (Can Login)</option>
                    <option value="INACTIVE">Inactive (Access Revoked)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={closeForm} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={16} /> Save User
                </button>
              </div>
            </form>
          </div>
        )}

        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          searchPlaceholder="Search users..."
          searchKeys={['firstName', 'lastName', 'email', 'role.name']}
          extraActions={extraActions}
          onRowClick={(row) => openForm(row)}
        />
      </div>
    </AppLayout>
  );
}
