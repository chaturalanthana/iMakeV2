import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Pencil, RotateCw, Cog, Check, Copy } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

const CAD = '#8eb4e8';
const CAD_TEXT = '#3d4a5c';
const CARD_W = 176;
const DEFAULT_H = 72;
const MIN_W = 112;
const MIN_H = 56;

const sizeOf = (machine) => ({
  width: Number(machine.width) || CARD_W,
  height: Number(machine.height) || DEFAULT_H,
  rotation: Number(machine.rotation) || 0
});

const machineAabb = (machine) => {
  const { width, height, rotation } = sizeOf(machine);
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const cx = machine.posX + width / 2;
  const cy = machine.posY + height / 2;
  const aabbW = width * cos + height * sin;
  const aabbH = width * sin + height * cos;
  return {
    left: cx - aabbW / 2,
    top: cy - aabbH / 2,
    right: cx + aabbW / 2,
    bottom: cy + aabbH / 2
  };
};

const multiSelectKey = (event) => event.shiftKey || event.ctrlKey || event.metaKey;

const resizeBox = (drag, dx, dy) => {
  const rad = (drag.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localDx = dx * cos + dy * sin;
  const localDy = -dx * sin + dy * cos;
  const signX = drag.corner.includes('e') ? 1 : -1;
  const signY = drag.corner.includes('s') ? 1 : -1;
  const width = Math.max(MIN_W, Math.round(drag.width + localDx * signX));
  const height = Math.max(MIN_H, Math.round(drag.height + localDy * signY));
  const oldCx = drag.x + drag.width / 2;
  const oldCy = drag.y + drag.height / 2;
  const fixed = {
    se: [-drag.width / 2, -drag.height / 2],
    sw: [drag.width / 2, -drag.height / 2],
    ne: [-drag.width / 2, drag.height / 2],
    nw: [drag.width / 2, drag.height / 2]
  }[drag.corner];
  const nextFixed = {
    se: [-width / 2, -height / 2],
    sw: [width / 2, -height / 2],
    ne: [-width / 2, height / 2],
    nw: [width / 2, height / 2]
  }[drag.corner];
  const fx = oldCx + fixed[0] * cos - fixed[1] * sin;
  const fy = oldCy + fixed[0] * sin + fixed[1] * cos;
  const newCx = fx - nextFixed[0] * cos + nextFixed[1] * sin;
  const newCy = fy - nextFixed[0] * sin - nextFixed[1] * cos;
  return {
    posX: Math.max(8, Math.round(newCx - width / 2)),
    posY: Math.max(8, Math.round(newCy - height / 2)),
    width,
    height
  };
};

const rotationFrom = (drag, clientX, clientY) => {
  const pointerAngle = Math.atan2(clientY - drag.cy, clientX - drag.cx);
  let delta = pointerAngle - drag.lastPointerAngle;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  drag.lastPointerAngle = pointerAngle;
  drag.current += (delta * 180) / Math.PI;
  return ((drag.current % 360) + 360) % 360;
};

const CORNERS = {
  nw: { left: -6, top: -6, cursor: 'nwse-resize' },
  ne: { right: -6, top: -6, cursor: 'nesw-resize' },
  sw: { left: -6, bottom: -6, cursor: 'nesw-resize' },
  se: { right: -6, bottom: -6, cursor: 'nwse-resize' }
};

export default function MachineLayout({ workstationId }) {
  const { showToast } = useToast();
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const panDragRef = useRef(null);
  const marqueeRef = useRef(null);
  const machinesRef = useRef([]);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [hotId, setHotId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({ name: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const authConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }), []);

  const loadMachines = useCallback(async () => {
    try {
      const res = await axios.get('/api/machines', authConfig());
      setMachines(res.data.filter((machine) => machine.workstationId === workstationId));
    } catch (error) {
      showToast('Failed to load machines', 'error');
    } finally {
      setLoading(false);
    }
  }, [authConfig, showToast, workstationId]);

  useEffect(() => {
    setLoading(true);
    setMachines([]);
    setDirty(false);
    setHotId(null);
    setSelectedIds([]);
    setActiveId(null);
    setModal(null);
    loadMachines();
  }, [loadMachines]);

  viewRef.current = { zoom, panX: pan.x, panY: pan.y };
  machinesRef.current = machines;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const { zoom: currentZoom, panX, panY } = viewRef.current;
      const rect = viewport.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const next = Math.min(2.5, Math.max(0.35, currentZoom * (event.deltaY > 0 ? 0.92 : 1.08)));
      const worldX = (px - panX) / currentZoom;
      const worldY = (py - panY) / currentZoom;
      setZoom(next);
      setPan({ x: px - worldX * next, y: py - worldY * next });
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const move = (event) => {
      const marqueeDrag = marqueeRef.current;
      if (marqueeDrag && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        setMarquee({
          left: Math.min(marqueeDrag.originX, event.clientX) - rect.left,
          top: Math.min(marqueeDrag.originY, event.clientY) - rect.top,
          width: Math.abs(event.clientX - marqueeDrag.originX),
          height: Math.abs(event.clientY - marqueeDrag.originY)
        });
        return;
      }
      const panDrag = panDragRef.current;
      if (panDrag) {
        setPan({
          x: panDrag.x + event.clientX - panDrag.originX,
          y: panDrag.y + event.clientY - panDrag.originY
        });
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const screenX = event.clientX - drag.originX;
      const screenY = event.clientY - drag.originY;
      const dx = screenX / (viewRef.current.zoom || 1);
      const dy = screenY / (viewRef.current.zoom || 1);
      if (drag.mode !== 'rotate' && (Math.abs(screenX) > 3 || Math.abs(screenY) > 3)) drag.moved = true;
      if (drag.mode === 'rotate') {
        const rotation = rotationFrom(drag, event.clientX, event.clientY);
        if (Math.abs(rotation - drag.rotation) > 0.4) drag.moved = true;
        drag.nextRotation = rotation;
        if (drag.tile) drag.tile.style.transform = `rotate(${rotation}deg)`;
        return;
      }
      if (drag.mode === 'resize') {
        const next = resizeBox(drag, dx, dy);
        drag.posX = next.posX;
        drag.posY = next.posY;
        drag.widthNext = next.width;
        drag.heightNext = next.height;
        setMachines((prev) => prev.map((machine) => (
          machine.id === drag.id ? { ...machine, ...next } : machine
        )));
        return;
      }
      const dxClamped = Math.max(dx, 12 - Math.min(...drag.origins.map((origin) => origin.x)));
      const dyClamped = Math.max(dy, 12 - Math.min(...drag.origins.map((origin) => origin.y)));
      drag.origins.forEach((origin) => {
        origin.posX = origin.x + dxClamped;
        origin.posY = origin.y + dyClamped;
      });
      setMachines((prev) => prev.map((machine) => {
        const origin = drag.origins.find((item) => item.id === machine.id);
        return origin ? { ...machine, posX: origin.posX, posY: origin.posY } : machine;
      }));
    };
    const up = (event) => {
      const marqueeDrag = marqueeRef.current;
      if (marqueeDrag && viewportRef.current) {
        marqueeRef.current = null;
        const rect = viewportRef.current.getBoundingClientRect();
        const { zoom: currentZoom, panX, panY } = viewRef.current;
        const x1 = (Math.min(marqueeDrag.originX, event.clientX) - rect.left - panX) / currentZoom;
        const y1 = (Math.min(marqueeDrag.originY, event.clientY) - rect.top - panY) / currentZoom;
        const x2 = (Math.max(marqueeDrag.originX, event.clientX) - rect.left - panX) / currentZoom;
        const y2 = (Math.max(marqueeDrag.originY, event.clientY) - rect.top - panY) / currentZoom;
        const drawn = Math.abs(event.clientX - marqueeDrag.originX) > 3 || Math.abs(event.clientY - marqueeDrag.originY) > 3;
        if (drawn) {
          const hits = machinesRef.current.filter((machine) => {
            const box = machineAabb(machine);
            return box.right >= x1 && box.left <= x2 && box.bottom >= y1 && box.top <= y2;
          }).map((machine) => machine.id);
          setSelectedIds(marqueeDrag.additive ? Array.from(new Set([...marqueeDrag.base, ...hits])) : hits);
        } else if (!marqueeDrag.additive) {
          setSelectedIds([]);
        }
        setMarquee(null);
        return;
      }
      if (panDragRef.current) {
        panDragRef.current = null;
        setPanning(false);
      }
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setActiveId(null);
      if (drag.mode === 'rotate' && drag.moved) {
        const rotation = drag.nextRotation;
        setMachines((prev) => prev.map((machine) => (
          machine.id === drag.id ? { ...machine, rotation } : machine
        )));
      }
      if (!drag.moved) {
        if (drag.mode === 'move') {
          if (drag.additive) {
            setSelectedIds((prev) => (
              prev.includes(drag.id) ? prev.filter((id) => id !== drag.id) : [...prev, drag.id]
            ));
          } else {
            setSelectedIds([drag.id]);
          }
        }
        return;
      }
      if (drag.mode === 'move' && drag.additive) {
        setSelectedIds((prev) => (prev.includes(drag.id) ? prev : [...prev, drag.id]));
      }
      setDirty(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const openCreate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const count = machines.length;
    setSelectedIds([]);
    setDraft({ name: '' });
    setErrors({});
    setModal({
      mode: 'create',
      posX: 48 + (count % 5) * 196,
      posY: 72 + Math.floor(count / 5) * 120
    });
  };

  const openEdit = (event, machine) => {
    event.stopPropagation();
    setSelectedIds([machine.id]);
    setDraft({ name: machine.name });
    setErrors({});
    setModal({ mode: 'edit', id: machine.id, code: machine.code });
  };

  const closeModal = () => {
    setModal(null);
    setErrors({});
  };

  const saveLayout = async () => {
    if (!dirty || savingLayout) return;
    setSavingLayout(true);
    try {
      await Promise.all(machines.map((machine) => {
        const { width, height, rotation } = sizeOf(machine);
        return axios.put(`/api/machines/${machine.id}`, {
          posX: machine.posX,
          posY: machine.posY,
          width,
          height,
          rotation
        }, authConfig());
      }));
      setDirty(false);
      showToast('Layout saved', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save layout', 'error');
    } finally {
      setSavingLayout(false);
    }
  };

  const zoomAround = (nextZoom, originX, originY) => {
    const next = Math.min(2.5, Math.max(0.35, nextZoom));
    const worldX = (originX - pan.x) / zoom;
    const worldY = (originY - pan.y) / zoom;
    setZoom(next);
    setPan({ x: originX - worldX * next, y: originY - worldY * next });
  };

  const stepZoom = (factor) => {
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    zoomAround(zoom * factor, (rect?.width || 0) / 2, (rect?.height || 0) / 2);
  };

  const beginPan = (event) => {
    if (event.target.closest('[data-machine], button, input')) return;
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      event.preventDefault();
      panDragRef.current = {
        originX: event.clientX,
        originY: event.clientY,
        x: pan.x,
        y: pan.y
      };
      setPanning(true);
      return;
    }
    if (event.button !== 0) return;
    marqueeRef.current = {
      originX: event.clientX,
      originY: event.clientY,
      additive: multiSelectKey(event),
      base: selectedIds
    };
    const rect = viewportRef.current.getBoundingClientRect();
    setMarquee({ left: event.clientX - rect.left, top: event.clientY - rect.top, width: 0, height: 0 });
  };

  const saveMachine = async () => {
    if (!modal) return;
    const nextErrors = {};
    if (!draft.name.trim()) nextErrors.name = true;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      showToast('Please fill the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        const res = await axios.post('/api/machines', {
          name: draft.name.trim(),
          workstationId,
          posX: modal.posX,
          posY: modal.posY
        }, authConfig());
        setMachines((prev) => [...prev, res.data]);
        setDraft({ name: '' });
        setModal(null);
        showToast('Machine added', 'success');
      } else {
        const res = await axios.put(`/api/machines/${modal.id}`, {
          name: draft.name.trim()
        }, authConfig());
        setMachines((prev) => prev.map((machine) => (machine.id === res.data.id ? res.data : machine)));
        setModal(null);
        showToast('Machine saved', 'success');
      }
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save machine', 'error');
    } finally {
      setSaving(false);
    }
  };

  const duplicateMachine = async (event, machine) => {
    event.stopPropagation();
    const group = selectedIds.includes(machine.id) && selectedIds.length > 1
      ? machines.filter((item) => selectedIds.includes(item.id))
      : [machine];
    const created = [];
    try {
      for (const item of group) {
        const { width, height, rotation } = sizeOf(item);
        const res = await axios.post('/api/machines', {
          name: item.name,
          workstationId,
          posX: item.posX + 28,
          posY: item.posY + 28,
          width,
          height,
          rotation
        }, authConfig());
        created.push(res.data);
      }
      showToast(created.length > 1 ? 'Machines copied' : 'Machine copied', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to copy machine', 'error');
    }
    if (created.length) {
      setMachines((prev) => [...prev, ...created]);
      setSelectedIds(created.map((item) => item.id));
    }
  };

  const removeMachine = async (event, machine) => {
    event.stopPropagation();
    try {
      await axios.delete(`/api/machines/${machine.id}`, authConfig());
      setMachines((prev) => prev.filter((item) => item.id !== machine.id));
      if (modal?.id === machine.id) setModal(null);
      setSelectedIds((prev) => prev.filter((id) => id !== machine.id));
      showToast('Machine removed', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to remove machine', 'error');
    }
  };

  const beginDrag = (event, machine) => {
    if (event.target.closest('button, input')) return;
    event.preventDefault();
    event.stopPropagation();
    const additive = multiSelectKey(event);
    const groupIds = additive || selectedIds.includes(machine.id)
      ? Array.from(new Set([...selectedIds, machine.id]))
      : [machine.id];
    if (!additive && !selectedIds.includes(machine.id)) setSelectedIds([machine.id]);
    setActiveId(machine.id);
    const group = machines.filter((item) => groupIds.includes(item.id));
    dragRef.current = {
      mode: 'move',
      id: machine.id,
      additive,
      originX: event.clientX,
      originY: event.clientY,
      origins: group.map((item) => ({ id: item.id, x: item.posX, y: item.posY })),
      moved: false
    };
  };

  const beginResize = (event, machine, corner) => {
    event.stopPropagation();
    event.preventDefault();
    const { width, height, rotation } = sizeOf(machine);
    setSelectedIds([machine.id]);
    setActiveId(machine.id);
    dragRef.current = {
      mode: 'resize',
      corner,
      id: machine.id,
      originX: event.clientX,
      originY: event.clientY,
      x: machine.posX,
      y: machine.posY,
      width,
      height,
      rotation,
      posX: machine.posX,
      posY: machine.posY,
      widthNext: width,
      heightNext: height,
      moved: false
    };
  };

  const beginRotate = (event, machine) => {
    event.stopPropagation();
    event.preventDefault();
    const tile = event.currentTarget.closest('[data-machine]');
    const rect = tile.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rotation = sizeOf(machine).rotation;
    const pointerAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
    setSelectedIds([machine.id]);
    setActiveId(machine.id);
    dragRef.current = {
      mode: 'rotate',
      id: machine.id,
      tile,
      cx,
      cy,
      lastPointerAngle: pointerAngle,
      rotation,
      current: rotation,
      nextRotation: rotation,
      moved: false
    };
  };

  const extents = machines.map((machine) => {
    const { width, height, rotation } = sizeOf(machine);
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const cx = machine.posX + width / 2;
    const cy = machine.posY + height / 2;
    return {
      right: cx + (width * cos + height * sin) / 2,
      bottom: cy + (width * sin + height * cos) / 2
    };
  });
  const boardWidth = Math.max(1100, ...extents.map((box) => box.right + 80));
  const boardHeight = Math.max(560, ...extents.map((box) => box.bottom + 80));

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 280px)', minHeight: '520px' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 6, display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={saveLayout}
          disabled={!dirty || savingLayout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.85rem',
            borderRadius: '8px',
            border: 'none',
            background: dirty ? 'var(--accent)' : '#e2e8f0',
            color: dirty ? '#fff' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: dirty ? 'pointer' : 'default',
            fontFamily: 'inherit',
            boxShadow: dirty ? '0 4px 12px rgba(15, 23, 42, 0.12)' : 'none'
          }}
        >
          <Check size={15} /> {savingLayout ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={openCreate}
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
          <Plus size={15} /> Machine
        </button>
      </div>
      <div
        ref={viewportRef}
        onPointerDown={beginPan}
        onAuxClick={(event) => event.preventDefault()}
        style={{
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          cursor: panning ? 'grabbing' : 'crosshair',
          backgroundColor: '#fbfcfe',
          backgroundImage: 'linear-gradient(to right, rgba(148, 163, 184, 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.28) 1px, transparent 1px)',
          backgroundSize: `${48 * zoom}px ${48 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          touchAction: 'none'
        }}
      >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: boardWidth,
          height: boardHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'top left'
        }}
      >
        {!loading && machines.map((machine) => {
          const { width, height, rotation } = sizeOf(machine);
          const selected = selectedIds.includes(machine.id);
          const showHandles = selectedIds.length <= 1 && (hotId === machine.id || selected || activeId === machine.id);
          return (
            <div
              key={machine.id}
              data-machine
              onClick={(event) => event.stopPropagation()}
              onPointerEnter={() => setHotId(machine.id)}
              onPointerLeave={() => setHotId((current) => (current === machine.id ? null : current))}
              onPointerDown={(event) => beginDrag(event, machine)}
              style={{
                position: 'absolute',
                left: machine.posX,
                top: machine.posY,
                width,
                height,
                background: selected ? '#f3f7fd' : '#ffffff',
                border: selected ? `1.5px solid ${CAD}` : `1px solid ${CAD}`,
                borderRadius: 0,
                padding: '0.55rem 0.7rem',
                boxSizing: 'border-box',
                cursor: 'move',
                userSelect: 'none',
                touchAction: 'none',
                color: CAD_TEXT,
                zIndex: hotId === machine.id || activeId === machine.id ? 20 : selected ? 3 : 1,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
            >
              <span style={{ position: 'absolute', top: 8, left: 10, right: 10, fontSize: '0.78rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{machine.code}</span>
              {hotId === machine.id && (
              <div style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 30 }}>
                <button type="button" title="Copy" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => duplicateMachine(event, machine)} style={{ border: 'none', background: 'rgba(255, 255, 255, 0.96)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)', cursor: 'pointer', color: CAD_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, padding: 0 }}>
                  <Copy size={16} />
                </button>
                <button type="button" title="Edit" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => openEdit(event, machine)} style={{ border: 'none', background: 'rgba(255, 255, 255, 0.96)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)', cursor: 'pointer', color: CAD_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, padding: 0 }}>
                  <Pencil size={16} />
                </button>
                <button type="button" title="Delete" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => removeMachine(event, machine)} style={{ border: 'none', background: 'rgba(255, 255, 255, 0.96)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, padding: 0 }}>
                  <Trash2 size={16} />
                </button>
              </div>
              )}
              <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', transform: 'translateY(-50%)', textAlign: 'center', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{machine.name}</div>
              {showHandles && (
                <>
                  <button
                    type="button"
                    data-handle
                    onPointerDown={(event) => beginRotate(event, machine)}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -28,
                      transform: 'translateX(-50%)',
                      width: 24,
                      height: 24,
                      borderRadius: 0,
                      border: 'none',
                      background: 'transparent',
                      color: CAD,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      padding: 0
                    }}
                  >
                    <RotateCw size={22} />
                  </button>
                  {Object.entries(CORNERS).map(([corner, place]) => (
                    <button
                      key={corner}
                      type="button"
                      data-handle
                      onPointerDown={(event) => beginResize(event, machine, corner)}
                      style={{
                        position: 'absolute',
                        width: 8,
                        height: 8,
                        borderRadius: 0,
                        border: `1px solid ${CAD}`,
                        background: '#ffffff',
                        padding: 0,
                        ...place
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
        {marquee && (
          <div style={{
            position: 'absolute',
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
            border: `1px solid ${CAD}`,
            background: 'rgba(142, 180, 232, 0.16)',
            pointerEvents: 'none',
            zIndex: 5
          }} />
        )}
      </div>
      <div
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          border: '1px solid #e6ebf2',
          borderRadius: '2px',
          padding: '0.35rem 0.65rem',
          boxShadow: 'none'
        }}
      >
        <button type="button" onClick={() => stepZoom(1 / 1.1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 700, fontSize: '0.95rem', width: 22, height: 22, padding: 0 }}>−</button>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => stepZoom(1.1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 700, fontSize: '0.95rem', width: 22, height: 22, padding: 0 }}>+</button>
        <button
          type="button"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={{ background: 'none', border: 'none', borderLeft: '1px solid #e6ebf2', cursor: 'pointer', color: '#64748b', fontWeight: 700, fontSize: '0.72rem', padding: '0 0 0 0.45rem' }}
        >
          Reset
        </button>
      </div>
      <Modal
        isOpen={!!modal}
        onClose={closeModal}
        title={modal?.mode === 'edit' ? modal.code : 'New Machine'}
        icon={Cog}
        maxWidth="420px"
      >
        <div style={{ padding: '1.5rem' }}>
          <input
            autoFocus
            value={draft.name}
            placeholder="Machine name"
            className={errors.name ? 'field-invalid' : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveMachine();
              }
            }}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, name: event.target.value }));
              setErrors((prev) => ({ ...prev, name: false }));
            }}
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '8px',
              padding: '0 0.75rem',
              border: errors.name ? '1px solid #ef4444' : '1px solid var(--border-color)',
              background: '#f8fafc',
              outline: 'none',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
        </div>
        <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', backgroundColor: '#f8fafc' }}>
          <button type="button" onClick={closeModal} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Cancel</button>
          <button type="button" onClick={saveMachine} disabled={saving} style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
            {saving ? 'Saving...' : modal?.mode === 'edit' ? 'Save' : 'Add'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
