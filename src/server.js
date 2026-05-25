const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve static frontend ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes.auth'));
app.use('/api/projects', require('./routes.projects'));
app.use('/api/projects/:projectId/tasks', require('./routes.tasks'));
app.use('/api', require('./routes.misc'));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  TaskFlow running on http://localhost:${PORT}`);
});

module.exports = app;
