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
const OWNER_EMAIL  = 'arc39491@gmail.com'; // Admin principal

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
      email VARCHAR(150),
      discord_id VARCHAR(50),
      label VARCHAR(100),
      added_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(email),
      UNIQUE(discord_id)
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(200) NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sender_type VARCHAR(10) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      discount_type VARCHAR(10) NOT NULL DEFAULT 'percent',
      discount_value NUMERIC(10,2) NOT NULL,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      valid_until TIMESTAMP,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100) NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      product_price VARCHAR(20) NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      buyer_name VARCHAR(200) NOT NULL,
      buyer_email VARCHAR(200),
      buyer_doc VARCHAR(30),
      items JSONB NOT NULL,
      total VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Migração segura
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE`).catch(()=>{});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id VARCHAR(50) UNIQUE`).catch(()=>{});
  await pool.query(`ALTER TABLE staff_emails ADD COLUMN IF NOT EXISTS discord_id VARCHAR(50)`).catch(()=>{});
  await pool.query(`ALTER TABLE staff_emails ALTER COLUMN email DROP NOT NULL`).catch(()=>{});
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
  const r = await pool.query('SELECT is_staff, is_admin, email, discord_id FROM users WHERE id=$1', [decoded.id]);
  if (!r.rows.length) return false;
  if (r.rows[0].is_staff || r.rows[0].is_admin || r.rows[0].email === OWNER_EMAIL) return true;
  const u = r.rows[0];
  if (u.email) {
    const se = await pool.query('SELECT id FROM staff_emails WHERE email=$1', [u.email]);
    if (se.rows.length) return true;
  }
  if (u.discord_id) {
    const sd = await pool.query('SELECT id FROM staff_emails WHERE discord_id=$1', [u.discord_id]);
    if (sd.rows.length) return true;
  }
  return false;
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
      const u = await pool.query('SELECT id,name,email,discord_id,avatar,is_admin,is_staff,created_at FROM users WHERE id=$1',[decoded.id]);
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
      const users = await pool.query('SELECT id,name,email,discord_id,avatar,is_admin,is_staff,provider,created_at FROM users ORDER BY created_at DESC');
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
    const {email,discord_id,label} = await readBody(req);
    if (!email && !discord_id) return jsonRes(res,400,{error:'Informe o email ou o Discord ID.'});
    try {
      if (email) {
        await pool.query('INSERT INTO staff_emails (email,label) VALUES($1,$2) ON CONFLICT (email) DO UPDATE SET label=$2',[email.toLowerCase(),label||'Staff']);
        await pool.query('UPDATE users SET is_staff=true WHERE email=$1',[email.toLowerCase()]);
      }
      if (discord_id) {
        await pool.query('INSERT INTO staff_emails (discord_id,label) VALUES($1,$2) ON CONFLICT (discord_id) DO UPDATE SET label=$2',[discord_id,label||'Staff']);
        await pool.query('UPDATE users SET is_staff=true WHERE discord_id=$1',[discord_id]);
      }
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath === '/staff/remove' && req.method === 'POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    const {email,discord_id} = await readBody(req);
    if (email === OWNER_EMAIL) return jsonRes(res,403,{error:'Não é possível remover o dono.'});
    try {
      if (email) {
        await pool.query('DELETE FROM staff_emails WHERE email=$1',[email]);
        await pool.query('UPDATE users SET is_staff=false WHERE email=$1',[email]);
      }
      if (discord_id) {
        await pool.query('DELETE FROM staff_emails WHERE discord_id=$1',[discord_id]);
        await pool.query('UPDATE users SET is_staff=false WHERE discord_id=$1',[discord_id]);
      }
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

  // ── SUPORTE ──────────────────────────────────────────────────────────
  if (urlPath==='/support/ticket'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Faça login para abrir um ticket.'});
    const {subject} = await readBody(req);
    if (!subject||!subject.trim()) return jsonRes(res,400,{error:'Informe o assunto.'});
    try {
      const r = await pool.query('INSERT INTO support_tickets (user_id,subject) VALUES($1,$2) RETURNING id,subject,status,created_at,updated_at',[decoded.id,subject.trim()]);
      jsonRes(res,200,{ticket:r.rows[0]});
    } catch(e) { jsonRes(res,500,{error:'Erro ao criar ticket.'}); }
    return;
  }

  if (urlPath==='/support/tickets'&&req.method==='GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Não autorizado.'});
    try {
      const staff = await isStaff(decoded);
      let r;
      if (staff) {
        r = await pool.query(`SELECT t.*, u.name as user_name, u.email as user_email,
          (SELECT COUNT(*) FROM support_messages WHERE ticket_id=t.id) as msg_count,
          (SELECT message FROM support_messages WHERE ticket_id=t.id ORDER BY created_at DESC LIMIT 1) as last_msg
          FROM support_tickets t LEFT JOIN users u ON t.user_id=u.id ORDER BY t.updated_at DESC`);
      } else {
        r = await pool.query(`SELECT t.*,
          (SELECT COUNT(*) FROM support_messages WHERE ticket_id=t.id) as msg_count,
          (SELECT message FROM support_messages WHERE ticket_id=t.id ORDER BY created_at DESC LIMIT 1) as last_msg
          FROM support_tickets t WHERE t.user_id=$1 ORDER BY t.updated_at DESC`,[decoded.id]);
      }
      jsonRes(res,200,{tickets:r.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath==='/support/message'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Não autorizado.'});
    const {ticket_id,message} = await readBody(req);
    if (!ticket_id||!message||!message.trim()) return jsonRes(res,400,{error:'Mensagem vazia.'});
    try {
      const t = await pool.query('SELECT * FROM support_tickets WHERE id=$1',[ticket_id]);
      if (!t.rows.length) return jsonRes(res,404,{error:'Ticket não encontrado.'});
      const ticket = t.rows[0];
      const staff = await isStaff(decoded);
      if (ticket.user_id !== decoded.id && !staff) return jsonRes(res,403,{error:'Sem permissão.'});
      const senderType = staff ? 'staff' : 'user';
      const r = await pool.query('INSERT INTO support_messages (ticket_id,sender_id,sender_type,message) VALUES($1,$2,$3,$4) RETURNING id,sender_id,sender_type,message,created_at',[ticket_id,decoded.id,senderType,message.trim()]);
      await pool.query('UPDATE support_tickets SET updated_at=NOW() WHERE id=$1',[ticket_id]);
      jsonRes(res,200,{msg:r.rows[0]});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath==='/support/messages'&&req.method==='GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Não autorizado.'});
    const ticketId = new URL('http://x'+req.url).searchParams.get('ticket_id');
    if (!ticketId) return jsonRes(res,400,{error:'ticket_id obrigatório.'});
    try {
      const t = await pool.query('SELECT * FROM support_tickets WHERE id=$1',[ticketId]);
      if (!t.rows.length) return jsonRes(res,404,{error:'Ticket não encontrado.'});
      const ticket = t.rows[0];
      const staff = await isStaff(decoded);
      if (ticket.user_id !== decoded.id && !staff) return jsonRes(res,403,{error:'Sem permissão.'});
      const r = await pool.query(`SELECT sm.*, u.name as sender_name FROM support_messages sm
        LEFT JOIN users u ON sm.sender_id=u.id WHERE sm.ticket_id=$1 ORDER BY sm.created_at ASC`,[ticketId]);
      jsonRes(res,200,{messages:r.rows,ticket});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath==='/support/close'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isStaff(decoded)) return jsonRes(res,403,{error:'Apenas staff.'});
    const {ticket_id} = await readBody(req);
    if (!ticket_id) return jsonRes(res,400,{error:'ticket_id obrigatório.'});
    try {
      await pool.query("UPDATE support_tickets SET status='closed',updated_at=NOW() WHERE id=$1",[ticket_id]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  if (urlPath==='/support/reopen'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded) return jsonRes(res,401,{error:'Não autorizado.'});
    const {ticket_id} = await readBody(req);
    if (!ticket_id) return jsonRes(res,400,{error:'ticket_id obrigatório.'});
    try {
      const t = await pool.query('SELECT * FROM support_tickets WHERE id=$1',[ticket_id]);
      if (!t.rows.length) return jsonRes(res,404,{error:'Ticket não encontrado.'});
      const ticket = t.rows[0];
      const staff = await isStaff(decoded);
      if (ticket.user_id !== decoded.id && !staff) return jsonRes(res,403,{error:'Sem permissão.'});
      await pool.query("UPDATE support_tickets SET status='open',updated_at=NOW() WHERE id=$1",[ticket_id]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  // ── CHAT (LEGADO) ────────────────────────────────────────────────────
  if (urlPath==='/chat/start'&&req.method==='POST') {
    const body=await readBody(req); const id=makeId();
    sessions[id]={id,name:body.name||'Visitante',email:body.email||'',messages:[],open:true};
    sessions[id].messages.push({from:'admin',text:'Olá! Como posso te ajudar? 👋',time:nowTime()});
    try {
      const guestUser = await pool.query("SELECT id FROM users WHERE name=$1 LIMIT 1",[body.name||'Visitante']);
      const userId = guestUser.rows.length ? guestUser.rows[0].id : null;
      const t = await pool.query("INSERT INTO support_tickets (user_id,subject) VALUES($1,$2) RETURNING id",[userId,'Chat: '+id]);
      sessions[id].db_ticket_id = t.rows[0].id;
      await pool.query("INSERT INTO support_messages (ticket_id,sender_id,sender_type,message) VALUES($1,$2,'staff',$3)",[t.rows[0].id,null,'Olá! Como posso te ajudar? 👋']);
    } catch(_){}
    notifyAdmin(); jsonRes(res,200,{id}); return;
  }
  if (urlPath==='/chat/send'&&req.method==='POST') {
    const body=await readBody(req); const s=sessions[body.id];
    if(!s){res.writeHead(404,CORS);res.end('{}');return;}
    s.messages.push({from:'visitor',text:body.text,time:nowTime()});
    try {
      if (s.db_ticket_id) {
        await pool.query("INSERT INTO support_messages (ticket_id,sender_id,sender_type,message) VALUES($1,$2,'user',$3)",[s.db_ticket_id,null,body.text]);
        await pool.query("UPDATE support_tickets SET updated_at=NOW() WHERE id=$1",[s.db_ticket_id]);
      }
    } catch(_){}
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
    try {
      if (s.db_ticket_id) {
        await pool.query("INSERT INTO support_messages (ticket_id,sender_id,sender_type,message) VALUES($1,$2,'staff',$3)",[s.db_ticket_id,null,body.text]);
        await pool.query("UPDATE support_tickets SET updated_at=NOW() WHERE id=$1",[s.db_ticket_id]);
      }
    } catch(_){}
    while(s.visitorWaiting?.length){const r=s.visitorWaiting.shift();try{r.writeHead(200,{'Content-Type':'application/json',...CORS});r.end(JSON.stringify(s.messages));}catch(_){}}
    notifyAdmin(); jsonRes(res,200,{ok:true}); return;
  }
  if (urlPath==='/chat/admin/close'&&req.method==='POST') {
    const body=await readBody(req);const s=sessions[body.id];
    if(s){s.open=false;s.messages.push({from:'admin',text:'Conversa encerrada. Obrigado! 👋',time:nowTime()});
    try {
      if (s.db_ticket_id) {
        await pool.query("INSERT INTO support_messages (ticket_id,sender_id,sender_type,message) VALUES($1,$2,'staff',$3)",[s.db_ticket_id,null,'Conversa encerrada. Obrigado! 👋']);
        await pool.query("UPDATE support_tickets SET status='closed',updated_at=NOW() WHERE id=$1",[s.db_ticket_id]);
      }
    } catch(_){}
    while(s.visitorWaiting?.length){const r=s.visitorWaiting.shift();try{r.writeHead(200,{'Content-Type':'application/json',...CORS});r.end(JSON.stringify(s.messages));}catch(_){}}
    notifyAdmin();}
    jsonRes(res,200,{ok:true}); return;
  }

  // ── CUPONS ────────────────────────────────────────────────────────────
  if (urlPath==='/coupon/validate'&&req.method==='POST') {
    const {code} = await readBody(req);
    if (!code) return jsonRes(res,400,{error:'Informe o cupom.'});
    try {
      const r = await pool.query("SELECT * FROM coupons WHERE code=$1 AND active=true",[code.toUpperCase()]);
      if (!r.rows.length) return jsonRes(res,404,{error:'Cupom não encontrado.'});
      const c = r.rows[0];
      if (c.valid_until && new Date(c.valid_until) < new Date()) return jsonRes(res,400,{error:'Cupom expirado.'});
      if (c.max_uses > 0 && c.used_count >= c.max_uses) return jsonRes(res,400,{error:'Cupom atingiu o limite de uso.'});
      jsonRes(res,200,{coupon:{code:c.code,discount_type:c.discount_type,discount_value:parseFloat(c.discount_value)}});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/coupon/list'&&req.method==='GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    try {
      const r = await pool.query("SELECT * FROM coupons ORDER BY created_at DESC");
      jsonRes(res,200,{coupons:r.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/coupon/create'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    const {code,discount_type,discount_value,max_uses,valid_until} = await readBody(req);
    if (!code||!discount_value) return jsonRes(res,400,{error:'Preencha código e valor.'});
    try {
      await pool.query("INSERT INTO coupons (code,discount_type,discount_value,max_uses,valid_until) VALUES($1,$2,$3,$4,$5)",
        [code.toUpperCase(),discount_type||'percent',discount_value,max_uses||0,valid_until||null]);
      jsonRes(res,200,{ok:true});
    } catch(e) {
      if (e.code==='23505') return jsonRes(res,409,{error:'Cupom já existe.'});
      jsonRes(res,500,{error:'Erro.'});
    }
    return;
  }
  if (urlPath==='/coupon/delete'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isAdmin(decoded)) return jsonRes(res,403,{error:'Apenas admin.'});
    const {code} = await readBody(req);
    try {
      await pool.query("DELETE FROM coupons WHERE code=$1",[code.toUpperCase()]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/coupon/use'&&req.method==='POST') {
    const {code} = await readBody(req);
    if (!code) return jsonRes(res,400,{error:'Cupom obrigatório.'});
    try {
      await pool.query("UPDATE coupons SET used_count=used_count+1 WHERE code=$1",[code.toUpperCase()]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  // ── CARRINHO ─────────────────────────────────────────────────────────
  if (urlPath==='/cart/add'&&req.method==='POST') {
    const {session_id,product_name,product_price,quantity} = await readBody(req);
    if (!session_id||!product_name) return jsonRes(res,400,{error:'Dados obrigatórios.'});
    try {
      const exist = await pool.query("SELECT * FROM cart_items WHERE session_id=$1 AND product_name=$2",[session_id,product_name]);
      if (exist.rows.length) {
        await pool.query("UPDATE cart_items SET quantity=quantity+$1 WHERE id=$2",[quantity||1,exist.rows[0].id]);
      } else {
        await pool.query("INSERT INTO cart_items (session_id,product_name,product_price,quantity) VALUES($1,$2,$3,$4)",
          [session_id,product_name,product_price||'R$ 0,00',quantity||1]);
      }
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/cart/items'&&req.method==='GET') {
    const sid = new URL('http://x'+req.url).searchParams.get('session_id');
    if (!sid) return jsonRes(res,400,{error:'session_id obrigatório.'});
    try {
      const r = await pool.query("SELECT * FROM cart_items WHERE session_id=$1 ORDER BY created_at ASC",[sid]);
      jsonRes(res,200,{items:r.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/cart/remove'&&req.method==='POST') {
    const {id} = await readBody(req);
    if (!id) return jsonRes(res,400,{error:'ID obrigatório.'});
    try {
      await pool.query("DELETE FROM cart_items WHERE id=$1",[id]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/cart/update'&&req.method==='POST') {
    const {id,quantity} = await readBody(req);
    if (!id||quantity===undefined) return jsonRes(res,400,{error:'Dados obrigatórios.'});
    try {
      if (quantity <= 0) await pool.query("DELETE FROM cart_items WHERE id=$1",[id]);
      else await pool.query("UPDATE cart_items SET quantity=$1 WHERE id=$2",[quantity,id]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/cart/clear'&&req.method==='POST') {
    const {session_id} = await readBody(req);
    if (!session_id) return jsonRes(res,400,{error:'session_id obrigatório.'});
    try {
      await pool.query("DELETE FROM cart_items WHERE session_id=$1",[session_id]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  // ── PEDIDOS ──────────────────────────────────────────────────────────
  if (urlPath==='/order/create'&&req.method==='POST') {
    const {buyer_name,buyer_email,buyer_doc,items,total} = await readBody(req);
    if (!buyer_name||!items||!total) return jsonRes(res,400,{error:'Dados obrigatórios.'});
    try {
      const r = await pool.query("INSERT INTO orders (buyer_name,buyer_email,buyer_doc,items,total) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at",
        [buyer_name,buyer_email||null,buyer_doc||null,JSON.stringify(items),total]);
      jsonRes(res,200,{order:r.rows[0]});
    } catch(e) { jsonRes(res,500,{error:'Erro ao criar pedido.'}); }
    return;
  }
  if (urlPath==='/order/list'&&req.method==='GET') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isStaff(decoded)) return jsonRes(res,403,{error:'Apenas staff.'});
    try {
      const r = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
      jsonRes(res,200,{orders:r.rows});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }
  if (urlPath==='/order/update-status'&&req.method==='POST') {
    const decoded = verifyToken(getToken(req));
    if (!decoded||!await isStaff(decoded)) return jsonRes(res,403,{error:'Apenas staff.'});
    const {order_id,status} = await readBody(req);
    if (!order_id||!status) return jsonRes(res,400,{error:'Dados obrigatórios.'});
    try {
      await pool.query("UPDATE orders SET status=$1 WHERE id=$2",[status,order_id]);
      jsonRes(res,200,{ok:true});
    } catch(e) { jsonRes(res,500,{error:'Erro.'}); }
    return;
  }

  // ── TICKET DISCORD ──────────────────────────────────────────────────
  if (urlPath==='/ticket/create'&&req.method==='POST') {
    const {script_name, price, user_name, user_email} = await readBody(req);
    if (!script_name||!price) return jsonRes(res,400,{error:'Dados obrigatórios.'});
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'));
      const botToken = cfg.discord?.bot_token;
      const categoryId = cfg.discord?.ticket_category_id;
      if (!botToken||!categoryId) return jsonRes(res,500,{error:'Discord não configurado.'});

      // Busca o guild do bot
      const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: 'Bot ' + botToken }
      });
      const guilds = await guildsRes.json();
      if (!guilds.length) return jsonRes(res,500,{error:'Bot não está em nenhum servidor.'});
      const guildId = guilds[0].id;

      // Cria canal na categoria de compras
      const channelName = 'compra-' + (user_name||'user').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').substring(0,20) + '-' + Date.now().toString(36);
      const createRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'POST',
        headers: { Authorization: 'Bot ' + botToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelName,
          type: 0,
          parent_id: categoryId,
          topic: `Compra: ${script_name} | ${user_name||'Anônimo'} | ${user_email||'sem email'}`
        })
      });
      const channel = await createRes.json();
      if (channel.code) return jsonRes(res,500,{error:'Erro ao criar canal: '+channel.message});

      // Envia mensagem de boas-vindas no canal
      const embed = {
        embeds: [{
          title: '🛒 Nova Compra',
          color: 0x1A56DB,
          fields: [
            { name: 'Script', value: script_name, inline: true },
            { name: 'Preço', value: price, inline: true },
            { name: 'Comprador', value: user_name||'Anônimo', inline: true },
            { name: 'Email', value: user_email||'Não informado', inline: true }
          ],
          footer: { text: 'ZK Studio — Sistema de Tickets' },
          timestamp: new Date().toISOString()
        }]
      };
      await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { Authorization: 'Bot ' + botToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(embed)
      });

      // Salva pedido no banco
      try {
        await pool.query("INSERT INTO orders (buyer_name,buyer_email,items,total) VALUES($1,$2,$3,$4)",
          [user_name||null, user_email||null, JSON.stringify([{name:script_name,price}]), price]);
      } catch(_){}

      const discordUrl = `https://discord.com/channels/${guildId}/${channel.id}`;
      jsonRes(res,200,{ok:true, channel_id: channel.id, url: discordUrl, guild_id: guildId});
    } catch(e) { jsonRes(res,500,{error:'Erro ao criar ticket: '+e.message}); }
    return;
  }

  // ── DISCORD OAUTH ────────────────────────────────────────────────────
  if (urlPath==='/auth/discord'&&req.method==='GET') {
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')); } catch { cfg = {}; }
    const dc = cfg.discord || {};
    if (!dc.client_id) { res.writeHead(302,{'Location':'/auth.html?error=discord_not_configured'}); res.end(); return; }
    const redirectUri = dc.redirect_uri || (req.headers.origin || '') + '/auth/discord/callback';
    const discordUrl = 'https://discord.com/api/oauth2/authorize?client_id='+encodeURIComponent(dc.client_id)+'&redirect_uri='+encodeURIComponent(redirectUri)+'&response_type=code&scope=identify%20email';
    res.writeHead(302,{'Location':discordUrl}); res.end(); return;
  }
  if (urlPath==='/auth/discord/callback'&&req.method==='GET') {
    const urlParams = new URL('http://x'+req.url).searchParams;
    const code = urlParams.get('code');
    if (!code) { res.writeHead(302,{'Location':'/auth.html?error=no_code'}); res.end(); return; }
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')); } catch { cfg = {}; }
    const dc = cfg.discord || {};
    const redirectUri = dc.redirect_uri || (req.headers.origin || '') + '/auth/discord/callback';
    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token',{
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:dc.client_id,client_secret:dc.client_secret,grant_type:'authorization_code',code,redirect_uri:redirectUri}).toString()
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) { res.writeHead(302,{'Location':'/auth.html?error=token_failed'}); res.end(); return; }
      const userRes = await fetch('https://discord.com/api/users/@me',{headers:{'Authorization':'Bearer '+tokenData.access_token}});
      const dUser = await userRes.json();
      if (!dUser.id) { res.writeHead(302,{'Location':'/auth.html?error=user_failed'}); res.end(); return; }
      const discordId = dUser.id;
      const discordName = dUser.username;
      const discordAvatar = dUser.avatar ? 'https://cdn.discordapp.com/avatars/'+discordId+'/'+dUser.avatar+'.png' : null;
      const discordEmail = dUser.email || null;
      // Procura ou cria usuário
      let user = null;
      const existing = await pool.query("SELECT * FROM users WHERE discord_id=$1",[discordId]);
      if (existing.rows.length) {
        user = existing.rows[0];
        await pool.query("UPDATE users SET name=$1,avatar=$2 WHERE id=$3",[discordName,discordAvatar,user.id]);
      } else {
        const emailToUse = discordEmail || (discordId+'@discord.local');
        const emailExists = await pool.query("SELECT * FROM users WHERE email=$1",[emailToUse.toLowerCase()]);
        if (emailExists.rows.length) {
          user = emailExists.rows[0];
          await pool.query("UPDATE users SET discord_id=$1,name=$2,avatar=$3,provider='discord' WHERE id=$4",[discordId,discordName,discordAvatar,user.id]);
        } else {
          const r = await pool.query("INSERT INTO users (name,email,discord_id,avatar,provider) VALUES($1,$2,$3,$4,'discord') RETURNING *",[discordName,emailToUse.toLowerCase(),discordId,discordAvatar]);
          user = r.rows[0];
        }
      }
      const jwtToken = jwt.sign({id:user.id,email:user.email},JWT_SECRET,{expiresIn:'30d'});
      const userData = encodeURIComponent(JSON.stringify({id:user.id,name:user.name,email:user.email,avatar:user.avatar||discordAvatar}));
      res.writeHead(302,{'Location':'/?discord_token='+jwtToken+'&discord_user='+userData}); res.end();
    } catch(e) {
      console.error('Discord OAuth error:',e);
      res.writeHead(302,{'Location':'/auth.html?error=oauth_failed'}); res.end();
    }
    return;
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
