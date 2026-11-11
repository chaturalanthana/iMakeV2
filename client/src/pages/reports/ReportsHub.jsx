import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { 
  BarChart2, Factory, Archive, Wallet, ArrowRight, 
  Search, AlertTriangle, FileText, TrendingUp, Layers
} from 'lucide-react';

const REPORT_SECTIONS = [
  {
    category: 'Production & Manufacturing',
    icon: Factory,
    reports: [
      {
        title: 'Production Reports',
        description: 'Cost variance, WIP valuation, machine yield, and batch genealogy analysis.',
        path: '/production/reports',
        icon: BarChart2,
        badge: 'Operational'
      },
      {
        title: 'Abnormal Losses',
        description: 'Audit scrap exceeding product-line tolerances and posted scrap accounts.',
        path: '/production/losses',
        icon: AlertTriangle,
        badge: 'Variance'
      }
    ]
  },
  {
    category: 'Inventory & Warehouse',
    icon: Archive,
    reports: [
      {
        title: 'Stock Reports',
        description: 'Stock availability, movement logs, batch expiry, and reorder levels.',
        path: '/warehouse/stock-reports',
        icon: FileText,
        badge: 'Inventory'
      },
      {
        title: 'Inventory Valuation Report',
        description: 'Comprehensive physical inventory list with cost and retail valuations.',
        path: '/warehouse/inventory-report',
        icon: Layers,
        badge: 'Valuation'
      }
    ]
  },
  {
    category: 'Finance & Accounts',
    icon: Wallet,
    reports: [
      {
        title: 'Finance Reports',
        description: 'General ledger summary, statement of accounts, and financial health check.',
        path: '/finance/reports',
        icon: TrendingUp,
        badge: 'Financial'
      },
      {
        title: 'VAT & Tax Report',
        description: 'Detailed VAT breakdowns, taxable turnovers, and tax schedules.',
        path: '/finance/vat',
        icon: FileText,
        badge: 'Tax'
      }
    ]
  }
];

export default function ReportsHub() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = REPORT_SECTIONS.map(section => {
    const matchingReports = section.reports.filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...section, reports: matchingReports };
  }).filter(section => section.reports.length > 0);

  return (
    <AppLayout title="Reports & Analytics" icon={BarChart2}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Header & Quick Search */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Operational & Financial Reports
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Centralized reporting module for manufacturing, inventory, and finance analytics.
            </p>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search 
              size={16} 
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
            />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter reports..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                outline: 'none',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Report Sections */}
        {filteredSections.map(section => (
          <div key={section.category}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
              <section.icon size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {section.category}
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {section.reports.map(rep => {
                const Icon = rep.icon;
                return (
                  <div
                    key={rep.title}
                    onClick={() => navigate(rep.path)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--accent-light, #eff6ff)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)'
                          }}>
                            <Icon size={18} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {rep.title}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {rep.badge}
                        </span>
                      </div>

                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {rep.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1rem', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span>Open report</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No reports matched "{searchQuery}"</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
