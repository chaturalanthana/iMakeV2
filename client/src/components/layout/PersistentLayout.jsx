import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import { LogOut, Bell, Search, HelpCircle, Info } from 'lucide-react';
import { useLayout } from '../../context/LayoutContext';

export default function PersistentLayout() {
  const isAuthenticated = !!localStorage.getItem('token');
  let user = {};
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    user = stored && typeof stored === 'object' ? stored : {};
  } catch {
    user = {};
  }
  const { title, icon: Icon } = useLayout();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let stop = false;
    const load = () => {
      axios.get('/api/alerts', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then((res) => { if (!stop) setAlertCount(res.data.count || 0); })
        .catch(() => { if (!stop) setAlertCount(0); });
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { stop = true; clearInterval(timer); };
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Get initials for profile badge
  const userName = user.email?.split('@')[0] || 'Admin';
  const userInitials = userName.substring(0, 2).toLowerCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#ffffff' }}>
        
        {/* Top Header */}
        <header style={{ 
          height: '70px', 
          backgroundColor: '#ffffff', 
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          zIndex: 10
        }}>
          {/* Left section: Title & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              {Icon && <Icon size={24} style={{ color: 'var(--accent)' }} />}
              {title}
            </h1>

            {/* iforce-styled Global Search Bar */}
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Search modules, pages, users..." 
                style={{
                  width: '100%',
                  height: '36px',
                  paddingLeft: '36px',
                  paddingRight: '44px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1px 4px', backgroundColor: '#ffffff', fontWeight: 600, userSelect: 'none' }}>
                ⌘ K
              </span>
            </div>
          </div>

          {/* Right section: System Utilities & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Help & Info Buttons */}
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center' }} title="Help Center">
              <HelpCircle size={20} />
            </button>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center' }} title="System Info">
              <Info size={20} />
            </button>

            {/* Badged Notification Bell */}
            <button type="button" onClick={() => navigate('/alerts')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center', position: 'relative' }} title="Alerts">
              <Bell size={20} />
              {alertCount > 0 && (
                <div style={{ position: 'absolute', top: '0px', right: '0px', minWidth: '16px', height: '16px', padding: '0 3px', borderRadius: '8px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {alertCount > 99 ? '99+' : alertCount}
                </div>
              )}
            </button>

            {/* Profile Block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1.25rem', borderLeft: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{userName}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.02em' }}>
                  {user.tenant?.name || 'Administrator'}
                </span>
              </div>
              
              {/* Circular Initials Avatar */}
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                backgroundColor: '#2563eb', color: '#ffffff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase'
              }}>
                {userInitials}
              </div>

              {/* Log out Button */}
              <button 
                onClick={handleLogout} 
                style={{ 
                  background: 'rgba(239, 68, 68, 0.08)', color: 'var(--error)', 
                  border: 'none', padding: '0.45rem', borderRadius: '6px', 
                  cursor: 'pointer', marginLeft: '0.25rem', display: 'flex' 
                }}
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ width: '100%' }}>
             <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
