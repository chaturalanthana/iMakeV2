import React from 'react';

const PageSkeleton = ({ type = 'table' }) => {
  return (
    <div style={{ padding: '0.5rem', width: '100%', boxSizing: 'border-box', animation: 'fadeIn 0.5s ease-in-out' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
          <div>
            <div className="skeleton-box" style={{ width: '180px', height: '20px', marginBottom: '8px' }} />
            <div className="skeleton-box" style={{ width: '120px', height: '14px' }} />
          </div>
        </div>
        <div className="skeleton-box" style={{ width: '140px', height: '40px', borderRadius: '8px' }} />
      </div>

      {type === 'table' ? (
        <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table Toolbar Skeleton */}
          <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '1rem' }}>
            <div className="skeleton-box" style={{ width: '280px', height: '36px', borderRadius: '6px' }} />
            <div className="skeleton-box" style={{ width: '100px', height: '36px', borderRadius: '6px' }} />
          </div>
          {/* Table Header Skeleton */}
          <div style={{ padding: '0.75rem 1rem', display: 'flex', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f9fafb' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-box" style={{ flex: 1, height: '12px', margin: '0 10px' }} />
            ))}
          </div>
          {/* Table Rows Skeleton */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(row => (
            <div key={row} style={{ padding: '1rem', display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
              {[1, 2, 3, 4, 5].map(col => (
                <div key={col} className="skeleton-box" style={{ flex: 1, height: '14px', margin: '0 10px' }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Form Fields Skeleton */}
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 2 }}>
              <div className="skeleton-box" style={{ width: '80px', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton-box" style={{ width: '100%', height: '42px', borderRadius: '8px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="skeleton-box" style={{ width: '80px', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton-box" style={{ width: '100%', height: '42px', borderRadius: '8px' }} />
            </div>
          </div>
          {/* Items Table Skeleton */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #f1f5f9' }}>
              <div className="skeleton-box" style={{ width: '200px', height: '14px' }} />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '1.25rem 1rem', display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                <div className="skeleton-box" style={{ flex: 3, height: '14px', marginRight: '20px' }} />
                <div className="skeleton-box" style={{ flex: 1, height: '14px', marginRight: '20px' }} />
                <div className="skeleton-box" style={{ flex: 1, height: '14px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .skeleton-box {
          background-color: #f1f5f9;
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default PageSkeleton;
