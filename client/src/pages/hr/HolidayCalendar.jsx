import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, X, CheckCircle, Trash2, Pencil } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { confirmDialog } from '../../components/ui/appDialog';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TYPE_CONFIG = {
  PUBLIC:     { label: 'Public Holiday',     color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  RESTRICTED: { label: 'Restricted Holiday', color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  OPTIONAL:   { label: 'Optional Holiday',   color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', dot: '#7c3aed' },
};

const FIELD_STYLE = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};
const LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem'
};

function toDateKey(date) {
  // Returns YYYY-MM-DD in LOCAL time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalDateKey(isoString) {
  // Convert UTC ISO string to local YYYY-MM-DD
  const d = new Date(isoString);
  return toDateKey(d);
}

export default function HolidayCalendar() {
  const { showToast } = useToast();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [holidays, setHolidays] = useState([]); // all for current year
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null); // null = create
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', description: '', type: 'PUBLIC' });

  const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await axios.get('/api/hr/holidays', { ...authConfig(), params: { year: viewYear } });
      setHolidays(res.data);
    } catch {
      showToast('Failed to load holidays', 'error');
    }
  }, [viewYear]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  // Build a map: "YYYY-MM-DD" -> [holiday, ...]
  const holidayMap = {};
  holidays.forEach(h => {
    const key = toLocalDateKey(h.date);
    if (!holidayMap[key]) holidayMap[key] = [];
    holidayMap[key].push(h);
  });

  // Calendar grid calculation
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const openCreateModal = (dateStr) => {
    setEditingHoliday(null);
    setForm({ date: dateStr, name: '', description: '', type: 'PUBLIC' });
    setShowModal(true);
  };

  const openEditModal = (holiday, e) => {
    e.stopPropagation();
    setEditingHoliday(holiday);
    setForm({
      date: toLocalDateKey(holiday.date),
      name: holiday.name,
      description: holiday.description || '',
      type: holiday.type
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('Holiday name is required', 'error');
    if (!form.date) return showToast('Date is required', 'error');
    setSaving(true);
    try {
      if (editingHoliday) {
        await axios.put(`/api/hr/holidays/${editingHoliday.id}`, form, authConfig());
        showToast('Holiday updated', 'success');
      } else {
        await axios.post('/api/hr/holidays', form, authConfig());
        showToast('Holiday added', 'success');
      }
      setShowModal(false);
      fetchHolidays();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save holiday', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (!(await confirmDialog({ title: 'Remove holiday', message: `Remove holiday "${name}"?` }))) return;
    try {
      await axios.delete(`/api/hr/holidays/${id}`, authConfig());
      showToast('Holiday removed', 'success');
      fetchHolidays();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  // Stats
  const monthHolidays = holidays.filter(h => {
    const d = new Date(h.date);
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  const todayKey = toDateKey(today);

  return (
    <AppLayout title="Holiday Calendar" icon={CalendarCheck}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Month Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={prevMonth} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ minWidth: '180px', textAlign: 'center' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{MONTHS[viewMonth]}</span>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b', marginLeft: '0.5rem' }}>{viewYear}</span>
          </div>
          <button onClick={nextMonth} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <ChevronRight size={18} />
          </button>
          <button onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }} style={{ padding: '0.4rem 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>
            Today
          </button>
        </div>

        {/* Legend + Month holiday count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {Object.entries(TYPE_CONFIG).map(([key, tc]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: tc.dot }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>{tc.label}</span>
            </div>
          ))}
          <div style={{ padding: '0.35rem 0.875rem', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.8rem' }}>
            {monthHolidays.length} holiday{monthHolidays.length !== 1 ? 's' : ''} this month
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #e2e8f0' }}>
          {DAYS_SHORT.map((d, i) => (
            <div key={d} style={{ padding: '0.75rem 0', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: i === 0 || i === 6 ? '#94a3b8' : '#475569', background: '#f8fafc', borderRight: i < 6 ? '1px solid #f1f5f9' : 'none' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - firstDay + 1;
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const cellDate = new Date(viewYear, viewMonth, dayNum);
            const dateKey = isCurrentMonth ? toDateKey(cellDate) : null;
            const isToday = dateKey === todayKey;
            const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
            const dayHolidays = dateKey ? (holidayMap[dateKey] || []) : [];
            const colIndex = i % 7;
            const rowIndex = Math.floor(i / 7);
            const totalRows = totalCells / 7;

            return (
              <div
                key={i}
                onClick={() => isCurrentMonth && openCreateModal(dateKey)}
                style={{
                  minHeight: '110px',
                  padding: '0.5rem',
                  borderRight: colIndex < 6 ? '1px solid #f1f5f9' : 'none',
                  borderBottom: rowIndex < totalRows - 1 ? '1px solid #f1f5f9' : 'none',
                  background: !isCurrentMonth ? '#fafafa' : isToday ? 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' : isWeekend ? '#fefefe' : '#fff',
                  cursor: isCurrentMonth ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
                onMouseEnter={e => { if (isCurrentMonth) e.currentTarget.style.background = isToday ? 'linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%)' : '#f0f7ff'; }}
                onMouseLeave={e => {
                  if (isCurrentMonth) e.currentTarget.style.background = isToday
                    ? 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)'
                    : isWeekend ? '#fefefe' : '#fff';
                }}
              >
                {/* Day Number */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: isToday ? 800 : 600,
                    color: !isCurrentMonth ? '#d1d5db' : isToday ? '#fff' : isWeekend ? '#94a3b8' : '#1e293b',
                    background: isToday ? 'var(--accent)' : 'transparent',
                    width: '26px', height: '26px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isCurrentMonth ? dayNum : ''}
                  </span>
                  {isCurrentMonth && dayHolidays.length === 0 && (
                    <span style={{ opacity: 0, fontSize: '0.7rem', color: '#94a3b8', transition: 'opacity 0.15s' }} className="add-hint">
                      <Plus size={12} />
                    </span>
                  )}
                </div>

                {/* Holiday Chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  {dayHolidays.map(h => {
                    const tc = TYPE_CONFIG[h.type] || TYPE_CONFIG.PUBLIC;
                    return (
                      <div key={h.id} onClick={e => openEditModal(h, e)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: tc.bg, border: `1px solid ${tc.border}`,
                        borderRadius: '5px', padding: '2px 5px',
                        cursor: 'pointer', gap: '4px',
                        transition: 'opacity 0.15s'
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: tc.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: tc.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.name}
                          </span>
                        </div>
                        <button
                          onClick={e => handleDelete(h.id, h.name, e)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: tc.color, display: 'flex', alignItems: 'center', opacity: 0.6, padding: 0, flexShrink: 0 }}
                          title="Remove"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Year Holiday List Panel */}
      {holidays.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
              All Holidays — {viewYear}
              <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>({holidays.length} total)</span>
            </h3>
          </div>
          <div style={{ padding: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
            {holidays.map(h => {
              const tc = TYPE_CONFIG[h.type] || TYPE_CONFIG.PUBLIC;
              const d = new Date(h.date);
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', padding: '0.625rem 0.875rem', borderRadius: '8px', gap: '0.75rem', border: `1px solid ${tc.border}`, background: tc.bg }}>
                  <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '42px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: tc.color, lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: tc.color, opacity: 0.7, textTransform: 'uppercase' }}>{MONTHS[d.getMonth()].slice(0, 3)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: tc.color, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                    <div style={{ fontSize: '0.72rem', color: tc.color, opacity: 0.7 }}>{DAYS_SHORT[d.getDay()]} · {tc.label}</div>
                    {h.description && <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button onClick={e => openEditModal(h, e)} style={{ padding: '0.3rem', borderRadius: '5px', border: `1px solid ${tc.border}`, background: '#fff', cursor: 'pointer', color: tc.color, display: 'flex' }}><Pencil size={12} /></button>
                    <button onClick={e => handleDelete(h.id, h.name, e)} style={{ padding: '0.3rem', borderRadius: '5px', border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '460px', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            {/* Modal Header with gradient */}
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                </h3>
                {form.date && (
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>
                    {new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                )}
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: '8px', padding: '0.4rem', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Date */}
              <div>
                <label style={LABEL_STYLE}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={FIELD_STYLE} />
              </div>

              {/* Name */}
              <div>
                <label style={LABEL_STYLE}>Holiday Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={FIELD_STYLE} placeholder="e.g. Christmas Day" autoFocus autoComplete="off" />
              </div>

              {/* Type */}
              <div>
                <label style={LABEL_STYLE}>Holiday Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
                  {Object.entries(TYPE_CONFIG).map(([key, tc]) => (
                    <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))} style={{
                      padding: '0.6rem 0.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', textAlign: 'center',
                      border: `2px solid ${form.type === key ? tc.dot : '#e2e8f0'}`,
                      background: form.type === key ? tc.bg : '#fff',
                      color: form.type === key ? tc.color : '#64748b',
                      transition: 'all 0.15s'
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: tc.dot, margin: '0 auto 4px' }} />
                      {tc.label.replace(' Holiday', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={LABEL_STYLE}>Description <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span></label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Any notes about this holiday..." style={{ ...FIELD_STYLE, height: 'auto', padding: '0.625rem 0.875rem', resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {editingHoliday ? (
                <button onClick={e => handleDelete(editingHoliday.id, editingHoliday.name, e)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                  <Trash2 size={14} /> Delete
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
                  <CheckCircle size={16} /> {saving ? 'Saving...' : editingHoliday ? 'Update' : 'Add Holiday'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}
