function validateBody(schema) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Request body must be an object.',
        fields: { body: 'Request body must be an object.' }
      });
    }

    const parsed = schema.safeParse(req.body);
    if (parsed.success) return next();

    const fields = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.length ? issue.path.join('.') : 'body';
      if (!fields[key]) fields[key] = issue.message;
    }
    const messages = Object.values(fields);
    return res.status(400).json({
      error: messages.length === 1 ? messages[0] : 'Please correct the highlighted fields.',
      fields
    });
  };
}

module.exports = { validateBody };
