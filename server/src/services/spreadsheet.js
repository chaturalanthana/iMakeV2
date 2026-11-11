const zlib = require('zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
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
  const locals = [];
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
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset),
      name
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  });
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDir.length), u32(offset), u16(0)
  ]);
  return Buffer.concat([...locals, centralDir, end]);
}

function unzip(buffer) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const marker = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  let eocd = source.lastIndexOf(marker);
  if (eocd < 0) throw new Error('Could not read that spreadsheet.');
  const count = source.readUInt16LE(eocd + 8);
  let cursor = source.readUInt32LE(eocd + 16);
  const files = {};
  for (let index = 0; index < count; index += 1) {
    if (source.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Could not read that spreadsheet.');
    const method = source.readUInt16LE(cursor + 10);
    const compressedSize = source.readUInt32LE(cursor + 20);
    const nameLength = source.readUInt16LE(cursor + 28);
    const extraLength = source.readUInt16LE(cursor + 30);
    const commentLength = source.readUInt16LE(cursor + 32);
    const localOffset = source.readUInt32LE(cursor + 42);
    const name = source.slice(cursor + 46, cursor + 46 + nameLength).toString();
    const localNameLength = source.readUInt16LE(localOffset + 26);
    const localExtraLength = source.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = source.slice(start, start + compressedSize);
    let data = compressed;
    if (method === 8) data = zlib.inflateRawSync(compressed);
    else if (method !== 0) throw new Error('Could not read that spreadsheet.');
    files[name] = data;
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => String(value).trim() !== ''));
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  });
  return `${lines.join('\n')}\n`;
}

function recordsFromMatrix(matrix) {
  if (!matrix.length) return [];
  const headers = matrix[0].map((header) => String(header || '').trim());
  return matrix.slice(1).map((line) => {
    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = line[index] == null ? '' : String(line[index]).trim();
    });
    return record;
  }).filter((record) => Object.values(record).some((value) => String(value).trim() !== ''));
}

function columnName(index) {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function xmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toXlsx(headers, rows) {
  const matrix = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
  const sheetRows = matrix.map((line, rowIndex) => {
    const cells = line.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const text = value == null ? '' : String(value);
      if (text !== '' && /^-?\d+(\.\d+)?$/.test(text)) {
        return `<c r="${ref}"><v>${text}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(text)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }
  ];
  return zipStore(files);
}

function sharedStrings(xml) {
  const values = [];
  const items = String(xml).match(/<si\b[\s\S]*?<\/si>/g) || [];
  items.forEach((item) => {
    const parts = [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]);
    values.push(decodeXml(parts.join('')));
  });
  return values;
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseXlsx(buffer) {
  const files = unzip(buffer);
  const sheetName = Object.keys(files).find((name) => /xl\/worksheets\/sheet1\.xml$/i.test(name));
  if (!sheetName) throw new Error('The workbook has no sheet.');
  const sharedName = Object.keys(files).find((name) => /xl\/sharedStrings\.xml$/i.test(name));
  const strings = sharedName ? sharedStrings(files[sharedName].toString('utf8')) : [];
  const xml = files[sheetName].toString('utf8');
  const cells = [...xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)];
  const grid = new Map();
  let maxRow = 0;
  let maxCol = 0;
  cells.forEach((match) => {
    const attrs = match[1] || match[3] || '';
    const body = match[2] || '';
    const refMatch = attrs.match(/\br="([A-Z]+)(\d+)"/);
    if (!refMatch) return;
    const column = refMatch[1].split('').reduce((sum, char) => (sum * 26) + char.charCodeAt(0) - 64, 0) - 1;
    const row = Number(refMatch[2]) - 1;
    let value = '';
    if (/\bt="inlineStr"/.test(attrs)) {
      value = decodeXml(((body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/) || [])[1]) || '');
    } else if (/\bt="s"/.test(attrs)) {
      const index = Number(((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]) || 0);
      value = strings[index] || '';
    } else if (/\bt="b"/.test(attrs)) {
      value = ((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]) === '1' ? 'true' : 'false';
    } else {
      value = decodeXml(((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]) || '');
    }
    if (!grid.has(row)) grid.set(row, new Map());
    grid.get(row).set(column, value);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, column);
  });
  if (!grid.size) return [];
  const matrix = [];
  for (let row = 0; row <= maxRow; row += 1) {
    const line = [];
    for (let column = 0; column <= maxCol; column += 1) {
      line.push(grid.get(row)?.get(column) || '');
    }
    matrix.push(line);
  }
  return recordsFromMatrix(matrix);
}

function parseSpreadsheet(buffer, filename = '') {
  const name = String(filename || '').toLowerCase();
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (name.endsWith('.xlsx') || (bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    return parseXlsx(bytes);
  }
  return recordsFromMatrix(parseCsv(bytes.toString('utf8')));
}

module.exports = {
  parseCsv,
  toCsv,
  toXlsx,
  parseXlsx,
  parseSpreadsheet,
  recordsFromMatrix,
  unzip
};
