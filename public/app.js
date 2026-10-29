import { RoomCore, freshState, LIFE, TECH, PROMPTS, AVATARS, OBJECTIVE, CODE_CHARS, cardById } from './room-core.js';

/* ============================== helpers ============================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mk = (store) => ({
  get(k) { try { return JSON.parse(store().getItem(k)); } catch { return null; } },
  set(k, v) { try { store().setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { store().removeItem(k); } catch {} },
});
const ss = mk(() => sessionStorage);
const lstore = mk(() => localStorage);
const rnd = (n = 8) => Math.random().toString(36).slice(2, 2 + n);
const app = document.getElementById('app');
let MODE = 'live';

const SOFT = ['#FFE3C2', '#D4F5D9', '#D3F1FA', '#E3DBFF', '#FFDDF3', '#FFF4BF', '#D6E6FF', '#FFD9D6'];
const avBg = (av) => SOFT[[...(av || '?')].reduce((a, c) => a + c.codePointAt(0), 0) % SOFT.length];
const hashRot = (id) => ((([...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0)) % 7) - 3) * 0.45;

const VERDICT = {
  yes: { e: '✅', label: 'Works together', cls: 'v-yes' },
  depends: { e: '🤔', label: 'It depends', cls: 'v-dep' },
  no: { e: '⛔', label: 'Doesn’t work together', cls: 'v-no' },
};
const FLASHES = [
  { text: 'Time to listen', e: '👂' },
  { text: 'Eyes on me', e: '👀' },
  { text: 'Hands off the keyboard', e: '🙌' },
  { text: 'Talk to your partner', e: '🗣️' },
  { text: 'Tidy up time', e: '🧺' },
  { text: 'Brilliant work, everyone!', e: '🌟' },
];
const flashEmoji = (t) => (FLASHES.find((f) => f.text === t) || { e: '📣' }).e;
const TYPE_ICON = { image: '🖼️', title: '🏁', respond: '💬', poll: '📊', cards: '🃏', deal: '🎴', split: '↔️', task: '⚖️' };
const TYPE_LABEL = { image: 'Teaching slide', title: 'Welcome', respond: 'Everyone answers', poll: 'Vote', cards: 'The cards', deal: 'Pair activity', split: 'Sort your answers', task: 'Your task' };

const kindOf = (c) => c.k || (String(c.id)[0] === 'T' ? 'tech' : 'life');
const cardHTML = (c, cls = '') => {
  const k = kindOf(c);
  return `<div class="gcard ${k} ${c.blank ? 'blank' : ''} ${cls}"><span class="gtag">${k === 'life' ? 'Life' : 'Tech'}</span><span class="ge">${c.e}</span><span class="gt">${esc(c.t)}</span></div>`;
};
const chipHTML = (c) => `<span class="chip ${kindOf(c)}">${c.e} ${esc(c.t)}</span>`;
const avHTML = (av, cls = '') => `<span class="av ${cls}" style="--avbg:${avBg(av)}">${av || '🙂'}</span>`;

function toast(msg, kind = '') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = 'show ' + kind;
  t.textContent = msg;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ''), 2600);
}

let audioCtx = null;
function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch {}
}
function chime() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [[659.25, 0], [880, 0.16], [1046.5, 0.32]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.exponentialRampToValueAtTime(0.22, now + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.7);
      o.connect(g).connect(audioCtx.destination); o.start(now + d); o.stop(now + d + 0.75);
    });
  } catch {}
}

const IS_TOUCH = matchMedia('(hover: none)').matches;
function setTheme(i) { document.body.dataset.theme = String(((i | 0) % 4 + 4) % 4); }
function fullJoinUrl(code) {
  if (MODE === 'live') return location.origin + '/?join=' + code;
  return location.href.split('#')[0].split('?')[0] + '?join=' + code + '#join-' + code;
}
function qrSVG(text) {
  try {
    const q = window.qrcode(0, 'M');
    q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR code to join the lesson' });
  } catch { return ''; }
}
const _pre = new Set();
function preloadSlides(slides) {
  for (const x of slides || []) if (x.src && !_pre.has(x.src)) { _pre.add(x.src); const im = new Image(); im.decoding = 'async'; im.src = x.src; }
}

/* keyed region: only re-render when key changes */
function region(el, key, html) {
  if (!el) return false;
  if (el._k === key) return false;
  el._k = key;
  el.innerHTML = html;
  return true;
}

/* ============================== transports ============================== */
function liveLink(code, on) {
  let ws, hello = null, closed = false, retry = 0, pingT;
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?code=' + encodeURIComponent(code);
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function open() {
    on.status('connecting');
    ws = new WebSocket(url);
    ws.onopen = () => { retry = 0; on.status('online'); if (hello) send(hello); clearInterval(pingT); pingT = setInterval(() => send({ t: 'ping' }), 20000); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } on.msg(m); };
    ws.onclose = () => { clearInterval(pingT); if (closed) return; on.status('offline'); clearTimeout(open._t); open._t = setTimeout(() => { if (!closed && (!ws || ws.readyState === 3)) open(); }, Math.min(8000, 600 * 2 ** retry++)); };
  }
  open();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || closed) return;
    if (!ws || ws.readyState === 3) { retry = 0; open(); }
    else if (ws.readyState === 1) send({ t: 'ping' });
  });
  return { send, hello(o, now = true) { hello = o; if (now) send(o); }, close() { closed = true; try { ws.close(); } catch {} } };
}

function localHostLink(code, key, on, saved) {
  const bc = new BroadcastChannel('lvt-' + code);
  const seen = new Map();
  const sinks = new Map();
  const core = new RoomCore({
    send: (cid, msg) => {
      if (cid === 'host') on.msg(msg);
      else if (sinks.has(cid)) sinks.get(cid)(msg);
      else bc.postMessage({ to: cid, msg });
    },
    persist: (st) => { if (st.ended) lstore.del('lvt-demo-' + code); else lstore.set('lvt-demo-' + code, st); },
  });
  core.load(saved || freshState(code, key));
  bc.onmessage = (ev) => {
    const d = ev.data;
    if (!d || !d.from) return;
    if (d.type === 'close') { seen.delete(d.from); core.disconnect(d.from); return; }
    if (!core.clients.has(d.from)) { core.connect(d.from); bc.postMessage({ to: d.from, msg: { t: 'rehello' } }); }
    seen.set(d.from, Date.now());
    if (d.type === 'msg') core.message(d.from, d.msg);
  };
  const hb = setInterval(() => {
    const now = Date.now();
    for (const [cid, t] of seen) if (now - t > 9000) { seen.delete(cid); core.disconnect(cid); }
  }, 3000);
  core.connect('host');
  setTimeout(() => on.status('online'));
  return { core, sinks, send(o) { core.message('host', o); }, hello(o) { core.message('host', o); }, close() { clearInterval(hb); bc.close(); } };
}

function localPupilLink(code, on) {
  const bc = new BroadcastChannel('lvt-' + code);
  const cid = 'p' + rnd(10);
  let hello = null, got = false;
  const post = (type, msg) => { try { bc.postMessage({ from: cid, type, msg }); } catch {} };
  bc.onmessage = (ev) => {
    const d = ev.data;
    if (!d || d.to !== cid) return;
    if (!got) { got = true; on.status('online'); }
    if (d.msg && d.msg.t === 'rehello') { if (hello) post('msg', hello); return; }
    on.msg(d.msg);
  };
  on.status('connecting');
  post('open');
  const t = setInterval(() => { post('msg', { t: 'ping' }); if (!got && hello) post('msg', hello); }, 2500);
  setTimeout(() => { if (!got) on.msg({ t: 'error', e: 'nohost' }); }, 3000);
  addEventListener('pagehide', () => post('close'));
  return { send(o) { post('msg', o); }, hello(o, now = true) { hello = o; if (now) post('msg', o); }, close() { clearInterval(t); post('close'); bc.close(); } };
}

/* ============================== home ============================== */
function showHome(msg = '') {
  document.body.className = 'home-mode';
  setTheme(0);
  const resume = ss.get('lvt-teacher');
  app.innerHTML = `
  <div class="home">
    <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
    <div class="home-inner">
      <div class="hero-cards" aria-hidden="true">
        ${cardHTML(LIFE[8], 'tilt-l')}
        <div class="vs">vs</div>
        ${cardHTML(TECH[2], 'tilt-r')}
      </div>
      <h1 class="home-title">Life <span>vs</span> Tech</h1>
      <p class="home-sub">${esc(OBJECTIVE)}</p>
      ${msg ? `<p class="home-msg">${esc(msg)}</p>` : ''}
      <div class="home-btns">
        <button class="hbtn pupil" id="goPupil"><span class="hb-e">🧑‍🤝‍🧑</span><span><b>We’re pupils</b><small>Join with a room code</small></span></button>
        <button class="hbtn teacher" id="goTeacher"><span class="hb-e">🧑‍🏫</span><span><b>I’m the teacher</b><small>Start a lesson</small></span></button>
      </div>
      ${resume && resume.mode === MODE ? `<button class="linkbtn" id="resume">↩ Go back to lesson <b>${esc(resume.code)}</b></button>` : ''}
      ${MODE === 'local' ? `<div class="demo-note"><b>Demo mode.</b> Everything runs inside this browser. Start a lesson as the teacher, then use <i>Open a pupil tab</i> or <i>Add 16 demo pairs</i> to try it out. Put it on Cloudflare for real laptops.</div>` : ''}
    </div>
  </div>`;
  $('#goPupil').onclick = () => showJoin();
  $('#goTeacher').onclick = () => (MODE === 'live' ? showTeacherGate() : startDemoTeacher());
  const r = $('#resume');
  if (r) r.onclick = () => {
    if (MODE === 'local') {
      const saved = lstore.get('lvt-demo-' + resume.code);
      if (!saved) { ss.del('lvt-teacher'); return showHome('That demo lesson has finished.'); }
      startTeacher({ code: resume.code, key: resume.key, saved });
    } else startTeacher(resume);
  };
}

function showTeacherGate() {
  const m = modal(`
    <h2>Start a lesson</h2>
    <p class="muted">Enter the teacher code. It isn’t saved on this computer.</p>
    <input id="tcodeIn" type="password" class="tin" placeholder="Teacher code" autocomplete="off">
    <p class="err" id="gerr"></p>
    <div class="mrow"><button class="ghost" data-close>Cancel</button><button class="primary" id="gstart">Start lesson ➜</button></div>`);
  const go = async () => {
    const teacherCode = $('#tcodeIn', m).value;
    $('#gstart', m).disabled = true;
    try {
      const r = await fetch('/api/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teacherCode }) });
      const j = await r.json();
      if (!r.ok) { $('#gerr', m).textContent = j.error === 'badcode' ? 'That teacher code isn’t right.' : 'Could not start a room. Try again.'; $('#gstart', m).disabled = false; return; }
      closeModal();
      startTeacher({ code: j.code, key: j.key });
    } catch { $('#gerr', m).textContent = 'No connection to the server.'; $('#gstart', m).disabled = false; }
  };
  $('#gstart', m).onclick = go;
  $('#tcodeIn', m).onkeydown = (e) => { if (e.key === 'Enter') go(); };
  setTimeout(() => $('#tcodeIn', m).focus(), 50);
}

function startDemoTeacher() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  startTeacher({ code, key: rnd(16) });
}

let modalEl = null;
function modal(html, cls = '') {
  closeModal();
  modalEl = document.createElement('div');
  modalEl.className = 'modal-back';
  modalEl.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(modalEl);
  return modalEl;
}
function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }

/* ============================== pupil ============================== */
const P = { link: null, view: null, me: null, code: null, mountKey: null, upd: null, lastFlash: null, dealSel: null, taskSel: null };

function showJoin(prefill = '', err = '') {
  document.body.className = 'join-mode';
  setTheme(2);
  const saved = ss.get('lvt-pupil');
  let av = (saved && saved.av) || AVATARS[Math.floor(Math.random() * AVATARS.length)];
  app.innerHTML = `
  <div class="home">
    <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
    <div class="join-card">
      <button class="back" id="jback">← Back</button>
      <h1>Join the lesson</h1>
      <label for="jcode">Room code</label>
      <input id="jcode" class="codein" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${esc(prefill)}">
      <label for="jname">Your first names</label>
      <input id="jname" class="tin" maxlength="32" autocomplete="off" placeholder="e.g. Amy & Leo" value="${esc(saved && saved.code === prefill ? saved.name : '')}">
      <label>Pick your team animal</label>
      <div class="avpick">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === av ? 'on' : ''}" style="--avbg:${avBg(a)}">${a}</button>`).join('')}</div>
      <p class="err" id="jerr">${esc(err)}</p>
      <button class="primary big" id="jgo">Join ➜</button>
    </div>
  </div>`;
  $('#jback').onclick = () => showHome();
  $$('.avpick button').forEach((b) => (b.onclick = () => { av = b.dataset.av; $$('.avpick button').forEach((x) => x.classList.toggle('on', x === b)); }));
  const ci = $('#jcode');
  ci.oninput = () => { ci.value = ci.value.toUpperCase().replace(/[^A-Z]/g, ''); };
  const go = () => {
    const code = ci.value.trim().toUpperCase();
    const name = $('#jname').value.trim();
    if (!/^[A-Z]{4}$/.test(code)) return ($('#jerr').textContent = 'The room code is 4 letters.');
    if (!name) return ($('#jerr').textContent = 'Type your first names.');
    unlockAudio();
    startPupil({ code, name, av, pairId: null });
  };
  $('#jgo').onclick = go;
  $('#jname').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  if (!IS_TOUCH) (prefill ? $('#jname') : ci).focus();
}

function startPupil(me) {
  P.me = me; P.code = me.code; P.mountKey = null; P.view = null; P.lastFlash = null;
  document.body.className = 'pupil-mode';
  app.innerHTML = `
  <div class="p-app">
    <header class="p-top">
      <div class="me">${avHTML(me.av)}<b>${esc(me.name)}</b></div>
      <div class="p-prog" id="pprog"></div>
      <div class="p-status"><span class="dot" id="pdot"></span>Room <b>${esc(me.code)}</b></div>
    </header>
    <main class="p-main" id="pmain"><div class="waiting"><div class="spinner"></div><p>Joining…</p></div></main>
    <div id="pover"></div>
  </div>`;
  const on = {
    status: (st) => { const d = $('#pdot'); if (d) d.className = 'dot ' + st; },
    msg: (m) => onPupilMsg(m),
  };
  P.link = MODE === 'live' ? liveLink(me.code, on) : localPupilLink(me.code, on);
  P.link.hello({ t: 'hello', role: 'pupil', pairId: me.pairId, name: me.name, av: me.av });
}

function onPupilMsg(m) {
  if (m.t === 'welcome') {
    P.me.pairId = m.pairId; P.me.name = m.name; P.me.av = m.av;
    ss.set('lvt-pupil', P.me);
    P.link.hello({ t: 'hello', role: 'pupil', pairId: m.pairId, name: m.name, av: m.av }, false);
    const nm = $('.p-top .me');
    if (nm) nm.innerHTML = `${avHTML(m.av)}<b>${esc(m.name)}</b>`;
    return;
  }
  if (m.t === 'state') { P.view = m.s; renderPupil(); return; }
  if (m.t === 'error') {
    if (m.e === 'nohost') {
      if (!P.view) $('#pmain').innerHTML = `<div class="waiting"><div class="spinner"></div><p>Looking for room <b>${esc(P.code)}</b>…</p><small>${MODE === 'local' ? 'Demo mode: the teacher tab must be open in this same browser.' : ''}</small></div>`;
      return;
    }
    const msgs = { noroom: `We couldn’t find room ${P.code}. Check the code with your teacher.`, ended: 'That lesson has finished.', full: 'This room is full.', removed: 'Your teacher took you out of the room. You can join again.', noname: 'Type your first names.' };
    const code = P.code;
    P.link && P.link.close();
    P.link = null;
    if (m.e === 'ended') { ss.del('lvt-pupil'); return showEnded(); }
    if (m.e !== 'noname') ss.del('lvt-pupil');
    showJoin(m.e === 'noroom' ? '' : code, msgs[m.e] || 'Something went wrong. Try again.');
  }
}

function showEnded() {
  document.body.className = 'join-mode';
  app.innerHTML = `<div class="home"><div class="blob b1"></div><div class="blob b2"></div><div class="join-card center"><div class="big-e">🎉</div><h1>Lesson finished</h1><p class="muted">Thank you for joining in. You can close this page.</p><button class="ghost" id="ehome">Back to start</button></div></div>`;
  $('#ehome').onclick = () => showHome();
}

function renderPupil() {
  const v = P.view;
  if (!v) return;
  if (v.ended) { P.link && P.link.close(); ss.del('lvt-pupil'); return showEnded(); }
  const sl = v.cur;
  setTheme(v.slide);
  preloadSlides(v.slides);
  $('#pprog').innerHTML = `<span class="kind">${TYPE_ICON[sl.type] || '•'} ${TYPE_LABEL[sl.type] || ''}</span><span class="pbar"><i style="width:${Math.round(((v.slide + 1) / v.slides.length) * 100)}%"></i></span><span class="pn">${v.slide + 1} / ${v.slides.length}</span>`;
  const key = sl.id + '|' + sl.type + '|' + sl.title;
  if (key !== P.mountKey) {
    P.mountKey = key;
    const main = $('#pmain');
    main.innerHTML = '';
    main.scrollTop = 0;
    P.upd = PUPIL_MOUNT[sl.type] ? PUPIL_MOUNT[sl.type](main, sl) : PUPIL_MOUNT.title(main, sl);
  }
  P.upd && P.upd(v);
  renderPupilOverlay(v);
}

function renderPupilOverlay(v) {
  const ov = $('#pover');
  let key = 'none', html = '';
  if (v.flash) {
    key = 'flash' + v.flash.id;
    html = `<div class="ov flash"><div class="rings"><i></i><i></i><i></i></div><div class="fl-in"><div class="fe">${flashEmoji(v.flash.text)}</div><h1>${esc(v.flash.text)}</h1><p>Your teacher has paused the screens</p></div></div>`;
  } else if (v.spot) {
    key = 'spot' + JSON.stringify(v.spot);
    html = `<div class="ov spot"><div class="spot-card"><div class="spot-head"><span class="star">🌟</span> Look at this work from ${avHTML(v.spot.pair.av)} <b>${esc(v.spot.pair.name)}</b></div><div class="spot-body">${renderWork(v.spot, v.cur)}</div></div></div>`;
  } else if (v.frozen) {
    key = 'frozen';
    html = `<div class="ov freeze"><div class="orb"><span>⏸</span></div><h1>Screens paused</h1><p>Eyes on your teacher</p></div>`;
  }
  if (v.flash && v.flash.id !== P.lastFlash) {
    P.lastFlash = v.flash.id;
    if (v.chime) chime();
  }
  if (!v.flash) P.lastFlash = null;
  if (ov._k !== key) {
    ov._k = key; ov.innerHTML = html;
    document.body.classList.toggle('locked', key !== 'none');
    if (key !== 'none' && document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
}

const questionHead = (sl, extra = '') => `
  <section class="qhead">
    <div class="qkind">${TYPE_ICON[sl.type] || ''} ${TYPE_LABEL[sl.type] || ''}</div>
    <h1>${esc(sl.title)}</h1>
    ${sl.hint ? `<p class="hint">${esc(sl.hint)}</p>` : ''}
    ${sl.sub ? `<p class="hint">${esc(sl.sub)}</p>` : ''}
    ${extra}
  </section>`;

const PUPIL_MOUNT = {
  title(main, sl) {
    main.innerHTML = `
      <div class="p-hero">
        ${sl.src ? `<div class="imgframe"><img src="${esc(sl.src)}" alt="${esc(sl.title)}"></div>` : `<h1>${esc(sl.title)}</h1>`}
        ${sl.sub ? `<p class="obj">${esc(sl.sub)}</p>` : ''}
        <p class="wait-note">✅ You’re in! Your teacher will start soon.</p>
      </div>`;
    return null;
  },
  image(main, sl) {
    main.innerHTML = `<div class="p-image"><div class="imgframe"><img src="${esc(sl.src)}" alt="${esc(sl.title)}"></div><p class="look-note">👀 Look and listen</p></div>`;
    return null;
  },
  cards(main, sl) {
    main.innerHTML = `${questionHead(sl)}
      <h3 class="sec life-h">🟢 Life cards</h3><div class="deck">${LIFE.map((c) => cardHTML(c)).join('')}</div>
      <h3 class="sec tech-h">⚫ Tech cards</h3><div class="deck">${TECH.map((c) => cardHTML(c)).join('')}</div>`;
    return null;
  },
  respond(main, sl) { return mountRespond(main, sl, false); },
  split(main, sl) { return mountRespond(main, sl, true); },
  poll(main, sl) {
    main.innerHTML = `${questionHead(sl)}<div class="opts">${sl.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="fill"></span><span class="ol">${String.fromCharCode(65 + i)}</span><span class="ot">${esc(o)}</span><span class="oc"></span></button>`).join('')}</div><p class="muted center small-note">You can change your vote.</p>`;
    $$('.opt', main).forEach((b) => (b.onclick = () => P.link.send({ t: 'act', a: 'vote', slideId: sl.id, opt: +b.dataset.i })));
    return (v) => {
      const mine = v.mine ? v.mine.vote : undefined;
      const total = v.counts ? v.counts.reduce((a, b) => a + b, 0) : 0;
      $$('.opt', main).forEach((b, i) => {
        b.classList.toggle('on', mine === i);
        const fill = $('.fill', b); const oc = $('.oc', b);
        if (v.counts) { const pct = total ? Math.round((v.counts[i] / total) * 100) : 0; fill.style.width = pct + '%'; oc.textContent = v.counts[i]; }
        else { fill.style.width = '0'; oc.textContent = mine === i ? '✓' : ''; }
      });
    };
  },
  deal(main, sl) { return mountDeal(main, sl); },
  task(main, sl) { return mountTask(main, sl); },
};

function mountRespond(main, sl, split) {
  let side = 'left';
  main.innerHTML = `${questionHead(sl)}
    ${split ? `<div class="sidepick"><button data-side="left" class="on">✅ ${esc(sl.left)}</button><button data-side="right">⛔ ${esc(sl.right)}</button></div>` : ''}
    <form class="answer" autocomplete="off">
      <textarea maxlength="160" rows="2" placeholder="Talk with your partner, then type your answer…"></textarea>
      <div class="arow"><span class="count">0 / 160</span><button class="primary" type="submit">Send ➤</button></div>
    </form>
    <h3 class="sec">Your answers <small class="mycount"></small></h3>
    <div class="mylist"></div>
    <div class="wallwrap" hidden><h3 class="sec">Everyone’s answers</h3><div class="pwall ${split ? 'two' : ''}"></div></div>`;
  const ta = $('textarea', main);
  const form = $('form', main);
  ta.oninput = () => ($('.count', main).textContent = ta.value.length + ' / 160');
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    P.link.send({ t: 'act', a: 'respond', slideId: sl.id, text, side });
    ta.value = ''; ta.oninput();
    form.classList.remove('sent'); void form.offsetWidth; form.classList.add('sent');
  };
  $$('.sidepick button', main).forEach((b) => (b.onclick = () => { side = b.dataset.side; $$('.sidepick button', main).forEach((x) => x.classList.toggle('on', x === b)); if (!IS_TOUCH) ta.focus(); }));
  if (!IS_TOUCH) setTimeout(() => ta.focus(), 50);
  return (v) => {
    const mine = (v.mine && v.mine.responses) || [];
    region($('.mylist', main), JSON.stringify(mine), mine.length
      ? mine.map((r) => `<div class="mycard ${r.side || ''}">${split ? `<span class="side">${r.side === 'right' ? '⛔' : '✅'}</span>` : ''}<p>${esc(r.text)}</p><button class="x" data-id="${r.id}" title="Delete">✕</button></div>`).join('')
      : `<p class="muted empty-note">Nothing sent yet.</p>`);
    $$('.mylist .x', main).forEach((b) => (b.onclick = () => P.link.send({ t: 'act', a: 'unrespond', slideId: sl.id, id: b.dataset.id })));
    $('.mycount', main).textContent = mine.length ? `${mine.length} of 6` : '';
    const full = mine.length >= 6;
    ta.disabled = full; ta.placeholder = full ? 'That’s the most you can send. Delete one to add another.' : 'Talk with your partner, then type your answer…';
    const ww = $('.wallwrap', main);
    ww.hidden = !v.wall;
    if (v.wall) {
      const pw = $('.pwall', main);
      if (split) {
        region(pw, JSON.stringify(v.wall), ['left', 'right'].map((s) => `<div class="col"><h4>${s === 'left' ? '✅ ' + esc(sl.left) : '⛔ ' + esc(sl.right)}</h4>${v.wall.filter((r) => r.side === s).map(wallItemP).join('')}</div>`).join(''));
      } else region(pw, JSON.stringify(v.wall), v.wall.map(wallItemP).join(''));
    }
  };
}
const wallItemP = (r) => `<div class="wcard ${r.mine ? 'mine' : ''}" style="--bg:${avBg(r.av || r.id)};--rot:${hashRot(r.id)}deg"><p>${esc(r.text)}</p>${r.name ? `<footer>${r.av} ${esc(r.name)}</footer>` : ''}</div>`;

function mountDeal(main, sl) {
  main.innerHTML = `
    <div class="focus"><span class="lbl">Talk about</span><span class="fq"></span></div>
    <div class="dtable"></div>
    <div class="decide" hidden>
      <div class="step"><span class="n">1</span>Can you do these at the same time? Is it okay?</div>
      <div class="verdicts">${Object.entries(VERDICT).map(([k, x]) => `<button class="vbtn ${x.cls}" data-v="${k}"><span>${x.e}</span>${x.label}</button>`).join('')}</div>
      <div class="step"><span class="n">2</span>Which one is more important?</div>
      <div class="imps"><button data-i="life" class="imp life">🟢 The life card</button><button data-i="tech" class="imp tech">⚫ The tech card</button><button data-i="same" class="imp same">⚖️ Both the same</button></div>
      <div class="step"><span class="n">3</span>Why? Explain your thinking.</div>
      <textarea class="why" maxlength="200" rows="2" placeholder="Because…"></textarea>
      <div class="arow"><button class="ghost blankbtn" type="button">✏️ Use a blank card</button><button class="primary add" disabled>Add to our board ➜</button></div>
      <div class="blankform" hidden>
        <select class="bk"><option value="life">Life card</option><option value="tech">Tech card</option></select>
        <input class="bt tin" maxlength="40" placeholder="Write your own activity">
        <button class="primary bgo" type="button">Use it</button>
      </div>
    </div>
    <h3 class="sec">Our board <small class="bcount"></small></h3>
    <div class="board"></div>`;
  let sel = { v: null, i: null, curId: null };
  const dec = $('.decide', main);
  const why = $('.why', dec);
  const addBtn = $('.add', dec);
  const refresh = () => {
    $$('.vbtn', dec).forEach((b) => b.classList.toggle('on', b.dataset.v === sel.v));
    $$('.imp', dec).forEach((b) => b.classList.toggle('on', b.dataset.i === sel.i));
    const ok = sel.v && why.value.trim().length >= 4;
    addBtn.disabled = !ok;
    addBtn.title = ok ? '' : 'Choose an answer and explain why';
  };
  $$('.vbtn', dec).forEach((b) => (b.onclick = () => { sel.v = b.dataset.v; refresh(); }));
  $$('.imp', dec).forEach((b) => (b.onclick = () => { sel.i = b.dataset.i; refresh(); }));
  why.oninput = refresh;
  addBtn.onclick = () => {
    P.link.send({ t: 'act', a: 'decide', verdict: sel.v, important: sel.i, why: why.value.trim() });
    toast('Added to your board ✨', 'good');
  };
  $('.blankbtn', dec).onclick = () => { const f = $('.blankform', dec); f.hidden = !f.hidden; if (!f.hidden) $('.bt', f).focus(); };
  $('.bgo', dec).onclick = () => {
    const t = $('.bt', dec).value.trim();
    if (!t) return;
    P.link.send({ t: 'act', a: 'blank', k: $('.bk', dec).value, text: t });
    $('.bt', dec).value = ''; $('.blankform', dec).hidden = true;
  };
  return (v) => {
    $('.fq', main).textContent = PROMPTS[v.focusQ] || PROMPTS[0];
    const d = v.mine && v.mine.deal;
    const cur = d && d.cur;
    const table = $('.dtable', main);
    if (!cur) {
      region(table, 'deck' + v.dealMode, `
        <div class="piles">
          <div class="pile life"><i></i><i></i><i></i><span>Life</span></div>
          <div class="pile tech"><i></i><i></i><i></i><span>Tech</span></div>
        </div>
        <button class="primary huge dealbtn">🎴 Deal ${v.dealMode === 3 ? 'three' : 'two'} cards</button>
        ${v.dealMode === 3 ? '<p class="muted center">Challenge mode: you get three cards this time.</p>' : ''}`);
      const db = $('.dealbtn', table);
      if (db) db.onclick = () => P.link.send({ t: 'act', a: 'deal' });
      dec.hidden = true;
      sel = { v: null, i: null, curId: null };
    } else {
      if (region(table, 'cur' + cur.id, `<div class="dealt">${cur.cards.map((c, i) => (i ? '<span class="plus">+</span>' : '') + cardHTML(c, 'flip')).join('')}</div>`)) {
        $$('.flip', table).forEach((el, i) => (el.style.animationDelay = i * 0.18 + 's'));
      }
      dec.hidden = false;
      if (sel.curId !== cur.id) { sel = { v: null, i: null, curId: cur.id }; why.value = ''; refresh(); }
    }
    const board = (d && d.board) || [];
    $('.bcount', main).textContent = board.length ? `${board.length} decided` : '';
    region($('.board', main), JSON.stringify(board), boardHTML(board, true));
    $$('.board .x', main).forEach((b) => (b.onclick = () => P.link.send({ t: 'act', a: 'unboard', id: b.dataset.id })));
  };
}

function boardHTML(board, editable) {
  return `<div class="lanes">${Object.entries(VERDICT).map(([k, x]) => `
    <div class="lane ${x.cls}"><h4>${x.e} ${x.label}</h4>
      ${board.filter((b) => b.verdict === k).map((b) => `
        <div class="bitem">
          <div class="bcards">${b.cards.map((c) => `<span class="mini ${kindOf(c)} ${b.important && (b.important === kindOf(c) || b.important === 'same') ? 'star' : ''}">${c.e} ${esc(c.t)}</span>`).join('')}</div>
          ${b.why ? `<p>${esc(b.why)}</p>` : ''}
          ${editable ? `<button class="x" data-id="${b.id}" title="Remove">✕</button>` : ''}
        </div>`).join('') || '<div class="lane-empty">—</div>'}
    </div>`).join('')}</div>`;
}

function mountTask(main, sl) {
  const panel = (side) => `
    <div class="tpanel ${side}" data-side="${side}">
      <h2>${side === 'pos' ? '👍 Fit together well' : '👎 Work against each other'}</h2>
      <p class="muted">${side === 'pos' ? 'A life card and a tech card that can go together in a good way.' : 'A life card and a tech card that are a bad mix.'}</p>
      <div class="pick-lbl">Life card</div>
      <div class="picker" data-k="life">${LIFE.map((c) => `<button data-id="${c.id}" class="pchip life">${c.e} ${esc(c.t)}</button>`).join('')}</div>
      <div class="pick-lbl">Tech card</div>
      <div class="picker" data-k="tech">${TECH.map((c) => `<button data-id="${c.id}" class="pchip tech">${c.e} ${esc(c.t)}</button>`).join('')}</div>
      <div class="pick-lbl">Why?</div>
      <textarea maxlength="240" rows="3" placeholder="${side === 'pos' ? 'They work well together because…' : 'They work against each other because…'}"></textarea>
      <div class="arow"><span class="saved"></span><button class="primary save">Save</button></div>
    </div>`;
  main.innerHTML = `${questionHead(sl)}<div class="task">${panel('pos')}${panel('neg')}</div>`;
  const sel = { pos: { life: null, tech: null, dirty: false }, neg: { life: null, tech: null, dirty: false } };
  $$('.tpanel', main).forEach((pn) => {
    const side = pn.dataset.side;
    const ta = $('textarea', pn);
    const paint = () => {
      $$('.picker', pn).forEach((pk) => $$('button', pk).forEach((b) => b.classList.toggle('on', b.dataset.id === sel[side][pk.dataset.k])));
      $('.save', pn).disabled = !(sel[side].life && sel[side].tech && ta.value.trim().length >= 4);
    };
    pn._paint = paint;
    $$('.picker', pn).forEach((pk) => $$('button', pk).forEach((b) => (b.onclick = () => { sel[side][pk.dataset.k] = b.dataset.id; sel[side].dirty = true; paint(); })));
    ta.oninput = () => { sel[side].dirty = true; paint(); };
    $('.save', pn).onclick = () => {
      P.link.send({ t: 'act', a: 'task', side, life: sel[side].life, tech: sel[side].tech, why: ta.value.trim() });
      sel[side].dirty = false;
      toast('Saved ✓', 'good');
    };
    paint();
  });
  return (v) => {
    const t = (v.mine && v.mine.task) || {};
    $$('.tpanel', main).forEach((pn) => {
      const side = pn.dataset.side;
      const saved = t[side];
      if (saved && !sel[side].dirty) {
        sel[side].life = saved.life; sel[side].tech = saved.tech;
        $('textarea', pn).value = saved.why;
      }
      $('.saved', pn).textContent = saved ? (sel[side].dirty ? 'Not saved yet' : '✓ Saved') : '';
      $('.saved', pn).className = 'saved ' + (saved && !sel[side].dirty ? 'ok' : '');
      pn._paint();
    });
  };
}

/* shared: render one pair's work for spotlight */
function renderWork(w, sl) {
  if (!w) return '<p class="muted center">Nothing yet.</p>';
  const empty = (t) => `<div class="empty-work">${t}</div>`;
  switch (sl.type) {
    case 'respond':
    case 'split':
      return w.responses.length
        ? `<div class="sgrid">${w.responses.map((r) => `<div class="scard" style="--bg:${avBg(w.pair.av)}">${sl.type === 'split' ? `<span class="side">${r.side === 'right' ? '⛔ ' + esc(sl.right) : '✅ ' + esc(sl.left)}</span>` : ''}<p>${esc(r.text)}</p></div>`).join('')}</div>`
        : empty('No answers yet.');
    case 'poll':
      return `<div class="opts static">${sl.options.map((o, i) => `<div class="opt ${w.vote === i ? 'on' : ''}"><span class="ol">${String.fromCharCode(65 + i)}</span><span class="ot">${esc(o)}</span><span class="oc">${w.vote === i ? '✓' : ''}</span></div>`).join('')}</div>`;
    case 'deal': {
      const d = w.deal || { cur: null, board: [] };
      return `${d.cur ? `<div class="sp-sub">Cards on the table now</div><div class="dealt small">${d.cur.cards.map((c, i) => (i ? '<span class="plus">+</span>' : '') + cardHTML(c)).join('')}</div>` : ''}
        <div class="sp-sub">Their board</div>${d.board.length ? boardHTML(d.board, false) : empty('No decisions yet.')}`;
    }
    case 'task': {
      const t = w.task || {};
      const one = (side) => {
        const x = t[side];
        return `<div class="tshow ${side}"><h3>${side === 'pos' ? '👍 Fit together well' : '👎 Work against each other'}</h3>${x ? `<div class="tcards">${cardHTML(cardById(x.life))}<span class="plus">+</span>${cardHTML(cardById(x.tech))}</div><p class="twhy">${esc(x.why)}</p>` : empty('Not done yet.')}</div>`;
      };
      return `<div class="tshow-wrap">${one('pos')}${one('neg')}</div>`;
    }
    default:
      return w.deal && w.deal.board.length ? `<div class="sp-sub">Their card board</div>${boardHTML(w.deal.board, false)}` : empty('Nothing to show on this slide.');
  }
}

/* ============================== teacher ============================== */
const T = { link: null, s: null, code: null, key: null, mountKey: null, upd: null, present: false, matrixSel: null, endArm: false, bots: null };

function startTeacher({ code, key, saved }) {
  T.code = code; T.key = key; T.mountKey = null; T.s = null;
  ss.set('lvt-teacher', { code, key, mode: MODE });
  document.body.className = 'teacher-mode';
  app.innerHTML = `
  <div class="t-app" id="tapp">
    <header class="t-top">
      <button class="tbtn icon railbtn" id="railbtn" title="Slides">☰</button>
      <div class="brand"><span class="dot" id="tdot"></span>Life <span>vs</span> Tech</div>
      <button class="codepill" id="codepill" title="Show joining instructions">Room <b>${esc(code)}</b></button>
      <div class="tnav"><button class="nbtn" id="prev" title="Previous (←)">◀</button><span id="slideno"></span><button class="nbtn" id="next" title="Next (→)">▶</button></div>
      <div class="spacer"></div>
      <button class="tbtn" id="reveal" title="Let pupils see everyone’s answers on their laptops">👁<span class="lb"> Answers on laptops</span></button>
      <button class="tbtn freeze" id="freeze" title="Freeze laptops (F)">❄️<span class="lb"> Freeze</span></button>
      <div class="splitbtn"><button class="tbtn flash" id="flash" title="Flash a message and freeze (L)">📣<span class="lb"> Time to listen</span></button><button class="tbtn flash caret" id="flashmenu" title="More messages">▾</button></div>
      <button class="tbtn icon" id="more" title="More">⋯</button>
    </header>
    <aside class="t-rail" id="rail"></aside>
    <div class="rail-scrim" id="rscrim"></div>
    <main class="t-stage" id="stage"></main>
    <footer class="t-roster" id="roster"></footer>
    <div class="frozen-badge" id="fbadge" hidden></div>
  </div>`;
  const on = { status: (st) => { const d = $('#tdot'); if (d) d.className = 'dot ' + st; }, msg: onTeacherMsg };
  T.link = MODE === 'live' ? liveLink(code, on) : localHostLink(code, key, on, saved);
  T.link.hello({ t: 'hello', role: 'teacher', key });
  bindTeacher();
}

const act = (a, extra = {}) => T.link && T.link.send({ t: 'act', a, ...extra });

function onTeacherMsg(m) {
  if (m.t === 'state') { T.s = m.s; renderTeacher(); return; }
  if (m.t === 'error' && (m.e === 'badkey' || m.e === 'noroom' || m.e === 'ended')) {
    T.link && T.link.close(); T.link = null; ss.del('lvt-teacher');
    showHome(m.e === 'ended' ? 'That lesson has ended.' : 'That lesson is no longer available. Start a new one.');
  }
}

function bindTeacher() {
  $('#prev').onclick = () => act('goto', { i: T.s.slide - 1 });
  $('#next').onclick = () => act('goto', { i: T.s.slide + 1 });
  $('#freeze').onclick = () => act('freeze', { on: !(T.s.frozen || T.s.flash) });
  $('#flash').onclick = () => act('flash', { text: 'Time to listen' });
  $('#reveal').onclick = () => act('reveal', { on: !T.s.reveal });
  $('#codepill').onclick = () => showJoinInfo();
  const toggleRail = (on) => $('#tapp').classList.toggle('rail-open', on);
  $('#railbtn').onclick = () => toggleRail(!$('#tapp').classList.contains('rail-open'));
  $('#rscrim').onclick = () => toggleRail(false);
  $('#flashmenu').onclick = (e) => popMenu(e.currentTarget, `
    ${FLASHES.map((f) => `<button data-f="${esc(f.text)}"><span>${f.e}</span>${esc(f.text)}</button>`).join('')}
    <div class="mcustom"><input class="tin" id="fcustom" maxlength="60" placeholder="Your own message…"><button class="primary" id="fgo">Flash</button></div>`, (menu) => {
    $$('[data-f]', menu).forEach((b) => (b.onclick = () => { act('flash', { text: b.dataset.f }); closeMenu(); }));
    const go = () => { const t = $('#fcustom', menu).value.trim(); if (t) { act('flash', { text: t }); closeMenu(); } };
    $('#fgo', menu).onclick = go;
    $('#fcustom', menu).onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
  $('#more').onclick = (e) => popMenu(e.currentTarget, `
    <button data-m="quick"><span>➕</span>Quick question</button>
    <button data-m="names"><span>🙈</span>${T.s && T.s.hideNames ? 'Show pair names' : 'Hide pair names'}</button>
    <button data-m="chime"><span>🔔</span>Chime with flash: ${T.s && T.s.chime ? 'on' : 'off'}</button>
    <button data-m="clear"><span>🧹</span>Clear answers on this slide</button>
    <button data-m="present"><span>🖥️</span>${T.present ? 'Show controls' : 'Present mode'}</button>
    ${document.fullscreenEnabled ? '<button data-m="full"><span>⛶</span>Full screen</button>' : ''}
    <hr><button data-m="end" class="danger"><span>⏹</span>End lesson and delete answers</button>`, (menu) => {
    $$('[data-m]', menu).forEach((b) => (b.onclick = () => {
      const k = b.dataset.m; closeMenu();
      if (k === 'quick') quickQuestion();
      if (k === 'names') act('hideNames', { on: !T.s.hideNames });
      if (k === 'chime') act('chime', { on: !T.s.chime });
      if (k === 'clear') confirmBox('Clear all answers on this slide?', 'Clear answers', () => act('clearSlide'));
      if (k === 'present') togglePresent();
      if (k === 'full') { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch {} }
      if (k === 'end') confirmBox('End the lesson? Pupils will be signed out and all answers deleted.', 'End lesson', () => act('end'), true);
    }));
  });
  document.onkeydown = (e) => {
    if (!T.s || document.body.className.indexOf('teacher-mode') < 0) return;
    if (e.target.closest('input,textarea,select') || modalEl) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); act('goto', { i: T.s.slide + 1 }); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); act('goto', { i: T.s.slide - 1 }); }
    if (e.key === 'f' || e.key === 'F') act('freeze', { on: !(T.s.frozen || T.s.flash) });
    if (e.key === 'l' || e.key === 'L') act('flash', { text: 'Time to listen' });
    if (e.key === 'Escape' && T.present) togglePresent();
  };
}

function togglePresent() { T.present = !T.present; $('#tapp').classList.toggle('present', T.present); }

let menuEl = null;
function popMenu(anchor, html, bind) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'popmenu';
  menuEl.innerHTML = html;
  document.body.appendChild(menuEl);
  const r = anchor.getBoundingClientRect();
  menuEl.style.top = r.bottom + 8 + 'px';
  menuEl.style.right = Math.max(8, innerWidth - r.right) + 'px';
  bind && bind(menuEl);
  setTimeout(() => document.addEventListener('pointerdown', outside), 0);
}
function outside(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } document.removeEventListener('pointerdown', outside); }

function confirmBox(text, btn, fn, danger) {
  const m = modal(`<h2>${esc(text)}</h2><div class="mrow"><button class="ghost" data-close>Cancel</button><button class="${danger ? 'dangerbtn' : 'primary'}" id="cok">${esc(btn)}</button></div>`);
  $('#cok', m).onclick = () => { closeModal(); fn(); };
}

function joinUrl() { return MODE === 'live' ? location.host : 'this page (demo)'; }

function showJoinInfo() {
  modal(`<div class="joininfo"><div class="ji-grid"><div class="ji-qr">${qrSVG(fullJoinUrl(T.code))}<small>Scan to join</small></div><div><p>Or go to</p><div class="jurl">${esc(joinUrl())}</div><p>choose <b>We’re pupils</b> and type</p><div class="jcode">${T.code.split('').map((c) => `<span>${c}</span>`).join('')}</div></div></div><button class="primary" data-close>Done</button></div>`, 'wide');
}

function quickQuestion() {
  const m = modal(`
    <h2>Quick question</h2>
    <p class="muted">Adds a new slide after this one and sends it to every laptop.</p>
    <input class="tin" id="qq" maxlength="160" placeholder="Type your question…">
    <div class="seg" id="qtype"><button data-t="respond" class="on">💬 Typed answers</button><button data-t="poll">📊 Vote</button></div>
    <div id="qopts" hidden><textarea class="tin" id="qo" rows="4" placeholder="One option per line&#10;Yes&#10;No&#10;Not sure"></textarea></div>
    <div class="mrow"><button class="ghost" data-close>Cancel</button><button class="primary" id="qgo">Ask now ➜</button></div>`);
  let type = 'respond';
  $$('#qtype button', m).forEach((b) => (b.onclick = () => { type = b.dataset.t; $$('#qtype button', m).forEach((x) => x.classList.toggle('on', x === b)); $('#qopts', m).hidden = type !== 'poll'; }));
  $('#qgo', m).onclick = () => {
    const title = $('#qq', m).value.trim();
    if (!title) return $('#qq', m).focus();
    act('quickQ', { title, type, options: $('#qo', m).value.split('\n') });
    closeModal();
  };
  setTimeout(() => $('#qq', m).focus(), 50);
}

const pairWork = (s, pid, sl) => ({
  pair: s.pairs[pid],
  responses: (s.responses[sl.id] || []).filter((r) => r.pairId === pid),
  vote: s.polls[sl.id] ? s.polls[sl.id][pid] : undefined,
  deal: s.deals[pid] || null,
  task: s.tasks[pid] || null,
});

function didSlide(s, pid, sl) {
  switch (sl.type) {
    case 'respond': case 'split': return (s.responses[sl.id] || []).some((r) => r.pairId === pid);
    case 'poll': return !!(s.polls[sl.id] && s.polls[sl.id][pid] !== undefined);
    case 'deal': return !!(s.deals[pid] && s.deals[pid].board.length);
    case 'task': return !!(s.tasks[pid] && (s.tasks[pid].pos || s.tasks[pid].neg));
    default: return false;
  }
}

function renderTeacher() {
  const s = T.s;
  if (!s) return;
  if (s.ended) { T.link && T.link.close(); T.link = null; ss.del('lvt-teacher'); return showHome('Lesson ended. All pupil answers have been deleted.'); }
  const sl = s.slides[s.slide];
  setTheme(s.slide);
  preloadSlides(s.slides);
  $('#slideno').textContent = `${s.slide + 1} / ${s.slides.length}`;
  $('#prev').disabled = s.slide === 0;
  $('#next').disabled = s.slide === s.slides.length - 1;
  const locked = s.frozen || s.flash;
  $('#freeze').classList.toggle('on', !!locked);
  $('#freeze').innerHTML = locked ? '▶️<span class="lb"> Unfreeze</span>' : '❄️<span class="lb"> Freeze</span>';
  $('#reveal').classList.toggle('on', s.reveal);
  $('#reveal').hidden = !['respond', 'split', 'poll'].includes(sl.type);
  const fb = $('#fbadge');
  fb.hidden = !locked;
  if (locked) fb.innerHTML = `${s.flash ? `📣 Laptops showing “${esc(s.flash.text)}”` : '❄️ Laptops frozen'} <button id="unfz">Unfreeze</button>`;
  if (locked) $('#unfz').onclick = () => act('freeze', { on: false });

  // rail
  const online = new Set(s.online);
  region($('#rail'), JSON.stringify([s.slide, s.slides.map((x) => x.id + x.title), MODE, Object.keys(s.pairs).length]), `
    <div class="rail-h">Lesson</div>
    <ol class="slist">${s.slides.map((x, i) => `<li class="${i === s.slide ? 'on' : ''}" data-i="${i}"><span class="si">${TYPE_ICON[x.type]}</span><span class="st">${esc(x.type === 'title' ? x.title : x.title)}</span>${x.quick ? `<button class="x" data-rm="${x.id}" title="Remove">✕</button>` : ''}</li>`).join('')}</ol>
    <button class="ghost wide" id="addq">➕ Quick question</button>
    ${MODE === 'local' ? `<div class="demo-tools"><div class="rail-h">Demo tools</div><a class="ghost wide" href="?join=${esc(T.code)}#join-${esc(T.code)}" target="_blank" rel="noopener">🧑‍💻 Open a pupil tab</a><button class="ghost wide" id="bots">🤖 ${T.bots ? 'Stop demo pairs' : 'Add 16 demo pairs'}</button></div>` : ''}`);
  $$('#rail .slist li').forEach((li) => (li.onclick = (e) => { if (e.target.dataset.rm) return act('removeSlide', { id: e.target.dataset.rm }); act('goto', { i: +li.dataset.i }); $('#tapp').classList.remove('rail-open'); }));
  const onli = $('#rail .slist li.on'); if (onli && $('#rail')._scrolledTo !== s.slide) { $('#rail')._scrolledTo = s.slide; onli.scrollIntoView({ block: 'nearest' }); }
  const aq = $('#addq'); if (aq) aq.onclick = quickQuestion;
  const bb = $('#bots'); if (bb) bb.onclick = () => { T.bots ? stopBots() : startBots(16); $('#rail')._k = null; renderTeacher(); };

  // roster
  const pairs = Object.values(s.pairs).sort((a, b) => a.joined - b.joined);
  const doneN = pairs.filter((p) => didSlide(s, p.id, sl)).length;
  const showDone = ['respond', 'split', 'poll', 'deal', 'task'].includes(sl.type);
  region($('#roster'), JSON.stringify([pairs, s.online, showDone && pairs.map((p) => didSlide(s, p.id, sl)), s.spotlight, s.hideNames]), `
    <div class="r-sum"><b>${online.size}</b> of ${pairs.length} pairs online${showDone ? ` · <b>${doneN}</b> taken part` : ''}</div>
    <div class="r-chips">${pairs.length ? pairs.map((p) => `<button class="rchip ${online.has(p.id) ? '' : 'off'} ${showDone && didSlide(s, p.id, sl) ? 'done' : ''} ${s.spotlight === p.id ? 'spot' : ''}" data-pid="${p.id}" title="Show this pair’s screen">${avHTML(p.av)}<span>${esc(p.name)}</span><i class="tick">✓</i></button>`).join('') : `<span class="muted">Pairs appear here as they join. Click a pair to show their screen.</span>`}</div>`);
  $$('#roster .rchip').forEach((b) => (b.onclick = () => openSpotlight(b.dataset.pid)));

  // stage
  const key = sl.id + '|' + sl.type + '|' + sl.title;
  if (key !== T.mountKey) {
    T.mountKey = key; T.matrixSel = null;
    const st = $('#stage');
    st.innerHTML = '';
    st.scrollTop = 0;
    T.upd = (TEACHER_MOUNT[sl.type] || TEACHER_MOUNT.title)(st, sl);
  }
  T.upd && T.upd(s, sl);

  if (T.spotOpen) renderSpotlight();
}

const stageHead = (sl, metaId = true) => `
  <div class="st-head">
    <div class="st-kind">${TYPE_ICON[sl.type]} ${TYPE_LABEL[sl.type]}</div>
    <h1>${esc(sl.title)}</h1>
    ${sl.hint ? `<p class="st-hint">${esc(sl.hint)}</p>` : ''}
    ${sl.sub && sl.type !== 'title' ? `<p class="st-hint">${esc(sl.sub)}</p>` : ''}
    ${metaId ? '<div class="st-meta"></div>' : ''}
  </div>`;

function syncWall(box, items, s) {
  box._map ||= new Map();
  const map = box._map;
  const ids = new Set(items.map((r) => r.id));
  for (const [id, el] of map) if (!ids.has(id)) { el.remove(); map.delete(id); }
  if (!items.length && !$('.wall-empty', box)) box.insertAdjacentHTML('beforeend', `<div class="wall-empty">Answers will pop up here as pairs send them…</div>`);
  if (items.length) { const e = $('.wall-empty', box); if (e) e.remove(); }
  for (const r of items) {
    const p = s.pairs[r.pairId] || {};
    let el = map.get(r.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'wcard pop';
      el.style.setProperty('--bg', avBg(p.av || r.id));
      el.style.setProperty('--rot', hashRot(r.id) + 'deg');
      el.innerHTML = `<p>${esc(r.text)}</p><footer></footer><button class="hidebtn" title="Hide or show this answer">🙈</button>`;
      $('.hidebtn', el).onclick = () => act('hideResp', { slideId: s.slides[s.slide].id, id: r.id });
      box.appendChild(el);
      map.set(r.id, el);
      setTimeout(() => el.classList.remove('pop'), 700);
    }
    el.classList.toggle('hidden-card', !!r.hidden);
    const foot = s.hideNames ? '' : `${p.av || ''} ${esc(p.name || '')}`;
    const f = $('footer', el);
    if (f.innerHTML !== foot) f.innerHTML = foot;
  }
}

const TEACHER_MOUNT = {
  title(st, sl) {
    st.innerHTML = `
      <div class="t-hero">
        <div class="hero-img">${sl.src ? `<div class="imgframe"><img src="${esc(sl.src)}" alt="${esc(sl.title)}"></div>` : `<h1 class="mega">${esc(sl.title)}</h1>`}
          <p class="obj">${esc(sl.sub || OBJECTIVE)}</p></div>
        <div class="join-card-t">
          <div class="jc-h">Join the lesson</div>
          <div class="jc-qr">${qrSVG(fullJoinUrl(T.code))}</div>
          <div class="jc-or">Scan, or go to <b>${esc(joinUrl())}</b></div>
          <div class="jcode sm">${T.code.split('').map((c) => `<span>${c}</span>`).join('')}</div>
          <div class="jc-count"></div>
        </div>
      </div>
      <div class="joined-cloud"></div>`;
    return (s) => {
      const pairs = Object.values(s.pairs).sort((a, b) => a.joined - b.joined);
      $('.jc-count', st).textContent = pairs.length ? `${pairs.length} pair${pairs.length === 1 ? '' : 's'} joined` : 'Waiting for pairs…';
      region($('.joined-cloud', st), JSON.stringify(pairs.map((p) => p.id + p.name) + s.hideNames), pairs.map((p) => `<span class="jpair">${avHTML(p.av)}${s.hideNames ? '' : esc(p.name)}</span>`).join(''));
    };
  },
  image(st, sl) {
    st.innerHTML = `<div class="t-image"><div class="imgframe"><img src="${esc(sl.src)}" alt="${esc(sl.title)}"></div></div>`;
    return null;
  },
  cards(st, sl) {
    st.innerHTML = `${stageHead(sl, false)}
      <div class="deck-wrap"><h3 class="sec life-h">🟢 Life cards</h3><div class="deck big">${LIFE.map((c) => cardHTML(c)).join('')}</div>
      <h3 class="sec tech-h">⚫ Tech cards</h3><div class="deck big">${TECH.map((c) => cardHTML(c)).join('')}</div></div>`;
    return null;
  },
  respond(st, sl) {
    st.innerHTML = `${stageHead(sl)}<div class="wall"></div>`;
    const wall = $('.wall', st);
    return (s) => {
      const items = s.responses[sl.id] || [];
      const pairsN = new Set(items.map((r) => r.pairId)).size;
      $('.st-meta', st).innerHTML = `<span class="pillc">💬 ${items.filter((r) => !r.hidden).length} answers</span><span class="pillc">🧑‍🤝‍🧑 ${pairsN} pairs</span>`;
      const vis = items.filter((r) => !r.hidden).length;
      wall.classList.toggle('dense', vis > 12);
      wall.classList.toggle('denser', vis > 28);
      syncWall(wall, items, s);
    };
  },
  split(st, sl) {
    st.innerHTML = `${stageHead(sl)}<div class="splitwall"><div class="col left"><h2>✅ ${esc(sl.left)}</h2><div class="wall" data-s="left"></div></div><div class="col right"><h2>⛔ ${esc(sl.right)}</h2><div class="wall" data-s="right"></div></div></div>`;
    return (s) => {
      const items = s.responses[sl.id] || [];
      $('.st-meta', st).innerHTML = `<span class="pillc">💬 ${items.filter((r) => !r.hidden).length} answers</span>`;
      syncWall($('[data-s=left]', st), items.filter((r) => r.side !== 'right'), s);
      syncWall($('[data-s=right]', st), items.filter((r) => r.side === 'right'), s);
    };
  },
  poll(st, sl) {
    const many = sl.options.length > 6;
    st.innerHTML = `${stageHead(sl)}<div class="bars ${many ? 'many' : ''}">${sl.options.map((o, i) => `<div class="bar" style="--c:var(--c${i % 8})"><div class="bl">${esc(o)}</div><div class="bt"><div class="bf"></div><span class="bn">0</span></div></div>`).join('')}</div>`;
    return (s) => {
      const votes = Object.values(s.polls[sl.id] || {});
      const counts = sl.options.map((_, i) => votes.filter((v) => v === i).length);
      const max = Math.max(1, ...counts);
      $$('.bar', st).forEach((b, i) => {
        $('.bf', b).style.width = (counts[i] / max) * 100 + '%';
        $('.bn', b).textContent = counts[i];
        b.classList.toggle('top', counts[i] === max && counts[i] > 0);
      });
      $('.st-meta', st).innerHTML = `<span class="pillc">🗳️ ${votes.length} of ${Object.keys(s.pairs).length} pairs voted</span>`;
    };
  },
  deal(st, sl) {
    st.innerHTML = `
      <div class="deal-top">
        <div class="focus big"><span class="lbl">Talk about</span><span class="fq"></span></div>
        <div class="deal-ctrls">
          <div class="ctrl-l">Question for pairs</div>
          <div class="fqchips">${PROMPTS.map((p, i) => `<button data-i="${i}" title="${esc(p)}">${i + 1}</button>`).join('')}</div>
          <div class="ctrl-l">Cards dealt</div>
          <div class="seg" id="dmode"><button data-n="2">2 cards</button><button data-n="3">3 cards · challenge</button></div>
        </div>
      </div>
      <div class="deal-grid">
        <div class="panel"><div class="panel-h"><h3>Class decisions</h3><div class="legend"><span class="lg v-yes">✅ Works</span><span class="lg v-dep">🤔 Depends</span><span class="lg v-no">⛔ Doesn’t</span></div></div><div class="matrix-wrap"></div></div>
        <div class="panel"><div class="panel-h"><h3 class="feed-h">Latest decisions</h3></div><div class="feed"></div></div>
      </div>`;
    $$('.fqchips button', st).forEach((b) => (b.onclick = () => act('focusQ', { i: +b.dataset.i })));
    $$('#dmode button', st).forEach((b) => (b.onclick = () => act('dealMode', { n: +b.dataset.n })));
    return (s) => {
      $('.fq', st).textContent = PROMPTS[s.focusQ];
      $$('.fqchips button', st).forEach((b) => b.classList.toggle('on', +b.dataset.i === s.focusQ));
      $$('#dmode button', st).forEach((b) => b.classList.toggle('on', +b.dataset.n === s.dealMode));
      const all = [];
      for (const [pid, d] of Object.entries(s.deals)) for (const b of d.board) all.push({ ...b, pid });
      all.sort((a, b) => b.at - a.at);
      // matrix
      const cell = {};
      for (const b of all) {
        if (b.hidden) continue;
        const ls = b.cards.filter((c) => kindOf(c) === 'life' && !c.blank);
        const ts = b.cards.filter((c) => kindOf(c) === 'tech' && !c.blank);
        for (const l of ls) for (const t of ts) { const k = l.id + '|' + t.id; (cell[k] ||= { yes: 0, depends: 0, no: 0 })[b.verdict]++; }
      }
      region($('.matrix-wrap', st), JSON.stringify([cell, T.matrixSel]), `
        <table class="matrix"><thead><tr><th></th>${TECH.map((t) => `<th title="${esc(t.t)}"><span>${t.e}</span><small>${esc(t.t)}</small></th>`).join('')}</tr></thead>
        <tbody>${LIFE.map((l) => `<tr><th title="${esc(l.t)}"><span>${l.e}</span>${esc(l.t)}</th>${TECH.map((t) => {
          const c = cell[l.id + '|' + t.id];
          if (!c) return `<td class="mt-empty"></td>`;
          const n = c.yes + c.depends + c.no;
          const top = c.yes >= c.depends && c.yes >= c.no ? 'v-yes' : c.no >= c.depends ? 'v-no' : 'v-dep';
          const mixed = [c.yes, c.depends, c.no].filter(Boolean).length > 1;
          const sel = T.matrixSel === l.id + '|' + t.id;
          return `<td class="mt ${top} ${mixed ? 'mixed' : ''} ${sel ? 'sel' : ''}" data-k="${l.id}|${t.id}" title="${esc(l.t)} + ${esc(t.t)}: ✅${c.yes} 🤔${c.depends} ⛔${c.no}"><b>${n}</b></td>`;
        }).join('')}</tr>`).join('')}</tbody></table>`);
      $$('.matrix td.mt', st).forEach((td) => (td.onclick = () => { T.matrixSel = T.matrixSel === td.dataset.k ? null : td.dataset.k; renderTeacher(); }));
      // feed
      let list = all;
      if (T.matrixSel) {
        const [L, Tt] = T.matrixSel.split('|');
        list = all.filter((b) => b.cards.some((c) => c.id === L) && b.cards.some((c) => c.id === Tt));
      }
      $('.feed-h', st).innerHTML = T.matrixSel ? `${cardById(T.matrixSel.split('|')[0]).e} + ${cardById(T.matrixSel.split('|')[1]).e} decisions <button class="linkbtn" id="fall">show all</button>` : `Latest decisions <small>${all.length}</small>`;
      const fa = $('#fall', st); if (fa) fa.onclick = () => { T.matrixSel = null; renderTeacher(); };
      region($('.feed', st), JSON.stringify([list.slice(0, 30), s.hideNames]), list.length ? list.slice(0, 30).map((b) => {
        const p = s.pairs[b.pid] || {};
        return `<div class="fitem ${b.hidden ? 'hidden-card' : ''}">
          ${avHTML(p.av)}
          <div class="fbody"><div class="fcards">${b.cards.map(chipHTML).join('<span class="fplus">+</span>')}</div>${b.why ? `<p>“${esc(b.why)}”</p>` : ''}${s.hideNames ? '' : `<small>${esc(p.name || '')}</small>`}</div>
          <span class="vpill ${VERDICT[b.verdict].cls}">${VERDICT[b.verdict].e} ${VERDICT[b.verdict].label}</span>
          <button class="hidebtn" data-pid="${b.pid}" data-id="${b.id}" title="Hide or show">🙈</button>
        </div>`;
      }).join('') : `<div class="wall-empty">Decisions appear here as pairs add cards to their boards…</div>`);
      $$('.feed .hidebtn', st).forEach((b) => (b.onclick = () => act('hideBoard', { pairId: b.dataset.pid, id: b.dataset.id })));
    };
  },
  task(st, sl) {
    st.innerHTML = `${stageHead(sl)}<div class="taskwall"><div class="col pos"><h2>👍 Fit together well</h2><div class="tlist" data-s="pos"></div></div><div class="col neg"><h2>👎 Work against each other</h2><div class="tlist" data-s="neg"></div></div></div>`;
    return (s) => {
      let n = 0;
      for (const side of ['pos', 'neg']) {
        const items = Object.entries(s.tasks).filter(([, t]) => t[side]).map(([pid, t]) => ({ pid, ...t[side] })).sort((a, b) => a.at - b.at);
        n += items.length;
        region($(`[data-s=${side}]`, st), JSON.stringify([items, s.hideNames]), items.length ? items.map((x) => {
          const p = s.pairs[x.pid] || {};
          return `<div class="titem pop"><div class="tchips">${chipHTML(cardById(x.life))}<span class="fplus">+</span>${chipHTML(cardById(x.tech))}</div><p>${esc(x.why)}</p>${s.hideNames ? '' : `<small>${p.av || ''} ${esc(p.name || '')}</small>`}</div>`;
        }).join('') : `<div class="wall-empty">Waiting for pairs…</div>`);
      }
      $('.st-meta', st).innerHTML = `<span class="pillc">📝 ${n} examples</span>`;
    };
  },
};

/* spotlight */
function openSpotlight(pid) { T.spotOpen = pid; act('spotlight', { pairId: pid }); renderSpotlight(); }
function closeSpotlight() { T.spotOpen = null; act('spotlight', { pairId: null }); closeModal(); }

function renderSpotlight() {
  const s = T.s;
  const pid = T.spotOpen;
  if (!s || !pid || !s.pairs[pid]) { if (T.spotOpen) { T.spotOpen = null; closeModal(); } return; }
  const sl = s.slides[s.slide];
  const p = s.pairs[pid];
  const pairs = Object.values(s.pairs).sort((a, b) => a.joined - b.joined);
  const idx = pairs.findIndex((x) => x.id === pid);
  const online = s.online.includes(pid);
  const key = JSON.stringify([pid, pairWork(s, pid, sl), sl.id, s.share, s.spotlight, online, T.kickArm, s.hideNames]);
  if (modalEl && modalEl._spot === key) return;
  const html = `
    <div class="spot-top">
      <button class="nbtn" id="sprev" ${idx <= 0 ? 'disabled' : ''}>◀</button>
      <div class="spot-who">${avHTML(p.av, 'lg')}<div><h2>${s.hideNames ? 'A pair' : esc(p.name)}</h2><small><span class="dot ${online ? 'online' : 'offline'}"></span>${online ? 'Online' : 'Offline'} · ${esc(sl.title)}</small></div></div>
      <button class="nbtn" id="snext" ${idx >= pairs.length - 1 ? 'disabled' : ''}>▶</button>
      <div class="spacer"></div>
      <button class="tbtn ${s.share ? 'on' : ''}" id="sshare">${s.share ? '📡 Showing on all laptops' : '📡 Show on all laptops'}</button>
      <button class="tbtn icon" data-close title="Close">✕</button>
    </div>
    <div class="spot-body big">${renderWork(pairWork(s, pid, sl), sl)}</div>
    <div class="spot-foot"><button class="linkbtn danger" id="skick">${T.kickArm === pid ? 'Click again to remove this pair' : 'Remove this pair from the room'}</button></div>`;
  if (!modalEl || !modalEl._isSpot) {
    modal(html, 'spotmodal');
    modalEl._isSpot = true;
    modalEl.addEventListener('click', (e) => { const me = e.currentTarget; if (e.target === me || e.target.closest('[data-close]')) { T.spotOpen = null; T.kickArm = null; act('spotlight', { pairId: null }); } }, true);
  } else $('.modal', modalEl).innerHTML = html;
  modalEl._spot = key;
  $('#sprev').onclick = () => { T.kickArm = null; openSpotlight(pairs[idx - 1].id); };
  $('#snext').onclick = () => { T.kickArm = null; openSpotlight(pairs[idx + 1].id); };
  $('#sshare').onclick = () => act('share', { on: !s.share });
  $('#skick').onclick = () => {
    if (T.kickArm === pid) { T.kickArm = null; act('kick', { pairId: pid }); T.spotOpen = null; closeModal(); return; }
    T.kickArm = pid; modalEl._spot = null; renderSpotlight();
  };
}

/* ============================== demo pairs (demo mode only) ============================== */
const BOT_NAMES = ['Ava & Theo', 'Mia & Jack', 'Ruby & Leo', 'Isla & Noah', 'Freya & Alfie', 'Poppy & Oscar', 'Ella & Finn', 'Lily & Max', 'Grace & Sam', 'Evie & Harry', 'Daisy & Archie', 'Rosie & Ted', 'Millie & Arlo', 'Zara & Kai', 'Maya & Reuben', 'Esme & Jude'];
const BOT_SAY = {
  s2: ['Playing Minecraft', 'Fortnite', 'Coding in Scratch', 'Typing a story', 'Watching a how-to video', 'FIFA', 'Maths games on the iPad', 'Reading on a Kindle'],
  s3: ['If you stop concentrating you lose the game', 'You have to listen to the instructions', 'You can’t really talk to people at the same time', 'You might miss something important', 'I can listen to music while I draw'],
  s5: ['Playing outside', 'Seeing their friends', 'Getting enough sleep', 'Their homework', 'Family time', 'Football practice', 'Reading books', 'Eating proper meals'],
  s10: { left: ['Listen to music', 'Eat a snack', 'Talk to my mum', 'Relax on the sofa'], right: ['Swimming', 'Sleeping', 'Riding my bike', 'Having a shower', 'Playing football'] },
  s12: ['Homework comes first', 'I check what time it is', 'I ask my parents', 'I think about what I need to do first', 'If it helps me learn'],
  any: ['I think so', 'Not sure', 'Sometimes', 'It depends on the day'],
};
const BOT_WHY = {
  yes: ['You can listen to music while you relax', 'It helps if it is research for homework', 'You can do both easily', 'It can help you calm down'],
  depends: ['Only if it is for a short time', 'If your parents say it is okay', 'It depends if you are being careful', 'Only if your friends want to as well'],
  no: ['You might get hurt', 'Your device could get wet', 'Your friends would feel ignored', 'You need to concentrate on both', 'It is rude at the dinner table', 'You would not get to sleep'],
};
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

function startBots(n) {
  const core = T.link && T.link.core;
  if (!core) return;
  const bots = [];
  for (let i = 0; i < n; i++) {
    const cid = 'bot' + i + rnd(4);
    const bot = { cid, pid: null };
    T.link.sinks.set(cid, (m) => { if (m.t === 'welcome') bot.pid = m.pairId; });
    core.connect(cid);
    core.message(cid, { t: 'hello', role: 'pupil', name: BOT_NAMES[i % BOT_NAMES.length], av: AVATARS[i % AVATARS.length] });
    bots.push(bot);
  }
  const timer = setInterval(() => {
    const s = core.state;
    if (!s || s.frozen || s.flash || s.ended) return;
    const sl = s.slides[s.slide];
    for (const b of bots) {
      if (!b.pid || !s.pairs[b.pid] || Math.random() > 0.16) continue;
      const send = (o) => core.message(b.cid, { t: 'act', ...o });
      const mine = (s.responses[sl.id] || []).filter((r) => r.pairId === b.pid).length;
      if (sl.type === 'respond' && mine < 2) send({ a: 'respond', slideId: sl.id, text: pickOne(BOT_SAY[sl.id] || BOT_SAY.any) });
      if (sl.type === 'split' && mine < 3) { const side = Math.random() < 0.5 ? 'left' : 'right'; send({ a: 'respond', slideId: sl.id, side, text: pickOne(BOT_SAY.s10[side]) }); }
      if (sl.type === 'poll' && !(s.polls[sl.id] && s.polls[sl.id][b.pid] !== undefined)) send({ a: 'vote', slideId: sl.id, opt: Math.min(sl.options.length - 1, Math.floor(Math.random() ** 1.4 * sl.options.length)) });
      if (sl.type === 'deal') {
        const d = s.deals[b.pid];
        if (!d || !d.cur) { if (!d || d.board.length < 6) send({ a: 'deal' }); }
        else {
          const ids = d.cur.cards.map((c) => c.id);
          const risky = ids.some((x) => ['L2', 'L5', 'L8', 'L3'].includes(x));
          const v = risky ? (Math.random() < 0.75 ? 'no' : 'depends') : pickOne(['yes', 'yes', 'depends', 'no']);
          send({ a: 'decide', verdict: v, important: pickOne(['life', 'life', 'tech', 'same']), why: pickOne(BOT_WHY[v]) });
        }
      }
      if (sl.type === 'task') {
        const t = s.tasks[b.pid] || {};
        if (!t.pos) send({ a: 'task', side: 'pos', life: pickOne(['L1', 'L4', 'L10', 'L7']), tech: pickOne(['T1', 'T7', 'T6']), why: pickOne(BOT_WHY.yes) });
        else if (!t.neg) send({ a: 'task', side: 'neg', life: pickOne(['L2', 'L5', 'L8', 'L9', 'L6']), tech: pickOne(['T2', 'T3', 'T8', 'T5', 'T4']), why: pickOne(BOT_WHY.no) });
      }
    }
  }, 700);
  T.bots = { bots, timer };
}
function stopBots() {
  if (!T.bots) return;
  clearInterval(T.bots.timer);
  const core = T.link && T.link.core;
  for (const b of T.bots.bots) { if (core) { if (b.pid) core.message('host', { t: 'act', a: 'kick', pairId: b.pid }); core.disconnect(b.cid); } T.link.sinks.delete(b.cid); }
  T.bots = null;
}

/* ============================== boot ============================== */
async function detectMode() {
  if (window.LVT_FORCE_LOCAL) return 'local';
  if (location.protocol === 'file:') return 'local';
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('/api/ping', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(to);
    const j = await r.json();
    return j && j.app === 'lifevtech' ? 'live' : 'local';
  } catch { return 'local'; }
}

(async function boot() {
  MODE = await detectMode();
  document.documentElement.dataset.mode = MODE;
  const q = new URLSearchParams(location.search);
  const hj = (location.hash.match(/^#join-([a-z]{4})$/i) || [])[1] || '';
  const join = (q.get('join') || hj).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const savedP = ss.get('lvt-pupil');
  if (savedP && savedP.pairId && (!join || join === savedP.code)) return startPupil(savedP);
  if (join) return showJoin(join);
  showHome();
})();
