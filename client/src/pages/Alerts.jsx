import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Bell } from 'lucide-react';

const LABELS = {
  MATERIAL_SHORTAGE: 'Material shortage',
  WORKSTATION_OVERLOAD: 'Overload',
  OVERDUE_PURCHASE_ORDER: 'Overdue purchase',
  OVERDUE_SALES_ORDER: 'Overdue sales',
  OVERDUE_WORK_ORDER: 'Overdue work order',
  CREDIT_LIMIT: 'Credit limit',
  PENDING_APPROVAL: 'Approval',
  LOW_STOCK: 'Low stock'
};

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/alerts', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((res) => setAlerts(res.data.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Alerts" icon={Bell}>
      {loading && <div style={{ color: '#64748b' }}>Loading alerts…</div>}
      {!loading && alerts.length === 0 && <div style={{ color: '#64748b' }}>Nothing needs attention.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {alerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            onClick={() => alert.href && navigate(alert.href)}
            style={{ textAlign: 'left', background: '#fff', border: '1px solid var(--border-color)', borderLeft: `4px solid ${alert.severity === 'high' ? '#dc2626' : '#d97706'}`, borderRadius: 10, padding: '0.8rem 1rem', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{LABELS[alert.type] || alert.type}</div>
            <div style={{ fontWeight: 750, marginTop: 2 }}>{alert.title}</div>
            <div style={{ color: '#475569', fontSize: '0.85rem' }}>{alert.detail}</div>
          </button>
        ))}
      </div>
    </AppLayout>
  );
}
