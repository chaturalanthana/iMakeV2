import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { ArrowLeft, Printer, FileText } from 'lucide-react';

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WhtCertificate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/api/finance/payment-vouchers/${id}/wht-certificate`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then((res) => setCertificate(res.data)).catch((err) => setError(err.response?.data?.error || 'Certificate not found'));
  }, [id]);

  return (
    <AppLayout title={certificate?.certificateNumber || 'WHT certificate'} icon={FileText}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate('/finance/vouchers')} style={button}><ArrowLeft size={16} /> Back</button>
        <button type="button" onClick={() => window.print()} style={button}><Printer size={16} /> Print</button>
      </div>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {certificate && (
        <div style={{ background: '#fff', color: '#000', border: '1px solid #000', padding: '1.5rem', maxWidth: 720 }}>
          <div style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>{certificate.company}</div>
          <h2 style={{ margin: '0.2rem 0 1rem' }}>{certificate.certificateNumber}</h2>
          <p>Withholding tax certificate for supplier payment {certificate.voucherNumber} dated {new Date(certificate.date).toLocaleDateString()}.</p>
          <p><strong>{certificate.supplier.code}</strong> — {certificate.supplier.name}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Gross settled', certificate.grossAmount],
                ['Rate %', certificate.whtRate],
                ['Withheld on this payment', certificate.paymentWht],
                ['Already withheld on the bill', certificate.invoiceWht],
                ['Total WHT', certificate.whtAmount],
                ['Net paid', certificate.netPaid]
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: '0.35rem 0', borderBottom: '1px solid #ddd' }}>{label}</td>
                  <td style={{ padding: '0.35rem 0', borderBottom: '1px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}

const button = {
  height: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', background: '#fff',
  fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
};
