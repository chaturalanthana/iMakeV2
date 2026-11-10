const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Main API routes. Uploaded business files are served only from authenticated /api/uploads.
app.use('/api', routes);

const clientDir = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.join(__dirname, '../public');
if (fs.existsSync(path.join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
