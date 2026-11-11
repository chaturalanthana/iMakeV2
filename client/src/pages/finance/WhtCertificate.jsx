import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { findByRouteKey, isUuid, routeKeyOf, showRecord } from '../../utils/recordPath';
import AppLayout from '../../components/layout/AppLayout';
import PageHeader from '../../components/ui/PageHeader';
import ActionButton from '../../components/ui/ActionButton';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { Printer, FileText } from 'lucide-react';

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WhtCertificate() {
  const params = useParams();
  const routeKey = params['*'] ? routeKeyOf(params) : (params.id || '');
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      try {
        let voucherId = isUuid(routeKey) ? routeKey : '';
        if (!voucherId) {
          const list = await axios.get('/api/finance/payment-vouchers', { headers });
          voucherId = findByRouteKey(list.data, routeKey, 'voucherNumber')?.id || '';
        }
        if (!voucherId) {
          if (!stop) setError('Certificate not found');
          return;
        }
        const res = await axios.get(`/api/finance/payment-vouchers/${voucherId}/wht-certificate`, { headers });
        if (stop) return;
        setCertificate(res.data);
        if (res.data?.voucherNumber) showRecord(navigate, '/finance/vouchers/wht', { voucherNumber: res.data.voucherNumber }, 'voucherNumber');
      } catch (err) {
        if (!stop) setError(err.response?.data?.error || 'Certificate not found');
      } finally {
        if (!stop) setLoading(false);
      }
    };
    if (routeKey) load();
    else setLoading(false);
    return () => { stop = true; };
  }, [routeKey, navigate]);

  return (
    <AppLayout title={certificate?.certificateNumber || 'WHT Certificate'} icon={FileText}>
      {loading ? <PageSkeleton type="form" /> : (
        <>
          <PageHeader
            onBack={() => navigate('/finance/vouchers')}
            title={certificate?.certificateNumber || 'WHT Certificate'}
            subtitle={certificate ? `Payment ${certificate.voucherNumber}` : 'Withholding tax certificate'}
            actions={(
              <ActionButton variant="secondary" icon={Printer} onClick={() => window.print()}>
                Print Report
              </ActionButton>
            )}
          />
          {error && <div className="field-error-text" style={{ marginBottom: '1rem' }}>{error}</div>}
          {certificate && (
            <div style={{ background: '#fff', color: '#000', border: '1px solid #000', padding: '1.5rem', maxWidth: 720 }}>
              <div style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>{certificate.company}</div>
              <h2 style={{ margin: '0.2rem 0 1rem', fontSize: '1.25rem' }}>{certificate.certificateNumber}</h2>
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
        </>
      )}
    </AppLayout>
  );
}
