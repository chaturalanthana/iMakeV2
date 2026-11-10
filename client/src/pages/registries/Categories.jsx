import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import ConfirmModal from '../../components/ui/ConfirmModal';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Layers, Plus, Edit2, Trash2, X, Search, ChevronDown, ChevronRight, Folder, FolderOpen, Info, FolderSymlink } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import TreeSelect from '../../components/ui/TreeSelect';

export default function Categories() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [isContainerDragOver, setIsContainerDragOver] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    parentId: ''
  });

  const [confirmConfig, setConfirmConfig] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: null 
  });

  // Move Modal states
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingCategory, setMovingCategory] = useState(null);
  const [moveParentId, setMoveParentId] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get('/api/categories', config);
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        name: formData.name,
        parentId: formData.parentId || null
      };

      if (editingCategory) {
        await axios.put(`/api/categories/${editingCategory.id}`, payload, config);
        showToast('Category updated successfully', 'success');
      } else {
        await axios.post('/api/categories', payload, config);
        showToast('Category created successfully', 'success');
      }
      
      closeModal();
      fetchCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      showToast(error.response?.data?.error || 'Failed to save category', 'error');
    }
  };

  const isDescendant = (parentId, childId) => {
    let current = categories.find(c => c.id === childId);
    while (current && current.parentId) {
      if (current.parentId === parentId) return true;
      current = categories.find(c => c.id === current.parentId);
    }
    return false;
  };

  const handleMoveCategory = async (id, newParentId) => {
    if (id === newParentId) return;
    if (newParentId && isDescendant(id, newParentId)) {
      showToast('Cannot move a category into its own sub-category', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const category = categories.find(c => c.id === id);
      if (!category) return;

      await axios.put(`/api/categories/${id}`, {
        name: category.name,
        parentId: newParentId
      }, config);
      
      showToast('Category moved successfully', 'success');
      fetchCategories();
    } catch (error) {
      console.error('Failed to move category:', error);
      showToast(error.response?.data?.error || 'Failed to move category', 'error');
    }
  };

  const handleDeleteClick = (category) => {
    // Count total descendant categories that will be cascade-deleted
    const getDescendantsCount = (catId) => {
      let count = 0;
      const findChildren = (parentId) => {
        const children = categories.filter(c => c.parentId === parentId);
        count += children.length;
        children.forEach(child => findChildren(child.id));
      };
      findChildren(catId);
      return count;
    };

    const descendantsCount = getDescendantsCount(category.id);
    const subMessage = descendantsCount > 0 
      ? ` Warning: This category has ${descendantsCount} sub-categor${descendantsCount === 1 ? 'y' : 'ies'} which will also be permanently deleted.`
      : '';

    setConfirmConfig({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${category.name}"? This action cannot be undone and any products in this category will be unassigned.${subMessage}`,
      onConfirm: () => handleDelete(category.id)
    });
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/categories/${id}`, config);
      showToast('Category deleted successfully', 'success');
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      showToast(error.response?.data?.error || 'Failed to delete category', 'error');
    }
  };

  const openModal = (category = null, preselectedParentId = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        parentId: category.parentId || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        parentId: preselectedParentId || ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', parentId: '' });
  };

  const handleAddSubCategory = (parentId) => {
    openModal(null, parentId);
  };

  const handleEditCategory = (category) => {
    openModal(category);
  };

  const openMoveModal = (category) => {
    setMovingCategory(category);
    setMoveParentId(category.parentId || '');
    setIsMoveModalOpen(true);
  };

  const closeMoveModal = () => {
    setIsMoveModalOpen(false);
    setMovingCategory(null);
    setMoveParentId('');
  };

  const handleSaveMove = async (e) => {
    e.preventDefault();
    if (!movingCategory) return;
    await handleMoveCategory(movingCategory.id, moveParentId || null);
    closeMoveModal();
  };

  const getCategoryPathById = (catId) => {
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

  // Helper: Get visual path string for parent selection dropdown
  const getCategoryPath = (cat, list) => {
    let path = cat.name;
    let currentParentId = cat.parentId;
    while (currentParentId) {
      const parent = list.find(c => c.id === currentParentId);
      if (!parent) break;
      path = `${parent.name} > ${path}`;
      currentParentId = parent.parentId;
    }
    return path;
  };

  // Helper: Filter out self and any recursive descendants when choosing a parent category
  const getValidParents = (currentId, list) => {
    if (!currentId) return list;
    
    const descendantIds = new Set();
    const addDescendants = (id) => {
      list.forEach(item => {
        if (item.parentId === id) {
          descendantIds.add(item.id);
          addDescendants(item.id);
        }
      });
    };
    addDescendants(currentId);
    
    return list.filter(item => item.id !== currentId && !descendantIds.has(item.id));
  };

  // Build tree from flat list
  const buildTree = (list, parentId = null) => {
    return list
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: buildTree(list, item.id)
      }));
  };

  // Recursive search match check
  const hasMatch = (node, query) => {
    if (!query) return true;
    if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
    if (node.children && node.children.length > 0) {
      return node.children.some(child => hasMatch(child, query));
    }
    return false;
  };

  // Construct valid parent options for the dropdown
  const validParents = getValidParents(editingCategory?.id, categories);
  const parentOptions = validParents.map(cat => ({
    label: getCategoryPath(cat, categories),
    value: cat.id
  })).sort((a, b) => a.label.localeCompare(b.label));

  const categoryTree = buildTree(categories, null);

  // Recursive Tree Node Component
  const TreeNode = ({ node }) => {
    const isExpanded = expandedNodes[node.id] || false;
    const hasChildren = node.children && node.children.length > 0;
    
    const getRecursiveProductCount = (n) => {
      let count = n._count?.products || 0;
      if (n.children && n.children.length > 0) {
        n.children.forEach(child => {
          count += getRecursiveProductCount(child);
        });
      }
      return count;
    };
    const productCount = getRecursiveProductCount(node);
    const [isDragOver, setIsDragOver] = useState(false);
    
    // Automatically expand parent nodes if children match search query
    const hasSubMatch = searchQuery ? node.children.some(c => hasMatch(c, searchQuery)) : false;
    const shouldExpand = searchQuery ? hasSubMatch : isExpanded;

    const toggleExpand = () => {
      setExpandedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }));
    };

    const [isHovered, setIsHovered] = useState(false);

    // If searching and neither this node nor its children match, do not render
    if (searchQuery && !hasMatch(node, searchQuery)) {
      return null;
    }

    const isValidDrop = draggedId && draggedId !== node.id && !isDescendant(draggedId, node.id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          draggable={true}
          onDragStart={(e) => {
            e.stopPropagation();
            setDraggedId(node.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', node.id);
          }}
          onDragEnd={() => {
            setDraggedId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isValidDrop) {
              setIsDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            setIsDragOver(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            if (isValidDrop) {
              await handleMoveCategory(draggedId, node.id);
            }
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '0.55rem 0.8rem',
            borderRadius: '6px',
            backgroundColor: isDragOver ? 'var(--accent-light)' : 'transparent',
            border: isDragOver ? '1px dashed var(--accent)' : '1px solid transparent',
            transition: 'all 0.15s ease',
            cursor: 'grab',
            position: 'relative'
          }}
        >
          {/* Toggle Arrow */}
          <button
            type="button"
            onClick={toggleExpand}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              visibility: hasChildren ? 'visible' : 'hidden',
              transition: 'background-color 0.2s',
              marginRight: '0.25rem'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            {shouldExpand ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>

          {/* Folder Icon */}
          <span style={{ color: hasChildren ? 'var(--accent)' : '#94a3b8', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
            {shouldExpand && hasChildren ? <FolderOpen size={18} /> : <Folder size={18} />}
          </span>

          {/* Name */}
          <span style={{ 
            fontSize: '1.05rem', 
            fontWeight: hasChildren ? 600 : 500, 
            color: 'var(--text-main)',
            marginRight: '0.5rem'
          }}>
            {node.name}
          </span>

          {/* Product Count Badge */}
          <span style={{ 
            fontSize: '0.82rem', 
            color: 'var(--text-muted)', 
            backgroundColor: '#f1f5f9', 
            padding: '2px 8px', 
            borderRadius: '99px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            marginRight: '0.75rem'
          }}>
            {productCount} {productCount === 1 ? 'item' : 'items'}
          </span>

          {/* Action Toolbar on Hover */}
          <div style={{ 
            display: 'flex', 
            gap: '0.15rem', 
            opacity: isHovered ? 1 : 0, 
            transition: 'opacity 0.15s ease',
            pointerEvents: isHovered ? 'auto' : 'none',
            alignItems: 'center'
          }}>
            <button 
              type="button"
              onClick={() => handleAddSubCategory(node.id)}
              title="Add sub-category"
              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Plus size={14} />
            </button>
            <button 
              type="button"
              onClick={() => openMoveModal(node)}
              title="Move category"
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <FolderSymlink size={13} />
            </button>
            <button 
              type="button"
              onClick={() => handleEditCategory(node)}
              title="Edit category"
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Edit2 size={13} />
            </button>
            <button 
              type="button"
              onClick={() => handleDeleteClick(node)}
              title="Delete category"
              style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Children Render block */}
        {hasChildren && shouldExpand && (
          <div style={{ 
            borderLeft: '1px dashed #cbd5e1', 
            marginLeft: '1.25rem', 
            paddingLeft: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            marginTop: '2px',
            marginBottom: '4px',
            gap: '1px'
          }}>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout title="Categories" icon={Layers}>
      {isInitialLoad ? (
        <PageSkeleton type="table" />
      ) : (
        <>
          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', height: '38px', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  autoComplete="off"
                />
              </div>
            </div>
            
            <button
              onClick={() => openModal()}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '0.55rem 1.25rem',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={16} /> New Category
            </button>
          </div>

          {/* Tree Panel */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              if (e.target === e.currentTarget) {
                setIsContainerDragOver(true);
              }
            }}
            onDragLeave={() => {
              setIsContainerDragOver(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsContainerDragOver(false);
              const dragId = e.dataTransfer.getData('text/plain');
              if (dragId) {
                const item = categories.find(c => c.id === dragId);
                if (item && item.parentId !== null) {
                  await handleMoveCategory(dragId, null);
                }
              }
            }}
            style={{ 
              backgroundColor: isContainerDragOver ? 'var(--accent-light)' : 'transparent', 
              border: isContainerDragOver ? '2px dashed var(--accent)' : 'none', 
              borderRadius: '8px', 
              padding: '0.5rem 0', 
              minHeight: '300px',
              transition: 'all 0.2s ease'
            }}
          >
            {categories.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: 'var(--text-muted)' }}>
                <Layers size={48} strokeWidth={1.2} style={{ marginBottom: '1rem', color: '#94a3b8' }} />
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No categories created yet.</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Create one to start organizing products.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {categoryTree.map(rootNode => (
                  <TreeNode key={rootNode.id} node={rootNode} />
                ))}
              </div>
            )}
          </div>

          {/* CRUD Modal */}
          {isModalOpen && createPortal(
            <div style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              zIndex: 1000 
            }}>
              <div style={{ 
                backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', 
                maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{ 
                  padding: '1.25rem 1.75rem', 
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '8px',
                      backgroundColor: 'rgba(124, 58, 237, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent)'
                    }}>
                      <Layers size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {editingCategory ? 'Update Category' : 'Create Category'}
                      </h3>
                      <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {editingCategory 
                          ? `Rename this category. To move it, use drag-and-drop or the Move button.` 
                          : formData.parentId 
                            ? `Creating sub-category under "${categories.find(c => c.id === formData.parentId)?.name || ''}"` 
                            : 'Define a new top-level category'}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={closeModal} style={{ 
                    background: '#f1f5f9', border: 'none', cursor: 'pointer', 
                    color: 'var(--text-muted)', width: '32px', height: '32px', 
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s'
                  }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }} autoComplete="off">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Category Name <span style={{ color: 'var(--error)' }}>*</span></label>
                      <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange} 
                        placeholder="e.g. Laptops, Accessories" 
                        style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }} 
                        required 
                        autoFocus
                      />
                    </div>

                    {/* Parent Category Info (Read-only) */}
                    {formData.parentId && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Parent Category</label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.7rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#f8fafc',
                          color: 'var(--text-muted)',
                          fontSize: '0.9rem',
                        }}>
                          <Info size={14} style={{ marginRight: '8px', color: '#94a3b8', flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {getCategoryPathById(formData.parentId)}
                          </span>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Buttons */}
                  <div style={{ 
                    display: 'flex', justifyContent: 'flex-end', gap: '1rem', 
                    marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' 
                  }}>
                    <button type="button" onClick={closeModal} style={{ 
                      background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', 
                      padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', 
                      fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                      Cancel
                    </button>
                    <button type="submit" style={{ 
                      padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', 
                      cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
                      color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                      transition: 'opacity 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      {editingCategory ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Move Modal */}
          {isMoveModalOpen && movingCategory && createPortal(
            <div style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              zIndex: 1000 
            }}>
              <div style={{ 
                backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', 
                maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{ 
                  padding: '1.25rem 1.75rem', 
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '8px',
                      backgroundColor: 'rgba(124, 58, 237, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent)'
                    }}>
                      <FolderSymlink size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Move Category
                      </h3>
                      <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Change parent category for "{movingCategory.name}"
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={closeMoveModal} style={{ 
                    background: '#f1f5f9', border: 'none', cursor: 'pointer', 
                    color: 'var(--text-muted)', width: '32px', height: '32px', 
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s'
                  }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveMove} style={{ padding: '1.75rem' }} autoComplete="off">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Visual Parent Selector */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Select New Parent Category</label>
                      <TreeSelect
                        categories={categories}
                        value={moveParentId}
                        onChange={(val) => setMoveParentId(val)}
                        excludeId={movingCategory.id}
                      />
                      <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={13} />
                        Select "Top Level (No Parent)" to make this a root category.
                      </p>
                    </div>

                  </div>

                  {/* Buttons */}
                  <div style={{ 
                    display: 'flex', justifyContent: 'flex-end', gap: '1rem', 
                    marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' 
                  }}>
                    <button type="button" onClick={closeMoveModal} style={{ 
                      background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', 
                      padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer', 
                      fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                      Cancel
                    </button>
                    <button type="submit" style={{ 
                      padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', 
                      cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
                      color: '#ffffff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                      transition: 'opacity 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
            onConfirm={confirmConfig.onConfirm}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText="Delete"
          />
        </>
      )}
    </AppLayout>
  );
}
