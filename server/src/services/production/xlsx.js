function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function zipStore(files) {
  const parts = [];
  const centrals = [];
  let offset = 0;
  files.forEach((file) => {
    const name = Buffer.from(file.name);
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0),
      name, data
    ]);
    parts.push(local);
    centrals.push(Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset),
      name
    ]));
    offset += local.length;
  });
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0)
  ]);
  return Buffer.concat([...parts, central, end]);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(headers, rows) {
  const all = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
  const body = all.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const numeric = typeof value === 'number' && Number.isFinite(value);
      if (numeric) return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function toXlsx(headers, rows) {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: content },
    { name: '_rels/.rels', data: root },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: rels },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml(headers, rows) }
  ]);
}

function toHtml(report) {
  const head = report.columns.map((column) => `<th>${escapeXml(column.label)}</th>`).join('');
  const body = report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeXml(row[column.key] ?? '')}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(report.title)}</title>
<style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px}p{color:#333;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;font-size:12px;text-align:left}th{background:#f3f4f6}@media print{body{margin:0}}</style>
</head><body><h1>${escapeXml(report.title)}</h1><p>${escapeXml(report.note || '')}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function sendReport(res, report, format) {
  const kind = String(format || 'json').toLowerCase();
  if (kind === 'xlsx') {
    const headers = report.columns.map((column) => column.label);
    const rows = report.rows.map((row) => {
      const out = {};
      report.columns.forEach((column) => {
        out[column.label] = row[column.key] ?? '';
      });
      return out;
    });
    const body = toXlsx(headers, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${report.key}.xlsx"`);
    return res.status(200).send(body);
  }
  if (kind === 'html' || kind === 'pdf') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(toHtml(report));
  }
  return res.json(report);
}

module.exports = { toXlsx, toHtml, sendReport, crc32 };
