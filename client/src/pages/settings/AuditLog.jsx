import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ScrollText } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/ui/DataTable';
import PageSkeleton from '../../components/ui/PageSkeleton';
import FilterBar from '../../components/ui/FilterBar';
import FormField, { TextControl, SelectControl } from '../../components/ui/FormField';
import ExportButton from '../../components/ui/ExportButton';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../context/ToastContext';

export default function AuditLog() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState({ page: 1, q: '', entity: '', action: '' });
  const [loading, setLoading] = useState(true);

  const load = async (next = query) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/audit', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: {
          page: next.page,
          pageSize: 15,
          q: next.q || undefined,
          entity: next.entity || undefined,
          action: next.action || undefined
        }
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not load the audit log', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(query); }, [query.page, query.entity, query.action]);

  return (
    <AppLayout title="Audit log" icon={ScrollText}>
      {loading && !rows.length ? <PageSkeleton /> : (
        <>
          <FilterBar
            variant="card"
            actions={<ExportButton url="/api/audit" filename="audit-log.xlsx" params={{ q: query.q, entity: query.entity, action: query.action }} />}
          >
            <FormField label="Search" width="280px">
              <TextControl
                value={query.q}
                placeholder="Action, entity, or id"
                onChange={(e) => setQuery((prev) => ({ ...prev, q: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') load({ ...query, page: 1 }); }}
              />
            </FormField>
            <FormField label="Entity" width="180px">
              <TextControl value={query.entity} placeholder="PO" onChange={(e) => setQuery((prev) => ({ ...prev, entity: e.target.value, page: 1 }))} />
            </FormField>
            <FormField label="Action" width="180px">
              <SelectControl value={query.action} onChange={(e) => setQuery((prev) => ({ ...prev, action: e.target.value, page: 1 }))}>
                <option value="">All actions</option>
                {['CREATE', 'UPDATE', 'DELETE', 'STATUS', 'POST', 'APPROVE', 'REVERSE'].map((name) => <option key={name} value={name}>{name}</option>)}
              </SelectControl>
            </FormField>
          </FilterBar>
          <DataTable
            columns={[
              { header: 'When', accessor: 'createdAt', render: (row) => new Date(row.createdAt).toLocaleString() },
              { header: 'Action', accessor: 'action', render: (row) => <StatusBadge status={row.action} /> },
              { header: 'Entity', accessor: 'entity' },
              { header: 'Record', accessor: 'entityId' },
              { header: 'Change', accessor: 'after', render: (row) => JSON.stringify(row.after || {}) }
            ]}
            data={rows}
            loading={loading}
            searchKeys={[]}
            onServerQuery={(next) => setQuery((prev) => ({ ...prev, page: next.page || 1 }))}
            serverTotal={total}
            serverPage={query.page}
            noDataMessage="No audit entries found."
          />
        </>
      )}
    </AppLayout>
  );
}
