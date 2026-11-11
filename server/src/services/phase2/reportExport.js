const { toXlsx } = require('../spreadsheet');

function xlsxBuffer(report) {
  const headers = report.columns.map((column) => column.label);
  const rows = report.rows.map((row) => {
    const out = {};
    for (const column of report.columns) {
      const value = row[column.key];
      out[column.label] = value == null ? '' : value;
    }
    return out;
  });
  return toXlsx(headers, rows);
}

function sendReport(res, report, format) {
  if (String(format || 'json').toLowerCase() === 'xlsx') {
    const body = xlsxBuffer(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${report.key}.xlsx"`);
    return res.status(200).send(body);
  }
  return res.json(report);
}

module.exports = { xlsxBuffer, sendReport };
