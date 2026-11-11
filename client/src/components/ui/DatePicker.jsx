import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronUp, ChevronDown, ChevronDown as CaretDown } from 'lucide-react';

export default function DatePicker({ value, onChange, placeholder = "Select Date", style = {}, disabled = false, invalid = false, error = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(value ? new Date(value) : new Date());
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 260 });
  
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (value) {
      setCurrentDate(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(event.target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target);
      if (isOutsideTrigger && isOutsideDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 280;
    const gap = 8;
    const margin = 8;
    const popHeight = dropdownRef.current?.offsetHeight || 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < popHeight + gap && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - popHeight - gap : rect.bottom + gap;
    let left = rect.left;

    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    if (top + popHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - popHeight - margin);
    }

    setCoords({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateCoords();
  }, [isOpen, currentDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMove = () => updateCoords();
    window.addEventListener('scroll', handleMove, true);
    window.addEventListener('resize', handleMove);
    return () => {
      window.removeEventListener('scroll', handleMove, true);
      window.removeEventListener('resize', handleMove);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (year, month, day) => {
    const selected = new Date(year, month, day);
    // Format to YYYY-MM-DD
    const localStr = new Date(selected.getTime() - (selected.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    onChange(localStr);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.preventDefault();
    onChange('');
    setIsOpen(false);
  };

  const handleToday = (e) => {
    e.preventDefault();
    const today = new Date();
    const localStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    onChange(localStr);
    setCurrentDate(today);
    setIsOpen(false);
  };

  // Build calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const numDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month); // 0 = Sun, 1 = Mon
  
  const prevMonthDays = daysInMonth(year, month - 1);
  const days = [];

  // Previous month padding
  for (let i = 0; i < startDay; i++) {
    days.push({ day: prevMonthDays - startDay + i + 1, isCurrentMonth: false, monthOffset: -1 });
  }
  // Current month days
  for (let i = 1; i <= numDays; i++) {
    days.push({ day: i, isCurrentMonth: true, monthOffset: 0 });
  }
  // Next month padding
  const totalSlots = Math.ceil(days.length / 7) * 7;
  const paddingEnd = totalSlots - days.length;
  for (let i = 1; i <= paddingEnd; i++) {
    days.push({ day: i, isCurrentMonth: false, monthOffset: 1 });
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  let selectedYMD = null;
  if (value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      selectedYMD = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    }
  }

  const formattedValue = value ? (() => {
    if (typeof value === 'string') {
      const parts = value.split('-');
      if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
      }
      return value;
    } else if (value instanceof Date) {
      if (isNaN(value.getTime())) return '';
      return `${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}/${value.getFullYear()}`;
    }
    return String(value);
  })() : '';

  return (
    <>
      <div 
        ref={triggerRef}
        onClick={toggleDropdown}
        className={invalid ? 'field-invalid' : undefined}
        style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.85rem', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          backgroundColor: disabled ? '#f8fafc' : '#fff', 
          fontSize: '0.9rem', 
          color: disabled ? 'var(--text-muted)' : (value ? 'var(--text-main)' : 'var(--text-muted)'), 
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.75 : 1,
          ...style
        }}
      >
        <span>{formattedValue || placeholder}</span>
        <CalendarIcon size={16} color="var(--text-muted)" />
      </div>
      {error ? <span className="field-error-text">{error}</span> : null}

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.top + 'px',
            left: coords.left + 'px',
            width: coords.width + 'px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-color)',
            zIndex: 9999,
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out' // Assume global fadeIn exists
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
              {monthNames[month]} {year} <CaretDown size={14} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-main)' }}>
              <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
                <ChevronUp size={18} strokeWidth={2.5} />
              </button>
              <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
                <ChevronDown size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Weekdays */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.75rem', gap: '4px' }}>
            {weekDays.map(wd => (
              <div key={wd} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{wd}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {days.map((d, i) => {
              const isSelected = selectedYMD && 
                                 d.isCurrentMonth && 
                                 selectedYMD.y === year && 
                                 selectedYMD.m === month && 
                                 selectedYMD.d === d.day;
                                 
              const isTodayObj = new Date();
              const isToday = isTodayObj.getFullYear() === year && 
                              isTodayObj.getMonth() === month && 
                              isTodayObj.getDate() === d.day && 
                              d.isCurrentMonth;

              let bgColor = 'transparent';
              let color = d.isCurrentMonth ? 'var(--text-main)' : '#cbd5e1';
              let fontWeight = 500;
              let border = '1px solid transparent';

              if (isSelected) {
                bgColor = '#475569'; // Slate dark
                color = '#fff';
                fontWeight = 700;
                border = '1px solid #1e293b';
              } else if (isToday) {
                fontWeight = 800;
                color = 'var(--accent)';
              }

              return (
                <div 
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectDate(year, month + d.monthOffset, d.day);
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  style={{
                    padding: '0.5rem 0',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    fontWeight,
                    color,
                    backgroundColor: bgColor,
                    border: border,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {d.day}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
            <button onMouseDown={handleClear} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
            <button onMouseDown={handleToday} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Today</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
