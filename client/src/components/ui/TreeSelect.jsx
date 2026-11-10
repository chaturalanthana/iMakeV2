import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Info, Search, X } from 'lucide-react';

export default function TreeSelect({ 
  categories, 
  value, 
  onChange, 
  excludeId, 
  placeholder = "Select category",
  emptyLabel = "Top Level (No Parent)",
  showEmptyOption = true,
  onAddNew = null,
  addNewLabel = 'Add New +',
  invalid = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDescendant = (parentId, childId) => {
    let current = categories.find(c => c.id === childId);
    while (current && current.parentId) {
      if (current.parentId === parentId) return true;
      current = categories.find(c => c.id === current.parentId);
    }
    return false;
  };

  const isNodeDisabled = (nodeId) => {
    if (!excludeId) return false;
    if (nodeId === excludeId) return true;
    return isDescendant(excludeId, nodeId);
  };

  const getCategoryPath = (catId) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return '';
    let path = cat.name;
    let currentParentId = cat.parentId;
    while (currentParentId) {
      const parent = categories.find(c => c.id === currentParentId);
      if (!parent) break;
      path = `${parent.name} > ${path}`;
      currentParentId = parent.parentId;
    }
    return path;
  };

  const buildTree = (list, parentId = null) => {
    return list
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: buildTree(list, item.id)
      }));
  };

  const hasMatch = (node, query) => {
    if (!query) return true;
    if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
    if (node.children && node.children.length > 0) {
      return node.children.some(child => hasMatch(child, query));
    }
    return false;
  };

  const getCategoryPathNodes = (catId) => {
    const nodes = [];
    let current = categories.find(c => c.id === catId);
    while (current) {
      nodes.unshift(current);
      current = current.parentId ? categories.find(c => c.id === current.parentId) : null;
    }
    return nodes;
  };

  const categoryTree = buildTree(categories, null);
  const pathNodes = value ? getCategoryPathNodes(value) : [];

  const DropdownTreeNode = ({ node, depth = 0 }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isDisabled = isNodeDisabled(node.id);
    const isExpanded = expandedNodes[node.id] || false;

    const hasSubMatch = searchTerm ? node.children.some(c => hasMatch(c, searchTerm)) : false;
    const shouldExpand = searchTerm ? hasSubMatch : isExpanded;

    const toggleExpand = (e) => {
      e.stopPropagation();
      setExpandedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }));
    };

    if (searchTerm && !hasMatch(node, searchTerm)) {
      return null;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => {
            if (!isDisabled) {
              onChange(node.id);
              setIsOpen(false);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${12 + depth * 16}px`,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.45 : 1,
            backgroundColor: value === node.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
            color: value === node.id ? 'var(--accent)' : 'var(--text-main)',
            fontSize: '0.88rem',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isDisabled && value !== node.id) {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDisabled && value !== node.id) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <button
            type="button"
            onClick={toggleExpand}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              width: '18px',
              height: '18px',
              marginRight: '4px',
              visibility: hasChildren ? 'visible' : 'hidden',
            }}
          >
            {shouldExpand ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <span style={{ color: value === node.id || hasChildren ? 'var(--accent)' : '#94a3b8', display: 'flex', alignItems: 'center', marginRight: '6px' }}>
            {shouldExpand && hasChildren ? <FolderOpen size={15} /> : <Folder size={15} />}
          </span>

          <span style={{ fontWeight: value === node.id ? 600 : 500 }}>{node.name}</span>
        </div>

        {hasChildren && shouldExpand && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map(child => (
              <DropdownTreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={invalid ? 'field-invalid' : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.35rem 0.75rem',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border-color)',
          backgroundColor: '#fff',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          height: '42px',
          minHeight: '42px',
          boxShadow: isOpen ? '0 0 0 2px rgba(124, 58, 237, 0.15)' : 'none',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = '#a78bfa';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', justifyContent: 'center' }}>
          {pathNodes.length > 0 ? (
            <>
              {pathNodes.length > 1 && (
                <div style={{ 
                  fontSize: '0.65rem', 
                  color: '#94a3b8', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  marginBottom: '1px'
                }}>
                  {pathNodes.slice(0, -1).map(node => node.name).join(' › ')}
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px', 
                color: 'var(--accent)', 
                fontWeight: 600, 
                fontSize: '0.82rem',
                lineHeight: 1.2
              }}>
                <Folder size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pathNodes[pathNodes.length - 1].name}
                </span>
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{placeholder}</span>
          )}
        </div>
        <ChevronDown size={18} style={{ color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: '#fff',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          maxHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: '#f8fafc'
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories..."
              style={{
                width: '100%',
                border: 'none',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                padding: '2px 0'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {!searchTerm && showEmptyOption && (
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  backgroundColor: !value ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                  color: !value ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (value) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (value) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Info size={14} style={{ marginRight: '8px', color: '#94a3b8' }} />
                <span style={{ fontWeight: !value ? 600 : 500 }}>{emptyLabel}</span>
              </div>
            )}

            {categoryTree.map(rootNode => (
              <DropdownTreeNode key={rootNode.id} node={rootNode} />
            ))}

            {searchTerm && categoryTree.every(rootNode => !hasMatch(rootNode, searchTerm)) && (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                No categories match "{searchTerm}"
              </div>
            )}
          </div>
          {onAddNew && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onAddNew();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                border: 'none',
                borderTop: '1px solid var(--border-color)',
                background: '#f8fafc',
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            >
              <span>{addNewLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
