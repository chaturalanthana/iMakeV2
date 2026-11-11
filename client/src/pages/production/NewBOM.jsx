import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Check, FileText, Settings, Layers, Wrench, 
  Trash2, Plus, GitFork, ChevronDown, ChevronRight, Play, DollarSign, Package, FolderOpen, Pencil,
  Download, File, Copy, Save, Pause
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import ProductSearchDropdown from '../../components/ui/ProductSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { bomPath, isUuid } from '../../utils/bomPath';

export default function NewBOM() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [id, setId] = useState(() => (isUuid(params.id) ? params.id : ''));
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('mandatory');

  const formatWithCommas = (val) => {
    if (val === null || val === undefined || val === '') return '';
    let s = val.toString().replace(/,/g, '');
    if (isNaN(s)) return s;
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const unformatNumber = (val) => {
    if (!val) return '0';
    return val.toString().replace(/,/g, '');
  };

  const openProtectedUpload = async (filePath, downloadName) => {
    try {
      const token = localStorage.getItem('token');
      const normalized = filePath.startsWith('/api/')
        ? filePath
        : `/api${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
      const response = await fetch(normalized, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Unable to open this file');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (downloadName) {
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      showToast(error.message || 'Unable to open this file', 'error');
    }
  };

  const formatCost = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const mapProductTypeName = (name, kind) => {
    const byKind = {
      FINISHED_GOOD: 'Finished Good',
      SEMI_FINISHED: 'Sub Assembly',
      RAW_MATERIAL: 'Raw Material',
      PACKAGING: 'Packaging Material',
      CONSUMABLE: 'Consumable',
      SERVICE: 'Service'
    };
    if (kind && byKind[kind]) return byKind[kind];
    if (!name) return 'Raw Material';
    const clean = name.toLowerCase().trim();
    if (clean.includes('semi') || clean.includes('sub')) return 'Sub Assembly';
    if (clean.includes('finish')) return 'Finished Good';
    if (clean.includes('pack')) return 'Packaging Material';
    if (clean.includes('consumable') || clean.includes('spare')) return 'Consumable';
    if (clean.includes('service')) return 'Service';
    if (clean.includes('raw')) return 'Raw Material';
    return 'Raw Material';
  };

  const getChangeBadge = (type) => {
    const configs = {
      added: { text: 'Added', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
      removed: { text: 'Removed', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
      modified: { text: 'Modified', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      unchanged: { text: 'Unchanged', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' }
    };
    const c = configs[type] || configs.unchanged;
    return (
      <span style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        color: c.color,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        display: 'inline-block',
        textTransform: 'uppercase'
      }}>
        {c.text}
      </span>
    );
  };

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, x: 0, y: 0, stepIndex: null });
  const [modalOperation, setModalOperation] = useState('');
  const [modalDuration, setModalDuration] = useState(10);
  const [modalSetupMin, setModalSetupMin] = useState(0);
  const [modalRunMin, setModalRunMin] = useState(10);
  const [modalWorkers, setModalWorkers] = useState(1);
  const [modalQCRequired, setModalQCRequired] = useState(false);
  const [modalInstructions, setModalInstructions] = useState('');
  const [modalAttachments, setModalAttachments] = useState([]);
  const [selectedWorkstation, setSelectedWorkstation] = useState(null);
  const [creatingWorkstation, setCreatingWorkstation] = useState(false);
  const [savingWorkstation, setSavingWorkstation] = useState(false);
  const [wsDraft, setWsDraft] = useState({ code: '', name: '' });
  const [wsErrors, setWsErrors] = useState({});
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', type: 'primary', onConfirm: null, confirmText: 'Confirm' });
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const formDataRef = useRef(null);
  const routingSaveRef = useRef({ chain: Promise.resolve(), token: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const [pickerPos, setPickerPos] = useState({ left: 16, top: 56 });
  const stepDraggedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      setZoom(prev => {
        const newZoom = prev - e.deltaY * 0.0015;
        return Math.min(2.0, Math.max(0.5, newZoom));
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [activeTab]);

  // Attributes for dropdowns
  const [products, setProducts] = useState([]);
  const [bomApplicableProducts, setBomApplicableProducts] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  
  const [formData, setFormData] = useState({
    productId: '',
    code: '',
    name: '',
    version: 'Rev 1',
    status: 'DRAFT',
    isDefault: false,
    description: '',
    routingSteps: [],
    items: [],
    effectiveFrom: ''
  });
  formDataRef.current = formData;

  const [treeData, setTreeData] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);


  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let ignore = false;
    const resolveBom = async () => {
      if (params.productCode && params.bomCode) {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(
            `/api/boms/by-code/${encodeURIComponent(params.productCode)}/${encodeURIComponent(params.bomCode)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!ignore) setId((current) => (current === res.data.id ? current : res.data.id));
        } catch (error) {
          if (!ignore) showToast(error.response?.data?.error || 'BOM not found', 'error');
        }
        return;
      }
      if (isUuid(params.id)) {
        setId((current) => (current === params.id ? current : params.id));
      }
    };
    resolveBom();
    return () => { ignore = true; };
  }, [params.id, params.productCode, params.bomCode]);

  useEffect(() => {
    if (id) fetchBOM();
  }, [id]);

  useEffect(() => {
    if (modalConfig.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [modalConfig.isOpen]);

  useEffect(() => {
    if (activeTab === 'tree' && formData.productId) {
      fetchBOMTree(formData.productId);
    }
  }, [activeTab, formData.productId]);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const [prodRes, wsRes] = await Promise.all([
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/workstations', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProducts(prodRes.data);
      setBomApplicableProducts(
        prodRes.data
          .filter(p => p.bomApplicable)
          .map(p => ({ 
            label: `${p.code} - ${p.name}`, 
            value: p.id, 
            code: p.code, 
            name: p.name, 
            uom: p.uom?.name || '-' 
          }))
      );
      setWorkstations(wsRes.data.filter(w => w.status === 'ACTIVE'));
    } catch (error) {
      console.error('Failed to fetch details:', error);
    }
  };

  const fetchBOM = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/boms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bom = res.data;
      setFormData({
        productId: bom.productId,
        code: bom.code,
        name: bom.name,
        version: bom.version,
        status: bom.status,
        isDefault: bom.isDefault,
        description: bom.description || '',
        effectiveFrom: bom.effectiveFrom ? bom.effectiveFrom.split('T')[0] : '',
        routingSteps: (bom.routingSteps || []).map((step, idx) => ({
          ...step,
          sequence: step.sequence || (idx + 1) * 10,
          x: 50 + idx * 250, // Re-index position horizontally sequentially to keep them fully visible on screen
          y: 185 // Force auto vertical-middle alignment on load
        })),
        items: bom.items.map(item => ({
          id: item.id,
          productId: item.productId,
          code: item.componentProduct?.code || '',
          name: item.componentProduct?.name || '',
          type: mapProductTypeName(item.componentProduct?.productType?.name || item.type || 'Raw Material', item.componentProduct?.productType?.kind),
          uom: item.componentProduct?.uom?.name || '-',
          quantity: parseFloat(item.quantity),
          scrapPercent: parseFloat(item.scrapPercent || 0),
          instruction: item.instruction || ''
        }))
      });

      const nextPath = bomPath(bom);
      if (decodeURI(location.pathname) !== decodeURI(nextPath)) {
        navigate(nextPath, { replace: true });
      }
    } catch (error) {
      console.error('Failed to fetch BOM:', error);
      showToast('Failed to load BOM record', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBOMTree = async (productId) => {
    setTreeLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/boms/tree/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTreeData(res.data);
    } catch (error) {
      console.error('Failed to resolve BOM tree:', error);
      showToast('Failed to load multi-level structure', 'error');
    } finally {
      setTreeLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleChange = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleParentProductChange = (val) => {
    if (formData.items.some(item => item.productId === val)) {
      showToast('Cannot select a product as finished good that is already a component in this BOM', 'error');
      return;
    }
    const matched = bomApplicableProducts.find(p => p.value === val);
    setFormData(prev => {
      const nextVer = prev.version || 'Rev 1';
      const cleanVer = nextVer.replace(/\s+/g, '');
      const codeSuggestion = matched ? `BOM-${matched.code}-${cleanVer}`.toUpperCase() : '';
      const nameSuggestion = matched ? matched.name : '';
      return {
        ...prev,
        productId: val,
        code: codeSuggestion,
        name: nameSuggestion
      };
    });
  };

  const handleVersionChange = (val) => {
    setFormData(prev => {
      const matched = bomApplicableProducts.find(p => p.value === prev.productId);
      const cleanVer = val.replace(/\s+/g, '');
      const codeSuggestion = matched ? `BOM-${matched.code}-${cleanVer}`.toUpperCase() : '';
      return {
        ...prev,
        version: val,
        code: codeSuggestion || prev.code
      };
    });
  };

  const handleItemProductChange = (index, product) => {
    if (formData.items.some((item, idx) => idx !== index && item.productId === product.id)) {
      showToast('This product is already selected as a component in another row', 'error');
      return;
    }
    setFormData(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        productId: product.id,
        code: product.code,
        name: product.name,
        type: mapProductTypeName(product.productType?.name, product.productType?.kind),
        uom: product.uom?.name || '-',
        standardCost: parseFloat(product.standardCost || product.costPrice || 0),
        scrapPercent: parseFloat(product.scrapPercent || 0)
      };
      return { ...prev, items: nextItems };
    });

    // Auto focus the quantity input field for this row
    setTimeout(() => {
      const qtyInput = document.getElementById(`bom-qty-input-${index}`);
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
  };

  const handleItemNumberChange = (index, field, value) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value === '' ? '' : parseFloat(value)
      };
      return { ...prev, items: nextItems };
    });
  };

  const handleItemTextChange = (index, field, value) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value
      };
      return { ...prev, items: nextItems };
    });
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: '', code: '', name: '', type: 'Raw Material', uom: '-', quantity: 1, scrapPercent: 0, instruction: '', standardCost: 0 }
      ]
    }));
  };

  const removeItemRow = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  // Routing Steps helpers
  const addRoutingStep = () => {
    setFormData(prev => {
      const steps = prev.routingSteps || [];
      const nextStepNum = steps.length + 1;
      return {
        ...prev,
        routingSteps: [
          ...steps,
          { stepNumber: nextStepNum, sequence: nextStepNum * 10, operation: '', workCenter: '', durationMinutes: 10, x: 200 + steps.length * 200, y: 180 }
        ]
      };
    });
  };

  const persistProcessFlow = (message = 'Workstation saved') => {
    if (!id) {
      if (message === 'Workstation saved') showToast('Save the BOM to keep this workstation', 'error');
      return;
    }
    const ticket = ++routingSaveRef.current.token;
    routingSaveRef.current.chain = routingSaveRef.current.chain.then(async () => {
      if (ticket !== routingSaveRef.current.token) return;
      const current = formDataRef.current;
      if (!current || current.status === 'ACTIVE' || current.status === 'RETIRED') return;
      try {
        const token = localStorage.getItem('token');
        await axios.put(`/api/boms/${id}`, {
          name: current.name,
          code: current.code,
          version: current.version,
          status: current.status,
          isDefault: current.isDefault,
          description: current.description,
          routingSteps: current.routingSteps,
          effectiveFrom: current.effectiveFrom || null,
          items: (current.items || []).filter((item) => item.productId).map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            scrapPercent: item.scrapPercent || 0,
            instruction: item.instruction || '',
            type: item.type || 'Raw Material'
          }))
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ticket === routingSaveRef.current.token) showToast(message, 'success');
      } catch (error) {
        if (ticket === routingSaveRef.current.token) {
          showToast(error.response?.data?.error || 'Failed to save workstation', 'error');
        }
      }
    });
  };

  const commitRoutingSteps = (routingSteps, message) => {
    const next = { ...formDataRef.current, routingSteps };
    formDataRef.current = next;
    setFormData(next);
    persistProcessFlow(message);
  };

  const workstationTaken = (code, exceptIndex = null) => {
    const key = String(code || '').trim().toLowerCase();
    if (!key) return false;
    return (formDataRef.current?.routingSteps || []).some((step, idx) => {
      if (exceptIndex !== null && exceptIndex !== undefined && idx === exceptIndex) return false;
      return String(step.workCenter || '').trim().toLowerCase() === key;
    });
  };

  const addWorkstationStep = (ws) => {
    if (workstationTaken(ws.code)) {
      showToast('This workstation is already in the process flow', 'error');
      return false;
    }
    const steps = [...(formDataRef.current.routingSteps || [])];
    const last = steps.reduce((latest, step) => ((step.x || 0) >= (latest?.x || -1) ? step : latest), null);
    const newStep = {
      stepNumber: steps.length + 1,
      sequence: (steps.length + 1) * 10,
      operation: ws.name || ws.code,
      workCenter: ws.code,
      setupMin: 0,
      runMin: 10,
      noOfWorkers: 1,
      qcRequired: false,
      instructions: '',
      attachments: [],
      durationMinutes: 10,
      x: last ? (last.x || 50) + 280 : 80,
      y: last?.y || 185
    };
    const sorted = [...steps, newStep].sort((a, b) => (a.x || 0) - (b.x || 0));
    commitRoutingSteps(sorted.map((step, idx) => ({ ...step, stepNumber: idx + 1, sequence: (idx + 1) * 10 })));
    return true;
  };

  const openPickerFrom = (event, anchorId, place = 'below') => {
    event.stopPropagation();
    if (pickerOpen && pickerAnchor === anchorId) {
      setPickerOpen(false);
      setPickerAnchor(null);
      return;
    }
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const anchor = event.currentTarget.getBoundingClientRect();
    if (!canvasRect) return;
    const panelW = 260;
    const panelH = 300;
    const gap = 8;
    let left = place === 'right'
      ? anchor.right - canvasRect.left + gap
      : anchor.left - canvasRect.left;
    let top = place === 'right'
      ? anchor.top - canvasRect.top
      : anchor.bottom - canvasRect.top + gap;
    if (left + panelW > canvasRect.width - 8) left = anchor.left - canvasRect.left - panelW - gap;
    if (top + panelH > canvasRect.height - 8) top = anchor.top - canvasRect.top - panelH - gap;
    left = Math.max(8, Math.min(left, canvasRect.width - panelW - 8));
    top = Math.max(8, Math.min(top, canvasRect.height - panelH - 8));
    setPickerPos({ left, top });
    setPickerAnchor(anchorId);
    setCreatingWorkstation(false);
    setPickerOpen(true);
  };

  const openNewWorkstation = () => {
    const randSuffix = Math.floor(100 + Math.random() * 900);
    setWsDraft({ code: `WS-${randSuffix}`, name: '' });
    setWsErrors({});
    setCreatingWorkstation(true);
  };

  const handleCreateWorkstation = async () => {
    const errors = {};
    if (!wsDraft.code.trim()) errors.code = 'Code is required.';
    if (!wsDraft.name.trim()) errors.name = 'Name is required.';
    if (Object.keys(errors).length > 0) {
      setWsErrors(errors);
      showToast(Object.keys(errors).length === 1 ? Object.values(errors)[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }

    setSavingWorkstation(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/workstations', {
        code: wsDraft.code.trim(),
        name: wsDraft.name.trim(),
        status: 'ACTIVE'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const created = res.data;
      setWorkstations((prev) => [...prev, created].sort((a, b) => String(a.code).localeCompare(String(b.code))));
      setSelectedWorkstation(created.code);
      if (!modalOperation || !modalOperation.trim()) {
        setModalOperation(created.name || created.code);
      }
      setCreatingWorkstation(false);
      showToast('Workstation created', 'success');
      if (pickerOpen) {
        addWorkstationStep(created);
        setPickerOpen(false);
        setPickerAnchor(null);
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create workstation';
      const nextErrors = {};
      if (message.toLowerCase().includes('code')) nextErrors.code = message;
      if (message.toLowerCase().includes('name')) nextErrors.name = message;
      if (Object.keys(nextErrors).length > 0) setWsErrors(nextErrors);
      showToast(message, 'error');
    } finally {
      setSavingWorkstation(false);
    }
  };

  const handleRoutingStepChange = (index, field, value) => {
    setFormData(prev => {
      const nextSteps = [...prev.routingSteps];
      nextSteps[index] = {
        ...nextSteps[index],
        [field]: field === 'durationMinutes' ? parseInt(value) || 0 : value
      };
      return { ...prev, routingSteps: nextSteps };
    });
  };

  const removeRoutingStep = (index) => {
    const steps = (formDataRef.current.routingSteps || []).filter((_, idx) => idx !== index);
    const sorted = [...steps].sort((a, b) => (a.x || 0) - (b.x || 0));
    commitRoutingSteps(
      sorted.map((s, idx) => ({ ...s, stepNumber: idx + 1, sequence: (idx + 1) * 10 })),
      'Workstation removed'
    );
  };

  const handleActivateCreatedBOM = async (bomId, shouldRedirect) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/boms/${bomId}/activate`, { confirmOverwrite: true }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(res.data.message || 'BOM created and activated successfully', 'success');
      if (shouldRedirect) {
        navigate('/production/boms');
      } else {
        const parent = products.find((product) => product.id === formData.productId);
        navigate(bomPath({ code: formData.code, product: parent, id: bomId }));
      }
    } catch (error) {
      console.error('Activate created BOM error:', error);
      showToast(error.response?.data?.error || 'Failed to activate BOM', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e, shouldRedirect = true) => {
    if (e && e.preventDefault) e.preventDefault();
    const errors = {};
    if (!formData.productId) errors.productId = 'Parent product is required';
    if (formData.items.length === 0) errors.items = 'At least one component is required in the BOM';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
      return;
    }
    setFieldErrors({});
    if (formData.items.some(item => item.productId === formData.productId)) {
      showToast('A BOM component cannot be the same as the parent product', 'error');
      return;
    }

    const selectedProductIds = formData.items.map(item => item.productId).filter(Boolean);
    const hasDuplicates = new Set(selectedProductIds).size !== selectedProductIds.length;
    if (hasDuplicates) {
      showToast('Duplicate component products are not allowed', 'error');
      return;
    }

    // Validate component quantities greater than zero
    for (const item of formData.items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        showToast(`Quantity for component ${item.code || '(unselected)'} must be greater than zero`, 'error');
        return;
      }
    }

    const targetStatus = shouldRedirect ? 'ACTIVE' : formData.status;
    if (targetStatus === 'ACTIVE') {
      if (!formData.effectiveFrom) {
        showToast('Effective From date is required when activating a BOM', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        status: targetStatus,
        confirmOverwrite: true,
        items: formData.items.filter(item => item.productId)
      };

      if (id) {
        // Edit flow
        await axios.put(`/api/boms/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });

        showToast('BOM saved successfully', 'success');
        if (shouldRedirect) {
          navigate('/production/boms');
        } else {
          fetchBOM();
        }
      } else {
        // Create flow
        // Step 1: Create as draft
        const res = await axios.post('/api/boms', { ...payload, status: 'DRAFT' }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const newBomId = res.data.id;

        // Step 2: If targetStatus is ACTIVE, activate it
        if (targetStatus === 'ACTIVE') {
          await axios.post(`/api/boms/${newBomId}/activate`, { confirmOverwrite: true }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        showToast('BOM created successfully', 'success');
        if (shouldRedirect) {
          navigate('/production/boms');
        } else {
          const parent = products.find((product) => product.id === formData.productId);
          navigate(bomPath({ code: res.data.code, product: parent }));
        }
      }
    } catch (error) {
      console.error('Save BOM error:', error);
      showToast(error.response?.data?.error || 'Failed to save BOM', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRetireBOM = async (confirmRetire = false) => {
    if (!id) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/boms/${id}/retire`, { confirmRetire }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.warning === 'NO_OTHER_ACTIVE_BOM') {
        setSaving(false);
        setConfirmConfig({
          isOpen: true,
          title: 'Retire BOM',
          message: res.data.message,
          type: 'danger',
          confirmText: 'Retire',
          onConfirm: () => handleRetireBOM(true)
        });
        return;
      }

      showToast(res.data.message || 'BOM retired successfully', 'success');
      fetchBOM();
    } catch (error) {
      console.error('Retire BOM error:', error);
      showToast(error.response?.data?.error || 'Failed to retire BOM', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Copy Version',
      message: 'Are you sure you want to copy this BOM version? This will create a new DRAFT version with incremented version number, copying all components, routing steps, and attachments.',
      type: 'primary',
      confirmText: 'Copy Version',
      children: (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0', margin: '0.5rem 0' }}>
          <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-light, #ddd6fe)" />
                <stop offset="100%" stopColor="var(--accent, #7c3aed)" />
              </linearGradient>
            </defs>

            {/* Left Source Document Card */}
            <g transform="translate(10, 10)">
              <rect x="0" y="0" width="60" height="78" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M12 20h36M12 34h36M12 48h24" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
              <circle cx="48" cy="62" r="4" fill="#94a3b8" />
            </g>

            {/* Dotted arch path representing motion */}
            <path d="M85 45 C 100 25, 120 25, 135 45" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4" fill="none" strokeLinecap="round" />
            <path d="M132 45l4.5 1-2.5-4.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Duplication Action Plus Icon in Center */}
            <g transform="translate(100, 16)">
              <circle cx="10" cy="10" r="11" fill="url(#docGrad)" />
              <path d="M10 6v8M6 10h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Right Duplicated Target Document Card */}
            <g transform="translate(140, 10)">
              <rect x="0" y="0" width="60" height="78" rx="8" fill="#ffffff" stroke="var(--accent)" strokeWidth="2" />
              <path d="M12 20h36M12 34h36M12 48h24" stroke="var(--accent-light)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="48" cy="62" r="4" fill="var(--accent)" />
            </g>
          </svg>
        </div>
      ),
      onConfirm: async () => {
        setSaving(true);
        try {
          const token = localStorage.getItem('token');
          const res = await axios.post(`/api/boms/${id}/duplicate`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          showToast('New BOM version copied successfully! You are now editing the new version.', 'success');
          const parent = products.find((product) => product.id === formData.productId);
          navigate(bomPath({ code: res.data.code, product: parent }));
        } catch (error) {
          console.error('Copy version error:', error);
          showToast(error.response?.data?.error || 'Failed to copy version', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleDeleteBOM = async () => {
    if (!id) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Delete BOM',
      message: 'Are you sure you want to delete this Bill of Materials? This action is permanent and only possible because it is currently in DRAFT status.',
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setSaving(true);
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`/api/boms/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          showToast('BOM deleted successfully', 'success');
          navigate('/production/boms');
        } catch (error) {
          console.error('Delete BOM error:', error);
          showToast(error.response?.data?.error || 'Failed to delete BOM', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  // Recursive Tree Node Renderer
  const TreeRow = ({ node, depth = 0 }) => {
    const [collapsed, setCollapsed] = useState(false);
    if (!node) return null;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <>
        <tr style={{ 
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'transparent',
          transition: 'background-color 0.2s',
          cursor: hasChildren ? 'pointer' : 'default'
        }}
        onClick={() => {
          if (hasChildren) setCollapsed(!collapsed);
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.015)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {/* Code with Indentation & Collapse Trigger */}
          <td style={{ 
            padding: '0.75rem 1rem', 
            fontSize: '0.85rem',
            paddingLeft: `${1 + depth * 1.75}rem`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {hasChildren ? (
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(!collapsed);
                  }} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: '#64748b' 
                  }}
                >
                  {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </button>
              ) : (
                <div style={{ width: 15 }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: node.bomApplicable ? 'var(--accent)' : '#475569' }}>
                {node.bomApplicable ? <Layers size={14} /> : <Package size={14} />}
                <span style={{ fontWeight: 700 }}>{node.code}</span>
              </div>
            </div>
          </td>

          {/* Name */}
          <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
            {node.name}
          </td>

          {/* Component Type */}
          <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
            {(() => {
              const typeColors = {
                'Finished Good': '#15803d',
                'Raw Material': '#0284c7',
                'Sub Assembly': '#10b981',
                'Packaging Material': '#7c3aed',
                'Consumable': '#b45309',
                'Service': '#64748b'
              };
              const label = node.type || 'Raw Material';
              return (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: typeColors[label] || typeColors['Raw Material'] }}>
                  {label}
                </span>
              );
            })()}
          </td>

          {/* UOM */}
          <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
            {node.uom || '-'}
          </td>

          {/* Quantity */}
          <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#0284c7', fontWeight: 600, textAlign: 'right' }}>
            {node.quantity}
          </td>

          {/* Scrap % */}
          <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#b45309', fontWeight: 600, textAlign: 'right' }}>
            {node.scrapPercent !== undefined ? `${node.scrapPercent}%` : '-'}
          </td>
        </tr>

        {!collapsed && hasChildren && node.children.map((child, idx) => (
          <TreeRow key={idx} node={child} depth={depth + 1} />
        ))}
      </>
    );
  };

  // Styles
  const tabBtnStyle = (isActive) => ({
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

  const sectionHeaderStyle = {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.65rem',
    marginBottom: '1.25rem',
    marginTop: '0.5rem'
  };

  const labelStyle = {
    width: '180px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#475569',
    flexShrink: 0
  };

  const inputStyle = {
    width: '100%',
    padding: '0.6rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    fontSize: '0.85rem',
    outline: 'none',
    backgroundColor: '#fff'
  };

  const formRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    width: '100%'
  };

  const isLocked = id && (formData.status === 'ACTIVE' || formData.status === 'RETIRED');

  return (
    <AppLayout title={id ? "Edit BOM" : "Create BOM"}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => navigate('/production/boms')} 
            style={{ 
              background: '#fff', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              padding: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              color: '#64748b' 
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1.25rem' }}>
              {id ? `BOM Code: ${formData.code}` : 'Create Bill of Materials'}
            </h2>
            <p style={{ margin: '0.1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Configure parent product, components spreadsheet, process flow, and structure rollup.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {id && (
            <button 
              type="button"
              onClick={handleDuplicate}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#faf5ff',
                color: 'var(--accent)',
                border: '1px solid #d8b4fe',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f3e8ff';
                e.currentTarget.style.borderColor = '#c084fc';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#faf5ff';
                e.currentTarget.style.borderColor = '#d8b4fe';
              }}
            >
              <Copy size={16} /> Copy Version
            </button>
          )}
          {id && formData.status === 'ACTIVE' && (
            <button 
              type="button"
              onClick={() => handleRetireBOM(false)}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f8fafc',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              <Pause size={16} /> Retire
            </button>
          )}
          {id && formData.status === 'DRAFT' && (
            <button 
              type="button"
              onClick={handleDeleteBOM}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.borderColor = '#f87171';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.borderColor = '#fca5a5';
              }}
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button 
            type="button" 
            onClick={() => navigate('/production/boms')} 
            style={{ 
              background: '#fff', 
              color: '#64748b', 
              border: '1px solid #e2e8f0', 
              padding: '0.55rem 1.25rem', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 600, 
              fontSize: '0.85rem'
            }}
          >
            Cancel
          </button>
          {!isLocked && (
            <>
              <button 
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                disabled={saving}
                style={{ 
                  padding: '0.55rem 1.25rem', 
                  borderRadius: '8px', 
                  border: '1px solid #cbd5e1', 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  fontSize: '0.85rem', 
                  background: '#ffffff', 
                  color: '#334155',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <Save size={16} style={{ color: '#475569' }} /> Save
              </button>
              <button 
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={saving}
                style={{ 
                  padding: '0.55rem 1.5rem', 
                  borderRadius: '8px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontWeight: 700, 
                  fontSize: '0.85rem', 
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', 
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {saving ? 'Confirming...' : <><Check size={16} /> Confirm</>}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ width: '100%', backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Top Horizontal Tabs Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
          {[
            { id: 'mandatory', label: 'General', icon: FileText },
            { id: 'components', label: 'Components', icon: Layers },
            { id: 'routing', label: 'Process Flow', icon: Wrench },
            { id: 'tree', label: 'Tree', icon: GitFork },
            { id: 'resources', label: 'Attachments', icon: FolderOpen }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={tabBtnStyle(activeTab === tab.id)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Full-width Content Section */}
        <div style={{ width: '100%' }}>
          {/* TAB 1: MANDATORY */}
          {activeTab === 'mandatory' && (
            <div>
              <h3 style={sectionHeaderStyle}>BOM Header Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Finished Good <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1 }}>
                    <LiveSearchDropdown
                      options={bomApplicableProducts}
                      value={formData.productId}
                      invalid={!!fieldErrors.productId}
                      onChange={handleParentProductChange}
                      placeholder="Select Finished Good Product..."
                      style={{ input: inputStyle }}
                      disabled={isLocked}
                      columns={[
                        { label: 'Code', key: 'code', width: '30%' },
                        { label: 'Name', key: 'name', width: '50%' },
                        { label: 'UOM', key: 'uom', width: '20%' }
                      ]}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>BOM Code <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1 }}>
                    <input 
                      type="text" 
                      name="code" 
                      value={formData.code} 
                      onChange={handleInputChange} 
                      placeholder="e.g. BOM-PROD-REV1" 
                      style={inputStyle}
                      required 
                      readOnly={isLocked}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>BOM Name <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1 }}>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="BOM Name" 
                      style={inputStyle}
                      required 
                      readOnly={isLocked}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>BOM Version <span style={{ color: 'red' }}>*</span></label>
                  <div style={{ flexGrow: 1 }}>
                    <input 
                      type="text" 
                      name="version" 
                      value={formData.version} 
                      onChange={(e) => handleVersionChange(e.target.value)} 
                      placeholder="e.g. Rev 1" 
                      style={inputStyle}
                      required
                      readOnly={isLocked}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Status</label>
                  <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                    {(() => {
                      const colors = {
                        DRAFT: '#475569',
                        ACTIVE: '#10b981',
                        RETIRED: '#ef4444',
                        SUPERSEDED: '#d97706'
                      };
                      const status = formData.status || 'DRAFT';
                      return (
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: colors[status] || colors.DRAFT }}>
                          {status}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Effective From</label>
                  <div style={{ flexGrow: 1 }}>
                    <DatePicker
                      value={formData.effectiveFrom}
                      onChange={(date) => setFormData(prev => ({ ...prev, effectiveFrom: date }))}
                      placeholder="Effective From"
                      disabled={isLocked}
                    />
                  </div>
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>Remarks</label>
                  <div style={{ flexGrow: 1 }}>
                    <textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Increased foam quantity from 2kg to 2.5kg" 
                      style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                      readOnly={isLocked}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPONENTS */}
          {activeTab === 'components' && (
            <div>
              <h3 style={sectionHeaderStyle}>BOM Components</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Select component materials and quantities.
              </p>

              <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                  <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr style={{ height: '2.25rem' }}>
                      <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '50px', textAlign: 'center' }}>#</th>
                      <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, width: '400px' }}>Component Item</th>
                      <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Type</th>
                      <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '80px' }}>UOM</th>
                      <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Qty</th>
                      <th style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', width: '120px' }}>Scrap %</th>
                      <th style={{ borderBottom: '1px solid var(--border-color)', width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr 
                        key={idx} 
                        style={{ height: '2.25rem', transition: 'all 0.2s', borderBottom: '1px solid var(--border-color)' }}
                        onMouseEnter={e => { !isLocked && (e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.03)') }}
                        onMouseLeave={e => { !isLocked && (e.currentTarget.style.backgroundColor = 'transparent') }}
                      >
                        <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          {idx + 1}
                        </td>
                        <td style={{ borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: '#000' }} className="spreadsheet-cell">
                          <div style={{ pointerEvents: 'auto', height: '2.25rem' }}>
                            <ProductSearchDropdown
                              products={products.filter(p => 
                                p.id !== formData.productId && 
                                !formData.items.some((itm, i) => i !== idx && itm.productId === p.id)
                              )}
                              value={item.code ? `${item.code} - ${item.name}` : ''}
                              onChange={(prod) => handleItemProductChange(idx, prod)}
                              className="spreadsheet-input"
                              hideCost={true}
                              disabled={isLocked}
                              style={{
                                wrapper: { height: '100%', width: '100%' },
                                input: { height: '100%', padding: '0 1rem', fontSize: '0.85rem', fontWeight: 500, borderRadius: '0px' }
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', color: '#000' }} className="spreadsheet-cell">
                          {(() => {
                            const typeColors = {
                              'Finished Good': '#15803d',
                              'Raw Material': '#0284c7',
                              'Sub Assembly': '#10b981',
                              'Packaging Material': '#7c3aed',
                              'Consumable': '#b45309',
                              'Service': '#64748b'
                            };
                            const label = item.type || 'Raw Material';
                            return (
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: typeColors[label] || typeColors['Raw Material'] }}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-main)', padding: '0.25rem 1rem' }}>
                          {item.uom || '-'}
                        </td>
                        <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: 800, color: '#000' }} className="spreadsheet-cell">
                          <input
                            id={`bom-qty-input-${idx}`}
                            type="text"
                            value={formatWithCommas(item.quantity)}
                            onChange={(e) => handleItemNumberChange(idx, 'quantity', unformatNumber(e.target.value))}
                            readOnly={isLocked}
                            style={{ 
                              textAlign: 'center', 
                              fontSize: '0.85rem', 
                              fontWeight: 800, 
                              color: 'var(--text-main)',
                              boxSizing: 'border-box',
                              height: '100%',
                              width: '100%',
                              padding: '0 1rem',
                              border: 'none',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              cursor: isLocked ? 'not-allowed' : 'text'
                            }}
                          />
                        </td>
                        <td style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: 800, color: '#000' }} className="spreadsheet-cell">
                          <input
                            type="text"
                            value={formatWithCommas(item.scrapPercent)}
                            onChange={(e) => handleItemNumberChange(idx, 'scrapPercent', unformatNumber(e.target.value))}
                            readOnly={isLocked}
                            style={{ 
                              textAlign: 'center', 
                              fontSize: '0.85rem', 
                              fontWeight: 800, 
                              color: 'var(--text-main)',
                              boxSizing: 'border-box',
                              height: '100%',
                              width: '100%',
                              padding: '0 1rem',
                              border: 'none',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              cursor: isLocked ? 'not-allowed' : 'text'
                            }}
                          />
                        </td>
                        <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem', textAlign: 'center' }}>
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                              onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!isLocked && (
                      <tr 
                        style={{ height: '2.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} 
                        onClick={addItemRow} 
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.03)'} 
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', textAlign: 'center' }}>
                          <Plus size={14} color="#cbd5e1" style={{ margin: '0 auto' }} />
                        </td>
                        <td colSpan={6} style={{ borderBottom: '1px solid var(--border-color)', padding: '0.25rem 1rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Click here to add another line...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ROUTING */}
          {activeTab === 'routing' && (
            <div>
              <h3 style={sectionHeaderStyle}>Process Flow Operations & Workstation Times</h3>

              {/* Main Outer Canvas Wrapper */}
              <div 
                ref={canvasRef}
                onMouseDown={(e) => {
                  setPickerOpen(false);
                  setPickerAnchor(null);
                  setIsPanning(true);
                  setPanStart({
                    x: e.clientX - panOffset.x,
                    y: e.clientY - panOffset.y
                  });
                  setMouseDownPos({
                    x: e.clientX,
                    y: e.clientY
                  });
                }}
                onMouseMove={(e) => {
                  if (draggingIndex !== null) {
                    if (Math.abs(e.clientX - mouseDownPos.x) > 4 || Math.abs(e.clientY - mouseDownPos.y) > 4) {
                      stepDraggedRef.current = true;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = (e.clientX - rect.left - panOffset.x) / zoom;
                    const mouseY = (e.clientY - rect.top - panOffset.y) / zoom;
                    
                    setFormData(prev => {
                      const nextSteps = [...prev.routingSteps];
                      nextSteps[draggingIndex] = {
                        ...nextSteps[draggingIndex],
                        x: Math.max(10, mouseX - dragOffset.x),
                        y: Math.max(10, mouseY - dragOffset.y)
                      };
                      return { ...prev, routingSteps: nextSteps };
                    });
                  } else if (isPanning) {
                    setPanOffset({
                      x: e.clientX - panStart.x,
                      y: e.clientY - panStart.y
                    });
                  }
                }}
                onMouseUp={(e) => {
                  if (draggingIndex !== null) {
                    setFormData(prev => {
                      const sorted = [...prev.routingSteps].sort((a, b) => (a.x || 0) - (b.x || 0));
                      const sequenced = sorted.map((s, idx) => ({
                        ...s,
                        stepNumber: idx + 1,
                        sequence: (idx + 1) * 10
                      }));
                      return { ...prev, routingSteps: sequenced };
                    });
                    setDraggingIndex(null);
                    if (stepDraggedRef.current) {
                      setTimeout(() => { stepDraggedRef.current = false; }, 0);
                    }
                  }
                  setIsPanning(false);
                }}
                onMouseLeave={() => {
                  if (draggingIndex !== null) {
                    setFormData(prev => {
                      const sorted = [...prev.routingSteps].sort((a, b) => (a.x || 0) - (b.x || 0));
                      const sequenced = sorted.map((s, idx) => ({
                        ...s,
                        stepNumber: idx + 1,
                        sequence: (idx + 1) * 10
                      }));
                      return { ...prev, routingSteps: sequenced };
                    });
                    setDraggingIndex(null);
                  }
                  setIsPanning(false);
                }}
                style={{
                  width: '100%',
                  height: '550px',
                  border: 'none',
                  borderRadius: '12px',
                  backgroundColor: '#fafbfc',
                  backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 0)',
                  backgroundSize: '24px 24px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: draggingIndex !== null || isPanning ? 'grabbing' : (isLocked ? 'default' : 'grab'),
                  boxSizing: 'border-box'
                }}
              >

                {!isLocked && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 12 }}
                  >
                    <button
                      type="button"
                      onClick={(event) => openPickerFrom(event, 'toolbar', 'below')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(226, 232, 240, 0.9)',
                        background: 'rgba(255, 255, 255, 0.96)',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)'
                      }}
                    >
                      <Plus size={15} />
                      Workstation
                    </button>
                  </div>
                )}
                {pickerOpen && !isLocked && (
                      <div
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                        position: 'absolute',
                        left: pickerPos.left,
                        top: pickerPos.top,
                        zIndex: 20,
                        width: '260px',
                        maxHeight: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.65rem',
                        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.1)',
                        boxSizing: 'border-box'
                      }}>
                        {creatingWorkstation ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            <input
                              type="text"
                              value={wsDraft.code}
                              placeholder="Code"
                              className={wsErrors.code ? 'field-invalid' : undefined}
                              onChange={(e) => {
                                setWsDraft((prev) => ({ ...prev, code: e.target.value }));
                                setWsErrors((prev) => ({ ...prev, code: undefined }));
                              }}
                              style={{ ...inputStyle, padding: '0.4rem 0.55rem', height: '34px', fontSize: '0.8rem', borderRadius: '8px' }}
                            />
                            {wsErrors.code && <span className="field-error-text">{wsErrors.code}</span>}
                            <input
                              type="text"
                              value={wsDraft.name}
                              placeholder="Name"
                              className={wsErrors.name ? 'field-invalid' : undefined}
                              onChange={(e) => {
                                setWsDraft((prev) => ({ ...prev, name: e.target.value }));
                                setWsErrors((prev) => ({ ...prev, name: undefined }));
                              }}
                              style={{ ...inputStyle, padding: '0.4rem 0.55rem', height: '34px', fontSize: '0.8rem', borderRadius: '8px' }}
                            />
                            {wsErrors.name && <span className="field-error-text">{wsErrors.name}</span>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              <button
                                type="button"
                                disabled={savingWorkstation}
                                onClick={() => setCreatingWorkstation(false)}
                                style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.35rem 0.7rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingWorkstation}
                                onClick={handleCreateWorkstation}
                                style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: 'none', cursor: savingWorkstation ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.75rem', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', color: '#fff', opacity: savingWorkstation ? 0.7 : 1 }}
                              >
                                {savingWorkstation ? 'Saving...' : 'Create'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto', maxHeight: '320px' }}>
                              {workstations.map((ws) => {
                                const taken = workstationTaken(ws.code);
                                return (
                                <button
                                  key={ws.id}
                                  type="button"
                                  onClick={() => {
                                    if (!addWorkstationStep(ws)) return;
                                    setPickerOpen(false);
                                    setPickerAnchor(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.4rem',
                                    width: '100%',
                                    padding: '0.45rem 0.6rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    background: taken ? '#f8fafc' : '#fff',
                                    cursor: taken ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit',
                                    textAlign: 'left',
                                    opacity: taken ? 0.55 : 1
                                  }}
                                >
                                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{ws.code}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{ws.name}</span>
                                  </span>
                                  {taken && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>In use</span>}
                                </button>
                                );
                              })}
                              {workstations.length === 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0.35rem 0.2rem' }}>No workstations</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={openNewWorkstation}
                              style={{
                                width: '100%',
                                padding: '0.5rem 0.65rem',
                                border: 'none',
                                borderRadius: '8px',
                                background: 'rgba(37, 99, 235, 0.08)',
                                color: 'var(--accent)',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textAlign: 'left'
                              }}
                            >
                              Add New +
                            </button>
                          </>
                        )}
                      </div>
                )}

                 {/* Floating SMV Total Indicator */}
                 <div 
                   onMouseDown={(e) => e.stopPropagation()}
                   style={{
                     position: 'absolute',
                     top: '16px',
                     right: '16px',
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'flex-end',
                     backgroundColor: 'rgba(255, 255, 255, 0.95)',
                     backdropFilter: 'blur(8px)',
                     border: '1px solid rgba(226, 232, 240, 0.8)',
                     borderRadius: '8px',
                     padding: '0.55rem 1rem',
                     boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                     zIndex: 10
                   }}
                 >
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                     Total SMV
                   </span>
                   <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                     {(formData.routingSteps || []).reduce((sum, step) => sum + (parseFloat(step.runMin ?? step.durationMinutes) || 0), 0)} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Min</span>
                   </span>
                 </div>

                {/* Floating Zoom Controls - NOT scaled */}
                <div 
                  onMouseDown={(e) => e.stopPropagation()} // Stop drag/pan from zoom controls
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.92)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.65rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    zIndex: 10
                  }}
                >
                  <button 
                    type="button" 
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontWeight: 700, fontSize: '0.9rem', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', minWidth: '36px', textAlign: 'center' }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontWeight: 700, fontSize: '0.9rem', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    +
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setZoom(1.0);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, paddingLeft: '6px', borderLeft: '1px solid #e2e8f0', marginLeft: '2px' }}
                  >
                    Reset
                  </button>
                </div>

                {/* Scaled/Zoomable Inner Content Wrapper */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  transformOrigin: 'top left',
                  transition: draggingIndex !== null || isPanning ? 'none' : 'transform 0.1s ease-out'
                }}>
                  {/* SVG Connections overlay */}
                  <svg style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '3000px',
                    height: '1500px',
                    pointerEvents: 'none',
                    zIndex: 0
                  }}>
                    {/* Draw connections sequentially between steps */}
                    {(() => {
                      const steps = [...(formData.routingSteps || [])].sort((a, b) => (a.x || 0) - (b.x || 0));
                      if (steps.length <= 1) return null;
                      
                      const paths = [];
                      for (let i = 0; i < steps.length - 1; i++) {
                        const current = steps[i];
                        const next = steps[i + 1];
                        
                        const currentOutX = (current.x !== undefined && current.x !== null ? current.x : (50 + i * 250)) + 200;
                        const currentOutY = (current.y || 185) + 55;
                        
                        const nextInX = next.x !== undefined && next.x !== null ? next.x : (50 + (i + 1) * 250);
                        const nextInY = (next.y || 185) + 55;
                        
                        const d = Math.abs(nextInX - currentOutX) * 0.5;
                        paths.push(
                          <path
                            key={`step-conn-${i}`}
                            d={`M ${currentOutX} ${currentOutY} C ${currentOutX + d} ${currentOutY}, ${nextInX - d} ${nextInY}, ${nextInX} ${nextInY}`}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="3"
                          />
                        );
                      }
                      return paths;
                    })()}
                  </svg>

                  {/* Intermediate Step Nodes */}
                  {(formData.routingSteps || []).map((step, idx) => {
                    const stepX = step.x || (50 + idx * 250);
                    const stepY = step.y || 185;
                    
                    return (
                      <div
                        key={idx}
                        onMouseDown={(e) => {
                          if (e.target.closest('button')) return;
                          e.stopPropagation();
                          if (isLocked) return;
                          stepDraggedRef.current = false;
                          setMouseDownPos({ x: e.clientX, y: e.clientY });
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDragOffset({
                            x: (e.clientX - rect.left) / zoom,
                            y: (e.clientY - rect.top) / zoom
                          });
                          setDraggingIndex(idx);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${stepX}px`,
                          top: `${stepY}px`,
                          width: '200px',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          boxShadow: draggingIndex === idx ? '0 10px 15px -3px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                          zIndex: draggingIndex === idx ? 10 : 2,
                          transition: draggingIndex === idx ? 'none' : 'box-shadow 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          boxSizing: 'border-box',
                          cursor: isLocked ? 'default' : (draggingIndex === idx ? 'grabbing' : 'grab')
                        }}
                      >
                        {/* Connection points */}
                        <div style={{ position: 'absolute', left: '-5px', top: '50px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: '2px solid #fff', zIndex: 3 }} />
                        {idx === formData.routingSteps.length - 1 ? (
                          !isLocked ? (
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => openPickerFrom(e, `step-${idx}`, 'right')}
                              className="pulse-button"
                              style={{
                                position: 'absolute',
                                right: '-12px',
                                top: '43px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent)',
                                border: '2px solid #fff',
                                zIndex: 4,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                outline: 'none',
                                boxShadow: '0 0 0 0 rgba(124, 58, 237, 0.7)'
                              }}
                              title="Add next workstation step"
                            >
                              <Plus size={14} color="#fff" strokeWidth={3} />
                            </button>
                          ) : (
                            <div style={{ position: 'absolute', right: '-5px', top: '50px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: '2px solid #fff', zIndex: 3 }} />
                          )
                        ) : (
                          <div style={{ position: 'absolute', right: '-5px', top: '50px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: '2px solid #fff', zIndex: 3 }} />
                        )}

                        <div 
                          style={{
                            padding: '0.45rem 0.65rem',
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: '#f8fafc',
                            borderTopLeftRadius: '7px',
                            borderTopRightRadius: '7px',
                            cursor: isLocked ? 'default' : (draggingIndex === idx ? 'grabbing' : 'grab'),
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)' }}>
                              STEP #{step.stepNumber}
                            </span>
                            {step.qcRequired && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444' }}>
                                QC
                              </span>
                            )}
                          </div>
                          {!isLocked && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDraggingIndex(null);
                                  setModalOperation(step.operation || '');
                                  setModalDuration(step.durationMinutes || 10);
                                  setModalSetupMin(step.setupMin || 0);
                                  setModalRunMin(step.runMin || 10);
                                  setModalWorkers(step.noOfWorkers || 1);
                                  setModalQCRequired(step.qcRequired || false);
                                  setModalInstructions(step.instructions || '');
                                  setModalAttachments(step.attachments || []);
                                  setSelectedWorkstation(step.workCenter || null);
                                  setModalConfig({
                                    isOpen: true,
                                    x: stepX,
                                    y: stepY,
                                    stepIndex: idx
                                  });
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--accent)',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeRoutingStep(idx);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--error)',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Node content (Read Only view) */}
                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          <div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>
                              Operation
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {step.operation || '(Unspecified)'}
                            </span>
                          </div>
 
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginTop: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.45rem' }}>
                            <div>
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>
                                Station
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                                {step.workCenter}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>
                                Run Min
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                                {step.runMin || step.durationMinutes || 0}m
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TREE */}
          {activeTab === 'tree' && (
            <div>
              <h3 style={sectionHeaderStyle}>Multi-Level Structure</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Explore the nested product build hierarchy recursively.
              </p>

              {!formData.productId ? (
                <div style={{ padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', textAlign: 'center', fontSize: '0.85rem' }}>
                  Please select a <strong>Parent Item</strong> in the <strong>Mandatory</strong> tab to load the structure.
                </div>
              ) : treeLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <Play size={16} className="animate-spin" /> Resolving BOM nodes recursively...
                </div>
              ) : treeData ? (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <GitFork size={18} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Structure Rollup: {treeData.code}</span>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Item Code</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Description / Item Name</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '140px', whiteSpace: 'nowrap' }}>Component Type</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '100px', whiteSpace: 'nowrap' }}>UOM</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right', width: '120px', whiteSpace: 'nowrap' }}>Quantity</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right', width: '120px', whiteSpace: 'nowrap' }}>Scrap %</th>
                        </tr>
                      </thead>
                      <tbody>
                        <TreeRow node={treeData} />
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#b91c1c', textAlign: 'center', fontSize: '0.85rem' }}>
                  Could not resolve build tree. Ensure you have saved this BOM and activated an active BOM version for any Semi-FGs used.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RESOURCES */}
          {activeTab === 'resources' && (
            <div>
              <h3 style={sectionHeaderStyle}>Product Documents</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Upload manuals, quality procedures, images, 3D models or CAD files (.pdf, .dwg, .dxf, .step, .png, .jpg) related to this BOM.
              </p>

              {!id ? (
                <div style={{ padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', textAlign: 'center', fontSize: '0.85rem' }}>
                  Please <strong>Save</strong> this BOM once before uploading resource attachments.
                </div>
              ) : (
                <BOMResourceManager bomId={id} isLocked={isLocked} routingSteps={formData.routingSteps} />
              )}
            </div>
          )}
        </div>
      </div>
      {/* Workstation Selection Popup Modal */}
      {modalConfig.isOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999999
        }} onClick={() => setModalConfig({ isOpen: false, x: 0, y: 0 })}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
              width: '480px',
              maxHeight: '90vh',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Operation
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setModalConfig({ isOpen: false, x: 0, y: 0 })}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#334155';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                &times;
              </button>
            </div>

            {/* Content Body: Left Column (Inputs) & Right Column (Workstations list) */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              overflow: 'hidden'
            }}>
              {/* Left Column: Form Inputs (Fixed Width, Scrollable) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                padding: '1.25rem',
                backgroundColor: '#ffffff',
                flex: 1,
                boxSizing: 'border-box',
                overflowY: 'auto'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Operation Name
                  </span>
                  <input
                    type="text"
                    value={modalOperation}
                    onChange={(e) => setModalOperation(e.target.value)}
                    placeholder="e.g. Solder joints"
                    style={{ ...inputStyle, padding: '0.45rem 0.65rem', height: '36px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Run Min
                  </span>
                  <input
                    type="number"
                    value={modalRunMin}
                    onChange={(e) => setModalRunMin(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="10"
                    style={{ ...inputStyle, padding: '0.45rem 0.65rem', height: '36px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="qcRequiredCheckbox"
                    checked={modalQCRequired}
                    onChange={(e) => setModalQCRequired(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                  />
                  <label htmlFor="qcRequiredCheckbox" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                    Quality Control (QC) Required
                  </label>
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Operation Instructions
                  </span>
                  <textarea
                    value={modalInstructions}
                    onChange={(e) => setModalInstructions(e.target.value)}
                    placeholder="e.g. Apply solder flux before heating"
                    style={{ ...inputStyle, padding: '0.45rem 0.65rem', minHeight: '60px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Save Footer */}
            <div style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: '#ffffff',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => setModalConfig({ isOpen: false, x: 0, y: 0, stepIndex: null })}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!modalOperation || !modalOperation.trim()) {
                    showToast('Please enter an operation name first', 'error');
                    return;
                  }
                  if (!selectedWorkstation) {
                    showToast('Please select a workstation first', 'error');
                    return;
                  }
                  if (workstationTaken(selectedWorkstation, modalConfig.stepIndex)) {
                    showToast('This workstation is already in the process flow', 'error');
                    return;
                  }
                  const steps = [...(formDataRef.current.routingSteps || [])];
                  const computedDuration = parseFloat(modalRunMin || 0);
                  if (modalConfig.stepIndex !== null && modalConfig.stepIndex !== undefined) {
                    steps[modalConfig.stepIndex] = {
                      ...steps[modalConfig.stepIndex],
                      operation: modalOperation,
                      workCenter: selectedWorkstation,
                      setupMin: parseFloat(modalSetupMin || 0),
                      runMin: parseFloat(modalRunMin || 0),
                      noOfWorkers: parseInt(modalWorkers || 1),
                      qcRequired: modalQCRequired,
                      instructions: modalInstructions,
                      attachments: modalAttachments,
                      durationMinutes: computedDuration
                    };
                    commitRoutingSteps(steps);
                  } else {
                    const nextStepNum = steps.length + 1;
                    const newStep = {
                      stepNumber: nextStepNum,
                      sequence: nextStepNum * 10,
                      operation: modalOperation || 'Operation',
                      workCenter: selectedWorkstation,
                      setupMin: parseFloat(modalSetupMin || 0),
                      runMin: parseFloat(modalRunMin || 0),
                      noOfWorkers: parseInt(modalWorkers || 1),
                      qcRequired: modalQCRequired,
                      instructions: modalInstructions,
                      attachments: modalAttachments,
                      durationMinutes: computedDuration,
                      x: Math.max(10, modalConfig.x - 100),
                      y: 185
                    };
                    const sorted = [...steps, newStep].sort((a, b) => (a.x || 0) - (b.x || 0));
                    commitRoutingSteps(sorted.map((s, idx) => ({ ...s, stepNumber: idx + 1, sequence: (idx + 1) * 10 })));
                  }
                  setModalConfig({ isOpen: false, x: 0, y: 0, stepIndex: null });
                }}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'var(--accent)';
                }}
              >
                Save Step
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 6px rgba(124, 58, 237, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(124, 58, 237, 0);
          }
        }
        .pulse-button {
          animation: pulse 1.8s infinite;
        }
      `}</style>
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        type={confirmConfig.type}
      >
        {confirmConfig.children}
      </ConfirmModal>
    </AppLayout>
  );
}

function BOMResourceManager({ bomId, isLocked = false, routingSteps = [] }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', type: 'danger', onConfirm: null, confirmText: 'Delete' });

  const fetchResources = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/boms/${bomId}/resources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResources(res.data);
    } catch (error) {
      console.error('Fetch resources error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bomId) {
      fetchResources();
    }
  }, [bomId]);

  const handleFileUpload = async (e) => {
    if (isLocked) return;
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/boms/${bomId}/resources`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      showToast('File uploaded successfully', 'success');
      fetchResources();
    } catch (error) {
      console.error('Upload error:', error);
      showToast(error.response?.data?.error || 'Failed to upload resource', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (resourceId) => {
    if (isLocked) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Attachment',
      message: 'Are you sure you want to delete this resource file? This action is permanent and cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`/api/boms/${bomId}/resources/${resourceId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          showToast('Resource deleted successfully', 'success');
          fetchResources();
        } catch (error) {
          console.error('Delete resource error:', error);
          showToast('Failed to delete resource', 'error');
        }
      }
    });
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Upload Box Dropzone */}
      {!isLocked ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: '#fafbfc',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.55rem'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.02)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.backgroundColor = '#fafbfc';
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <div style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--accent-light)', 
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderOpen size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', display: 'block' }}>
              {uploading ? 'Uploading attachment...' : 'Click to select or upload a file'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
              Supports PDF manuals, images, STP/STEP, DWG/DXF drawings up to 50MB
            </span>
          </div>
        </div>
      ) : (
        <div 
          style={{
            border: '2px dashed #e2e8f0',
            borderRadius: '12px',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.55rem',
            cursor: 'not-allowed',
            opacity: 0.8
          }}
        >
          <div style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '50%', 
            backgroundColor: '#e2e8f0', 
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderOpen size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', display: 'block' }}>
              File uploads are locked
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
              This BOM has been confirmed. Duplicate this BOM to upload new attachments.
            </span>
          </div>
        </div>
      )}

      {/* Resource List Table */}
      <div>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem' }}>
          Uploaded Attachments ({resources.length})
        </h4>

        {loading ? (
          <div style={{ fontSize: '0.85rem', color: '#64748b', padding: '1rem 0' }}>Loading resource records...</div>
        ) : resources.length === 0 ? (
          <div style={{ padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#94a3b8', textAlign: 'center', fontSize: '0.85rem', fontStyle: 'italic', backgroundColor: '#fff' }}>
            No resources uploaded for this BOM yet.
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>File Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Process Step</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '100px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '120px', textAlign: 'right', whiteSpace: 'nowrap' }}>Size</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '150px', whiteSpace: 'nowrap' }}>Upload Date</th>
                  <th style={{ padding: '0.75rem 1rem', width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {resources.map((res) => {
                  const linkedStep = (routingSteps || []).find(step => 
                    (step.attachments || []).some(att => att.id === res.id)
                  );
                  return (
                    <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                        <a href={res.filePath} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); openProtectedUpload(res.filePath); }} style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <File size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span>{res.fileName}</span>
                        </a>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
                        {linkedStep ? (
                          <span style={{ color: '#0369a1', fontSize: '0.8rem', fontWeight: 700 }}>
                            Step {linkedStep.stepNumber || linkedStep.sequence}: {linkedStep.operation || '(Unspecified)'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569', textAlign: 'center', textTransform: 'uppercase', fontWeight: 700 }}>
                      {res.fileType}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'right' }}>
                      {formatBytes(res.fileSize)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#64748b' }}>
                      {new Date(res.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <a 
                          href={res.filePath} 
                          download 
                          title="Download"
                          onClick={(event) => { event.preventDefault(); openProtectedUpload(res.filePath, res.fileName); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#fff',
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                            e.currentTarget.style.backgroundColor = '#f5f3ff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#475569';
                            e.currentTarget.style.backgroundColor = '#fff';
                          }}
                        >
                          <Download size={15} />
                        </a>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleDelete(res.id)}
                            title="Delete"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#fee2e2';
                              e.currentTarget.style.borderColor = '#fca5a5';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = '#fef2f2';
                              e.currentTarget.style.borderColor = '#fecaca';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        type={confirmConfig.type}
        children={confirmConfig.children}
      />
    </div>
  );
}
