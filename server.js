// Bharat City server: serves the game and relays multiplayer presence between players.
// No accounts: anyone who opens the site can create or join a room with a code.
// Run:  npm install && npm start     (PORT env var, default 8080)
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { WebSocketServer } = require('ws');

const ROOT = path.resolve(__dirname, 'public');
const PORT = process.env.PORT || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const cache = new Map(); // gzip once, serve from memory

const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  if (p === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok ' + wss.clients.size); }
  if (p === '/' || p === '') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  const send = (entry) => {
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const headers = { 'content-type': entry.type, 'cache-control': p === '/index.html' ? 'no-cache' : 'public, max-age=3600', vary: 'accept-encoding' };
    if (gz) headers['content-encoding'] = 'gzip';
    res.writeHead(200, headers); res.end(gz ? entry.gz : entry.raw);
  };
  const hit = cache.get(file); if (hit) return send(hit);
  fs.readFile(file, (err, raw) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    const entry = { raw, gz: zlib.gzipSync(raw, { level: 6 }), type: TYPES[path.extname(file)] || 'application/octet-stream' };
    cache.set(file, entry); send(entry);
  });
});

// ---- multiplayer relay ----
// Each client keeps one presence object (its player state, including the room code `rc`).
// The server forwards it to everyone else with the same room code, about 8 times a second.
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });
let nextId = 1;
const MAX_PER_ROOM = 16;
const roomCount = (rc) => { let n = 0; for (const c of wss.clients) if (c.rc === rc) n++; return n; };
const send = (c, obj) => { if (c.readyState === 1 && c.bufferedAmount < 256 * 1024) c.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); };

wss.on('connection', (ws) => {
  ws.peer = 'p' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);
  ws.rc = null; ws.state = null; ws.alive = true; ws.budget = 30; ws.last = Date.now();
  send(ws, { t: 'hello', peer: ws.peer });
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf) => {
    // simple rate limit: ~20 messages/s sustained
    const now = Date.now(); ws.budget = Math.min(40, ws.budget + (now - ws.last) / 50); ws.last = now;
    if (ws.budget < 1) return; ws.budget--;
    let m; try { m = JSON.parse(buf); } catch (_) { return; }
    if (!m || m.t !== 'p' || typeof m.d !== 'object' || m.d === null || Array.isArray(m.d)) return;
    const rc = typeof m.d.rc === 'string' ? m.d.rc.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || null : null;
    if (rc !== ws.rc) {
      // leaving the old room
      if (ws.rc) for (const c of wss.clients) if (c !== ws && c.rc === ws.rc) send(c, { t: 'left', peer: ws.peer });
      if (rc && roomCount(rc) >= MAX_PER_ROOM) { ws.rc = null; ws.state = null; return; }
      ws.rc = rc;
      // a newcomer receives everyone already in the room
      if (rc) for (const c of wss.clients) if (c !== ws && c.rc === rc && c.state) send(ws, { t: 'p', peer: c.peer, d: c.state });
    }
    ws.state = rc ? m.d : null;
    if (!rc) return;
    const out = JSON.stringify({ t: 'p', peer: ws.peer, d: m.d });
    for (const c of wss.clients) if (c !== ws && c.rc === rc) send(c, out);
  });
  ws.on('close', () => { if (ws.rc) for (const c of wss.clients) if (c.rc === ws.rc) send(c, { t: 'left', peer: ws.peer }); });
});
// drop dead connections (phones that went to sleep)
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch (_) {} } }, 15000);

server.listen(PORT, () => console.log('Bharat City on http://localhost:' + PORT));
