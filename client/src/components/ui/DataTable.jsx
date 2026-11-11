import React, { useEffect, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Reusable DataTable Component
 * Features:
 * - Internal / External Search & Filtering
 * - Internal Pagination
 * - Configurable columns with custom renderers
 * - Extra headers/actions buttons slot
 * - Clean matching style without left/right borders
 * - Automatic alignment: text left, numbers/amounts right, action icons right
 * - Automatic proper amount/number formatting
 */
export default function DataTable({
  columns,
  data = [],
  loading = false,
  searchPlaceholder = 'Search...',
  searchKeys = [], // keys to perform local search on (e.g. ['name', 'code'])
  itemsPerPage = 15,
  extraActions, // JSX element for action button(s) next to the search input
  noDataMessage = 'No records found.',
  onRowClick,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  onServerQuery,
  serverTotal,
  serverPage = 1
}) {
  const usingServer = typeof onServerQuery === 'function';
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [internalSelectedIds, setInternalSelectedIds] = useState([]);
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;

  const commitSelection = (next) => {
    if (controlledSelectedIds === undefined) {
      setInternalSelectedIds(next);
    }
    onSelectionChange?.(next);
  };

  // Component-level rule: determine auto-align and format based on column headers and data types
  const formattedColumns = columns.map(col => {
    const headerLower = (col.header || '').toLowerCase();
    const accessorLower = (col.accessor || '').toLowerCase();
    const isAccount = headerLower.includes('account') || accessorLower.includes('account');
    
    const isAmount = !isAccount && (
      headerLower.includes('total') ||
      headerLower.includes('price') ||
      headerLower.includes('amount') ||
      headerLower.includes('cost') ||
      headerLower.includes('rate') ||
      headerLower.includes('subtotal') ||
      headerLower.includes('discount') ||
      headerLower.includes('tax') ||
      headerLower.includes('balance') ||
      headerLower.includes('debit') ||
      headerLower.includes('credit') ||
      headerLower.includes('charge') ||
      headerLower.includes('fee') ||
      headerLower.includes('$') ||
      accessorLower.includes('total') ||
      accessorLower.includes('amount') ||
      accessorLower.includes('price') ||
      accessorLower.includes('cost') ||
      accessorLower.includes('rate') ||
      accessorLower.includes('balance') ||
      accessorLower.includes('tax')
    );

    const isNumeric = !isAccount && (
      isAmount ||
      headerLower.includes('qty') ||
      headerLower.includes('quantity') ||
      headerLower.includes('count') ||
      (
        !headerLower.includes('#') && 
        !headerLower.includes('number') && 
        !headerLower.includes('code') &&
        !accessorLower.includes('number') &&
        !accessorLower.includes('code') &&
        (headerLower.includes('qty') || headerLower.includes('quantity') || headerLower.includes('count') || accessorLower.includes('qty') || accessorLower.includes('quantity') || accessorLower.includes('count'))
      )
    );

    const isAction = headerLower.includes('action') || accessorLower.includes('action');

    const autoAlign = isAction || isAmount || isNumeric ? 'right' : 'left';
    
    const originalRender = col.render;

    const formatAmountValue = (val) => {
      if (val === null || val === undefined) return '-';
      const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (!isNaN(num) && isFinite(num)) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return String(val);
    };

    const newRender = (row, val) => {
      if (originalRender) {
        const renderedVal = originalRender(row, val);
        if (React.isValidElement(renderedVal)) {
          return renderedVal;
        }
        if (isAmount && (typeof renderedVal === 'string' || typeof renderedVal === 'number')) {
          const renderedStr = String(renderedVal);
          const hasDollar = renderedStr.includes('$');
          const cleanVal = renderedStr.replace(/[$,\s]/g, '');
          const parsed = parseFloat(cleanVal);
          if (!isNaN(parsed) && isFinite(parsed)) {
            const formatted = parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return hasDollar ? `$${formatted}` : formatted;
          }
        }
        return renderedVal;
      }

      if (isAmount) {
        return formatAmountValue(val);
      }

      if (isNumeric) {
        if (val === null || val === undefined) return '-';
        const num = parseFloat(val);
        if (!isNaN(num) && isFinite(num)) {
          return num.toLocaleString('en-US');
        }
      }

      return val !== null && val !== undefined ? String(val) : '-';
    };

    return {
      ...col,
      align: col.align || autoAlign,
      render: newRender
    };
  });

  // Group columns to place amount columns right before action columns
  const actionCols = [];
  const amountCols = [];
  const regularCols = [];
  
  formattedColumns.forEach(col => {
    const headerLower = (col.header || '').toLowerCase();
    const accessorLower = (col.accessor || '').toLowerCase();
    const isAccount = headerLower.includes('account') || accessorLower.includes('account');
    
    const isAction = headerLower.includes('action') || accessorLower.includes('action');
    
    const isAmount = !isAccount && (
      headerLower.includes('total') ||
      headerLower.includes('price') ||
      headerLower.includes('amount') ||
      headerLower.includes('cost') ||
      headerLower.includes('rate') ||
      headerLower.includes('subtotal') ||
      headerLower.includes('discount') ||
      headerLower.includes('tax') ||
      headerLower.includes('balance') ||
      headerLower.includes('debit') ||
      headerLower.includes('credit') ||
      headerLower.includes('charge') ||
      headerLower.includes('fee') ||
      headerLower.includes('$') ||
      accessorLower.includes('total') ||
      accessorLower.includes('amount') ||
      accessorLower.includes('price') ||
      accessorLower.includes('cost') ||
      accessorLower.includes('rate') ||
      accessorLower.includes('balance') ||
      accessorLower.includes('tax')
    );
      
    if (isAction) {
      actionCols.push(col);
    } else if (isAmount) {
      amountCols.push(col);
    } else {
      regularCols.push(col);
    }
  });
  
  const finalColumns = [...regularCols, ...amountCols, ...actionCols];

  // 1. Handle local search/filtering if searchKeys are provided
  const getFilteredData = () => {
    if (usingServer || !searchQuery.trim() || searchKeys.length === 0) {
      return data;
    }
    
    const query = searchQuery.toLowerCase();
    return data.filter(item => 
      searchKeys.some(key => {
        const val = item[key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  };

  const filteredData = getFilteredData();

  // 2. Sorting Logic
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      key = null;
      direction = 'asc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
    if (usingServer) onServerQuery({ q: searchQuery, page: 1, sort: key, dir: direction });
  };

  const getSortedData = () => {
    if (usingServer || !sortConfig.key) {
      return filteredData;
    }
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedData = getSortedData();
  const columnCount = finalColumns.length + (selectable ? 1 : 0);
  const visibleIds = sortedData.map((row) => row.id).filter((id) => id !== undefined && id !== null);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (!selectable) return;
    const next = selectedIds.filter((id) => data.some((row) => row.id === id));
    if (next.length !== selectedIds.length) commitSelection(next);
  }, [data, selectable]);

  const toggleAllVisible = () => {
    const next = allVisibleSelected
      ? selectedIds.filter((id) => !visibleIds.includes(id))
      : [...new Set([...selectedIds, ...visibleIds])];
    commitSelection(next);
  };

  const toggleRow = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    commitSelection(next);
  };

  // 3. Pagination Calculations. Server mode keeps this same footer and skips the local slice.
  const totalRows = usingServer ? (serverTotal || 0) : sortedData.length;
  const pageNow = usingServer ? serverPage : currentPage;
  const totalPages = Math.ceil(totalRows / itemsPerPage) || 1;
  const startIndex = (pageNow - 1) * itemsPerPage;
  const paginatedData = usingServer ? data : sortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    if (usingServer) onServerQuery({ q: e.target.value, page: 1, sort: sortConfig.key, dir: sortConfig.direction });
  };

  return (
    <>
      {/* Top Search & Actions Row */}
      {(searchKeys.length > 0 || extraActions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            {searchKeys.length > 0 && (
              <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  style={{ 
                    width: '100%', 
                    paddingLeft: '34px', 
                    paddingRight: '12px', 
                    height: '38px', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    outline: 'none', 
                    fontSize: '0.85rem', 
                    backgroundColor: '#fff', 
                    boxSizing: 'border-box' 
                  }}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
          {extraActions && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {extraActions}
            </div>
          )}
        </div>
      )}

      {/* Main Table Wrapper */}
      <div className="datatable" style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {selectable && (
                <th style={{ width: '44px', textAlign: 'center' }}>
                  <SelectCheckbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={toggleAllVisible}
                    label="Select all"
                  />
                </th>
              )}
              {finalColumns.map((col, idx) => {
                const isSortable = col.accessor && col.sortable !== false;
                const isSorted = sortConfig.key === col.accessor;
                
                return (
                  <th 
                    key={col.key || idx} 
                    onClick={() => isSortable && handleSort(col.accessor)}
                    style={{ 
                      textAlign: col.align || 'left',
                      width: col.width || 'auto',
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.35rem',
                      justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}>
                      <span>{col.header}</span>
                      {isSortable && (
                        <span style={{ 
                          display: 'inline-flex', 
                          color: isSorted ? 'var(--accent)' : '#94a3b8',
                          opacity: isSorted ? 1 : 0.4
                        }}>
                          {isSorted ? (
                            sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columnCount} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading records...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columnCount} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {noDataMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr 
                  key={row.id || rowIdx} 
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ 
                    borderBottom: '1px solid var(--border-color)', 
                    transition: 'background 0.2s',
                    cursor: onRowClick ? 'pointer' : 'default',
                    backgroundColor: selectable && selectedIds.includes(row.id) ? 'rgba(37, 99, 235, 0.06)' : 'transparent'
                  }}
                >
                  {selectable && (
                    <td style={{ width: '44px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <SelectCheckbox
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleRow(row.id)}
                        label={`Select ${row.name || row.code || 'row'}`}
                      />
                    </td>
                  )}
                  {finalColumns.map((col, colIdx) => {
                    const value = row[col.accessor];
                    
                    return (
                      <td 
                        key={col.key || colIdx} 
                        style={{ 
                          textAlign: col.align || 'left',
                          fontWeight: col.fontWeight || 'normal',
                          color: col.color || 'inherit'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: col.align === 'right' ? 'flex-end' : (col.align === 'center' ? 'center' : 'flex-start'),
                          whiteSpace: 'nowrap'
                        }}>
                          {col.render ? col.render(row, value) : (value !== null && value !== undefined ? String(value) : '-')}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}

            {/* Pagination Controls */}
            {!loading && filteredData.length > 0 && (
              <tr className="table-pagination-row">
                <td colSpan={columnCount} className="table-pagination-td" style={{ padding: '0' }}>
                  <div style={{ 
                    padding: '0 1rem', 
                    height: '100%',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    backgroundColor: 'transparent' 
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectable && selectedIds.length > 0 ? `${selectedIds.length} selected · ` : ''}
                      Showing {totalRows > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalRows)} of {totalRows} entries
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        onClick={() => {
                          const next = Math.max(1, pageNow - 1);
                          if (usingServer) onServerQuery({ q: searchQuery, page: next, sort: sortConfig.key, dir: sortConfig.direction });
                          else setCurrentPage(next);
                        }} 
                        disabled={pageNow === 1} 
                        style={{ 
                          padding: '3px', 
                          borderRadius: '4px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: pageNow === 1 ? '#f8fafc' : '#fff', 
                          cursor: pageNow === 1 ? 'not-allowed' : 'pointer', 
                          color: pageNow === 1 ? '#cbd5e1' : 'var(--text-main)', 
                          display: 'flex', 
                          alignItems: 'center' 
                        }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0 0.5rem' }}>
                        Page {pageNow} of {totalPages || 1}
                      </span>
                      <button 
                        onClick={() => {
                          const next = Math.min(totalPages, pageNow + 1);
                          if (usingServer) onServerQuery({ q: searchQuery, page: next, sort: sortConfig.key, dir: sortConfig.direction });
                          else setCurrentPage(next);
                        }} 
                        disabled={pageNow === totalPages || totalPages === 0} 
                        style={{ 
                          padding: '3px', 
                          borderRadius: '4px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: (pageNow === totalPages || totalPages === 0) ? '#f8fafc' : '#fff', 
                          cursor: (pageNow === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', 
                          color: (pageNow === totalPages || totalPages === 0) ? '#cbd5e1' : 'var(--text-main)', 
                          display: 'flex', 
                          alignItems: 'center' 
                        }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SelectCheckbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
    />
  );
}
