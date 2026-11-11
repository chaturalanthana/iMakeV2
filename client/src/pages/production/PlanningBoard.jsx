import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import { 
  Sliders, Plus, CheckCircle, Trash2, AlertCircle, X, ChevronRight, ChevronLeft, Split, Merge, Check, Table2, GanttChart, GripVertical
} from 'lucide-react';
import { recordPath } from '../../utils/recordPath';
import { useToast } from '../../context/ToastContext';
import LiveSearchDropdown from '../../components/ui/LiveSearchDropdown';
import DatePicker from '../../components/ui/DatePicker';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Section from '../../components/ui/Section';
import StatusBadge from '../../components/ui/StatusBadge';

const JOB_COLORS = [
  '#c5d4f2', '#b7e0c8', '#f3c7c7', '#f3d7ad', '#d4c6f2',
  '#b7ddd8', '#f3cbb0', '#c9d5ee', '#e4c6d4', '#cfe3b4',
  '#f0d0c2', '#c5d6e6', '#e6d4a8', '#d2c4ea', '#b9d6c8',
  '#f0c9b6', '#c8d2ee', '#e4c8c0', '#c3dfd4', '#ddd2b6'
];
const JOB_TEXT = '#3d4a5c';

const STATUS_TEXT = {
  QUEUED: { label: 'Scheduled', color: '#475569' },
  WIP: { label: 'In Progress', color: '#2563eb' },
  QC: { label: 'Inspection', color: '#b45309' },
  COMPLETED: { label: 'Completed', color: '#15803d' },
  CANCELLED: { label: 'Cancelled', color: '#b91c1c' }
};

const colorForJobs = (list) => {
  const colors = new Map();
  const used = new Set();
  [...list].sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach((job) => {
    let hash = 0;
    const text = String(job.id || '');
    for (let i = 0; i < text.length; i += 1) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
    let slot = hash % JOB_COLORS.length;
    let guard = 0;
    while (used.has(slot) && guard < JOB_COLORS.length) {
      slot = (slot + 1) % JOB_COLORS.length;
      guard += 1;
    }
    used.add(slot);
    colors.set(job.id, JOB_COLORS[slot]);
  });
  return colors;
};

const DAY_WIDTH = 36;
const PRODUCT_COL = 200;
const PLACED_ORDERS_KEY = 'imake.planning.placedWorkOrders';

const planIsOpen = (status, kind) => (
  kind === 'work-order'
    ? ['CREATED', 'DRAFT', 'RELEASED'].includes(status)
    : !['WIP', 'QC', 'COMPLETED', 'CANCELLED'].includes(status)
);

const readPlacedOrderIds = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PLACED_ORDERS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const FIELD_STYLE = {
  width: '100%', height: '42px', padding: '0 0.875rem', borderRadius: '8px',
  border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none',
  fontWeight: 500, fontSize: '0.9rem', boxSizing: 'border-box', color: '#1e293b'
};

const LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem'
};

export default function PlanningBoard() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);
  const [capacity, setCapacity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Date State for Gantt View
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed

  // Scroll Ref for Gantt
  const timelineScrollRef = useRef(null);
  const barDragRef = useRef(null);
  const suppressBarClickRef = useRef(false);
  const draggingOrderRef = useRef(null);
  const [barPreview, setBarPreview] = useState(null);
  const [dropDayIndex, setDropDayIndex] = useState(null);
  const [placedOrderIds, setPlacedOrderIds] = useState(readPlacedOrderIds);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null); // null = create
  const [viewMode, setViewMode] = useState('plan');
  const [planTool, setPlanTool] = useState(null);
  const [mergeSelection, setMergeSelection] = useState([]);
  const [splitJob, setSplitJob] = useState(null);
  const [splitForm, setSplitForm] = useState({ quantity: '', splitDate: '' });
  const [splitErrors, setSplitErrors] = useState({});
  const [form, setForm] = useState({
    productId: '', bomId: '', quantity: 1,
    startDate: '', endDate: ''
  });

  const [availableBoms, setAvailableBoms] = useState([]);

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const config = authConfig();
      const [jobsRes, productsRes, bomsRes, ordersRes] = await Promise.all([
        axios.get('/api/production-jobs', config),
        axios.get('/api/products', config),
        axios.get('/api/boms', config),
        axios.get('/api/work-orders', config)
      ]);
      setJobs(jobsRes.data);
      setWorkOrders(ordersRes.data);
      setProducts(productsRes.data.filter(p => p.bomApplicable));
      setBoms(bomsRes.data);
      axios.get('/api/work-orders/capacity', config).then((res) => setCapacity(res.data)).catch(() => setCapacity(null));
    } catch (err) {
      console.error(err);
      showToast('Failed to load production planning data', 'error');
    } finally {
      setLoading(false);
    }
  }, [authConfig, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When parent product is selected in modal form, fetch matching BOM versions
  const handleProductChange = (val) => {
    setForm(prev => ({ ...prev, productId: val, bomId: '' }));
    const filtered = boms.filter(b => b.productId === val);
    setAvailableBoms(filtered.map(b => ({ label: `${b.code} (v${b.version})`, value: b.id })));
    
    // Auto-select default BOM if exists
    const defaultBom = filtered.find(b => b.isDefault);
    if (defaultBom) {
      setForm(prev => ({ ...prev, bomId: defaultBom.id }));
    }
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setAvailableBoms([]);
    setForm({
      productId: '', bomId: '', quantity: 1,
      startDate: '', endDate: ''
    });
    setShowModal(true);
  };

  const openPlanItem = (job, e) => {
    if (e) e.stopPropagation();
    if (!planIsOpen(job?.status, job?.kind || 'job')) return;
    if (job?.kind === 'work-order') {
      navigate(recordPath('/production/work-orders', { id: job.id, orderNumber: job.jobNumber }, 'orderNumber'));
      return;
    }
    openEditModal(job, e);
  };

  const openEditModal = (job, e) => {
    if (e) e.stopPropagation();
    if (job && !planIsOpen(job.status, 'job')) return;
    setEditingJob(job);
    
    // Load available BOMs for original product
    const filtered = boms.filter(b => b.productId === job.productId);
    setAvailableBoms(filtered.map(b => ({ label: `${b.code} (v${b.version})`, value: b.id })));

    setForm({
      productId: job.productId,
      bomId: job.bomId || '',
      quantity: parseFloat(job.quantity),
      startDate: toDateValue(job.startDate),
      endDate: toDateValue(job.endDate)
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const errors = {};
    if (!form.productId) errors.productId = 'Product selection is required';
    if (!(parseFloat(form.quantity) > 0)) errors.quantity = 'Quantity must be greater than zero';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const messages = Object.values(errors);
      return showToast(messages.length === 1 ? messages[0] : 'Please fill the highlighted fields.', 'error');
    }
    setFieldErrors({});
    if (editingJob && !planIsOpen(editingJob.status, 'job')) return;

    setSaving(true);
    try {
      const config = authConfig();
      if (editingJob) {
        await axios.put(`/api/production-jobs/${editingJob.id}`, form, config);
        showToast('Job card updated successfully', 'success');
      } else {
        await axios.post('/api/production-jobs', form, config);
        showToast('Production job scheduled successfully', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFieldErrors(err.response?.data?.fields || {});
      showToast(err.response?.data?.error || 'Failed to save job card', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, jobNumber, e) => {
    if (e) e.stopPropagation();
    if (editingJob && !planIsOpen(editingJob.status, 'job')) return;
    if (!window.confirm(`Delete production job "${jobNumber}"?`)) return;
    try {
      await axios.delete(`/api/production-jobs/${id}`, authConfig());
      showToast('Production job card removed', 'success');
      setShowModal(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove job card', 'error');
    }
  };

  const openSplit = (job) => {
    if (job.status !== 'QUEUED') {
      showToast('Only scheduled jobs can be split', 'error');
      return;
    }
    if (!job.startDate || !job.endDate) {
      showToast('This job has no schedule to split', 'error');
      return;
    }
    const start = startOfDay(job.startDate);
    const end = startOfDay(job.endDate);
    if (end <= start) {
      showToast('This job is only one day', 'error');
      return;
    }
    const total = parseFloat(job.quantity);
    const half = Math.round((total / 2) * 10000) / 10000;
    const span = Math.round((end - start) / 86400000);
    const cut = addDays(start, Math.max(1, Math.floor(span / 2)));
    setSplitJob(job);
    setSplitErrors({});
    setSplitForm({
      quantity: half > 0 && half < total ? String(half) : '',
      splitDate: toDateValue(cut)
    });
  };

  const handleSplit = async () => {
    if (!splitJob) return;
    const total = parseFloat(splitJob.quantity);
    const quantity = parseFloat(splitForm.quantity);
    const start = toDateValue(splitJob.startDate);
    const end = toDateValue(splitJob.endDate);
    const errors = {};
    if (!(quantity > 0) || quantity >= total) errors.quantity = true;
    if (!splitForm.splitDate || splitForm.splitDate <= start || splitForm.splitDate > end) errors.splitDate = true;
    if (Object.keys(errors).length) {
      setSplitErrors(errors);
      showToast('Please fill the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/api/production-jobs/${splitJob.id}/split`, {
        quantity,
        splitDate: splitForm.splitDate
      }, authConfig());
      showToast('Job split', 'success');
      setSplitJob(null);
      setPlanTool(null);
      setMergeSelection([]);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to split job', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleMergeJob = (job) => {
    if (job.status !== 'QUEUED') {
      showToast('Only scheduled jobs can be merged', 'error');
      return;
    }
    setMergeSelection((prev) => {
      if (prev.includes(job.id)) return prev.filter((id) => id !== job.id);
      const selected = jobs.filter((item) => prev.includes(item.id));
      if (selected.length && selected[0].productId !== job.productId) {
        showToast('Select jobs for the same product', 'error');
        return prev;
      }
      return [...prev, job.id];
    });
  };

  const handleMerge = async () => {
    if (mergeSelection.length < 2) {
      showToast('Select at least two jobs for the same product', 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/production-jobs/merge', { jobIds: mergeSelection }, authConfig());
      showToast('Jobs merged', 'success');
      setMergeSelection([]);
      setPlanTool(null);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to merge jobs', 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePlanTool = (tool, event) => {
    event?.currentTarget?.blur();
    if (planTool === tool) {
      setPlanTool(null);
      setMergeSelection([]);
      setSplitJob(null);
      return;
    }
    setPlanTool(tool);
    setMergeSelection([]);
    setSplitJob(null);
    setSplitErrors({});
  };

  const toDateValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const addDays = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  };

  const shiftBarDates = (drag, delta) => {
    const today = startOfDay(new Date());
    const floor = startOfDay(drag.start) < today ? startOfDay(drag.start) : today;
    let start = new Date(drag.start);
    let end = new Date(drag.end);
    if (drag.mode === 'move') {
      start = addDays(drag.start, delta);
      end = addDays(drag.end, delta);
      if (startOfDay(start) < floor) {
        const fix = Math.round((floor - startOfDay(start)) / 86400000);
        start = addDays(start, fix);
        end = addDays(end, fix);
      }
    } else if (drag.mode === 'start') {
      start = addDays(drag.start, delta);
      if (startOfDay(start) < floor) start = new Date(floor);
      if (start > end) start = new Date(end);
    } else {
      end = addDays(drag.end, delta);
      if (startOfDay(end) < today) end = new Date(today);
      if (end < start) end = new Date(start);
    }
    return { start, end };
  };

  const beginBarDrag = (event, job, mode) => {
    if (planTool) return;
    if (!planIsOpen(job.status, job.kind || 'job')) return;
    event.preventDefault();
    event.stopPropagation();
    barDragRef.current = {
      id: job.id,
      kind: job.kind || 'job',
      mode,
      originX: event.clientX,
      start: new Date(job.startDate),
      end: new Date(job.endDate)
    };
    setBarPreview({ id: job.id, startDate: job.startDate, endDate: job.endDate });
  };

  useEffect(() => {
    const move = (event) => {
      const drag = barDragRef.current;
      if (!drag) return;
      const delta = Math.round((event.clientX - drag.originX) / DAY_WIDTH);
      if (delta !== 0) suppressBarClickRef.current = true;
      const { start, end } = shiftBarDates(drag, delta);
      drag.nextStart = start;
      drag.nextEnd = end;
      setBarPreview({ id: drag.id, startDate: start.toISOString(), endDate: end.toISOString() });
    };
    const up = async () => {
      const drag = barDragRef.current;
      if (!drag) return;
      barDragRef.current = null;
      if (!drag.nextStart || (drag.nextStart.getTime() === drag.start.getTime() && drag.nextEnd.getTime() === drag.end.getTime())) {
        setBarPreview(null);
        return;
      }
      try {
        const dates = {
          startDate: drag.nextStart.toISOString(),
          endDate: drag.nextEnd.toISOString()
        };
        if (drag.kind === 'work-order') {
          await axios.put(`/api/work-orders/${drag.id}`, dates, authConfig());
          rememberPlacedOrder(drag.id);
          setWorkOrders((prev) => prev.map((order) => (
            order.id === drag.id ? { ...order, ...dates } : order
          )));
        } else {
          await axios.put(`/api/production-jobs/${drag.id}`, dates, authConfig());
          setJobs((prev) => prev.map((job) => (
            job.id === drag.id ? { ...job, ...dates } : job
          )));
        }
        setBarPreview(null);
      } catch (err) {
        setBarPreview(null);
        showToast(err.response?.data?.error || 'Failed to update schedule', 'error');
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [authConfig, showToast]);

  // Month Shifters
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Multi-Month Day Generator (Prev, Current, Next Month)
  const generateGanttTimeline = (year, month) => {
    const list = [];
    
    // 1. Previous Month
    const prevDate = new Date(year, month - 1, 1);
    const pY = prevDate.getFullYear();
    const pM = prevDate.getMonth();
    const pDays = new Date(pY, pM + 1, 0).getDate();
    for (let d = 1; d <= pDays; d++) {
      list.push({ date: new Date(pY, pM, d), monthKey: `${pY}-${pM}` });
    }

    // 2. Current Month
    const cDays = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= cDays; d++) {
      list.push({ date: new Date(year, month, d), monthKey: `${year}-${month}` });
    }

    // 3. Next Month
    const nextDate = new Date(year, month + 1, 1);
    const nY = nextDate.getFullYear();
    const nM = nextDate.getMonth();
    const nDays = new Date(nY, nM + 1, 0).getDate();
    for (let d = 1; d <= nDays; d++) {
      list.push({ date: new Date(nY, nM, d), monthKey: `${nY}-${nM}` });
    }

    return {
      list,
      prevCount: pDays,
      currentCount: cDays,
      nextCount: nDays,
      prevName: prevDate.toLocaleString('default', { month: 'long' }),
      currentName: new Date(year, month, 1).toLocaleString('default', { month: 'long' }),
      nextName: nextDate.toLocaleString('default', { month: 'long' }),
      prevYear: pY,
      nextYear: nY
    };
  };

  const ganttData = generateGanttTimeline(currentYear, currentMonth);
  const timelineDays = ganttData.list;
  const timelineStart = timelineDays[0].date;
  const timelineEnd = new Date(timelineDays[timelineDays.length - 1].date.getTime());
  timelineEnd.setHours(23, 59, 59, 999);

  // Filter jobs for Gantt timeline
  const scheduledGanttJobs = jobs.filter(job => {
    if (!job.startDate || !job.endDate) return false;
    const jobStart = new Date(job.startDate);
    const jobEnd = new Date(job.endDate);
    return jobStart <= timelineEnd && jobEnd >= timelineStart;
  });

  const unscheduledGanttJobs = jobs.filter(job => !job.startDate || !job.endDate);

  const spanDays = (order) => {
    if (order.startDate && order.endDate) {
      const days = Math.round((startOfDay(order.endDate) - startOfDay(order.startDate)) / 86400000) + 1;
      if (days > 0) return days;
    }
    return Math.max(1, Number(order.plannedDays) || 1);
  };

  const scheduledWorkOrders = workOrders.filter((order) => {
    if (!order.startDate || !order.endDate || order.status === 'CANCELLED' || order.legacyJobId) return false;
    const orderStart = new Date(order.startDate);
    const orderEnd = new Date(order.endDate);
    return orderStart <= timelineEnd && orderEnd >= timelineStart;
  }).map((order) => ({
    id: order.id,
    kind: 'work-order',
    jobNumber: order.orderNumber,
    product: order.product,
    productId: order.productId,
    bomId: order.bomId,
    quantity: order.quantity,
    startDate: order.startDate,
    endDate: order.endDate,
    status: order.status,
    priority: order.priority,
    plannedDays: order.plannedDays
  }));

  const rememberPlacedOrder = (orderId) => {
    setPlacedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev;
      const next = [...prev, orderId];
      localStorage.setItem(PLACED_ORDERS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const forgetPlacedOrder = (orderId) => {
    setPlacedOrderIds((prev) => {
      const next = prev.filter((id) => id !== orderId);
      localStorage.setItem(PLACED_ORDERS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const unschedulePlanItem = async (item) => {
    if (!planIsOpen(item.status, item.kind)) return;
    const keptDays = spanDays(item);
    try {
      if (item.kind === 'work-order') {
        await axios.put(`/api/work-orders/${item.id}`, { startDate: null, endDate: null }, authConfig());
        forgetPlacedOrder(item.id);
        setWorkOrders((prev) => prev.map((order) => (
          order.id === item.id ? { ...order, startDate: null, endDate: null, plannedDays: order.plannedDays || keptDays } : order
        )));
        return;
      }
      await axios.put(`/api/production-jobs/${item.id}`, { startDate: null, endDate: null }, authConfig());
      setJobs((prev) => prev.map((job) => (
        job.id === item.id ? { ...job, startDate: null, endDate: null, plannedDays: keptDays } : job
      )));
      setWorkOrders((prev) => prev.map((order) => (
        order.legacyJobId === item.id ? { ...order, startDate: null, endDate: null } : order
      )));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove the order from the plan', 'error');
    }
  };

  const unplannedWorkOrders = workOrders.filter((order) => (
    ['CREATED', 'DRAFT', 'RELEASED'].includes(order.status)
    && !order.legacyJobId
    && (!order.startDate || !order.endDate)
  ));

  const pendingJobs = jobs.filter((job) => (
    (!job.startDate || !job.endDate) && planIsOpen(job.status, 'job')
  ));

  const pendingItems = [
    ...unplannedWorkOrders.map((order) => ({
      id: order.id,
      kind: 'work-order',
      number: order.orderNumber,
      name: order.product?.name || '',
      status: order.status,
      startDate: order.startDate,
      endDate: order.endDate,
      plannedDays: order.plannedDays,
      quantity: order.quantity
    })),
    ...pendingJobs.map((job) => ({
      id: job.id,
      kind: 'job',
      number: job.jobNumber,
      name: job.product?.name || '',
      status: job.status,
      startDate: job.startDate,
      endDate: job.endDate,
      plannedDays: job.plannedDays,
      quantity: job.quantity
    }))
  ];

  const boardItems = [
    ...scheduledGanttJobs.map((job) => ({ ...job, kind: 'job' })),
    ...scheduledWorkOrders
  ];
  const jobColors = colorForJobs([...jobs, ...workOrders]);

  const planRows = (() => {
    const groups = [];
    const indexByProduct = new Map();
    boardItems.forEach((job) => {
      const productId = job.productId || job.id;
      if (!indexByProduct.has(productId)) {
        indexByProduct.set(productId, groups.length);
        groups.push([]);
      }
      groups[indexByProduct.get(productId)].push(job);
    });

    const rows = [];
    groups.forEach((productJobs) => {
      const sorted = [...productJobs].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      const lanes = [];
      sorted.forEach((job) => {
        const preview = barPreview?.id === job.id ? barPreview : null;
        const start = startOfDay(preview?.startDate || job.startDate);
        const end = startOfDay(preview?.endDate || job.endDate);
        const lane = lanes.find((existing) => existing.every((other) => start > other.end || end < other.start));
        if (lane) lane.push({ job, start, end });
        else lanes.push([{ job, start, end }]);
      });
      lanes.forEach((lane) => rows.push(lane));
    });
    return rows;
  })();

  const dayIndexFromClientX = (clientX) => {
    const scroller = timelineScrollRef.current;
    if (!scroller) return -1;
    const rect = scroller.getBoundingClientRect();
    return Math.floor((clientX - rect.left + scroller.scrollLeft - PRODUCT_COL) / DAY_WIDTH);
  };

  const placeDroppedItem = async (item, dayIndex) => {
    setDropDayIndex(null);
    draggingOrderRef.current = null;
    if (!item || dayIndex < 0 || dayIndex >= timelineDays.length) return;
    if (!planIsOpen(item.status, item.kind)) return;
    const today = startOfDay(new Date());
    let start = startOfDay(timelineDays[dayIndex].date);
    if (start < today) start = today;
    const end = startOfDay(addDays(start, spanDays(item) - 1));
    const dates = { startDate: start.toISOString(), endDate: end.toISOString() };
    try {
      if (item.kind === 'job') {
        await axios.put(`/api/production-jobs/${item.id}`, dates, authConfig());
        setJobs((prev) => prev.map((job) => (job.id === item.id ? { ...job, ...dates } : job)));
        return;
      }
      await axios.put(`/api/work-orders/${item.id}`, dates, authConfig());
      rememberPlacedOrder(item.id);
      setWorkOrders((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...dates } : row)));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to plan the order', 'error');
    }
  };

  const onTimelineDragOver = (event) => {
    if (!draggingOrderRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const index = dayIndexFromClientX(event.clientX);
    const next = index >= 0 && index < timelineDays.length ? index : null;
    setDropDayIndex((prev) => (prev === next ? prev : next));
  };

  const onTimelineDrop = (event) => {
    if (!draggingOrderRef.current) return;
    event.preventDefault();
    const item = draggingOrderRef.current;
    placeDroppedItem(item, dayIndexFromClientX(event.clientX));
  };

  const todayIndex = timelineDays.findIndex((day) => startOfDay(day.date).getTime() === startOfDay(new Date()).getTime());
  const previewIndex = dropDayIndex === null ? null : (todayIndex >= 0 && dropDayIndex < todayIndex ? todayIndex : dropDayIndex);
  const previewSpan = draggingOrderRef.current ? spanDays(draggingOrderRef.current) : 1;
  const inDropRange = (index) => previewIndex !== null && index >= previewIndex && index < previewIndex + previewSpan;

  const timelineScrollKey = useRef(null);
  const snapPlanToTodayRef = useRef(true);
  // Open the timeline with today as the first visible day, including each return from the table.
  useLayoutEffect(() => {
    if (viewMode !== 'plan') {
      snapPlanToTodayRef.current = true;
      return;
    }
    const scroller = timelineScrollRef.current;
    if (!scroller) return;
    const today = new Date();
    const key = `${currentYear}-${currentMonth}`;
    const todayIndex = timelineDays.findIndex((d) => d.date.toDateString() === today.toDateString());
    if (snapPlanToTodayRef.current) {
      if (todayIndex < 0) {
        if (currentMonth !== today.getMonth() || currentYear !== today.getFullYear()) {
          setCurrentMonth(today.getMonth());
          setCurrentYear(today.getFullYear());
        }
        return;
      }
      scroller.scrollLeft = todayIndex * DAY_WIDTH;
      timelineScrollKey.current = key;
      snapPlanToTodayRef.current = false;
      return;
    }
    if (timelineScrollKey.current === key) return;
    timelineScrollKey.current = key;
    const monthStart = timelineDays.findIndex((d) => d.date.getDate() === 1 && d.date.getMonth() === currentMonth && d.date.getFullYear() === currentYear);
    scroller.scrollLeft = Math.max(0, monthStart) * DAY_WIDTH;
  }, [viewMode, currentMonth, currentYear, timelineDays]);

  const selectedMergeJobs = mergeSelection
    .map((id) => jobs.find((job) => job.id === id))
    .filter(Boolean);
  const mergeProductId = selectedMergeJobs[0]?.productId;
  const tableJobs = jobs.map((job) => ({
    ...job,
    productLabel: job.product ? `${job.product.code} - ${job.product.name}` : '',
    qtyLabel: `${parseFloat(job.quantity)} ${job.product?.stockUom?.name || job.product?.uom?.name || ''}`.trim(),
    bomLabel: job.bom ? `${job.bom.code} (v${job.bom.version})` : '',
    startLabel: job.startDate ? new Date(job.startDate).toLocaleDateString() : '',
    endLabel: job.endDate ? new Date(job.endDate).toLocaleDateString() : ''
  }));
  const tableColumns = [
    { header: 'Job', accessor: 'jobNumber' },
    { header: 'Product', accessor: 'productLabel' },
    { header: 'Quantity', accessor: 'qtyLabel' },
    { header: 'BOM', accessor: 'bomLabel' },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const status = STATUS_TEXT[row.status] || { label: row.status, color: '#475569' };
        return <span style={{ fontWeight: 700, color: status.color }}>{status.label}</span>;
      }
    },
    { header: 'Start', accessor: 'startLabel' },
    { header: 'End', accessor: 'endLabel' }
  ];

  return (
    <AppLayout title="Production Planning" icon={Sliders}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
          {viewMode === 'plan' && (<>
          <button
            onClick={(event) => togglePlanTool('split', event)}
            title="Split"
            style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', cursor: 'pointer',
              border: planTool === 'split' ? '1px solid var(--accent)' : '1px solid #e2e8f0',
              background: planTool === 'split' ? 'var(--accent)' : '#fff',
              color: planTool === 'split' ? '#fff' : '#475569'
            }}
          >
            <Split size={16} />
          </button>
          <button
            onClick={(event) => togglePlanTool('merge', event)}
            title="Merge"
            style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', cursor: 'pointer',
              border: planTool === 'merge' ? '1px solid var(--accent)' : '1px solid #e2e8f0',
              background: planTool === 'merge' ? 'var(--accent)' : '#fff',
              color: planTool === 'merge' ? '#fff' : '#475569'
            }}
          >
            <Merge size={16} />
          </button>
          {planTool === 'merge' && (
            <>
              {selectedMergeJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => toggleMergeJob(job)}
                  title="Remove"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 8px',
                    borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 700, color: '#1e293b'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: jobColors.get(job.id), flexShrink: 0 }} />
                  {job.jobNumber}
                  <X size={12} color="#94a3b8" />
                </button>
              ))}
              <button
                onClick={handleMerge}
                disabled={selectedMergeJobs.length < 2 || saving}
                style={{
                  height: '34px', padding: '0 0.9rem', borderRadius: '8px', border: 'none',
                  background: selectedMergeJobs.length >= 2 ? 'var(--accent)' : '#e2e8f0',
                  color: selectedMergeJobs.length >= 2 ? '#fff' : '#94a3b8',
                  cursor: selectedMergeJobs.length >= 2 ? 'pointer' : 'default',
                  fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Merge size={14} /> Merge
              </button>
            </>
          )}
          </>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
            <button
              onClick={() => setViewMode('table')}
              title="Table"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 0.75rem', border: 'none', cursor: 'pointer',
                background: viewMode === 'table' ? 'var(--accent)' : '#fff',
                color: viewMode === 'table' ? '#fff' : '#475569',
                fontWeight: 700, fontSize: '0.78rem'
              }}
            >
              <Table2 size={15} /> Table
            </button>
            <button
              onClick={() => setViewMode('plan')}
              title="Plan"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 0.75rem', border: 'none', borderLeft: '1px solid #e2e8f0', cursor: 'pointer',
                background: viewMode === 'plan' ? 'var(--accent)' : '#fff',
                color: viewMode === 'plan' ? '#fff' : '#475569',
                fontWeight: 700, fontSize: '0.78rem'
              }}
            >
              <GanttChart size={15} /> Plan
            </button>
          </div>
          {viewMode === 'plan' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f1f5f9', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', color: '#475569' }} title="Previous Month">
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b', minWidth: '125px', textAlign: 'center' }}>
            {ganttData.currentName} {currentYear}
          </span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px', color: '#475569' }} title="Next Month">
            <ChevronRight size={18} />
          </button>
        </div>
          )}
        </div>
      </div>
      {viewMode === 'plan' && pendingItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Pending ({pendingItems.length})
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', minWidth: 0, flex: 1, paddingBottom: '2px' }}>
            {pendingItems.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                draggable
                onDragStart={(event) => {
                  draggingOrderRef.current = item;
                  event.dataTransfer.setData('text/plain', item.id);
                  event.dataTransfer.setData('application/x-work-order', item.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  draggingOrderRef.current = null;
                  setDropDayIndex(null);
                }}
                title={`${item.number} · ${item.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'grab',
                  flex: '0 0 auto',
                  maxWidth: '280px',
                  userSelect: 'none'
                }}
              >
                <GripVertical size={14} color="#94a3b8" />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>{item.number}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {capacity && (capacity.workstations || []).length > 0 && (
        <Section title="Workstation load">
          <div style={{ padding: '0.75rem 1rem 0', fontSize: '0.75rem', fontWeight: 700, color: capacity.overloads?.length ? '#dc2626' : '#059669' }}>
            {capacity.overloads?.length > 0
              ? `Overload on ${capacity.overloads.length} ${capacity.overloads.length === 1 ? 'day' : 'days'}`
              : 'Within available hours'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th style={{ textAlign: 'right' }}>Load</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {capacity.workstations.filter((row) => row.loadHours > 0 || row.overload).length === 0 ? (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No workstation load in this horizon.</td></tr>
                ) : capacity.workstations.filter((row) => row.loadHours > 0 || row.overload).map((row) => (
                  <tr key={row.id || row.code}>
                    <td style={{ fontWeight: 600 }}>{row.code} · {row.name}</td>
                    <td style={{ textAlign: 'right' }}>{row.loadHours}h</td>
                    <td style={{ textAlign: 'right' }}>{row.availableHours}h</td>
                    <td><StatusBadge status={row.overload ? 'OVERLOAD' : 'WITHIN'} label={row.overload ? 'Overload' : 'Within hours'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        </Section>
      )}
      </div>

      {viewMode === 'table' ? (
        <DataTable
          columns={tableColumns}
          data={tableJobs}
          loading={loading}
          searchPlaceholder="Search jobs or products..."
          searchKeys={['jobNumber', 'productLabel', 'bomLabel', 'qtyLabel']}
          onRowClick={(row) => openEditModal(row)}
          extraActions={
            <button
              onClick={openCreateModal}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 1.1rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Add Job
            </button>
          }
        />
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: `calc(100vh - ${pendingItems.length ? 268 : 210}px)`, minHeight: '500px' }}>
          
          {/* Main Gantt Grid Wrapper */}
          <div 
            ref={timelineScrollRef}
            onDragOver={onTimelineDragOver}
            onDrop={onTimelineDrop}
            style={{ 
              flexGrow: 1, 
              overflowX: 'auto', 
              overflowY: 'auto', 
              backgroundColor: '#ffffff',
              containerType: 'inline-size'
            }}
          >
            <div style={{ minWidth: `${PRODUCT_COL + timelineDays.length * DAY_WIDTH}px` }}>
              
              {/* Header: Months Banner Row */}
              <div style={{ 
                display: 'flex', 
                height: '24px',
                boxSizing: 'border-box',
                borderBottom: '1px solid #e2e8f0', 
                backgroundColor: '#f1f5f9', 
                position: 'sticky', 
                top: 0, 
                zIndex: 4 
              }}>
                <div style={{ 
                  width: `${PRODUCT_COL}px`, 
                  minWidth: `${PRODUCT_COL}px`, 
                  borderRight: '1px solid var(--border-color)', 
                  position: 'sticky', 
                  left: 0, 
                  backgroundColor: '#f1f5f9', 
                  zIndex: 5 
                }} />
                
                <div style={{ display: 'flex', flexGrow: 1 }}>
                  {/* Prev Month banner */}
                  <div style={{ 
                    width: `${ganttData.prevCount * DAY_WIDTH}px`, 
                    textAlign: 'center', 
                    fontWeight: 800, 
                    fontSize: '0.65rem', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center', 
                    borderRight: '2px solid #cbd5e1', 
                    color: '#64748b', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    {ganttData.prevName} {ganttData.prevYear}
                  </div>
                  {/* Current Month banner */}
                  <div style={{ 
                    width: `${ganttData.currentCount * DAY_WIDTH}px`, 
                    textAlign: 'center', 
                    fontWeight: 800, 
                    fontSize: '0.65rem', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center', 
                    borderRight: '2px solid #cbd5e1', 
                    color: 'var(--accent)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    backgroundColor: 'rgba(124, 58, 237, 0.05)'
                  }}>
                    {ganttData.currentName} {currentYear}
                  </div>
                  {/* Next Month banner */}
                  <div style={{ 
                    width: `${ganttData.nextCount * DAY_WIDTH}px`, 
                    textAlign: 'center', 
                    fontWeight: 800, 
                    fontSize: '0.65rem', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center', 
                    borderRight: '1px solid #cbd5e1', 
                    color: '#64748b', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    {ganttData.nextName} {ganttData.nextYear}
                  </div>
                </div>
              </div>

              {/* Header: Days Header Row */}
              <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid var(--border-color)', 
                backgroundColor: '#f8fafc', 
                position: 'sticky', 
                top: '24px', 
                zIndex: 3 
              }}>
                {/* Left Sticky Header */}
                <div style={{ 
                  width: `${PRODUCT_COL}px`, 
                  minWidth: `${PRODUCT_COL}px`, 
                  padding: '0 0.75rem',
                  display: 'flex',
                  alignItems: 'center', 
                  borderRight: '1px solid var(--border-color)', 
                  position: 'sticky', 
                  left: 0, 
                  backgroundColor: '#f8fafc', 
                  zIndex: 5, 
                  fontWeight: 800, 
                  textTransform: 'uppercase', 
                  fontSize: '0.7rem', 
                  letterSpacing: '0.05em',
                  color: '#64748b'
                }}>
                  Product
                </div>
                
                {/* Right Timeline Days */}
                <div style={{ display: 'flex', flexGrow: 1 }}>
                  {timelineDays.map((d, index) => {
                    const day = d.date.getDate();
                    const dayOfWeek = d.date.getDay();
                    const isWeekend = [0, 6].includes(dayOfWeek);
                    const isToday = new Date().toDateString() === d.date.toDateString();
                    const isWeekStart = dayOfWeek === 1;
                    const marked = inDropRange(index);

                    return (
                      <div 
                        key={index} 
                        style={{ 
                          width: `${DAY_WIDTH}px`, 
                          minWidth: `${DAY_WIDTH}px`, 
                          textAlign: 'center', 
                          padding: '2px 0', 
                          borderRight: '1px solid #e2e8f0', 
                          borderLeft: isWeekStart ? '2px solid #94a3b8' : 'none',
                          flexShrink: 0,
                          backgroundColor: marked ? '#dbeafe' : isToday ? '#fee2e2' : isWeekend ? '#f1f5f9' : 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: isToday ? '#ef4444' : '#64748b' }}>
                          {d.date.toLocaleString('default', { weekday: 'short' }).substring(0, 1)}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isToday ? '#ef4444' : '#1e293b', lineHeight: 1.1 }}>
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Rows */}
              {boardItems.length === 0 ? (
                <div style={{
                  position: 'sticky',
                  left: 0,
                  width: '100cqi',
                  boxSizing: 'border-box',
                  padding: '4rem 1.5rem',
                  color: '#94a3b8',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  zIndex: 2
                }}>
                  No active jobs scheduled in this timeline range. Click the floating "+" to schedule a job.
                </div>
              ) : (
                planRows.map((lane) => {
                  const dayIndex = (dateStr) => Math.round((startOfDay(dateStr) - timelineStart) / 86400000);
                  const lead = lane.length === 1 ? lane[0].job : null;

                  return (
                    <div 
                      key={lane.map((item) => item.job.id).join('-')} 
                      style={{ 
                        display: 'flex', 
                        borderBottom: '1px solid #f1f5f9', 
                        backgroundColor: '#ffffff',
                        alignItems: 'stretch'
                      }}
                    >
                      <div 
                        onClick={lead && planIsOpen(lead.status, lead.kind || 'job') ? (e) => openPlanItem(lead, e) : undefined}
                        style={{ 
                          width: `${PRODUCT_COL}px`, 
                          minWidth: `${PRODUCT_COL}px`, 
                          padding: '0 0.75rem', 
                          borderRight: '1px solid var(--border-color)', 
                          position: 'sticky', 
                          left: 0, 
                          backgroundColor: '#ffffff', 
                          zIndex: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '2px',
                          cursor: lead && planIsOpen(lead.status, lead.kind || 'job') ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lane[0].job.product?.name}
                          </span>
                          {lead && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>
                              {parseFloat(lead.quantity)} {lead.product?.stockUom?.name || lead.product?.uom?.name || ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexGrow: 1, position: 'relative', height: '34px', flexShrink: 0 }}>
                        {timelineDays.map((d, index) => {
                          const dayOfWeek = d.date.getDay();
                          const isWeekend = [0, 6].includes(dayOfWeek);
                          const isWeekStart = dayOfWeek === 1;
                          const marked = inDropRange(index);

                          return (
                            <div 
                              key={index} 
                              style={{ 
                                width: `${DAY_WIDTH}px`, 
                                minWidth: `${DAY_WIDTH}px`, 
                                height: '100%', 
                                borderRight: '1px solid #f1f5f9', 
                                borderLeft: isWeekStart ? '2px solid #cbd5e1' : 'none',
                                backgroundColor: marked ? '#dbeafe' : isWeekend ? 'rgba(241, 245, 249, 0.4)' : 'transparent',
                                flexShrink: 0 
                              }} 
                            />
                          );
                        })}

                        {lane.map(({ job }) => {
                          const preview = barPreview?.id === job.id ? barPreview : null;
                          const barStart = preview?.startDate || job.startDate;
                          const barEnd = preview?.endDate || job.endDate;
                          const startIndex = dayIndex(barStart);
                          const endIndex = dayIndex(barEnd);
                          const leftOffset = Math.min(timelineDays.length, Math.max(0, startIndex)) * DAY_WIDTH;
                          const rightOffset = Math.min(timelineDays.length, Math.max(0, endIndex + 1)) * DAY_WIDTH;
                          const barWidth = Math.max(0, rightOffset - leftOffset);
                          const selectedForMerge = planTool === 'merge' && mergeSelection.includes(job.id);
                          const blockedForMerge = planTool === 'merge' && mergeProductId && job.productId !== mergeProductId;
                          const locked = !planIsOpen(job.status, job.kind || 'job');
                          const canUnschedule = !locked;
                          const meetsNext = lane.some(({ job: other }) => {
                            if (other.id === job.id) return false;
                            const otherPreview = barPreview?.id === other.id ? barPreview : null;
                            const otherStart = dayIndex(otherPreview?.startDate || other.startDate);
                            return otherStart === endIndex + 1;
                          });

                          return (
                            <div
                              key={job.id}
                              onPointerDown={(event) => beginBarDrag(event, job, 'move')}
                              onClick={(event) => {
                                if (!planIsOpen(job.status, job.kind || 'job')) {
                                  event.stopPropagation();
                                  return;
                                }
                                if (job.kind !== 'work-order' && planTool === 'split') {
                                  event.stopPropagation();
                                  openSplit(job);
                                  return;
                                }
                                if (job.kind !== 'work-order' && planTool === 'merge') {
                                  event.stopPropagation();
                                  toggleMergeJob(job);
                                  return;
                                }
                                if (suppressBarClickRef.current) {
                                  suppressBarClickRef.current = false;
                                  event.stopPropagation();
                                  return;
                                }
                                openPlanItem(job, event);
                              }}
                              title={`${job.jobNumber}: ${job.product?.name}\nStarts: ${new Date(barStart).toLocaleString()}\nEnds: ${new Date(barEnd).toLocaleString()}`}
                              style={{
                                position: 'absolute',
                                left: `${leftOffset}px`,
                                width: `${barWidth}px`,
                                top: 0,
                                bottom: 0,
                                height: '100%',
                                backgroundColor: jobColors.get(job.id),
                                borderRadius: 0,
                                cursor: locked ? 'default' : blockedForMerge ? 'not-allowed' : planTool ? 'pointer' : 'grab',
                                opacity: blockedForMerge ? 0.35 : 1,
                                boxShadow: selectedForMerge ? 'inset 0 0 0 2px #ffffff, inset 0 0 0 4px #0f172a' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                padding: canUnschedule ? '0 22px 0 8px' : '0 8px',
                                boxSizing: 'border-box',
                                zIndex: preview ? 2 : 1,
                                overflow: 'hidden',
                                touchAction: 'none',
                                userSelect: 'none'
                              }}
                            >
                              {!locked && (
                                <div
                                  onPointerDown={(event) => beginBarDrag(event, job, 'start')}
                                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize' }}
                                />
                              )}
                              {selectedForMerge && <Check size={12} color={JOB_TEXT} style={{ flexShrink: 0, marginRight: '4px' }} />}
                              <span style={{ 
                                fontSize: '0.65rem', 
                                fontWeight: 600, 
                                color: JOB_TEXT, 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                pointerEvents: 'none'
                              }}>
                                {job.jobNumber} ({parseFloat(job.quantity)} {job.product?.stockUom?.name || job.product?.uom?.name || ''})
                              </span>
                              {canUnschedule && (
                                <button
                                  type="button"
                                  title="Remove from plan"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    unschedulePlanItem(job);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: 0,
                                    bottom: 0,
                                    width: '16px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    zIndex: 3
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              )}
                              {!locked && (
                                <div
                                  onPointerDown={(event) => beginBarDrag(event, job, 'end')}
                                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize', zIndex: 2 }}
                                />
                              )}
                              {meetsNext && (
                                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '2px', backgroundColor: '#94a3b8', pointerEvents: 'none' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Unscheduled Backlog Drawer Panel at bottom */}
          {unscheduledGanttJobs.some((job) => !planIsOpen(job.status, 'job')) && (
            <div style={{ border: '1px solid #fee2e2', borderRadius: '12px', padding: '1rem', backgroundColor: '#fef2f2' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                <AlertCircle size={16} /> Unscheduled Production Jobs ({unscheduledGanttJobs.filter((job) => !planIsOpen(job.status, 'job')).length})
              </h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#7f1d1d' }}>
                These sheets have been queued but lack start or end dates. Click a sheet to assign date limits and move it onto the visual planner board timeline.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {unscheduledGanttJobs.filter((job) => !planIsOpen(job.status, 'job')).map(job => (
                  <div 
                    key={job.id}
                    onClick={(e) => openEditModal(job, e)}
                    style={{
                      flex: '0 0 200px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#dc2626' }}>{job.jobNumber}</span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '1px 4px', borderRadius: '3px' }}>{job.priority}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.product?.name}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Target Qty: <strong>{parseFloat(job.quantity)} {job.product?.stockUom?.name || job.product?.uom?.name || ''}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: JOB CARD CREATION & INSPECTION DIALOG
          ======================================================== */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingJob ? `Edit Job Card: ${editingJob.jobNumber}` : 'Schedule Production Job'}
        icon={Sliders}
        maxWidth="580px"
      >
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={LABEL_STYLE}>Output Product *</label>
            <LiveSearchDropdown
              options={products.map(p => ({ label: `${p.code} - ${p.name}`, value: p.id }))}
              value={form.productId}
              invalid={!!fieldErrors.productId}
              onChange={handleProductChange}
              placeholder="Select Finished / Semi-Finished Product..."
              style={{ input: FIELD_STYLE }}
            />
            {fieldErrors.productId && <span className="field-error-text">{fieldErrors.productId}</span>}
          </div>

          <div>
            <label style={LABEL_STYLE}>BOM Version</label>
            <LiveSearchDropdown
              options={availableBoms}
              value={form.bomId}
              onChange={val => setForm(prev => ({ ...prev, bomId: val }))}
              placeholder="Auto-resolved BOM..."
              style={{ input: FIELD_STYLE }}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Target Quantity *</label>
            <input 
              type="number" 
              value={form.quantity} 
              onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
              className={fieldErrors.quantity ? 'field-invalid' : undefined}
              style={FIELD_STYLE} 
            />
            {fieldErrors.quantity && <span className="field-error-text">{fieldErrors.quantity}</span>}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Start Date</label>
              <DatePicker
                value={form.startDate}
                onChange={(date) => setForm(prev => ({ ...prev, startDate: date }))}
                placeholder="Start Date"
                style={{ height: '42px', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>End Date</label>
              <DatePicker
                value={form.endDate}
                onChange={(date) => setForm(prev => ({ ...prev, endDate: date }))}
                placeholder="End Date"
                style={{ height: '42px', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
              />
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
          {editingJob ? (
            <button 
              onClick={(e) => handleDelete(editingJob.id, editingJob.jobNumber, e)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', padding: '0.55rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
            >
              <Trash2 size={14} /> Remove Job
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button onClick={() => setShowModal(false)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <CheckCircle size={16} /> {saving ? 'Saving...' : editingJob ? 'Save Card' : 'Add to Board'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!splitJob}
        onClose={() => setSplitJob(null)}
        title={splitJob ? `Split ${splitJob.jobNumber}` : 'Split Job'}
        icon={Split}
        maxWidth="420px"
      >
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={LABEL_STYLE}>Split Quantity *</label>
            <input
              type="number"
              value={splitForm.quantity}
              onChange={(e) => {
                setSplitForm((prev) => ({ ...prev, quantity: e.target.value }));
                setSplitErrors((prev) => ({ ...prev, quantity: false }));
              }}
              style={{ ...FIELD_STYLE, border: splitErrors.quantity ? '1px solid #ef4444' : FIELD_STYLE.border }}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Split Date *</label>
            <DatePicker
              value={splitForm.splitDate}
              onChange={(date) => {
                setSplitForm((prev) => ({ ...prev, splitDate: date }));
                setSplitErrors((prev) => ({ ...prev, splitDate: false }));
              }}
              placeholder="Split Date"
              style={{
                height: '42px',
                boxSizing: 'border-box',
                backgroundColor: '#f8fafc',
                border: splitErrors.splitDate ? '1px solid #ef4444' : '1px solid var(--border-color)'
              }}
            />
          </div>
        </div>
        <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', backgroundColor: '#f8fafc' }}>
          <button onClick={() => setSplitJob(null)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={handleSplit} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <Split size={16} /> {saving ? 'Saving...' : 'Split'}
          </button>
        </div>
      </Modal>

      {viewMode === 'plan' && (
        <button
          onClick={openCreateModal}
          style={{
            position: 'fixed', bottom: '2rem', right: '2rem',
            width: '56px', height: '56px', borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.4)', cursor: 'pointer', zIndex: 999
          }}
        >
          <Plus size={24} />
        </button>
      )}
    </AppLayout>
  );
}
