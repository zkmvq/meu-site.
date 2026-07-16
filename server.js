// ===========================
//   ZK STUDIO - SERVIDOR
// ===========================
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = process.env.PORT || 80;
const PUBLIC_DIR  = path.join(__dirname, 'public');
const LOGOS_DIR   = path.join(__dirname, 'LOGOS DO SITE');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ── DATABASE ──────────────────────────────────────────────────────────
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const JWT_SECRET   = process.env.JWT_SECRET || 'zkstudio_secret_2025';
const DB_URL       = process.env.DATABASE_URL || 'postgresql://postgres:MmoyArqrUmaytjQzcEVwmDGKtBitVqXY@postgres.railway.internal:5432/railway';
const OWNER_EMAIL  = 'ar39491@gmail.com'; // Admin principal

const pool = new Pool({
  connectionString: DB_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash VARCHAR(200),
      avatar VARCHAR(300),
      is_staff BOOLEAN DEFAULT FALSE,
      is_admin BOOLEAN DEFAULT FALSE,
      provider VARCHAR(20) DEFAULT 'local',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      script_name VARCHAR(100) NOT NULL,
      price VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      purchased_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS staff_emails (
      id SERIAL PRIMARY KEY,
      email VARCHAR(150) UNIQUE NOT NULL,
      label VARCHAR(100),
      added_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Migração segura
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE`).catch(()=>{});
  // Garante que o dono está na tabela de staff
  await pool.query(`INSERT INTO staff_emails (email, label) VALUES ($1, 'Dono - ZK Studio') ON CONFLICT (email) DO NOTHING`, [OWNER_EMAIL]);
  // Marca o dono como admin/staff se já estiver cadastrado
  await pool.query(`UPDATE users SET is_admin=true, is_staff=true WHERE email=$1`, [OWNER_EMAIL]);
  console.log('  ✅ Banco de dados conectado!');
}
initDB().catch(e => console.error('  ⚠️  DB:', e.message));

// ── CHAT ──────────────────────────────────────────────────────────────
const sessions   = {};
const adminPolls = [];

function makeId() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function notifyAdmin() {
  while (adminPolls.length) {
    const r = adminPolls.shift();
    try { r.writeHead(200,{'Content-Type':'application/json',...CORS}); r.end(JSON.stringify(getSessions())); } catch(_){}
  }
}
function getSessions() { return Object.values(sessions).filter(s=>s.open); }

const MIME = {
  '.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
};
const CORS = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS,DELETE',
  'Access-Control-Allow-Headers':'Content-Type,Authorization',
};

function readBody(req) {
  return new Promise(resolve => {
    let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{resolve(JSON.parse(d))}catch{resolve({})} });
  });
}
function jsonRes(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json',...CORS});
  res.end(JSON.stringify(data));
}
function getToken(req) {
  return (req.headers['authorization']||'').replace('Bearer ','').trim();
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
async function isStaff(decoded) {
  if (!decoded) return false;
  const r = await pool.query('SELECT is_staff, is_admin, email FROM users WHERE id=$1', [decoded.id]);
  if (!r.rows.length) return false;
  return r.rows[0].is_staff || r.rows[0].is_admin || r.rows[0].email === OWNER_EMAIL;
}
async function isAdmin(decoded) {
  if (!decoded) return false;
  const r = await pool.query('SELECT is_admin, email FROM users WHERE id=$1', [decoded.id]);
  if (!r.rows.length) return false;
  return r.rows[0].is_admin || r.rows[0].email === OWNER_EMAIL;
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  // ── AUTH ──────────────────────────────────────────────────────────────

  if (urlPath === '/auth/register' && req.method === 'POST') {
    const { name, email, password } = await readBody(req);
    if (!name||!email||!password) return jsonRes(res,400,{error:'Preencha todos os campos.'});
    if (password.length < 6) return jsonRes(res,400,{error:'Senha deve ter ao menos 6 caracteres.'});
    try {
      const exists = await pool.query('SELECT id FROM users WHERE email=$1',[email.toLowerCase()]);
      if (exists.rows.length) return jsonRes(res,409,{error:'Email já cadastrado.'});
      const hash = await bcrypt.hash(password,10);
      const isOwner = email.toLowerCase() === OWNER_EMAIL;
      const r = await pool.query(
        'INSERT INTO users (name,email,password_hash,is_admin,is_staff,provider) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,email,avatar,is_admin,is_staff,created_at',
        [name, email.toLowerCase(), hash, isOwner, isOwner, 'local']
      );
      if (isOwner) await pool.query(`INSERT INTO staff_emails (email,label) VALUES ($1,'Dono') ON CONFLICT DO NOTHING`,[OWNER_EMAIL]);
      const user  = r.rows[0];
      const token = jwt.sign({id:user.id,email:user.email},JWT_SECRET,{expiresIn:'30d'});
      jsonRes(res,200,{token,user});
    } catch(e) { jsonRes(res,500,{error:'Erro ao cadastrar.'}); }
    return;
  }

  if (urlPath === '/auth/login' && req.method === 'POST') {
    const { email, password } = await readBody(req);
    if (!email||!password) return jsonRes(res,400,{error:'Preencha todos os campos.'});
    try {
      const r = await pool.query('SELECT * FROM users WHERE email=$1',[email.toLowerCase()]);
      if (!r.rows.length) return jsonRes(res,401,{error:'Email ou senha incorretos.'});
      const user = r.rows[0];
      const ok   = await bcrypt.compare(password, user.password_hash||'');
      if (!ok) return jsonRes(res,401,{error:'Email ou senha incorretos.'});
      // Garante que dono tem permissões
      if (user.email === OWNER_EMAIL && !user.is_admin) {
        await pool.query('UPDATE users SET is_admin=true, is_staff=true WHERE id=$1',[user.id]);
        user.is_admin = true; user.is_staff = true;
      }
      const token = jwt.sign({id:user.id,email:user.email},JWT_SECRET,{expiresIn:'30d'});
      jsonRes(res,200,{token,user:{id:user.id,name:user.name,email:user.email,avatar:user.avatar,is_admin:user.is_admin,is_staff:user.is_staff,created_at:user.created_at}});
    } catch(e) { jsonRes(res,500,{error:'Erro ao fazer login.'}); }
    return;
  }

  if (urlPath === '/auth/me' && req.method === 'GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Não autorizado.'});
    try {
      const u = await pool.query('SELECT id,name,email,avatar,is_admin,is_staff,created_at FROM users WHERE id=$1',[decoded.id]);
      if (!u.rows.length) return jsonRes(res,404,{error:'Usuário não encontrado.'});
      const p = await pool.query('SELECT * FROM purchases WHERE user_id=$1 ORDER BY purchased_at DESC',[decoded.id]);
      jsonRes(res,200,{user:u.rows[0],purchases:p.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  // ── STAFF ─────────────────────────────────────────────────────────────

  if (urlPath === '/staff/check' && req.method === 'GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Não autorizado.'});
    try {
      const staff = await isStaff(decoded);
      const admin = await isAdmin(decoded);
      if (!staff) return jsonRes(res,403,{error:'Sem permissão de staff.'});
      jsonRes(res,200,{ok:true,isAdmin:admin});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/users' && req.method === 'GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isStaff(decoded)) return jsonRes(res,403,{error:'Sem permissão.'});
    try {
      const users = await pool.query('SELECT id,name,email,avatar,is_admin,is_staff,provider,created_at FROM users ORDER BY created_at DESC');
      const purch = await pool.query('SELECT user_id,COUNT(*) as total FROM purchases GROUP BY user_id');
      const pm = {}; purch.rows.forEach(p=>pm[p.user_id]=parseInt(p.total));
      jsonRes(res,200,{users:users.rows.map(u=>({...u,purchase_count:pm[u.id]||0}))});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/list' && req.method === 'GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    try {
      const r = await pool.query('SELECT * FROM staff_emails ORDER BY added_at DESC');
      jsonRes(res,200,{staff:r.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/add' && req.method === 'POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    const {email,label} = await readBody(req);
    if (!email) return jsonRes(res,400,{error:'Informe o email.'});
    try {
      await pool.query('INSERT INTO staff_emails (email,label) VALUES($1,$2) ON CONFLICT (email) DO UPDATE SET label=$2',[email.toLowerCase(),label||'Staff']);
      await pool.query('UPDATE users SET is_staff=true WHERE email=$1',[email.toLowerCase()]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/remove' && req.method === 'POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    const {email} = await readBody(req);
    if (email === OWNER_EMAIL) return jsonRes(res,403,{error:'Não é possível remover o dono.'});
    try {
      await pool.query('DELETE FROM staff_emails WHERE email=$1',[email]);
      await pool.query('UPDATE users SET is_staff=false WHERE email=$1',[email]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/purchase/add' && req.method === 'POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isStaff(decoded)) return jsonRes(res,403,{error:'Sem permissão.'});
    const {user_email,script_name,price} = await readBody(req);
    try {
      const u = await pool.query('SELECT id FROM users WHERE email=$1',[user_email?.toLowerCase()]);
      if (!u.rows.length) return jsonRes(res,404,{error:'Usuário não encontrado.'});
      await pool.query('INSERT INTO purchases (user_id,script_name,price,status) VALUES($1,$2,$3,$4)',[u.rows[0].id,script_name,price,'active']);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/user/purchases' && req.method === 'GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isStaff(decoded)) return jsonRes(res,403,{error:'Sem permissão.'});
    const email = new URL('http://x'+req.url).searchParams.get('email');
    try {
      const u = await pool.query('SELECT id,name,email FROM users WHERE email=$1',[email?.toLowerCase()]);
      if (!u.rows.length) return jsonRes(res,404,{error:'Usuário não encontrado.'});
      const p = await pool.query('SELECT * FROM purchases WHERE user_id=$1 ORDER BY purchased_at DESC',[u.rows[0].id]);
      jsonRes(res,200,{user:u.rows[0],purchases:p.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  // ── CHAT ──────────────────────────────────────────────────────────────
  if (urlPath==='/chat/start'&&req.method==='POST') {
    const body=await readBody(req); const id=makeId();
    sessions[id]={id,name:body.name||'Visitante',email:body.email||'',messages:[],open:true};
    sessions[id].messages.push({from:'admin',text:'Olá! Como posso te ajudar? 👋',time:nowTime()});
    notifyAdmin(); jsonRes(res,200,{id}); return;
  }
  if (urlPath==='/chat/send'&&req.method==='POST') {
    const body=await readBody(req); const s=sessions[body.id];
    if(!s){res.writeHead(404,CORS);res.end('{}');return;}
    s.messages.push({from:'visitor',text:body.text,time:nowTime()});
    while(s.visitorWaiting?.length){const r=s.visitorWaiting.shift();try{r.writeHead(200,{'Content-Type':'application/json',...CORS});r.end(JSON.stringify(s.messages));}catch(_){}}
    notifyAdmin(); jsonRes(res,200,{ok:true}); return;
  }
  if (urlPath==='/chat/poll'&&req.method==='GET') {
    const id=new URL('http://x'+req.url).searchParams.get('id');
    const idx=parseInt(new URL('http://x'+req.url).searchParams.get('idx')||'0');
    const s=sessions[id];
    if(!s){res.writeHead(404,CORS);res.end('[]');return;}
    if(s.messages.length>idx){res.writeHead(200,{'Content-Type':'application/json',...CORS});res.end(JSON.stringify(s.messages));return;}
    if(!s.visitorWaiting)s.visitorWaiting=[];
    s.visitorWaiting.push(res);
    const t=setTimeout(()=>{const i=s.visitorWaiting.indexOf(res);if(i>-1)s.visitorWaiting.splice(i,1);try{res.writeHead(200,{'Content-Type':'application/json',...CORS});res.end(JSON.stringify(s.messages));}catch(_){}},25000);
    res.on('close',()=>clearTimeout(t)); return;
  }
  if (urlPath==='/chat/admin/sessions'&&req.method==='GET') {
    const active=getSessions();
    if(active.length){res.writeHead(200,{'Content-Type':'application/json',...CORS});res.end(JSON.stringify(active));return;}
    adminPolls.push(res);
    const t=setTimeout(()=>{const i=adminPolls.indexOf(res);if(i>-1)adminPolls.splice(i,1);try{res.writeHead(200,{'Content-Type':'application/json',...CORS});res.end(JSON.stringify(getSessions()));}catch(_){}},25000);
    res.on('close',()=>clearTimeout(t)); return;
  }
  if (urlPath==='/chat/admin/reply'&&req.method==='POST') {
    const body=await readBody(req);const s=sessions[body.id];
    if(!s){res.writeHead(404,CORS);res.end('{}');return;}
    s.messages.push({from:'admin',text:body.text,time:nowTime()});
    while(s.visitorWaiting?.length){const r=s.visitorWaiting.shift();try{r.writeHead(200,{'Content-Type':'application/json',...CORS});r.end(JSON.stringify(s.messages));}catch(_){}}
    notifyAdmin(); jsonRes(res,200,{ok:true}); return;
  }
  if (urlPath==='/chat/admin/close'&&req.method==='POST') {
    const body=await readBody(req);const s=sessions[body.id];
    if(s){s.open=false;s.messages.push({from:'admin',text:'Conversa encerrada. Obrigado! 👋',time:nowTime()});
    while(s.visitorWaiting?.length){const r=s.visitorWaiting.shift();try{r.writeHead(200,{'Content-Type':'application/json',...CORS});r.end(JSON.stringify(s.messages));}catch(_){}}
    notifyAdmin();}
    jsonRes(res,200,{ok:true}); return;
  }

  // ── ARQUIVOS ESTÁTICOS ────────────────────────────────────────────────
  if (urlPath==='/config.json') {
    fs.readFile(CONFIG_FILE,(err,data)=>{
      if(err){res.writeHead(500);res.end('{}');return;}
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-cache'});res.end(data);
    }); return;
  }

  let filePath;
  if(urlPath.startsWith('/logos/')) filePath=path.join(PUBLIC_DIR,urlPath);
  else if(urlPath.startsWith('/LOGOS DO SITE/')||urlPath.startsWith('/LOGOS%20DO%20SITE/')) filePath=path.join(LOGOS_DIR,urlPath.replace(/^\/LOGOS( DO SITE|%20DO%20SITE)\//,''));
  else filePath=path.join(PUBLIC_DIR,urlPath==='/'?'index.html':urlPath);

  const ext=path.extname(filePath).toLowerCase();
  const ct=MIME[ext]||'application/octet-stream';
  fs.readFile(filePath,(err,data)=>{
    if(err){fs.readFile(path.join(PUBLIC_DIR,'index.html'),(e2,html)=>{if(e2){res.writeHead(404);res.end('404');return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});return;}
    res.writeHead(200,{'Content-Type':ct});res.end(data);
  });
});

server.on('error',err=>{
  if(err.code==='EACCES')console.error('\n  [ERRO] Porta 80 requer Administrador.\n');
  else if(err.code==='EADDRINUSE')console.error('\n  [ERRO] Porta 80 já em uso.\n');
  else console.error(err);
  process.exit(1);
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║      ZK STUDIO — SERVIDOR ON         ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log('  ║  Admin: /staff                       ║');
  console.log('  ╚══════════════════════════════════════╝\n');
  if(!process.env.PORT){const {exec}=require('child_process');setTimeout(()=>exec('start http://zkstudio.local'),800);}
});
