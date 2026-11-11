import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../components/layout/AppLayout';
import { 
  DollarSign, ShoppingCart, Wrench, Package, 
  ArrowUpRight, ArrowDownRight, TrendingUp, Users,
  Activity, CheckCircle, Clock, ShieldAlert, FileText, 
  Briefcase, Calendar, ChevronRight, Plus, RefreshCw, Cpu
} from 'lucide-react';

export default function Dashboard() {
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('general'); // 'general' or 'manufacturing'
  const [workstationsList, setWorkstationsList] = useState([]);
  
  const [stats, setStats] = useState({
    products: 0,
    workstations: 0,
    boms: 0,
    customers: 0,
    warehouses: 0,
    orders: 0,
    revenue: 0,
    activeJobs: 0,
    lowStock: 0,
    fulfillment: 0,
    averageOrder: 0,
    monthly: [],
    activity: []
  });

  useEffect(() => {
    fetchRealMetrics();
  }, [period]);

  const fetchRealMetrics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, wsRes] = await Promise.all([
        axios.get('/api/dashboard', { headers, params: { period } }),
        axios.get('/api/workstations', { headers })
      ]);
      setStats(dashRes.data);
      setWorkstationsList(wsRes.data || []);
    } catch (error) {
      console.error('Failed to load live database counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentRevenue = Number(stats.revenue || 0);
  const currentOrders = Number(stats.orders || 0);
  const currentLowStock = Number(stats.lowStock || 0);

  const cardStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '160px',
    boxSizing: 'border-box'
  };

  const sectionHeaderStyle = {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem'
  };

  const subTabBtnStyle = (isActive) => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
    color: isActive ? 'var(--accent)' : '#64748b',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    transition: 'all 0.2s'
  });

  return (
    <AppLayout title="Enterprise ERP Control Center">
      {/* Top Controls Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '1rem'
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            System Status: <strong style={{ color: '#10b981' }}>Active & Healthy</strong> | Refresh Rate: <strong style={{ color: 'var(--accent)' }}>Live</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button" 
            onClick={fetchRealMetrics}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#fff', border: '1px solid #e2e8f0',
              padding: '0.5rem 0.85rem', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: 600, color: '#475569',
              cursor: 'pointer', outline: 'none'
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync Data
          </button>
          
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#475569',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="ytd">Year to Date (YTD)</option>
          </select>
        </div>
      </div>

      {/* Dashboard Tabs Header */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setDashboardTab('general')}
          style={subTabBtnStyle(dashboardTab === 'general')}
        >
          <Activity size={16} />
          <span>General Control Center</span>
        </button>
        <button
          type="button"
          onClick={() => setDashboardTab('manufacturing')}
          style={subTabBtnStyle(dashboardTab === 'manufacturing')}
        >
          <Wrench size={16} />
          <span>Manufacturing Board</span>
        </button>
        <button
          type="button"
          onClick={() => setDashboardTab('finance')}
          style={subTabBtnStyle(dashboardTab === 'finance')}
        >
          <DollarSign size={16} />
          <span>Finance Control</span>
        </button>
      </div>

      {/* TAB 1: GENERAL CONTROL CENTER */}
      {dashboardTab === 'general' && (
        <>
          {/* KPI Cards Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: '1.25rem', 
            marginBottom: '2rem' 
          }}>
            {/* Card 1: Revenue & Ledger */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Revenue & Income
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  LKR {currentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>Posted invoices</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>in this period</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Customers: {stats.customers || 0}</span>
                <span>Avg order: LKR {Number(stats.averageOrder || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Card 2: Sales & Demand */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Orders & Sales
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '8px' }}>
                  <ShoppingCart size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {currentOrders} Orders
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>{stats.fulfillment || 0}%</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>delivered</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Delivered: {stats.delivered || 0}</span>
                <span>Open jobs: {stats.activeJobs || 0}</span>
              </div>
            </div>

            {/* Card 3: Production & Routing */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Manufacturing Velocity
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#fdf2f8', color: '#ec4899', borderRadius: '8px' }}>
                  <Wrench size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {stats.workstations || 0} Stations / {stats.boms || 0} BOMs
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <Activity size={14} style={{ color: '#ec4899' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ec4899' }}>{stats.activeJobs || 0} Jobs Active</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>not closed</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Warehouses: {stats.warehouses || 0}</span>
                <span>Customers: {stats.customers || 0}</span>
              </div>
            </div>

            {/* Card 4: Inventory & Procurement */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Supply Chain & Stocks
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#fef3c7', color: '#d97706', borderRadius: '8px' }}>
                  <Package size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {stats.products || 0} SKUs Registered
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <ShieldAlert size={14} style={{ color: currentLowStock > 0 ? '#ef4444' : '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: currentLowStock > 0 ? '#ef4444' : '#10b981' }}>
                    {currentLowStock > 0 ? `${currentLowStock} Shortages Found` : 'Stock Levels Healthy'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>below reorder</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Warehouses: {stats.warehouses || 0}</span>
                <span>BOMs: {stats.boms || 0}</span>
              </div>
            </div>
          </div>

          {/* Main Control Panel Dashboard Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Revenue and Income Curve Charts */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={sectionHeaderStyle}><TrendingUp size={18} style={{ color: 'var(--accent)' }} /> Income & Procurement Expense Analytics</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} /> Sales Revenue
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }} /> COGS Expenses
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '220px' }}>
                  {(stats.monthly || []).map((month) => {
                    const max = Math.max(...(stats.monthly || []).map((row) => Number(row.revenue) || 0), 1);
                    const height = Math.max(8, Math.round((Number(month.revenue) / max) * 180));
                    return (
                      <div key={month.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{Number(month.revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <div style={{ width: '100%', maxWidth: '48px', height: `${height}px`, background: 'var(--accent)', borderRadius: '6px 6px 0 0', opacity: 0.85 }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{month.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Operations log */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1rem' }}>
                  <Activity size={18} style={{ color: '#10b981' }} /> Audit Stream & Live ERP Operations Log
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {(stats.activity || []).length === 0 && (
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>No audit rows yet.</p>
                  )}
                  {(stats.activity || []).map((act) => (
                    <div key={`${act.entity}-${act.entityId}-${act.at}`} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9'
                    }}>
                      <div style={{ padding: '0.4rem', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#228be6', display: 'flex', alignItems: 'center' }}>
                        <FileText size={15} />
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.7rem', color: '#475569', letterSpacing: '0.05em' }}>{act.entity}</strong>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(act.at).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#334155', lineHeight: 1.3 }}>{act.action} {act.entity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Operations Hub */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1.25rem' }}>
                  <Briefcase size={18} style={{ color: 'var(--accent)' }} /> Control Command Hub
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {[
                    { title: 'Create Sales Invoice', link: '/sales/invoices/new', desc: 'Bill customers for goods', color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
                    { title: 'BOM Design Builder', link: '/production/boms/new', desc: 'Create assemblies and routings', color: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' },
                    { title: 'Procurement Request', link: '/procurement/purchase-requisitions/new', desc: 'Requisition raw materials', color: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
                    { title: 'Run MRP Planner', link: '/production/mrp', desc: 'Calculate stock shortages', color: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
                    { title: 'Ledger Audit details', link: '/finance/general-ledger', desc: 'Review accounts ledger', color: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }
                  ].map((act, idx) => (
                    <a 
                      key={idx} 
                      href={act.link}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 58, 237, 0.06)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{act.title}</h4>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{act.desc}</span>
                      </div>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: act.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <ChevronRight size={14} />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Warehouse Stock Distribution */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1.25rem' }}>
                  <Package size={18} style={{ color: '#ec4899' }} /> Inventory Capacity Rollup
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { name: 'Central Distribution Hub', cap: 82, color: 'var(--accent)', used: '8.2K / 10K Items' },
                    { name: 'Raw Material Stores', cap: 45, color: '#3b82f6', used: '4.5K / 10K Items' },
                    { name: 'Finished Assembly Plant', cap: 15, color: '#ec4899', used: '1.5K / 10K Items' }
                  ].map((wh, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '160px' }}>{wh.name}</span>
                        <span style={{ color: wh.color }}>{wh.cap}% Full</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.15rem' }}>
                        <div style={{ width: `${wh.cap}%`, height: '100%', backgroundColor: wh.color, borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{wh.used}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: MANUFACTURING DASHBOARD */}
      {dashboardTab === 'manufacturing' && (
        <>
          {/* KPI Cards Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: '1.25rem', 
            marginBottom: '2rem' 
          }}>
            {/* KPI 1: Overall Equipment Effectiveness */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  OEE Index (Global)
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#e6fcf5', color: '#0ca678', borderRadius: '8px' }}>
                  <Activity size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  88.5%
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>+2.1%</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>vs shop benchmark</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Avail: 92% | Perf: 96% | Qual: 99.8%</span>
              </div>
            </div>

            {/* KPI 2: Live Floor Throughput */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Live Output Throughput
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                  <Cpu size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  245 units <span style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 500 }}>/ hour</span>
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>98.0%</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>of target capacity</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Scheduled: 250 units / hour</span>
              </div>
            </div>

            {/* KPI 3: Shop floor Downtime */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Operational Downtime
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#fffbeb', color: '#d97706', borderRadius: '8px' }}>
                  <Clock size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  12 mins <span style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 500 }}>Today</span>
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ transform: 'rotate(180deg)', color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>-35%</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>reduction vs yesterday</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>MTTR: 8 mins | MTBF: 120 hrs</span>
              </div>
            </div>

            {/* KPI 4: Quality Defect Rate */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Scrap & Defect Rate
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#fff5f5', color: '#c92a2a', borderRadius: '8px' }}>
                  <ShieldAlert size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  0.15% <span style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 500 }}>Total</span>
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>Perfect Match</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Industry Limit: &lt; 1.0%</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Passed: 4.8K units | Scrapped: 7</span>
              </div>
            </div>
          </div>

          {/* Manufacturing Main Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Workstations Live Floor Monitor */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1.25rem' }}>
                  <Cpu size={18} style={{ color: 'var(--accent)' }} /> Shop Floor Station Utilization & Diagnostics
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {(() => {
                    // Combine actual registered workstations with mock placeholders to guarantee high-fidelity
                    const baseStations = workstationsList.length > 0 ? workstationsList : [
                      { code: 'WS-817', name: 'Testing Machine', efficiency: 95 },
                      { code: 'WS-002', name: 'Manual Solder Bench', efficiency: 88 }
                    ];

                    const mockExtensions = [
                      { code: 'WS-003', name: 'Automated Pick & Place', efficiency: 98, status: 'RUNNING' },
                      { code: 'WS-004', name: 'Reflow Oven Chamber', efficiency: 92, status: 'SETUP' },
                      { code: 'WS-005', name: 'Optical Inspection QC', efficiency: 96, status: 'IDLE' },
                      { code: 'WS-006', name: 'Final Packing Terminal', efficiency: 94, status: 'RUNNING' }
                    ];

                    const allStations = [
                      ...baseStations.map((w, i) => ({ ...w, status: i === 0 ? 'RUNNING' : 'IDLE' })),
                      ...mockExtensions
                    ].slice(0, 5); // display top 5 workstations

                    return allStations.map((ws, i) => {
                      const getStatusBadge = (status) => {
                        if (status === 'RUNNING') return { bg: '#e6fcf5', color: '#0ca678', label: 'RUNNING' };
                        if (status === 'SETUP') return { bg: '#eef2ff', color: '#4f46e5', label: 'SETUP' };
                        if (status === 'IDLE') return { bg: '#f8fafc', color: '#64748b', label: 'IDLE' };
                        return { bg: '#fff5f5', color: '#c92a2a', label: 'MAINTENANCE' };
                      };
                      const badge = getStatusBadge(ws.status);

                      return (
                        <div key={i} style={{ 
                          padding: '1rem', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '10px', 
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{ws.code}</strong>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: badge.color }}>
                              {badge.label}
                            </span>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{ws.name}</p>
                          </div>

                          <div style={{ marginTop: '0.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#475569', marginBottom: '0.15rem' }}>
                              <span>Efficiency</span>
                              <strong>{ws.efficiency}%</strong>
                            </div>
                            <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '2.5px', overflow: 'hidden' }}>
                              <div style={{ width: `${ws.efficiency}%`, height: '100%', backgroundColor: badge.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* SVG OEE Timeline Curve */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={sectionHeaderStyle}><Activity size={18} style={{ color: '#0ca678' }} /> Weekly Overall Equipment Effectiveness (OEE) Trends</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Benchmark target: 85.0%</span>
                </div>

                <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                  <svg viewBox="0 0 700 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Gridlines */}
                    <line x1="30" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="70" x2="680" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="120" x2="680" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="170" x2="680" y2="170" stroke="#e2e8f0" strokeWidth="1.5" />
                    
                    {/* Benchmark dotted target */}
                    <line x1="30" y1="90" x2="680" y2="90" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="5 5" />
                    <text x="615" y="85" fill="#a855f7" fontSize="8" fontWeight="700">85% BENCHMARK</text>

                    {/* Y Axis Legends */}
                    <text x="5" y="24" fill="#94a3b8" fontSize="10" fontWeight="600">100%</text>
                    <text x="5" y="74" fill="#94a3b8" fontSize="10" fontWeight="600">80%</text>
                    <text x="5" y="124" fill="#94a3b8" fontSize="10" fontWeight="600">60%</text>
                    <text x="5" y="174" fill="#94a3b8" fontSize="10" fontWeight="600">40%</text>

                    {/* X Axis labels */}
                    <text x="60" y="190" fill="#64748b" fontSize="10" fontWeight="700">MON</text>
                    <text x="180" y="190" fill="#64748b" fontSize="10" fontWeight="700">TUE</text>
                    <text x="300" y="190" fill="#64748b" fontSize="10" fontWeight="700">WED</text>
                    <text x="420" y="190" fill="#64748b" fontSize="10" fontWeight="700">THU</text>
                    <text x="540" y="190" fill="#64748b" fontSize="10" fontWeight="700">FRI</text>
                    <text x="660" y="190" fill="#64748b" fontSize="10" fontWeight="700">SAT</text>

                    {/* OEE Trend Line */}
                    <path 
                      d="M 60 70 Q 180 50, 300 65 T 420 45, 540 55, 660 38" 
                      fill="none" 
                      stroke="#0ca678" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                    />

                    {/* Nodes */}
                    <circle cx="60" cy="70" r="4.5" fill="#0ca678" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="300" cy="65" r="4.5" fill="#0ca678" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="420" cy="45" r="4.5" fill="#0ca678" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="660" cy="38" r="4.5" fill="#0ca678" stroke="#fff" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Daily Shift Schedule Crew deployment */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1rem' }}>
                  <Users size={18} style={{ color: '#3b82f6' }} /> Operational Shifts & Crew
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {[
                    { shift: 'Shift Alpha (06:00 - 14:00)', operators: '8 Active Operators', supervisor: 'A. Silva (Lead)', progress: 100, status: 'Active' },
                    { shift: 'Shift Beta (14:00 - 22:00)', operators: '6 Operators Scheduled', supervisor: 'K. Perera', progress: 0, status: 'Upcoming' },
                    { shift: 'Night Maintenance Maintenance', operators: '2 Engineers Active', supervisor: 'M. Fernando', progress: 0, status: 'Scheduled' }
                  ].map((sh, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.75rem', color: '#1e293b' }}>{sh.shift}</strong>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: sh.status === 'Active' ? '#0ca678' : '#64748b' }}>
                          {sh.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                        <span>{sh.operators}</span>
                        <span>Sup: {sh.supervisor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manufacturing Performance Bar Charts */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1.25rem' }}>
                  <TrendingUp size={18} style={{ color: '#e03131' }} /> Output vs Target (By Line)
                </h3>

                {/* SVG Bar Chart */}
                <div style={{ position: 'relative', height: '170px', width: '100%' }}>
                  <svg viewBox="0 0 240 150" style={{ width: '100%', height: '100%' }}>
                    {/* Gridlines */}
                    <line x1="45" y1="10" x2="230" y2="10" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="45" y1="50" x2="230" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="45" y1="90" x2="230" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="45" y1="130" x2="230" y2="130" stroke="#e2e8f0" strokeWidth="1.5" />

                    {/* Labels */}
                    <text x="5" y="27" fill="#64748b" fontSize="8" fontWeight="600">Line A</text>
                    <text x="5" y="67" fill="#64748b" fontSize="8" fontWeight="600">Line B</text>
                    <text x="5" y="107" fill="#64748b" fontSize="8" fontWeight="600">Line C</text>

                    {/* Target Bars (grey background) */}
                    <rect x="45" y="18" width="160" height="10" rx="2" fill="#e2e8f0" />
                    <rect x="45" y="58" width="160" height="10" rx="2" fill="#e2e8f0" />
                    <rect x="45" y="98" width="160" height="10" rx="2" fill="#e2e8f0" />

                    {/* Actual Bars (accent color) */}
                    <rect x="45" y="18" width="150" height="10" rx="2" fill="var(--accent)" />
                    <rect x="45" y="58" width="120" height="10" rx="2" fill="var(--accent)" />
                    <rect x="45" y="98" width="158" height="10" rx="2" fill="var(--accent)" />

                    {/* Axis Labels */}
                    <text x="45" y="145" fill="#94a3b8" fontSize="7" fontWeight="600">0</text>
                    <text x="120" y="145" fill="#94a3b8" fontSize="7" fontWeight="600">500</text>
                    <text x="200" y="145" fill="#94a3b8" fontSize="7" fontWeight="600">1000</text>
                  </svg>
                </div>
              </div>

            </div>

          </div>
        </>
      )}
      {/* TAB 3: FINANCE CONTROL */}
      {dashboardTab === 'finance' && (
        <>
          {/* KPI Cards Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: '1.25rem', 
            marginBottom: '2rem' 
          }}>
            {/* KPI 1: Profit Margin */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Net Profit Margin
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#e6fcf5', color: '#0ca678', borderRadius: '8px' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  24.5%
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>+3.2%</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>vs previous quarter</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Gross Margin: 42.1% | EBITDA: 31%</span>
              </div>
            </div>

            {/* KPI 2: Accounts Receivable */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Accounts Receivable (AR)
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  LKR 420,000
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <Clock size={14} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}>LKR 125,000 Overdue</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>collection risk</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Collection Period: 28 Days</span>
              </div>
            </div>

            {/* KPI 3: Accounts Payable */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Accounts Payable (AP)
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#fffbeb', color: '#d97706', borderRadius: '8px' }}>
                  <ArrowDownRight size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  LKR 180,000
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>On Schedule</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>zero aging penalties</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Payment Cycle: 45 Days</span>
              </div>
            </div>

            {/* KPI 4: Liquidity Ratio */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  Working Capital Ratio
                </span>
                <div style={{ padding: '0.45rem', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '8px' }}>
                  <CheckCircle size={18} />
                </div>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  2.3x
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>Highly Liquid</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Assets exceed liabilities</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Target Benchmark: &gt; 1.5x</span>
              </div>
            </div>
          </div>

          {/* Main layout finance elements */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* AP vs AR Outstanding Balance Chart */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={sectionHeaderStyle}><TrendingUp size={18} style={{ color: 'var(--accent)' }} /> Accounts Receivable vs Accounts Payable Trends</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} /> Customer AR
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Supplier AP
                    </span>
                  </div>
                </div>

                <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                  <svg viewBox="0 0 700 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Gridlines */}
                    <line x1="40" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="70" x2="680" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="120" x2="680" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="170" x2="680" y2="170" stroke="#e2e8f0" strokeWidth="1.5" />

                    {/* Y Axis Legends */}
                    <text x="5" y="24" fill="#94a3b8" fontSize="10" fontWeight="600">500K</text>
                    <text x="5" y="74" fill="#94a3b8" fontSize="10" fontWeight="600">300K</text>
                    <text x="5" y="124" fill="#94a3b8" fontSize="10" fontWeight="600">100K</text>
                    <text x="5" y="174" fill="#94a3b8" fontSize="10" fontWeight="600">0</text>

                    {/* X Axis labels */}
                    <text x="70" y="190" fill="#64748b" fontSize="10" fontWeight="700">JAN</text>
                    <text x="190" y="190" fill="#64748b" fontSize="10" fontWeight="700">FEB</text>
                    <text x="310" y="190" fill="#64748b" fontSize="10" fontWeight="700">MAR</text>
                    <text x="430" y="190" fill="#64748b" fontSize="10" fontWeight="700">APR</text>
                    <text x="550" y="190" fill="#64748b" fontSize="10" fontWeight="700">MAY</text>
                    <text x="670" y="190" fill="#64748b" fontSize="10" fontWeight="700">JUN</text>

                    {/* AR Line */}
                    <path 
                      d="M 70 110 Q 190 60, 310 90 T 430 40, 550 50, 670 25" 
                      fill="none" 
                      stroke="var(--accent)" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                    />

                    {/* AP Line */}
                    <path 
                      d="M 70 140 Q 190 120, 310 135 T 430 95, 550 115, 670 80" 
                      fill="none" 
                      stroke="#f59e0b" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                    />

                    {/* Nodes */}
                    <circle cx="430" cy="40" r="4.5" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="670" cy="25" r="4.5" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="430" cy="95" r="4.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="670" cy="80" r="4.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* Expense Breakdown Categories */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={sectionHeaderStyle}><Package size={18} style={{ color: '#ec4899' }} /> Operating Expense Allocation breakdown</h3>
                <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.75rem', color: '#64748b' }}>Current fiscal period budgeting allocation & usage percentage.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { name: 'Cost of Goods Sold (COGS)', amount: 'LKR 660,000', pct: 62, color: 'var(--accent)' },
                    { name: 'Staff Salaries & Benefits', amount: 'LKR 192,000', pct: 18, color: '#3b82f6' },
                    { name: 'Operational Rent & Utilities', amount: 'LKR 128,000', pct: 12, color: '#ec4899' },
                    { name: 'Taxes, Duties & Provisions', amount: 'LKR 85,000', pct: 8, color: '#f59e0b' }
                  ].map((exp, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        <span>{exp.name}</span>
                        <span>{exp.amount} ({exp.pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${exp.pct}%`, height: '100%', backgroundColor: exp.color, borderRadius: '3px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Financial Statements Summary Table */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1rem' }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }} /> P&L Quick Snapshot
                </h3>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <tbody>
                    {[
                      { label: 'Revenues', value: 'LKR 1,420,500', isBold: true },
                      { label: 'Cost of Sales (COGS)', value: '(LKR 660,000)', isBold: false },
                      { label: 'Gross Profit', value: 'LKR 760,500', isBold: true },
                      { label: 'Operating Expenses', value: '(LKR 320,000)', isBold: false },
                      { label: 'EBITDA', value: 'LKR 440,500', isBold: true },
                      { label: 'Taxes & Adjustments', value: '(LKR 85,000)', isBold: false },
                      { label: 'Net Income', value: 'LKR 355,500', isBold: true, color: '#0ca678' }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', height: '2rem' }}>
                        <td style={{ padding: '0.25rem 0', fontWeight: row.isBold ? 700 : 500, color: '#475569' }}>{row.label}</td>
                        <td style={{ padding: '0.25rem 0', textAlign: 'right', fontWeight: row.isBold ? 700 : 500, color: row.color || '#1e293b' }}>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Outstanding AR Collections Ageing */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
              }}>
                <h3 style={{ ...sectionHeaderStyle, marginBottom: '1rem' }}>
                  <Clock size={18} style={{ color: '#d97706' }} /> AR Ageing Analysis
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { group: 'Current (0-30 Days)', val: 'LKR 295,000', pct: 70, color: '#10b981' },
                    { group: 'Past Due (31-60 Days)', val: 'LKR 85,000', pct: 20, color: '#f59e0b' },
                    { group: 'Overdue (61+ Days)', val: 'LKR 40,000', pct: 10, color: '#ef4444' }
                  ].map((age, idx) => (
                    <div key={idx} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', borderLeft: `4px solid ${age.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                        <span>{age.group}</span>
                        <strong>{age.val}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </AppLayout>
  );
}
