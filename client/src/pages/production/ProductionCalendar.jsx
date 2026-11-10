import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, X, CheckCircle, 
  Trash2, Pencil, Clock, Settings, ShieldAlert, Sliders, Play
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import Modal from '../../components/ui/Modal';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EVENT_TYPE_CONFIG = {
  HOLIDAY: { label: 'Public Holiday', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  MAINTENANCE: { label: 'Maintenance Day', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5', dot: '#ea580c' },
  OVERTIME: { label: 'Overtime Day', color: '#16a34a', bg: '#f0fdf4', border: '#dcfce7', dot: '#16a34a' },
  SHIFT_EXCEPTION: { label: 'Shift Exception', color: '#9333ea', bg: '#faf5ff', border: '#f3e8ff', dot: '#9333ea' }
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalDateKey(isoString) {
  const d = new Date(isoString);
  return toDateKey(d);
}

export default function ProductionCalendar() {
  const { showToast } = useToast();
  const today = new Date();
  
  const [activeView, setActiveView] = useState('calendar'); // 'calendar' or 'shifts'
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  
  const [events, setEvents] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    type: 'HOLIDAY', date: '', name: '', description: '', shiftPatternId: '', workCenterId: '', metadata: {}
  });

  // Shift modal state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: '', startTime: '08:00', endTime: '16:00', workDays: [1,2,3,4,5], description: ''
  });

  const authConfig = useCallback(() => ({ 
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
  }), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const config = authConfig();
      const [eventsRes, shiftsRes] = await Promise.all([
        axios.get('/api/production-calendar/events', { ...config, params: { year: viewYear, month: viewMonth } }),
        axios.get('/api/production-calendar/shifts', config)
      ]);
      setEvents(eventsRes.data);
      setShifts(shiftsRes.data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load production calendar data', 'error');
    } finally {
      setLoading(false);
    }
  }, [viewMonth, viewYear, authConfig, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar event mappings
  const eventMap = {};
  events.forEach(e => {
    const key = toLocalDateKey(e.date);
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push(e);
  });

  // Calendar cells calculation
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
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

  // Event modal actions
  const openCreateEventModal = (dateStr) => {
    setEditingEvent(null);
    setEventForm({
      type: 'HOLIDAY',
      date: dateStr,
      name: '',
      description: '',
      shiftPatternId: '',
      workCenterId: '',
      metadata: {}
    });
    setShowEventModal(true);
  };

  const openEditEventModal = (event, e) => {
    if (e) e.stopPropagation();
    setEditingEvent(event);
    setEventForm({
      type: event.type,
      date: toLocalDateKey(event.date),
      name: event.name,
      description: event.description || '',
      shiftPatternId: event.shiftPatternId || '',
      workCenterId: event.workCenterId || '',
      metadata: event.metadata || {}
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.name.trim()) return showToast('Event name is required', 'error');
    if (!eventForm.date) return showToast('Date is required', 'error');
    setSaving(true);
    try {
      const config = authConfig();
      if (editingEvent) {
        await axios.put(`/api/production-calendar/events/${editingEvent.id}`, eventForm, config);
        showToast('Event updated successfully', 'success');
      } else {
        await axios.post('/api/production-calendar/events', eventForm, config);
        showToast('Event scheduled successfully', 'success');
      }
      setShowEventModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id, name, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete event "${name}"?`)) return;
    try {
      await axios.delete(`/api/production-calendar/events/${id}`, authConfig());
      showToast('Event deleted successfully', 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete event', 'error');
    }
  };

  // Shift modal actions
  const openCreateShiftModal = () => {
    setEditingShift(null);
    setShiftForm({
      name: '', startTime: '08:00', endTime: '16:00', workDays: [1,2,3,4,5], description: ''
    });
    setShowShiftModal(true);
  };

  const openEditShiftModal = (shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      workDays: shift.workDays || [],
      description: shift.description || ''
    });
    setShowShiftModal(true);
  };

  const handleSaveShift = async () => {
    if (!shiftForm.name.trim()) return showToast('Shift name is required', 'error');
    setSaving(true);
    try {
      const config = authConfig();
      if (editingShift) {
        await axios.put(`/api/production-calendar/shifts/${editingShift.id}`, shiftForm, config);
        showToast('Shift pattern updated', 'success');
      } else {
        await axios.post('/api/production-calendar/shifts', shiftForm, config);
        showToast('Shift pattern created', 'success');
      }
      setShowShiftModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save shift', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (id, name) => {
    if (!window.confirm(`Delete shift pattern "${name}"?`)) return;
    try {
      await axios.delete(`/api/production-calendar/shifts/${id}`, authConfig());
      showToast('Shift pattern removed', 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete shift', 'error');
    }
  };

  const todayKey = toDateKey(today);

  return (
    <AppLayout title="Production Calendar" icon={Calendar}>
      
      {/* Top Navigation & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Toggle between Calendar and Shifts views */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
          <button 
            onClick={() => setActiveView('calendar')}
            style={{
              padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              backgroundColor: activeView === 'calendar' ? '#fff' : 'transparent',
              color: activeView === 'calendar' ? 'var(--text-main)' : '#64748b',
              boxShadow: activeView === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Calendar view
          </button>
          <button 
            onClick={() => setActiveView('shifts')}
            style={{
              padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              backgroundColor: activeView === 'shifts' ? '#fff' : 'transparent',
              color: activeView === 'shifts' ? 'var(--text-main)' : '#64748b',
              boxShadow: activeView === 'shifts' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Shift Patterns
          </button>
        </div>

        {/* View specific action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeView === 'calendar' ? (
            <button 
              onClick={() => openCreateEventModal(toDateKey(today))} 
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
                color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Add Calendar Event
            </button>
          ) : (
            <button 
              onClick={openCreateShiftModal} 
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
                color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Create Shift Pattern
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          VIEW: CALENDAR VIEW
          ======================================================== */}
      {activeView === 'calendar' && (
        <div>
          {/* Calendar Controller bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
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

            {/* Color Legends */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: config.dot }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{config.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            
            {/* Week Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0' }}>
              {DAYS_SHORT.map((d, idx) => (
                <div key={d} style={{ padding: '0.75rem 0', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: idx === 0 || idx === 6 ? '#94a3b8' : '#475569', background: '#f8fafc', borderRight: idx < 6 ? '1px solid #f1f5f9' : 'none' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Cells grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: totalCells }, (_, i) => {
                const dayNum = i - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const cellDate = new Date(viewYear, viewMonth, dayNum);
                const dateKey = isCurrentMonth ? toDateKey(cellDate) : null;
                const isToday = dateKey === todayKey;
                const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
                const dayEvents = dateKey ? (eventMap[dateKey] || []) : [];
                const colIndex = i % 7;
                const rowIndex = Math.floor(i / 7);
                const totalRows = totalCells / 7;

                return (
                  <div
                    key={i}
                    onClick={() => isCurrentMonth && openCreateEventModal(dateKey)}
                    style={{
                      minHeight: '120px',
                      padding: '0.6rem',
                      borderRight: colIndex < 6 ? '1px solid #f1f5f9' : 'none',
                      borderBottom: rowIndex < totalRows - 1 ? '1px solid #f1f5f9' : 'none',
                      background: !isCurrentMonth ? '#fcfcfc' : isToday ? 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' : isWeekend ? '#fafafa' : '#fff',
                      cursor: isCurrentMonth ? 'pointer' : 'default',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => { if (isCurrentMonth) e.currentTarget.style.backgroundColor = isToday ? '#e0e7ff' : '#f8fafc'; }}
                    onMouseLeave={e => { 
                      if (isCurrentMonth) e.currentTarget.style.background = isToday 
                        ? 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' 
                        : isWeekend ? '#fafafa' : '#fff'; 
                    }}
                  >
                    {/* Day number */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: '0.85rem', fontWeight: isToday ? 800 : 600,
                        color: !isCurrentMonth ? '#cbd5e1' : isToday ? '#fff' : isWeekend ? '#94a3b8' : '#334155',
                        background: isToday ? 'var(--accent)' : 'transparent',
                        width: '26px', height: '26px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isCurrentMonth ? dayNum : ''}
                      </span>
                    </div>

                    {/* Events wrapper */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexGrow: 1, overflow: 'hidden' }}>
                      {dayEvents.map(ev => {
                        const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.HOLIDAY;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => openEditEventModal(ev, e)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              background: cfg.bg, border: `1px solid ${cfg.border}`,
                              borderRadius: '4px', padding: '2px 6px', cursor: 'pointer',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}
                          >
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VIEW: SHIFTS VIEW
          ======================================================== */}
      {activeView === 'shifts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {shifts.map(sh => (
            <div 
              key={sh.id}
              style={{
                backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px',
                padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.01)', position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{sh.name}</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {sh.startTime} - {sh.endTime}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button 
                    onClick={() => openEditShiftModal(sh)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button 
                    onClick={() => handleDeleteShift(sh.id, sh.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '4px' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {sh.description && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {sh.description}
                </p>
              )}

              {/* Work days rendering */}
              <div style={{ display: 'flex', gap: '4px', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                {['S','M','T','W','T','F','S'].map((day, dIdx) => {
                  const isWorkday = (sh.workDays || []).includes(dIdx);
                  return (
                    <span 
                      key={dIdx}
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.68rem', fontWeight: 700,
                        backgroundColor: isWorkday ? 'var(--accent-light)' : '#f1f5f9',
                        color: isWorkday ? 'var(--accent)' : '#94a3b8',
                      }}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {shifts.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '3rem', backgroundColor: '#fff', border: '1px dashed var(--border-color)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No shift patterns configured yet. Click "Create Shift Pattern" to get started.
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: CALENDAR EVENT DIALOG
          ======================================================== */}
      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title={editingEvent ? 'Edit Calendar Event' : 'Schedule Production Event'}
        subtitle={editingEvent ? 'Modify event parameters, category classifications, and details.' : 'Schedule holiday closures, overtime shifts, or equipment maintenance exceptions.'}
        icon={Calendar}
        maxWidth="500px"
      >
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={LABEL_STYLE}>Event Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEventForm(prev => ({ ...prev, type: key }))}
                  style={{
                    padding: '0.5rem 0.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem', textAlign: 'center',
                    border: `2px solid ${eventForm.type === key ? config.dot : '#e2e8f0'}`,
                    background: eventForm.type === key ? config.bg : '#fff',
                    color: eventForm.type === key ? config.color : '#64748b'
                  }}
                >
                  {config.label.replace(' Day', '').replace(' Exception', '').replace(' Holiday', '')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Date *</label>
            <input 
              type="date" 
              value={eventForm.date} 
              onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))} 
              style={FIELD_STYLE} 
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Event Name *</label>
            <input 
              type="text" 
              value={eventForm.name} 
              onChange={e => setEventForm(prev => ({ ...prev, name: e.target.value }))} 
              placeholder="e.g. Annual Plant Overhaul"
              style={FIELD_STYLE} 
            />
          </div>

          {/* Conditional parameters based on Event Type */}
          {eventForm.type === 'OVERTIME' && (
            <div>
              <label style={LABEL_STYLE}>Reference Shift Pattern</label>
              <LiveSearchDropdown
                options={shifts.map(sh => ({ label: `${sh.name} (${sh.startTime}-${sh.endTime})`, value: sh.id }))}
                value={eventForm.shiftPatternId}
                onChange={val => setEventForm(prev => ({ ...prev, shiftPatternId: val }))}
                placeholder="Choose shift hours..."
                style={{ input: FIELD_STYLE }}
              />
            </div>
          )}

          {eventForm.type === 'MAINTENANCE' && (
            <div>
              <label style={LABEL_STYLE}>Target Machine / Work Center</label>
              <input 
                type="text" 
                value={eventForm.workCenterId} 
                onChange={e => setEventForm(prev => ({ ...prev, workCenterId: e.target.value }))} 
                placeholder="e.g. CNC-01 or LINE-A"
                style={FIELD_STYLE} 
              />
            </div>
          )}

          <div>
            <label style={LABEL_STYLE}>Description</label>
            <textarea 
              value={eventForm.description} 
              onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))} 
              rows={2}
              placeholder="Additional event details..." 
              style={{ ...FIELD_STYLE, height: 'auto', padding: '0.625rem 0.875rem', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
          {editingEvent ? (
            <button 
              onClick={(e) => handleDeleteEvent(editingEvent.id, editingEvent.name, e)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', padding: '0.55rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button onClick={() => setShowEventModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handleSaveEvent} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <CheckCircle size={16} /> {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Schedule Event'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================
          MODAL: SHIFT PATTERN DIALOG
          ======================================================== */}
      <Modal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        title={editingShift ? 'Edit Shift Pattern' : 'Create Shift Pattern'}
        subtitle={editingShift ? 'Modify shift name, hours, or working days.' : 'Set up standard weekly operations, work hours, and active weekdays.'}
        icon={Settings}
        maxWidth="460px"
      >
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={LABEL_STYLE}>Shift Name *</label>
            <input 
              type="text" 
              value={shiftForm.name} 
              onChange={e => setShiftForm(prev => ({ ...prev, name: e.target.value }))} 
              placeholder="e.g. Night Assembly Shift"
              style={FIELD_STYLE} 
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Start Time *</label>
              <input 
                type="time" 
                value={shiftForm.startTime} 
                onChange={e => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))} 
                style={FIELD_STYLE} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>End Time *</label>
              <input 
                type="time" 
                value={shiftForm.endTime} 
                onChange={e => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))} 
                style={FIELD_STYLE} 
              />
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Weekly Work Days</label>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => {
                const isSelected = shiftForm.workDays.includes(idx);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setShiftForm(prev => {
                        const days = prev.workDays.includes(idx)
                          ? prev.workDays.filter(day => day !== idx)
                          : [...prev.workDays, idx];
                        return { ...prev, workDays: days };
                      });
                    }}
                    style={{
                      flex: 1, padding: '0.5rem 0', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', border: '1px solid #cbd5e1',
                      backgroundColor: isSelected ? 'var(--accent-light)' : '#fff',
                      color: isSelected ? 'var(--accent)' : '#475569',
                      borderColor: isSelected ? 'var(--accent)' : '#cbd5e1',
                      fontFamily: 'inherit'
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Description</label>
            <textarea 
              value={shiftForm.description} 
              onChange={e => setShiftForm(prev => ({ ...prev, description: e.target.value }))} 
              rows={2}
              placeholder="Notes about roles or teams..." 
              style={{ ...FIELD_STYLE, height: 'auto', padding: '0.625rem 0.875rem', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
          <button onClick={() => setShowShiftModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={handleSaveShift} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <CheckCircle size={16} /> {saving ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
