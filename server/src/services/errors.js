class DocumentError extends Error {
  constructor(message, fields = {}, status = 400) {
    super(message);
    this.name = 'DocumentError';
    this.fields = fields;
    this.status = status;
  }
}

function sendError(res, error, fallback) {
  if (error instanceof DocumentError || (error && error.status && error.status < 500)) {
    const body = { error: error.message };
    if (error.fields && Object.keys(error.fields).length) body.fields = error.fields;
    return res.status(error.status || 400).json(body);
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

module.exports = { DocumentError, sendError };
