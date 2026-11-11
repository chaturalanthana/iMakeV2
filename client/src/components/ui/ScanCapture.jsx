import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, ScanLine } from 'lucide-react';

export async function lookupScan(code) {
  const res = await axios.get('/api/labels/resolve', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    params: { code }
  });
  return res.data;
}

export function mergeScannedProduct(items, product, quantityKey, { onlyExisting = false } = {}) {
  const existing = items.find((item) => item.productId === product.id);
  if (existing) {
    return {
      items: items.map((item) => {
        if (item.productId !== product.id) return item;
        const next = { ...item, productName: product.name };
        next[quantityKey] = (parseFloat(item[quantityKey]) || 0) + 1;
        return next;
      })
    };
  }
  if (onlyExisting) return { error: `${product.code} is not on this document.` };
  const blank = items.find((item) => !item.productId);
  const row = {
    ...(blank || { id: Date.now() + Math.random() }),
    productId: product.id,
    productName: product.name,
    [quantityKey]: 1
  };
  if (blank) return { items: items.map((item) => (item.id === blank.id ? { ...item, ...row } : item)) };
  return { items: [...items, row] };
}

export default function ScanCapture({ onScan, placeholder = 'Scan or type a code', disabled = false }) {
  const [value, setValue] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const submit = (code) => {
    const trimmed = String(code || '').trim();
    if (!trimmed || disabled) return;
    setValue('');
    onScan(trimmed);
  };

  const start = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) {
      setCameraError('This browser has no camera scanner. A wedge scanner or typed code still works.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOn(true);
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
      const loop = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          frameRef.current = requestAnimationFrame(loop);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) {
            submit(codes[0].rawValue);
            stop();
            return;
          }
        } catch (error) {
          setCameraError('The camera could not read a code.');
          stop();
          return;
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
    } catch (error) {
      setCameraError('Allow the camera, or type the code.');
    }
  };

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  return (
    <div style={{ margin: '0.75rem 0 1rem' }}>
      <form onSubmit={(event) => { event.preventDefault(); submit(value); }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 460 }}>
          <ScanLine size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={value}
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            style={{ width: '100%', height: 38, padding: '0 12px 0 34px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>
        <button type="button" disabled={disabled} onClick={cameraOn ? stop : start} style={{ height: 38, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
          <Camera size={16} /> {cameraOn ? 'Stop' : 'Camera'}
        </button>
      </form>
      {cameraError && <div style={{ color: '#b45309', fontSize: '0.8rem', marginTop: 6 }}>{cameraError}</div>}
      {cameraOn && <video ref={videoRef} muted playsInline style={{ marginTop: 8, width: 280, maxWidth: '100%', borderRadius: 8, background: '#000' }} />}
    </div>
  );
}
