// === ZK STUDIO — SCRIPT.JS ===

// ── DISCORD TOKEN CAPTURE + AUTO BUY ──────────────────────────────────
(function() {
  const params = new URLSearchParams(window.location.search);
  const dToken = params.get('discord_token');
  const dUser  = params.get('discord_user');
  if (dToken && dUser) {
    localStorage.setItem('zk_token', dToken);
    try { localStorage.setItem('zk_user', decodeURIComponent(dUser)); } catch(_) {}
    window.history.replaceState({}, '', '/');

    // Verifica se tem compra pendente e cria o ticket automaticamente
    const pending = localStorage.getItem('zk_pending_buy');
    if (pending) {
      localStorage.removeItem('zk_pending_buy');
      const buy = JSON.parse(pending);
      setTimeout(async () => {
        try {
          showToast('Login realizado! Abrindo ticket...');
          const r = await fetch('/ticket/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buy)
          });
          const d = await r.json();
          if (d.ok && d.url) {
            showToast('Ticket criado! Abrindo Discord...');
            setTimeout(() => { window.open(d.url, '_blank'); }, 500);
          } else {
            showToast(d.error || 'Erro ao criar ticket.');
          }
        } catch(_) {
          showToast('Erro ao criar ticket.');
        }
      }, 1000);
    }
  }
})();

// ── CURSOR COM DELAY ──────────────────────────────────────────────────
(function initCursor() {
  const dot = document.getElementById('cursor-dot');
  if (!dot) return;
  let mx = innerWidth / 2, my = innerHeight / 2;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  const targets = 'a,button,.btn-primary,.btn-secondary,.btn-nav,.btn-comprar,.produto-card,.dep-card,.feature-card,input,textarea,[onclick]';
  document.querySelectorAll(targets).forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
  document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
  document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-click'));
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; });
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
  const supportBtn = document.getElementById('navSupportBtn');
  if (!loginBtn) return;

  const token = localStorage.getItem('zk_token');
  if (!token) return;

  fetch('/auth/me', { headers:{ Authorization:'Bearer '+token } })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d || !d.user) {
        localStorage.removeItem('zk_token');
        return;
      }
      loginBtn.style.display = 'none';
      userBtn.style.display  = 'inline-flex';
      if (d.user.avatar) {
        avatar.innerHTML = '<img src="' + d.user.avatar + '" style="width:26px;height:26px;border-radius:50%;object-fit:cover;" />';
      } else {
        avatar.textContent = d.user.name.charAt(0).toUpperCase();
      }
      nameEl.textContent = d.user.name.split(' ')[0];
      localStorage.setItem('zk_user', JSON.stringify(d.user));
      fetch('/staff/check', { headers:{ Authorization:'Bearer '+token } })
        .then(r => r.ok ? r.json() : null)
        .then(s => {
          if (s && s.ok && supportBtn) supportBtn.style.display = 'inline-flex';
        });
    })
    .catch(() => {});
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
  if (!nl) return;
  const open = nl.style.display === 'flex';
  Object.assign(nl.style, {
    display: open ? 'none' : 'flex', flexDirection:'column',
    position:'absolute', top:'68px', left:'0', right:'0',
    background:'rgba(3,8,28,0.97)', padding:'1.5rem 2rem',
    borderBottom:'1px solid rgba(26,86,219,0.2)', zIndex:'999'
  });
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
    if (!box) return;
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
    const icon = document.getElementById('chat-toggle-icon');
    icon.innerHTML = chatOpen
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
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
      document.getElementById('chat-start-screen').style.display   = 'none';
      document.getElementById('chat-active-screen').style.display  = 'flex';
      startPolling();
      setTimeout(() => document.getElementById('chat-input')?.focus(), 100);
    } catch(e) {
      alert('Não foi possível conectar ao suporte. Tente novamente.');
    }
  };

  window.enviarMsgChat = async function() {
    if (!sessionId || chatClosed) return;
    const inp  = document.getElementById('chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    inp.style.height = '';
    addChatMsg({ from:'visitor', text, time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) });
    try {
      await fetch('/chat/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id: sessionId, text })
      });
    } catch(e) {}
  };

  window.chatKeyDown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMsgChat(); }
  };
  window.chatAutoResize = function(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  function addChatMsg(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'cb-msg from-' + msg.from;
    div.innerHTML = '<div class="cb-msg-avatar">' + (msg.from === 'admin' ? '<img src="/logos/ZK STUDIO SEM FUNDO.png" alt="ZK" />' : '👤') + '</div><div><div class="cb-msg-bubble">' + escapeHtml(msg.text) + '</div><div class="cb-msg-time">' + msg.time + '</div></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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
      const r = await fetch('/chat/poll?id=' + sessionId + '&idx=' + msgCount);
      const msgs = await r.json();
      if (msgs.length > msgCount) {
        for (let i = msgCount; i < msgs.length; i++) {
          if (msgs[i].from === 'admin') addChatMsg(msgs[i]);
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

// ── BUY MODAL (DISCORD TICKET) ────────────────────────────────────────
let buyScriptName = '', buyScriptPrice = '';

function openBuyModal(name, price) {
  buyScriptName = name;
  buyScriptPrice = price;
  document.getElementById('buyModalInfo').textContent = name + ' — ' + price;
  document.getElementById('buyName').value = '';
  document.getElementById('buyEmail').value = '';
  document.getElementById('buyModal').classList.add('active');
}

function closeBuyModal() {
  document.getElementById('buyModal').classList.remove('active');
}

async function submitBuy() {
  const nameEl = document.getElementById('buyName');
  const emailEl = document.getElementById('buyEmail');
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  if (!name) { nameEl.style.borderColor = '#ef4444'; nameEl.focus(); return; }
  nameEl.style.borderColor = '';

  const user = localStorage.getItem('zk_user');
  if (!user) {
    const pending = { script_name: buyScriptName, price: buyScriptPrice, user_name: name, user_email: email };
    localStorage.setItem('zk_pending_buy', JSON.stringify(pending));
    showToast('Redirecionando para login Discord...');
    setTimeout(() => { window.location.href = '/auth/discord'; }, 800);
    return;
  }

  const btn = document.getElementById('buySubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin"><circle cx="12" cy="12" r="10"/></svg> Abrindo ticket...';

  try {
    const r = await fetch('/ticket/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_name: buyScriptName, price: buyScriptPrice, user_name: name, user_email: email })
    });
    const d = await r.json();
    if (d.ok && d.url) {
      closeBuyModal();
      showToast('Abrindo Discord...');
      window.open(d.url, '_blank');
    } else {
      showToast(d.error || 'Erro ao abrir ticket.');
      btn.disabled = false;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Abrir Ticket no Discord';
    }
  } catch(e) {
    showToast('Erro de conexão.');
    btn.disabled = false;
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Abrir Ticket no Discord';
  }
}

