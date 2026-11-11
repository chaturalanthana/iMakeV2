import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { Users, Plus, Pencil, Trash2, X, CheckCircle, Briefcase, Phone, Mail, Calendar } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { confirmDialog } from '../../components/ui/appDialog';

const FIELD_STYLE = { width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box' };
const LABEL_STYLE = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' };

const DEPT_OPTIONS = ['Engineering', 'Finance', 'HR', 'Sales', 'Operations', 'Marketing', 'IT', 'Legal', 'Admin', 'Other'];

export default function Employees() {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    empCode: '', firstName: '', lastName: '', email: '', phone: '',
    department: '', designation: '', dateOfJoining: new Date().toISOString().split('T')[0],
    basicSalary: '', status: 'ACTIVE'
  });

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/hr/employees', authConfig());
      setEmployees(res.data);
    } catch (err) {
      showToast('Failed to fetch employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ empCode: `EMP-${Date.now().toString().slice(-4)}`, firstName: '', lastName: '', email: '', phone: '', department: '', designation: '', dateOfJoining: new Date().toISOString().split('T')[0], basicSalary: '', status: 'ACTIVE' });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingId(emp.id);
    setForm({
      empCode: emp.empCode, firstName: emp.firstName, lastName: emp.lastName,
      email: emp.email || '', phone: emp.phone || '', department: emp.department || '',
      designation: emp.designation || '', dateOfJoining: emp.dateOfJoining?.split('T')[0] || '',
      basicSalary: emp.basicSalary?.toString() || '', status: emp.status
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.empCode || !form.firstName || !form.lastName || !form.dateOfJoining) {
      return showToast('Please fill required fields: Code, First Name, Last Name, Date of Joining', 'error');
    }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`/api/hr/employees/${editingId}`, form, authConfig());
        showToast('Employee updated', 'success');
      } else {
        await axios.post('/api/hr/employees', form, authConfig());
        showToast('Employee created', 'success');
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save employee', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!(await confirmDialog({ title: 'Delete employee', message: `Delete employee "${name}"?` }))) return;
    try {
      await axios.delete(`/api/hr/employees/${id}`, authConfig());
      showToast('Employee deleted', 'success');
      fetchEmployees();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'ACTIVE').length,
    inactive: employees.filter(e => e.status === 'INACTIVE').length,
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'empCode',
      fontWeight: 600
    },
    {
      header: 'Employee Name',
      accessor: 'firstName',
      fontWeight: 500,
      render: (row) => `${row.firstName} ${row.lastName}`
    },
    {
      header: 'Department',
      accessor: 'department',
      render: (row) => row.department || '-'
    },
    {
      header: 'Designation',
      accessor: 'designation',
      render: (row) => row.designation || '-'
    },
    {
      header: 'Contact Info',
      accessor: 'email',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          {row.email && <span style={{ color: 'var(--text-main)' }}>{row.email}</span>}
          {row.phone && <span style={{ color: '#64748b' }}>{row.phone}</span>}
          {!row.email && !row.phone && <span>-</span>}
        </div>
      )
    },
    {
      header: 'Joining Date',
      accessor: 'dateOfJoining',
      render: (row) => row.dateOfJoining ? new Date(row.dateOfJoining).toLocaleDateString() : '-'
    },
    {
      header: 'Basic Salary',
      accessor: 'basicSalary',
      align: 'right',
      render: (row) => '$' + parseFloat(row.basicSalary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => openEdit(row)} 
            style={{ 
              padding: '0.35rem', 
              borderRadius: '6px', 
              border: '1px solid #e2e8f0', 
              background: '#fff', 
              cursor: 'pointer', 
              color: '#64748b', 
              display: 'flex', 
              alignItems: 'center' 
            }} 
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button 
            onClick={() => handleDelete(row.id, `${row.firstName} ${row.lastName}`)} 
            style={{ 
              padding: '0.35rem', 
              borderRadius: '6px', 
              border: '1px solid #fecaca', 
              background: '#fef2f2', 
              cursor: 'pointer', 
              color: '#dc2626', 
              display: 'flex', 
              alignItems: 'center' 
            }} 
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  const extraActions = (
    <button onClick={openCreate} style={{
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
      <Plus size={16} /> Add Employee
    </button>
  );

  return (
    <AppLayout title="Employees" icon={Users}>
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Employees', value: stats.total, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Active', value: stats.active, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Inactive', value: stats.inactive, color: '#dc2626', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</span>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        searchPlaceholder="Search employee code, name, department..."
        searchKeys={['empCode', 'firstName', 'lastName', 'email', 'phone', 'department', 'designation']}
        extraActions={extraActions}
        onRowClick={(row) => openEdit(row)}
      />

      {/* Modal */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{editingId ? 'Edit Employee' : 'Add Employee'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                { label: 'Employee Code *', key: 'empCode', span: 1 },
                { label: 'Status', key: 'status', type: 'select', options: ['ACTIVE', 'INACTIVE'], span: 1 },
                { label: 'First Name *', key: 'firstName', span: 1 },
                { label: 'Last Name *', key: 'lastName', span: 1 },
                { label: 'Email', key: 'email', span: 1 },
                { label: 'Phone', key: 'phone', span: 1 },
                { label: 'Department', key: 'department', type: 'select', options: ['', ...DEPT_OPTIONS], span: 1 },
                { label: 'Designation', key: 'designation', span: 1 },
                { label: 'Date of Joining *', key: 'dateOfJoining', type: 'date', span: 1 },
                { label: 'Basic Salary', key: 'basicSalary', type: 'number', span: 1 },
              ].map(field => (
                <div key={field.key} style={{ gridColumn: field.span === 2 ? 'span 2' : 'span 1' }}>
                  <label style={LABEL_STYLE}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} style={FIELD_STYLE}>
                      {field.options.map(o => <option key={o} value={o}>{o || '— None —'}</option>)}
                    </select>
                  ) : (
                    <input type={field.type || 'text'} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} style={FIELD_STYLE} autoComplete="off" />
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
                <CheckCircle size={16} /> {saving ? 'Saving...' : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
