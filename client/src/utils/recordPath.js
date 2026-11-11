import { isUuid } from './bomPath';

export { isUuid };

export function routeKeyOf(params) {
  const raw = params?.['*'] ?? params?.id ?? '';
  const value = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function recordPath(base, record, key) {
  const number = record?.[key];
  if (!number) return record?.id ? `${base}/${record.id}` : base;
  return `${base}/${String(number)}`;
}

export function queryRef(value) {
  return encodeURIComponent(value == null ? '' : String(value));
}

export function statementPath(base, row) {
  const code = row?.code;
  if (!code) return `${base}/${row?.id || ''}/statement`;
  return `${base}/${code}/statement`;
}

export function findByRouteKey(list, key, field) {
  const value = String(key || '');
  if (!value || !Array.isArray(list)) return null;
  if (isUuid(value)) return list.find((row) => row.id === value) || null;
  const wanted = value.toLowerCase();
  return list.find((row) => String(row?.[field] || '').toLowerCase() === wanted) || null;
}

export function showRecord(navigate, base, record, field) {
  if (!record || typeof window === 'undefined') return;
  const next = recordPath(base, record, field);
  let current = window.location.pathname;
  try { current = decodeURIComponent(current); } catch { /* keep the raw path */ }
  if (current !== next) navigate(next, { replace: true });
}
