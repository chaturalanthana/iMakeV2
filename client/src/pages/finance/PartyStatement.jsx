import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { ArrowLeft, FileText } from 'lucide-react';

export default function PartyStatement({ kind }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const back = kind === 'supplier' ? '/procurement/outstanding' : '/sales/outstanding';
  const title = kind === 'supplier' ? 'Supplier Statement' : 'Customer Statement';

  useEffect(() => {
    const load = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
        const path = kind === 'supplier'
          ? `/api/procurement/supplier-statement/${id}`
          : `/api/sales/customer-statement/${id}`;
        const res = await axios.get(path, config);
        setStatement(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, kind]);

  const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppLayout title={title} icon={FileText}>
      {loading ? <PageSkeleton /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <button onClick={() => navigate(back)} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem', display: 'flex' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ margin: 0 }}>{statement?.party ? `${statement.party.code} - ${statement.party.name}` : title}</h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Balance {money(statement?.balance)}</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['Date', 'Document', 'Number', 'Charge', 'Payment', 'Balance'].map((heading) => (
                    <th key={heading} style={{ textAlign: heading === 'Date' || heading === 'Document' || heading === 'Number' ? 'left' : 'right', padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(statement?.lines || []).map((line, index) => (
                  <tr key={`${line.number}-${index}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(line.date).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{line.document}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{line.number}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{money(line.charge)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{money(line.payment)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{money(line.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
