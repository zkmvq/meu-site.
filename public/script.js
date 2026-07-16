// === ZK STUDIO — SCRIPT.JS ===

// ── CURSOR COM DELAY ──────────────────────────────────────────────────
(function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;
  let mx = innerWidth / 2, my = innerHeight / 2;
  let rx = mx, ry = my;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });
  (function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(loop);
  })();

  const targets = 'a,button,.btn-primary,.btn-secondary,.btn-nav,.btn-comprar,.produto-card,.dep-card,.feature-card,input,textarea,[onclick]';
  document.querySelectorAll(targets).forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
  document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
  document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-click'));
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
})();

// ── CARD GLOW SEGUINDO O MOUSE ────────────────────────────────────────
document.querySelectorAll('[data-tilt]').forEach(card => {
  const glow = card.querySelector('.card-glow');
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (glow) { glow.style.left = x + 'px'; glow.style.top = y + 'px'; }
    const rx = ((y / r.height) - 0.5) * 8;
    const ry = ((x / r.width)  - 0.5) * -8;
    card.style.transform = `translateY(-7px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    card.style.transition = 'transform 0.1s, box-shadow 0.3s, border-color 0.3s';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'all 0.4s';
  });
});

// ── CONFIG ────────────────────────────────────────────────────────────
async function carregarConfig() {
  try {
    const cfg = await fetch('/config.json').then(r => r.json());
    const c = cfg.contato || {};
    ['discord','whatsapp','instagram','youtube'].forEach(k => {
      document.querySelectorAll(`[data-link="${k}"]`).forEach(el => { if(c[k]) el.href = c[k]; });
    });
    document.querySelectorAll('[data-text="discord"]').forEach(el => { if(c.discord) el.textContent = c.discord.replace('https://',''); });
    document.querySelectorAll('[data-text="email"]').forEach(el => { if(c.email) el.textContent = c.email; });
    document.querySelectorAll('[data-text="instagram"]').forEach(el => {
      if(c.instagram) el.textContent = '@' + c.instagram.replace(/https?:\/\/(www\.)?instagram\.com\//,'');
    });
    if(cfg.rodape?.copyright) document.querySelectorAll('[data-text="copyright"]').forEach(el => el.textContent = cfg.rodape.copyright);
  } catch(e) { console.warn('Config:', e); }
}
carregarConfig();

// ── FLOATING LETTERS ──────────────────────────────────────────────────
(function() {
  const c = document.getElementById('bgLetters');
  if (!c) return;
  const chars = [
    '0','1','{','}','[',']','(',')',';','=','>','<','/',
    '*','Z','K','f','n','x','i','let','var','if','fn','=>','::'
  ];
  const count = 80;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.classList.add('bg-letter');
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.top  = '110vh';
    s.style.fontSize = (Math.random() * 1.1 + 0.6) + 'rem';
    s.style.opacity  = (Math.random() * 0.6 + 0.2) + '';
    s.style.animationDuration = (Math.random() * 18 + 10) + 's';
    s.style.animationDelay    = '-' + (Math.random() * 25) + 's';
    // Alguns maiores e mais brilhantes
    if (Math.random() > 0.85) {
      s.style.fontSize = (Math.random() * 1.5 + 1.2) + 'rem';
      s.style.color = 'rgba(96,165,250,0.15)';
    }
    c.appendChild(s);
  }
})();

// ── NAVBAR AUTH ───────────────────────────────────────────────────────
(function initNavAuth() {
  const loginBtn = document.getElementById('navLoginBtn');
  const userBtn  = document.getElementById('navUserBtn');
  const avatar   = document.getElementById('navUserAvatar');
  const nameEl   = document.getElementById('navUserName');
  if (!loginBtn) return;

  const token = localStorage.getItem('zk_token');
  if (!token) return; // mostra "Entrar" por padrão

  // Tem token — verifica se é válido
  fetch('/auth/me', { headers:{ Authorization:'Bearer '+token } })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d || !d.user) {
        localStorage.removeItem('zk_token');
        return; // mantém "Entrar"
      }
      // Logado — troca para nome do usuário
      loginBtn.style.display = 'none';
      userBtn.style.display  = 'inline-flex';
      avatar.textContent     = d.user.name.charAt(0).toUpperCase();
      nameEl.textContent     = d.user.name.split(' ')[0];
      localStorage.setItem('zk_user', JSON.stringify(d.user));
    })
    .catch(() => {}); // mantém "Entrar" em caso de erro
})();


window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', scrollY > 50);

  // Scroll progress bar
  const prog = document.getElementById('scroll-progress');
  if (prog) {
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (scrollY / h * 100) + '%';
  }

  // Navbar link ativo por seção
  const sections = document.querySelectorAll('section[id]');
  let current = '';
  sections.forEach(s => {
    if (scrollY >= s.offsetTop - 120) current = s.id;
  });
  document.querySelectorAll('.nav-links a[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === current);
  });
});

// ── SMOOTH SCROLL ─────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior:'smooth' }); }
  });
});

// ── MOBILE NAV ────────────────────────────────────────────────────────
document.getElementById('navToggle')?.addEventListener('click', () => {
  const nl = document.querySelector('.nav-links');
  const bn = document.querySelector('.btn-nav');
  if (!nl) return;
  const open = nl.style.display === 'flex';
  Object.assign(nl.style, {
    display: open ? 'none' : 'flex', flexDirection:'column',
    position:'absolute', top:'68px', left:'0', right:'0',
    background:'rgba(3,8,28,0.97)', padding:'1.5rem 2rem',
    borderBottom:'1px solid rgba(26,86,219,0.2)', zIndex:'999'
  });
  if (bn) bn.style.display = open ? 'none' : 'block';
});

// ── COUNTER ───────────────────────────────────────────────────────────
function counter(el, to, dur=2200) {
  let n=0; const step=to/(dur/16);
  const t=setInterval(()=>{ n=Math.min(n+step,to); el.textContent=Math.floor(n)+(el.dataset.suffix||''); if(n>=to)clearInterval(t); },16);
}
new IntersectionObserver((en) => {
  en.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.stat-num').forEach(n => counter(n, parseInt(n.dataset.target)));
      statsObs.unobserve(e.target);
    }
  });
}, { threshold:0.5 }).observe(document.querySelector('.stats') || document.body);
// fix ref
const statsObs = new IntersectionObserver((en) => {
  en.forEach(e => { if(e.isIntersecting){ e.target.querySelectorAll('.stat-num').forEach(n=>counter(n,parseInt(n.dataset.target))); statsObs.unobserve(e.target); } });
},{ threshold:0.5 });
const statsSec = document.querySelector('.stats');
if(statsSec) statsObs.observe(statsSec);

// ── FADE IN SCROLL ────────────────────────────────────────────────────
const fadeObs = new IntersectionObserver((en) => {
  en.forEach(e => { if(e.isIntersecting){ e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; } });
},{ threshold:0.08 });
document.querySelectorAll('.produto-card,.dep-card,.contato-item,.feature-card').forEach((el,i) => {
  el.style.opacity='0';
  el.style.transform='translateY(30px)';
  el.style.transition=`opacity 0.5s ease ${i*0.07}s, transform 0.5s ease ${i*0.07}s`;
  fadeObs.observe(el);
});

// ── MODAL ─────────────────────────────────────────────────────────────
function openModal(name, price) {
  document.getElementById('modalTitle').textContent = name;
  document.getElementById('modalPrice').textContent = price;
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

// ── TOAST ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3500);
}
function enviarMensagem(e) {
  e.preventDefault();
  showToast('✅ Mensagem enviada! Falaremos em breve.');
  e.target.reset();
}

// ── CODE TYPING — letra por letra ─────────────────────────────────────
(function codeRewrite() {
  // Cada snippet: array de { ln, text, color }
  // color: 'comment' | 'key' | 'fn' | 'str' | 'var' | 'op' | ''
  const snippets = [
    [
      { ln:'1',  text:'-- ZK Studio Premium Script', color:'comment' },
      { ln:'2',  text:'local ZK = {}',               color:'mixed1' },
      { ln:'3',  text:'',                             color:'' },
      { ln:'4',  text:'function ZK.Initialize()',     color:'mixed2' },
      { ln:'5',  text:'  print("ZK Studio!")',        color:'mixed3' },
      { ln:'6',  text:'  ZK.Setup()',                 color:'mixed4' },
      { ln:'7',  text:'end',                          color:'key' },
      { ln:'8',  text:'',                             color:'' },
      { ln:'9',  text:"AddEventHandler('onResourceStart',", color:'mixed5' },
      { ln:'10', text:'  function() ZK.Initialize() end)', color:'mixed6' },
    ],
    [
      { ln:'1',  text:'-- Sistema HUD ZK Studio',    color:'comment' },
      { ln:'2',  text:'local HUD = {}',              color:'mixed1' },
      { ln:'3',  text:'',                            color:'' },
      { ln:'4',  text:"RegisterNetEvent('zk:hud')", color:'fn' },
      { ln:'5',  text:"AddEventHandler('zk:hud',",  color:'fn' },
      { ln:'6',  text:'  function(data)',            color:'mixed2' },
      { ln:'7',  text:'    HUD.Update(data)',        color:'mixed4' },
      { ln:'8',  text:'  end)',                      color:'key' },
      { ln:'9',  text:'',                            color:'' },
      { ln:'10', text:'return HUD',                  color:'mixed6' },
    ],
    [
      { ln:'1',  text:'-- Economy System ZK',        color:'comment' },
      { ln:'2',  text:'local Economy = {}',          color:'mixed1' },
      { ln:'3',  text:'',                            color:'' },
      { ln:'4',  text:'function Economy.Get(src)',   color:'mixed2' },
      { ln:'5',  text:"  local bal = exports[",     color:'mixed3' },
      { ln:'6',  text:"    'zk-bank']:GetMoney(src)",color:'str' },
      { ln:'7',  text:'  return bal',               color:'mixed4' },
      { ln:'8',  text:'end',                        color:'key' },
      { ln:'9',  text:'',                           color:'' },
      { ln:'10', text:'return Economy',             color:'mixed6' },
    ],
  ];

  // Mapeia cores simples para classes CSS
  function colorClass(c) {
    const map = {
      comment:'c-comment', key:'c-key', fn:'c-fn',
      str:'c-str', var:'c-var', op:'c-op',
      mixed1:'c-var', mixed2:'c-fn', mixed3:'c-str',
      mixed4:'c-var', mixed5:'c-fn', mixed6:'c-op',
    };
    return map[c] || '';
  }

  const body = document.getElementById('codeBody');
  if (!body) return;

  let snIdx = 0;

  function typeSnippet(lines, onDone) {
    body.innerHTML = '';
    let li = 0; // índice da linha atual

    function nextLine() {
      if (li >= lines.length) {
        // cursor piscando no final
        const last = body.lastElementChild;
        if (last) {
          const cur = document.createElement('span');
          cur.className = 'cursor-blink';
          cur.textContent = '█';
          last.appendChild(cur);
        }
        // Aguarda 2.5s mostrando o código completo, depois chama cycle
        setTimeout(() => {
          onDone();
        }, 2500);
        return;
      }

      const line = lines[li++];

      // Cria a div da linha com número
      const div = document.createElement('div');
      div.className = 'code-line';
      const lnSpan = document.createElement('span');
      lnSpan.className = 'ln';
      lnSpan.textContent = line.ln;
      div.appendChild(lnSpan);

      // Span do conteúdo que vai sendo preenchido
      const contentSpan = document.createElement('span');
      const cls = colorClass(line.color);
      if (cls) contentSpan.className = cls;
      div.appendChild(contentSpan);

      // Cursor de digitação
      const cur = document.createElement('span');
      cur.className = 'cursor-blink';
      cur.textContent = '█';
      div.appendChild(cur);

      body.appendChild(div);
      body.scrollTop = body.scrollHeight;

      // Digita letra por letra
      const chars = line.text.split('');
      let ci = 0;

      function typeChar() {
        if (ci >= chars.length) {
          // Remove cursor desta linha, vai pra próxima
          cur.remove();
          setTimeout(nextLine, 60);
          return;
        }
        contentSpan.textContent += chars[ci++];
        body.scrollTop = body.scrollHeight;
        // Velocidade: 28ms por caractere — rápido como digitação real
        setTimeout(typeChar, 28);
      }

      // Linha vazia: só pausa
      if (chars.length === 0) {
        cur.remove();
        setTimeout(nextLine, 80);
      } else {
        typeChar();
      }
    }

    nextLine();
  }

  function cycle() {
    const lines = snippets[snIdx % snippets.length];
    snIdx++;

    body.style.transition = 'opacity 0.35s';
    body.style.opacity = '0';

    setTimeout(() => {
      body.innerHTML = '';
      body.style.opacity = '1';
      typeSnippet(lines, cycle);
    }, 400);
  }

  setTimeout(cycle, 800);
})();

// ── GLITCH ────────────────────────────────────────────────────────────
(function() {
  const title = document.querySelector('.hero-title');
  if (!title) return;
  function glitch() {
    title.classList.add('glitching');
    setTimeout(()=>title.classList.remove('glitching'), 420);
  }
  setTimeout(()=>{ glitch(); setInterval(glitch, 3000); }, 1200);
})();


// ==============================
//   WIDGET DE SUPORTE — CHAT
// ==============================
(function() {
  let chatOpen    = false;
  let sessionId   = null;
  let msgCount    = 0;
  let polling     = false;
  let chatClosed  = false;

  window.toggleChat = function() {
    chatOpen = !chatOpen;
    const box   = document.getElementById('chat-box');
    const badge = document.getElementById('chat-unread-badge');
    box.style.display = chatOpen ? 'flex' : 'none';
    if (chatOpen) {
      badge.style.display = 'none';
      if (sessionId) {
        setTimeout(() => {
          const el = document.getElementById('chat-messages');
          if (el) el.scrollTop = el.scrollHeight;
          document.getElementById('chat-input')?.focus();
        }, 100);
      }
    }
    // Troca ícone
    const icon = document.getElementById('chat-toggle-icon');
    icon.innerHTML = chatOpen
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  };

  window.iniciarChat = async function() {
    const name = document.getElementById('chat-name-input').value.trim() || 'Visitante';
    try {
      const r = await fetch('/chat/start', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name })
      });
      const data = await r.json();
      sessionId = data.id;

      // Troca telas
      document.getElementById('chat-start-screen').style.display   = 'none';
      document.getElementById('chat-active-screen').style.display  = 'flex';

      // Inicia polling
      startPolling();
      setTimeout(() => document.getElementById('chat-input')?.focus(), 100);
    } catch(e) {
      alert('Não foi possível conectar ao suporte. Tente novamente.');
    }
  };

  window.enviarMensagem = async function() {
    if (!sessionId || chatClosed) return;
    const inp  = document.getElementById('chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    inp.style.height = '';

    // Adiciona mensagem localmente já
    addMsg({ from:'visitor', text, time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) });

    try {
      await fetch('/chat/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id: sessionId, text })
      });
    } catch(e) {}
  };

  window.chatKeyDown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
  };

  window.chatAutoResize = function(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  function addMsg(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `cb-msg from-${msg.from}`;
    div.innerHTML = `
      <div class="cb-msg-avatar">
        ${msg.from === 'admin'
          ? '<img src="../LOGOS DO SITE/ZK STUDIO SEM FUNDO.png" alt="ZK" />'
          : '👤'}
      </div>
      <div>
        <div class="cb-msg-bubble">${escapeHtml(msg.text)}</div>
        <div class="cb-msg-time">${msg.time}</div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Notifica se chat estiver fechado
    if (!chatOpen && msg.from === 'admin') {
      const badge = document.getElementById('chat-unread-badge');
      badge.style.display = 'flex';
      badge.textContent = parseInt(badge.textContent || '0') + 1;
      playBip();
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  function playBip() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 660; g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    } catch(_) {}
  }

  function startPolling() {
    if (polling) return;
    polling = true;
    pollMessages();
  }

  async function pollMessages() {
    if (!sessionId) return;
    try {
      const r = await fetch(`/chat/poll?id=${sessionId}&idx=${msgCount}`);
      const msgs = await r.json();
      // Só renderiza mensagens novas
      if (msgs.length > msgCount) {
        for (let i = msgCount; i < msgs.length; i++) {
          // Evita duplicar mensagens do próprio visitante (já adicionadas localmente)
          if (msgs[i].from === 'admin') addMsg(msgs[i]);
          // Verifica se a sessão foi encerrada
          if (msgs[i].from === 'admin' && msgs[i].text.includes('encerrada')) {
            chatClosed = true;
            document.getElementById('chat-input-wrap').style.display = 'none';
            document.getElementById('chat-closed-notice').style.display = 'block';
          }
        }
        msgCount = msgs.length;
      }
    } catch(e) {}
    if (!chatClosed) setTimeout(pollMessages, 300);
  }
})();
