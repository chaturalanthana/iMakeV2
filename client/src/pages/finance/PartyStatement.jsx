import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import PageHeader from '../../components/ui/PageHeader';
import Section, { EmptyState } from '../../components/ui/Section';
import { FileText } from 'lucide-react';

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
  const lines = statement?.lines || [];

  return (
    <AppLayout title={title} icon={FileText}>
      {loading ? <PageSkeleton /> : (
        <>
          <PageHeader
            onBack={() => navigate(back)}
            title={statement?.party ? `${statement.party.code} - ${statement.party.name}` : title}
            subtitle={`Balance ${money(statement?.balance)}`}
          />
          <Section>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Document</th>
                    <th>Number</th>
                    <th style={{ textAlign: 'right' }}>Charge</th>
                    <th style={{ textAlign: 'right' }}>Payment</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={6}><EmptyState>No documents in this statement.</EmptyState></td></tr>
                  ) : lines.map((line, index) => (
                    <tr key={`${line.number}-${index}`}>
                      <td>{new Date(line.date).toLocaleDateString()}</td>
                      <td>{line.document}</td>
                      <td style={{ fontWeight: 600 }}>{line.number}</td>
                      <td style={{ textAlign: 'right' }}>{money(line.charge)}</td>
                      <td style={{ textAlign: 'right' }}>{money(line.payment)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(line.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </AppLayout>
  );
}
