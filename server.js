// Serveur NEXTBOT (Render) : liste des sessions + relais entre joueurs (10 max). Aucune variable d'environnement requise (Render fournit PORT).
const http = require('http'), { WebSocketServer } = require('ws');
const server = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/plain' }); r.end('NEXTBOT server OK'); });
const wss = new WebSocketServer({ server, maxPayload: 32 * 1024 });
let nid = 1; const sessions = new Map();
const send = (ws, o) => { if (ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>&"'`]/g, '').slice(0, n);
function lobby() {
  const list = [...sessions.values()].filter(s => s.m.length < 10).map(s => ({ id: s.id, name: s.name, n: s.m.length }));
  for (const c of wss.clients) if (!c.s) send(c, { t: 'sessions', list });
}
wss.on('connection', ws => {
  ws.id = String(nid++); ws.alive = true; ws.on('pong', () => { ws.alive = true; }); send(ws, { t: 'hello', id: ws.id }); lobby();
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (m.t === 'list') return lobby();
    if (m.t === 'create' && !ws.s) {
      ws.skin = m.skin | 0; ws.nm = clean(m.nm, 12); const s = { id: 'S' + nid++, name: clean(m.name, 20) || 'Session', seed: m.seed, host: ws, m: [ws] };
      sessions.set(s.id, s); ws.s = s; send(ws, { t: 'created', id: s.id }); return lobby();
    }
    if (m.t === 'join' && !ws.s) {
      const s = sessions.get(String(m.id)); if (!s || s.m.length >= 10) return send(ws, { t: 'err', msg: 'Session pleine ou introuvable' });
      ws.skin = m.skin | 0; ws.nm = clean(m.nm, 12); const peers = s.m.map(p => ({ id: p.id, skin: p.skin, nm: p.nm }));
      for (const p of s.m) send(p, { t: 'peerJoined', id: ws.id, skin: ws.skin, nm: ws.nm });
      s.m.push(ws); ws.s = s; send(ws, { t: 'joined', seed: s.seed, peers, host: s.host.id }); return lobby();
    }
    if (ws.s) { m.f = ws.id; const o = JSON.stringify(m); for (const p of ws.s.m) if (p !== ws) send(p, o); }   // relais aux autres joueurs
  });
  ws.on('close', () => {
    const s = ws.s; if (s) {
      s.m = s.m.filter(x => x !== ws); for (const p of s.m) send(p, { t: 'peerleft', id: ws.id });
      if (!s.m.length) sessions.delete(s.id); else if (s.host === ws) { s.host = s.m[0]; for (const p of s.m) send(p, { t: 'host', id: s.host.id }); }   // un autre joueur devient hôte (simule les nextbots)
    }
    lobby();
  });
});
setInterval(() => { for (const c of wss.clients) { if (!c.alive) { c.terminate(); continue; } c.alive = false; c.ping(); } }, 25000);
server.listen(process.env.PORT || 3000, () => console.log('NEXTBOT server prêt'));
