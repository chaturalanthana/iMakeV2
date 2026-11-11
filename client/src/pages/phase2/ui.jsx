import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { ArrowLeft, Check, Plus, Trash2, FileText, Calendar, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export const labelStyle = {
  fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase',
  letterSpacing: '0.025em', width: '250px', flexShrink: 0, margin: 0
};
export const formRowStyle = { display: 'flex', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '550px' };
export const inputStyle = {
  width: '100%', height: '42px', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1',
  outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff'
};
export const sectionHeaderStyle = {
  fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem', marginBottom: '1.25rem'
};
const newButtonStyle = {
  display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem',
  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
  border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap'
};

export function useApiList(url) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(url, authConfig());
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setInitial(false);
    }
  };
  useEffect(() => { load(); }, [url]);
  return { rows, loading, initial, reload: load };
}

export function OriginalList({ title, icon, columns, rows, loading, initial, searchPlaceholder, searchKeys, onRowClick, newLabel, onNew }) {
  return (
    <AppLayout title={title} icon={icon}>
      {initial ? <PageSkeleton type="table" /> : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          searchKeys={searchKeys}
          onRowClick={onRowClick}
          extraActions={newLabel ? (
            <button onClick={onNew} style={newButtonStyle} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
              <Plus size={16} /> {newLabel}
            </button>
          ) : null}
        />
      )}
    </AppLayout>
  );
}

export function Field({ label, required, error, children }) {
  return (
    <div style={formRowStyle}>
      <label style={labelStyle}>{label} {required ? <span style={{ color: 'red' }}>*</span> : null}</label>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        {children}
        {error ? <span className="field-error-text">{error}</span> : null}
      </div>
    </div>
  );
}

export function MasterForm({ title, subtitle, backTo, tabs, activeTab, setActiveTab, onSubmit, saving, saveLabel, activeStatus, setActiveStatus, children }) {
  const navigate = useNavigate();
  return (
    <AppLayout title={title} icon={FileText}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button type="button" onClick={() => navigate(backTo)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: '0.45rem', display: 'flex', alignItems: 'center', color: '#64748b' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1.25rem' }}>{title}</h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{subtitle}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {setActiveStatus ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginRight: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Active Status</span>
              <button type="button" onClick={() => setActiveStatus(activeStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} style={{ width: '46px', height: '24px', borderRadius: '12px', backgroundColor: activeStatus === 'ACTIVE' ? 'var(--accent)' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', padding: 0 }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '3px', left: activeStatus === 'ACTIVE' ? '25px' : '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
              </button>
            </div>
          ) : null}
          <button type="button" onClick={() => navigate(backTo)} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.55rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancel</button>
          <button type="button" onClick={onSubmit} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : <><Check size={16} /> {saveLabel}</>}
          </button>
        </div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ width: '100%', maxWidth: '1200px', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.75rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', backgroundColor: isActive ? 'var(--accent-light)' : 'transparent', color: isActive ? 'var(--accent)' : '#64748b', width: '100%', fontFamily: 'inherit' }}>
                <Icon size={18} style={{ color: isActive ? 'var(--accent)' : '#64748b' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em', color: isActive ? 'var(--accent)' : '#334155' }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flexGrow: 1, minWidth: 0 }}>{children}</div>
      </form>
    </AppLayout>
  );
}

export function LineTable({ columns, rows, onChange, onAdd, onRemove }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid var(--border-color)' }}>
          <tr>
            <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '40px' }}>#</th>
            {columns.map((column) => (
              <th key={column.key} style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{column.label}</th>
            ))}
            <th style={{ width: '40px' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{index + 1}</td>
              {columns.map((column) => (
                <td key={column.key} style={{ padding: '0.5rem 1rem' }}>
                  {column.options ? (
                    <select value={row[column.key] || ''} onChange={(event) => onChange(row.id, column.key, event.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.9rem', fontWeight: 600, outline: 'none' }}>
                      <option value="">Select</option>
                      {column.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input type={column.type || 'text'} value={row[column.key] ?? ''} onChange={(event) => onChange(row.id, column.key, event.target.value)} placeholder={column.placeholder || ''} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.9rem', fontWeight: 600, outline: 'none', textAlign: column.type === 'number' ? 'right' : 'left' }} />
                  )}
                </td>
              ))}
              <td style={{ textAlign: 'center' }}>
                <button type="button" onClick={() => onRemove(row.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
          <tr style={{ cursor: 'pointer' }} onClick={onAdd}>
            <td />
            <td colSpan={columns.length} style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}><Plus size={16} /> Add new line</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ReportFilter({ fromDate, setFromDate, toDate, setToDate, onExport, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}><Calendar size={16} /> Date Range:</div>
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>to</span>
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none', backgroundColor: '#fff' }} />
        {children}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
          <Printer size={16} /> Print
        </button>
        <button type="button" onClick={onExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
          Export XLSX
        </button>
      </div>
    </div>
  );
}

export function applyServerErrors(error, showToast, setFieldErrors) {
  const fields = error.response?.data?.fields || {};
  if (setFieldErrors) setFieldErrors(fields);
  showToast(error.response?.data?.error || 'Could not save.', 'error');
}

export function ConfirmHost({ confirm, setConfirm }) {
  return (
    <ConfirmModal
      isOpen={confirm.isOpen}
      onClose={() => setConfirm({ ...confirm, isOpen: false })}
      onConfirm={confirm.onConfirm}
      title={confirm.title}
      message={confirm.message}
      confirmText={confirm.confirmText || 'Confirm'}
    />
  );
}

export function useInitialDone() {
  const [initial, setInitial] = useState(true);
  useEffect(() => { setInitial(false); }, []);
  return initial;
}
