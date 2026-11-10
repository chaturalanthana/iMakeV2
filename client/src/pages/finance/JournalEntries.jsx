import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { BookOpen, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/finance/journal-entries', config);
      setEntries(res.data);
    } catch (error) {
      console.error(`Failed to fetch journal entries:`, error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  return (
    <AppLayout title="Journal Entries" icon={BookOpen}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <>
          {/* Search and Filters Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
              <input
                type="text"
                placeholder="Search by entry # or description..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', height: '38px', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', backgroundColor: '#fff', boxSizing: 'border-box' }}
                autoComplete="off"
              />
            </div>
            </div>
            <button onClick={() => navigate('/finance/journals/new')}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={16} /> New Entry
            </button>
          </div>

          {/* Main Table Panel */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>Date</th>
                  <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>Entry #</th>
                  <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>Description</th>
                  <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
                ) : (() => {
                  const filtered = entries.filter(entry =>
                    entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (entry.description && entry.description.toLowerCase().includes(searchQuery.toLowerCase()))
                  );
                  const totalPages = Math.ceil(filtered.length / itemsPerPage);
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
                  return (
                    <>
                      {paginated.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No journal entries found.</td></tr>
                      ) : paginated.map(entry => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'} onClick={() => navigate(`/finance/journals/${entry.id}`)}>
                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{new Date(entry.date).toLocaleDateString()}</td>
                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{entry.entryNumber}</td>
                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>{entry.description || '-'}</td>
                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
                            <span style={{ color: entry.isPosted ? '#059669' : '#d97706', fontSize: '0.75rem', fontWeight: 700 }}>
                              {entry.isPosted ? 'POSTED' : 'DRAFT'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="4" style={{ padding: '0' }}>
                          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Showing {filtered.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length} entries</span>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: currentPage === 1 ? '#f8fafc' : '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : 'var(--text-main)', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} /></button>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.5rem' }}>Page {currentPage} of {totalPages || 1}</span>
                              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: (currentPage === totalPages || totalPages === 0) ? '#f8fafc' : '#fff', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', color: (currentPage === totalPages || totalPages === 0) ? '#cbd5e1' : 'var(--text-main)', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} /></button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}

