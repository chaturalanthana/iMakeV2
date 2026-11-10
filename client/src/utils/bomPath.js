export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

export function bomPath(bom) {
  const productCode = bom?.product?.code;
  const code = bom?.code;
  if (!productCode || !code) {
    return bom?.id ? `/production/boms/${bom.id}` : '/production/boms';
  }
  return `/production/boms/${encodeURIComponent(productCode)}/${encodeURIComponent(code)}`;
}
