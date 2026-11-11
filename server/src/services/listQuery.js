const { toXlsx } = require('./spreadsheet');

function listSpec(query, { sortFields = [], defaultSort = 'createdAt', defaultDir = 'desc' } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(200, Math.max(parseInt(query.pageSize, 10) || 15, 1));
  const sort = sortFields.includes(query.sort) ? query.sort : defaultSort;
  const dir = query.dir === 'asc' ? 'asc' : (query.dir === 'desc' ? 'desc' : defaultDir);
  const q = String(query.q || '').trim();
  const paged = query.page !== undefined || query.pageSize !== undefined || query.sort !== undefined || q.length > 0;
  return {
    page,
    pageSize,
    sort,
    dir,
    q,
    paged,
    exporting: query.export === 'xlsx',
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

function searchWhere(q, fields) {
  if (!q || !fields?.length) return null;
  return {
    OR: fields.map((field) => {
      if (field.includes('.')) {
        const [rel, key] = field.split('.');
        return { [rel]: { [key]: { contains: q, mode: 'insensitive' } } };
      }
      return { [field]: { contains: q, mode: 'insensitive' } };
    })
  };
}

function combineWhere(base, extra) {
  if (!extra) return base || {};
  if (!base || !Object.keys(base).length) return extra;
  return { AND: [base, extra] };
}

async function respondList(req, res, options) {
  const spec = listSpec(req.query, options);
  const where = combineWhere(options.where || { tenantId: req.tenantId }, searchWhere(spec.q, options.search));
  const orderBy = options.orderBy || { [spec.sort]: spec.dir };
  const args = { where, orderBy, include: options.include };
  if (spec.exporting) {
    const rows = await options.model.findMany(args);
    const headers = options.exportHeaders;
    const mapped = rows.map((row) => options.toExport(row));
    const buffer = toXlsx(headers, mapped);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename || 'export.xlsx'}"`);
    return res.send(buffer);
  }
  if (!spec.paged) {
    return res.json(await options.model.findMany(args));
  }
  const [items, total] = await Promise.all([
    options.model.findMany({ ...args, skip: spec.skip, take: spec.take }),
    options.model.count({ where })
  ]);
  return res.json({ items, total, page: spec.page, pageSize: spec.pageSize });
}

module.exports = { listSpec, respondList, searchWhere };
