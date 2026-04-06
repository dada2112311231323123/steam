'use strict';

const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

// ── Services
const scanner = require('./services/scanner');

// ── Routes
const itemsRouter    = require('./routes/items');
const scanRouter     = require('./routes/scan');
const simulateRouter = require('./routes/simulate');
const settingsRouter = require('./routes/settings');
const cacheRouter    = require('./routes/cache');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

// ══ Middleware ══════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));  // index.html → public/

// ══ WebSocket Server ════════════════════════════════════════════════════
const wss = new WebSocket.Server({ server });

// Broadcast to all connected clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Scanner emits 'ws' events → forward to all WS clients
scanner.on('ws', (msg) => broadcast(msg));

wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected · ${req.socket.remoteAddress}`);

  // Send current scan status on connect
  ws.send(JSON.stringify({ type: 'scan:status', ...scanner.getStatus() }));

  ws.on('error', (e) => console.error('[WS] Error:', e.message));
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ══ API Routes ══════════════════════════════════════════════════════════
app.use('/api/items',    itemsRouter);
app.use('/api/scan',     scanRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/cache',    cacheRouter);

// Ping
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Export items as JSON file download
app.get('/api/export/items', (_req, res) => {
  const db = require('./services/db');
  const items = db.getItems({ limit: 99999 });
  res.setHeader('Content-Disposition', 'attachment; filename="cs2_items.json"');
  res.json({ exported: new Date().toISOString(), count: items.length, items });
});

// Serve index.html at root
app.get('/', (_req, res) => {
  const idx = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.status(404).send('index.html not found in /public');
});

// ══ Boot ════════════════════════════════════════════════════════════════
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   CS2 MARKET TERMINAL · backend v1.0    ║
║   http://localhost:${PORT}                   ║
║   WebSocket: ws://localhost:${PORT}          ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, broadcast };
