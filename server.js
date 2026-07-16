// ===========================
//   ZK STUDIO - SERVIDOR
// ===========================
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 80;
const PUBLIC_DIR  = path.join(__dirname, 'public');
const LOGOS_DIR   = path.join(__dirname, 'LOGOS DO SITE');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ── CHAT STATE ────────────────────────────────────────────────────────
// Cada sessão: { id, messages:[{from,text,time}], adminWaiting:[], visitorWaiting:[], open:true }
const sessions   = {};          // sessionId -> session
const adminPolls = [];          // fila de long-poll do admin aguardando novidades

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function notifyAdmin() {
  // Despacha para todos os long-polls do admin esperando
  while (adminPolls.length) {
    const res = adminPolls.shift();
    try {
      res.writeHead(200, { 'Content-Type':'application/json', ...CORS });
      res.end(JSON.stringify(getSessions()));
    } catch(_) {}
  }
}
function getSessions() {
  return Object.values(sessions).filter(s => s.open);
}

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css',
  '.js':'application/javascript',    '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf',
};
const CORS = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
};

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }

  // ── API DE CHAT ──────────────────────────────────────────────────────

  // Visitante: iniciar sessão
  if (urlPath === '/chat/start' && req.method === 'POST') {
    const body = await readBody(req);
    const id = makeId();
    sessions[id] = { id, name: body.name || 'Visitante', messages: [], open: true };
    // Mensagem automática de boas-vindas
    sessions[id].messages.push({ from:'admin', text:'Olá! Como posso te ajudar? 👋', time: now() });
    notifyAdmin();
    res.writeHead(200, { 'Content-Type':'application/json', ...CORS });
    res.end(JSON.stringify({ id }));
    return;
  }

  // Visitante: enviar mensagem
  if (urlPath === '/chat/send' && req.method === 'POST') {
    const body = await readBody(req);
    const s = sessions[body.id];
    if (!s) { res.writeHead(404, CORS); res.end('{}'); return; }
    s.messages.push({ from:'visitor', text: body.text, time: now() });
    // Acorda visitante esperando resposta
    while (s.visitorWaiting && s.visitorWaiting.length) {
      const r = s.visitorWaiting.shift();
      try { r.writeHead(200,{'Content-Type':'application/json',...CORS}); r.end(JSON.stringify(s.messages)); } catch(_){}
    }
    notifyAdmin();
    res.writeHead(200, { 'Content-Type':'application/json', ...CORS });
    res.end('{"ok":true}');
    return;
  }

  // Visitante: long-poll aguarda nova mensagem
  if (urlPath === '/chat/poll' && req.method === 'GET') {
    const id  = new URL('http://x' + req.url).searchParams.get('id');
    const idx = parseInt(new URL('http://x' + req.url).searchParams.get('idx') || '0');
    const s   = sessions[id];
    if (!s) { res.writeHead(404, CORS); res.end('[]'); return; }
    if (s.messages.length > idx) {
      res.writeHead(200,{'Content-Type':'application/json',...CORS});
      res.end(JSON.stringify(s.messages));
      return;
    }
    // Espera até 25s
    if (!s.visitorWaiting) s.visitorWaiting = [];
    s.visitorWaiting.push(res);
    const t = setTimeout(() => {
      const i = s.visitorWaiting.indexOf(res);
      if (i > -1) s.visitorWaiting.splice(i, 1);
      try { res.writeHead(200,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify(s.messages)); } catch(_){}
    }, 25000);
    res.on('close', () => clearTimeout(t));
    return;
  }

  // Admin: listar sessões (long-poll)
  if (urlPath === '/chat/admin/sessions' && req.method === 'GET') {
    const active = getSessions();
    if (active.length > 0) {
      res.writeHead(200,{'Content-Type':'application/json',...CORS});
      res.end(JSON.stringify(active)); return;
    }
    adminPolls.push(res);
    const t = setTimeout(() => {
      const i = adminPolls.indexOf(res);
      if (i > -1) adminPolls.splice(i, 1);
      try { res.writeHead(200,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify(getSessions())); } catch(_){}
    }, 25000);
    res.on('close', () => clearTimeout(t));
    return;
  }

  // Admin: responder mensagem
  if (urlPath === '/chat/admin/reply' && req.method === 'POST') {
    const body = await readBody(req);
    const s = sessions[body.id];
    if (!s) { res.writeHead(404,CORS); res.end('{}'); return; }
    s.messages.push({ from:'admin', text: body.text, time: now() });
    while (s.visitorWaiting && s.visitorWaiting.length) {
      const r = s.visitorWaiting.shift();
      try { r.writeHead(200,{'Content-Type':'application/json',...CORS}); r.end(JSON.stringify(s.messages)); } catch(_){}
    }
    notifyAdmin();
    res.writeHead(200,{'Content-Type':'application/json',...CORS});
    res.end('{"ok":true}');
    return;
  }

  // Admin: fechar conversa
  if (urlPath === '/chat/admin/close' && req.method === 'POST') {
    const body = await readBody(req);
    const s = sessions[body.id];
    if (s) {
      s.open = false;
      s.messages.push({ from:'admin', text:'Conversa encerrada. Obrigado pelo contato! 👋', time: now() });
      while (s.visitorWaiting && s.visitorWaiting.length) {
        const r = s.visitorWaiting.shift();
        try { r.writeHead(200,{'Content-Type':'application/json',...CORS}); r.end(JSON.stringify(s.messages)); } catch(_){}
      }
      notifyAdmin();
    }
    res.writeHead(200,{'Content-Type':'application/json',...CORS});
    res.end('{"ok":true}');
    return;
  }

  // ── ARQUIVOS ESTÁTICOS ───────────────────────────────────────────────

  if (urlPath === '/config.json') {
    fs.readFile(CONFIG_FILE, (err, data) => {
      if (err) { res.writeHead(500); res.end('{}'); return; }
      res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-cache' });
      res.end(data);
    });
    return;
  }

  let filePath;
  if (urlPath.startsWith('/logos/')) {
    filePath = path.join(PUBLIC_DIR, urlPath);
  } else if (urlPath.startsWith('/LOGOS DO SITE/') || urlPath.startsWith('/LOGOS%20DO%20SITE/')) {
    const file = urlPath.replace(/^\/LOGOS( DO SITE|%20DO%20SITE)\//, '');
    filePath = path.join(LOGOS_DIR, file);
  } else {
    filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  }

  const ext = path.extname(filePath).toLowerCase();
  const ct  = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
});

server.on('error', err => {
  if (err.code === 'EACCES') console.error('\n  [ERRO] Porta 80 requer Administrador.\n');
  else if (err.code === 'EADDRINUSE') console.error('\n  [ERRO] Porta 80 já em uso.\n');
  else console.error(err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
    }
  }
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║      ZK STUDIO — SERVIDOR ON         ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log('  ║  Site:   http://zkstudio.local       ║');
  console.log(`  ║  Rede:   http://${localIP.padEnd(22)}║`);
  console.log('  ║  Admin:  http://zkstudio.local/admin ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  const { exec } = require('child_process');
  // Só abre navegador localmente
  if (!process.env.PORT) {
    setTimeout(() => exec('start http://zkstudio.local'), 800);
  }
});
