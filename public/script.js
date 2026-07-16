// === ZK STUDIO — SCRIPT.JS ===

// ── DISCORD TOKEN CAPTURE ─────────────────────────────────────────────
(function() {
  const params = new URLSearchParams(window.location.search);
  const dToken = params.get('discord_token');
  const dUser  = params.get('discord_user');
  if (dToken && dUser) {
    localStorage.setItem('zk_token', dToken);
    try { localStorage.setItem('zk_user', decodeURIComponent(dUser)); } catch(_) {}
    window.history.replaceState({}, '', '/');
  }
})();

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
    rx += (mx - rx) * 0.35;
    ry += (my - ry) * 0.35;
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

// ==============================
//   CARRINHO
// ==============================
(function() {
  const CART_KEY = 'zk_cart';
  let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  let appliedCoupon = null;

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
  }

  function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const total = cart.reduce((s, i) => s + i.quantity, 0);
    if (total > 0) { badge.style.display = 'block'; badge.textContent = total; }
    else badge.style.display = 'none';
  }

  function parsePrice(str) {
    const m = str.match(/[\d.,]+/);
    if (!m) return 0;
    return parseFloat(m[0].replace('.','').replace(',','.'));
  }

  function formatPrice(val) {
    return 'R$ ' + val.toFixed(2).replace('.',',');
  }

  window.addToCart = function(name, price) {
    const exist = cart.find(i => i.name === name);
    if (exist) { exist.quantity++; }
    else { cart.push({ name, price, quantity: 1 }); }
    saveCart();
    renderCart();
    showToast('✅ ' + name + ' adicionado ao carrinho!');
  };

  window.openCart = function() {
    renderCart();
    document.getElementById('cartOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeCart = function() {
    document.getElementById('cartOverlay').classList.remove('active');
    document.body.style.overflow = '';
  };

  window.updateCartQty = function(idx, delta) {
    cart[idx].quantity += delta;
    if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    saveCart();
    renderCart();
  };

  window.removeCartItem = function(idx) {
    cart.splice(idx, 1);
    saveCart();
    renderCart();
  };

  window.clearCart = function() {
    cart = [];
    appliedCoupon = null;
    window._appliedCoupon = null;
    saveCart();
    renderCart();
  };

  window.applyCoupon = async function() {
    const code = document.getElementById('cartCouponInput').value.trim();
    const msg = document.getElementById('cartCouponMsg');
    if (!code) { msg.className = 'cart-coupon-msg error'; msg.textContent = 'Digite um cupom.'; return; }
    try {
      const r = await fetch('/coupon/validate', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ code })
      });
      const d = await r.json();
      if (!r.ok) { msg.className = 'cart-coupon-msg error'; msg.textContent = d.error || 'Cupom inválido.'; appliedCoupon = null; window._appliedCoupon = null; return; }
      appliedCoupon = d.coupon;
      window._appliedCoupon = d.coupon;
      msg.className = 'cart-coupon-msg success';
      msg.textContent = '✅ Cupom aplicado! (' + (d.coupon.discount_type === 'percent' ? d.coupon.discount_value + '%' : formatPrice(d.coupon.discount_value)) + ' de desconto)';
      renderCart();
    } catch(e) {
      msg.className = 'cart-coupon-msg error'; msg.textContent = 'Erro ao validar cupom.';
    }
  };

  window.checkoutCart = function() {
    if (!cart.length) return;
    const total = calcTotal();
    document.getElementById('checkoutTotal').textContent = formatPrice(total) + ' (' + cart.length + ' item' + (cart.length > 1 ? 's' : '') + ')';
    document.getElementById('checkoutStep1').style.display = 'block';
    document.getElementById('checkoutStep2').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  function calcTotal() {
    let total = cart.reduce((s, i) => s + parsePrice(i.price) * i.quantity, 0);
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'percent') {
        total = total * (1 - appliedCoupon.discount_value / 100);
      } else {
        total = total - appliedCoupon.discount_value;
      }
      if (total < 0) total = 0;
    }
    return total;
  }

  function renderCart() {
    const itemsEl = document.getElementById('cartItems');
    const footerEl = document.getElementById('cartFooter');
    const discountEl = document.getElementById('cartDiscount');
    if (!itemsEl) return;

    if (!cart.length) {
      itemsEl.innerHTML = '<div class="cart-empty">Seu carrinho está vazio.</div>';
      footerEl.style.display = 'none';
      updateCartBadge();
      return;
    }

    itemsEl.innerHTML = cart.map((item, i) =>
      '<div class="cart-item">' +
        '<div class="cart-item-info">' +
          '<div class="cart-item-name">' + escapeCartHtml(item.name) + '</div>' +
          '<div class="cart-item-price">' + escapeCartHtml(item.price) + '</div>' +
        '</div>' +
        '<div class="cart-item-qty">' +
          '<button onclick="updateCartQty('+i+',-1)">−</button>' +
          '<span>' + item.quantity + '</span>' +
          '<button onclick="updateCartQty('+i+',1)">+</button>' +
        '</div>' +
        '<button class="cart-item-remove" onclick="removeCartItem('+i+')" title="Remover">🗑</button>' +
      '</div>'
    ).join('');

    const total = calcTotal();
    document.getElementById('cartTotal').textContent = formatPrice(total);

    if (appliedCoupon) {
      const rawTotal = cart.reduce((s, i) => s + parsePrice(i.price) * i.quantity, 0);
      const saved = rawTotal - total;
      discountEl.style.display = 'block';
      discountEl.textContent = 'Desconto: -' + formatPrice(saved) + ' (' + appliedCoupon.code + ')';
    } else {
      discountEl.style.display = 'none';
    }

    footerEl.style.display = 'block';
    updateCartBadge();
  }

  function escapeCartHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  updateCartBadge();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
})();

// ==============================
//   PIX / QR CODE CHECKOUT
// ==============================
let pixConfig = null;

async function loadPixConfig() {
  try {
    const cfg = await fetch('/config.json').then(r => r.json());
    pixConfig = cfg.pix || null;
  } catch(e) {}
}
loadPixConfig();

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, value) {
  const idStr = String(id).padStart(2, '0');
  const len = String(value.length).padStart(2, '0');
  return idStr + len + value;
}

function generatePixPayload(chave, nome, cidade, valor, txid) {
  txid = txid || '***';
  let payload = '';
  payload += tlv(0, '01');
  payload += tlv(1, '12');
  payload += tlv(26, tlv(0, 'br.gov.bcb.pix') + tlv(1, chave) + tlv(2, nome));
  payload += tlv(52, '0000');
  payload += tlv(53, '986');
  if (valor) payload += tlv(54, valor.toFixed(2));
  payload += tlv(58, 'BR');
  payload += tlv(59, nome.substring(0, 25));
  payload += tlv(60, cidade.substring(0, 15));
  payload += tlv(62, tlv(5, txid));
  const crcValue = crc16(payload + '6304');
  payload += '6304' + crcValue;
  return payload;
}

function formatPrice(val) {
  return 'R$ ' + val.toFixed(2).replace('.', ',');
}

function parsePrice(str) {
  const m = str.match(/[\d.,]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace('.', '').replace(',', '.'));
}

async function generatePix() {
  const name = document.getElementById('checkoutName').value.trim();
  const email = document.getElementById('checkoutEmail').value.trim();
  const doc = document.getElementById('checkoutDoc').value.trim();
  if (!name) { alert('Informe seu nome.'); return; }
  if (!pixConfig || !pixConfig.chave) { alert('Chave PIX não configurada.'); return; }

  const cart = JSON.parse(localStorage.getItem('zk_cart') || '[]');
  if (!cart.length) { alert('Carrinho vazio.'); return; }

  let total = cart.reduce((s, i) => s + parsePrice(i.price) * i.quantity, 0);

  // Aplica cupom se tiver
  const appliedCoupon = window._appliedCoupon;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percent') total = total * (1 - appliedCoupon.discount_value / 100);
    else total = total - appliedCoupon.discount_value;
    if (total < 0) total = 0;
  }

  const txid = 'ZK' + Date.now().toString(36).toUpperCase();
  const payload = generatePixPayload(pixConfig.chave, pixConfig.nome, pixConfig.cidade, total, txid);

  // Salva pedido no banco
  try {
    await fetch('/order/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer_name: name,
        buyer_email: email,
        buyer_doc: doc,
        items: cart.map(i => ({ name: i.name, price: i.price, qty: i.quantity })),
        total: formatPrice(total)
      })
    });
  } catch(e) {}

  // Mostra step 2
  document.getElementById('checkoutStep1').style.display = 'none';
  document.getElementById('checkoutStep2').style.display = 'block';
  document.getElementById('pixAmount').textContent = formatPrice(total);
  document.getElementById('pixCopyCode').textContent = payload;

  // Gera QR Code
  const qrContainer = document.getElementById('qrCodeContainer');
  qrContainer.innerHTML = '';
  try {
    if (typeof QRCode === 'object' && QRCode.toCanvas) {
      const canvas = document.createElement('canvas');
      qrContainer.appendChild(canvas);
      QRCode.toCanvas(canvas, payload, {
        width: 220,
        margin: 2,
        color: { dark: '#F1F5FF', light: '#081230' }
      });
    } else if (typeof QRCode === 'function') {
      const div = document.createElement('div');
      qrContainer.appendChild(div);
      new QRCode(div, { text: payload, width: 220, height: 220, colorDark: '#F1F5FF', colorLight: '#081230' });
    }
  } catch(e) {
    qrContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Copie o código PIX abaixo</p>';
  }
}

function copyPixCode() {
  const code = document.getElementById('pixCopyCode').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const el = document.getElementById('pixCopyCode');
    const orig = el.style.color;
    el.style.color = '#22C55E';
    el.textContent = '✅ Código copiado!';
    setTimeout(() => { el.style.color = orig; el.textContent = code; }, 2000);
  }).catch(() => {
    const range = document.createRange();
    range.selectNode(document.getElementById('pixCopyCode'));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}
