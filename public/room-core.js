// Life vs Tech — shared room logic.
// Runs inside the Cloudflare Durable Object (live lessons) and inside the
// teacher's browser tab (demo mode). Keep it free of DOM / platform APIs.

export const LIFE = [
  { id: 'L1', t: 'Eating a snack', e: '🍎' },
  { id: 'L2', t: 'Walking to school', e: '🚶' },
  { id: 'L3', t: 'Playing a sport', e: '⚽' },
  { id: 'L4', t: 'Doing your homework', e: '📚' },
  { id: 'L5', t: 'Going to sleep', e: '😴' },
  { id: 'L6', t: 'Eating a large meal', e: '🍽️' },
  { id: 'L7', t: 'Doing chores', e: '🧹' },
  { id: 'L8', t: 'Having a bath/shower', e: '🛁' },
  { id: 'L9', t: 'Spending time with my friends', e: '🧑‍🤝‍🧑' },
  { id: 'L10', t: 'Relaxing or calming down', e: '🧘' },
];

export const TECH = [
  { id: 'T1', t: 'Streaming music', e: '🎧' },
  { id: 'T2', t: 'Watching a film', e: '🎬' },
  { id: 'T3', t: 'Playing a video game', e: '🎮' },
  { id: 'T4', t: 'Using an app on a phone', e: '📱' },
  { id: 'T5', t: 'Taking a selfie', e: '🤳' },
  { id: 'T6', t: 'Messaging a friend', e: '💬' },
  { id: 'T7', t: 'Looking at a website', e: '🌐' },
  { id: 'T8', t: 'Using a VR headset', e: '🥽' },
  { id: 'T9', t: 'Livestreaming', e: '📡' },
  { id: 'T10', t: 'Editing a video', e: '🎞️' },
];

export const PROMPTS = [
  'Can you do both at the same time?',
  'Is it okay to do both at the same time? Why? Why not?',
  'Which one is more important?',
  'Which one takes more time?',
  'How would other people feel if you did those two things at once?',
  'How do these make you feel? How would you feel if you could only pick one?',
];

export const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🐙', '🦉', '🐝', '🐢', '🦄', '🐳', '🐧', '🦋', '🐞', '🐬', '🦔', '🐿️', '🦒', '🐘'];

export const OBJECTIVE = 'I can explain how using technology can be a distraction from other things, in both a positive and negative way.';

const img = (n, title) => ({ id: 'i' + n, type: 'image', title, src: 'slides/' + n + '.webp' });

export const DEFAULT_SLIDES = [
  { id: 's1', type: 'title', title: 'The Balance Quest', sub: OBJECTIVE, src: 'slides/01.webp' },
  { id: 's2', type: 'respond', title: 'What do you use technology for that needs you to really concentrate?', hint: 'e.g. Playing a game needs me to focus on what is happening in the game.' },
  { id: 's3', type: 'respond', title: 'Why do you need to pay attention to it? Can you do anything else at the same time?', hint: 'Does it matter if you can’t?' },
  img('02', 'Technology is like water for a growing plant'),
  { id: 's4', type: 'poll', title: 'Do you ever lose track of time when you are using technology?', options: ['Never', 'Sometimes', 'Often', 'Nearly always'], hint: 'Talk with your partner: why do you think this happens?' },
  img('03', 'Why is it so hard to stop?'),
  { id: 's14', type: 'poll', title: 'Which “sticky” trick catches you out the most?', options: ['▶️ Autoplay', '🔔 Notifications', '📜 Endless scrolling', '🙅 None of them'], hint: 'Why do you think it works on you?' },
  { id: 's5', type: 'respond', title: 'If a child spent all their time after school and at the weekend playing an online game, what might they miss out on?', hint: 'Think about family, friends, sleep, hobbies…' },
  { id: 's6', type: 'poll', title: 'How do you usually decide what to do on a device?', options: ['How much time I have', 'How I am feeling', 'I plan it in advance', 'What my friends are doing', 'Whatever comes up first'] },
  img('04', 'The Challenge: Life vs Tech'),
  { id: 's7', type: 'cards', title: 'The Life and Tech cards', sub: 'Green cards are everyday life. Grey cards are tech. You will be dealt one of each. Talk with your partner, then decide: do they work together?' },
  img('05', 'Round 1: The Perfect Match'),
  img('06', 'Round 2: The Danger Zone'),
  img('07', 'Round 3: The Social Crash'),
  img('08', 'Round 4: The Battery Drain'),
  { id: 's8', type: 'deal', title: 'Tech vs Life', sub: 'Deal the cards. Talk. Decide. Explain why.' },
  img('09', 'The Multitasking Matrix'),
  { id: 's9', type: 'poll', title: 'Which tech activity do you think is the most distracting?', options: TECH.map((c) => c.e + ' ' + c.t), hint: 'Are some activities more distracting than others? Why?' },
  { id: 's10', type: 'split', title: 'What can you do at the same time as using a device — and what can’t you?', left: 'Can do at the same time', right: 'Can’t do at the same time' },
  img('10', 'Knowing when to unplug'),
  img('11', 'The Guardrails: why age limits matter'),
  { id: 's11', type: 'task', title: 'Positive and negative', sub: 'Choose one life card and one tech card that fit together well, and one pair that work against each other. Explain why.' },
  { id: 's12', type: 'respond', title: 'How do you decide what is important to do when you are using technology?', hint: 'What helps you choose?' },
  img('12', 'Achieving digital wellbeing'),
  img('13', 'Master your screen time'),
  { id: 's13', type: 'poll', title: 'How confident are you?', sub: OBJECTIVE, options: ['🌱 Not yet', '🌿 Getting there', '🌳 I can explain it'] },
];

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
export const MAX_PAIRS = 40;
const MAX_RESP_PER_SLIDE = 6;
const MAX_BOARD = 40;

const clone = (o) => JSON.parse(JSON.stringify(o));
const rid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function cardById(id) {
  return LIFE.find((c) => c.id === id) || TECH.find((c) => c.id === id) || null;
}

export function freshState(code, teacherKey) {
  return {
    v: 1, code, teacherKey,
    created: Date.now(), last: Date.now(),
    slides: clone(DEFAULT_SLIDES), slide: 0,
    frozen: false, flash: null,
    spotlight: null, share: false,
    reveal: false, hideNames: false, chime: true,
    dealMode: 2, focusQ: 0,
    pairs: {}, responses: {}, polls: {}, deals: {}, tasks: {},
    ended: false,
  };
}

export class RoomCore {
  /**
   * @param {{send:(cid:string,msg:object)=>void, persist?:(state:object)=>void, close?:(cid:string)=>void}} io
   */
  constructor(io) {
    this.io = io;
    this.clients = new Map(); // cid -> { role, pairId }
    this.state = null;
    this._timer = null;
  }

  load(state) { this.state = state; }

  connect(cid) { this.clients.set(cid, { role: null, pairId: null }); }

  disconnect(cid) {
    const c = this.clients.get(cid);
    this.clients.delete(cid);
    if (c && c.role) this.schedule();
  }

  online() {
    const set = new Set();
    for (const c of this.clients.values()) if (c.role === 'pupil' && c.pairId) set.add(c.pairId);
    return set;
  }

  currentSlide() { return this.state.slides[this.state.slide]; }

  message(cid, raw) {
    let m;
    try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
    if (!m || typeof m !== 'object') return;
    const c = this.clients.get(cid);
    if (!c || !this.state) return;
    try {
      if (m.t === 'hello') return this.hello(cid, c, m);
      if (m.t === 'ping') return this.io.send(cid, { t: 'pong' });
      if (!c.role) return;
      if (c.role === 'teacher') this.teacherAct(c, m);
      else this.pupilAct(c, m);
      this.state.last = Date.now();
      this.schedule();
    } catch (e) {
      this.io.send(cid, { t: 'error', e: 'bad', detail: String(e && e.message || e) });
    }
  }

  hello(cid, c, m) {
    const s = this.state;
    if (m.role === 'teacher') {
      if (m.key !== s.teacherKey) return this.io.send(cid, { t: 'error', e: 'badkey' });
      c.role = 'teacher';
      this.io.send(cid, { t: 'welcome', role: 'teacher' });
      return this.flush(cid);
    }
    if (s.ended) return this.io.send(cid, { t: 'error', e: 'ended' });
    let pairId = clean(m.pairId, 20);
    if (!pairId && c.pairId && s.pairs[c.pairId]) pairId = c.pairId; // repeated hello from same connection
    let p = pairId && s.pairs[pairId];
    if (!p) {
      const name = clean(m.name, 32);
      if (!name) return this.io.send(cid, { t: 'error', e: 'noname' });
      if (Object.keys(s.pairs).length >= MAX_PAIRS) return this.io.send(cid, { t: 'error', e: 'full' });
      pairId = pairId || rid(10);
      const av = AVATARS.includes(m.av) ? m.av : pick(AVATARS);
      p = s.pairs[pairId] = { id: pairId, name, av, joined: Date.now() };
    }
    c.role = 'pupil';
    c.pairId = pairId;
    this.io.send(cid, { t: 'welcome', role: 'pupil', pairId, name: p.name, av: p.av });
    s.last = Date.now();
    this.schedule();
  }

  teacherAct(c, m) {
    const s = this.state;
    switch (m.a) {
      case 'goto': {
        const i = Math.max(0, Math.min(s.slides.length - 1, m.i | 0));
        if (i !== s.slide) { s.slide = i; s.reveal = false; s.share = false; }
        break;
      }
      case 'freeze': s.frozen = !!m.on; if (!m.on) s.flash = null; break;
      case 'flash': s.flash = { text: clean(m.text, 60) || 'Time to listen', id: rid(6), at: Date.now() }; s.frozen = true; break;
      case 'spotlight': s.spotlight = m.pairId && s.pairs[m.pairId] ? m.pairId : null; if (!s.spotlight) s.share = false; break;
      case 'share': s.share = !!m.on && !!s.spotlight; break;
      case 'reveal': s.reveal = !!m.on; break;
      case 'hideNames': s.hideNames = !!m.on; break;
      case 'chime': s.chime = !!m.on; break;
      case 'dealMode': s.dealMode = m.n === 3 ? 3 : 2; break;
      case 'focusQ': s.focusQ = Math.max(0, Math.min(PROMPTS.length - 1, m.i | 0)); break;
      case 'hideResp': {
        const r = (s.responses[m.slideId] || []).find((x) => x.id === m.id);
        if (r) r.hidden = !r.hidden;
        break;
      }
      case 'hideBoard': {
        const d = s.deals[m.pairId];
        const b = d && d.board.find((x) => x.id === m.id);
        if (b) b.hidden = !b.hidden;
        break;
      }
      case 'kick': {
        const id = m.pairId;
        if (!s.pairs[id]) break;
        delete s.pairs[id];
        delete s.deals[id];
        delete s.tasks[id];
        for (const k in s.responses) s.responses[k] = s.responses[k].filter((r) => r.pairId !== id);
        for (const k in s.polls) delete s.polls[k][id];
        if (s.spotlight === id) { s.spotlight = null; s.share = false; }
        for (const [cid, cc] of this.clients) if (cc.pairId === id) { this.io.send(cid, { t: 'error', e: 'removed' }); cc.role = null; cc.pairId = null; }
        break;
      }
      case 'quickQ': {
        const title = clean(m.title, 160);
        if (!title) break;
        const type = m.type === 'poll' ? 'poll' : 'respond';
        const slide = { id: 'q' + rid(6), type, title, quick: true };
        if (type === 'poll') {
          const opts = (Array.isArray(m.options) ? m.options : []).map((o) => clean(o, 40)).filter(Boolean).slice(0, 8);
          slide.options = opts.length >= 2 ? opts : ['Yes', 'No', 'Not sure'];
        }
        s.slides.splice(s.slide + 1, 0, slide);
        s.slide += 1; s.reveal = false; s.share = false;
        break;
      }
      case 'removeSlide': {
        const i = s.slides.findIndex((x) => x.id === m.id);
        if (i < 0 || !s.slides[i].quick) break;
        s.slides.splice(i, 1);
        if (s.slide >= i && s.slide > 0) s.slide -= 1;
        break;
      }
      case 'clearSlide': {
        const sl = this.currentSlide();
        delete s.responses[sl.id];
        delete s.polls[sl.id];
        break;
      }
      case 'end': s.ended = true; s.frozen = false; s.flash = null; break;
    }
  }

  pupilAct(c, m) {
    const s = this.state;
    const pid = c.pairId;
    if (!pid || !s.pairs[pid] || s.ended) return;
    if (s.frozen || s.flash) return; // screens frozen: ignore input
    const sl = this.currentSlide();
    switch (m.a) {
      case 'respond': {
        if (m.slideId !== sl.id || !['respond', 'split'].includes(sl.type)) return;
        const text = clean(m.text, 160);
        if (!text) return;
        const list = (s.responses[sl.id] ||= []);
        if (list.filter((r) => r.pairId === pid).length >= MAX_RESP_PER_SLIDE) return;
        const r = { id: rid(8), pairId: pid, text, at: Date.now() };
        if (sl.type === 'split') r.side = m.side === 'right' ? 'right' : 'left';
        list.push(r);
        break;
      }
      case 'unrespond': {
        const list = s.responses[m.slideId];
        if (list) s.responses[m.slideId] = list.filter((r) => !(r.id === m.id && r.pairId === pid));
        break;
      }
      case 'vote': {
        if (m.slideId !== sl.id || sl.type !== 'poll') return;
        const o = m.opt | 0;
        if (o < 0 || o >= sl.options.length) return;
        (s.polls[sl.id] ||= {})[pid] = o;
        break;
      }
      case 'deal': {
        if (sl.type !== 'deal') return;
        const d = (s.deals[pid] ||= { cur: null, board: [] });
        const used = new Set(d.board.map((b) => b.cards.map((x) => x.id).sort().join('+')));
        let cards;
        for (let tries = 0; tries < 30; tries++) {
          let nl = 1, nt = 1;
          if (s.dealMode === 3) { if (Math.random() < 0.5) nl = 2; else nt = 2; }
          const ls = shuffle(LIFE).slice(0, nl);
          const ts = shuffle(TECH).slice(0, nt);
          cards = [...ls.map((x) => ({ ...x, k: 'life' })), ...ts.map((x) => ({ ...x, k: 'tech' }))];
          if (!used.has(cards.map((x) => x.id).sort().join('+'))) break;
        }
        d.cur = { cards, at: Date.now(), id: rid(6) };
        break;
      }
      case 'blank': {
        if (sl.type !== 'deal') return;
        const d = (s.deals[pid] ||= { cur: null, board: [] });
        const k = m.k === 'tech' ? 'tech' : 'life';
        const text = clean(m.text, 40);
        if (!text || !d.cur) return;
        const card = { id: 'B' + rid(5), t: text, e: '✏️', k, blank: true };
        const i = d.cur.cards.findIndex((x) => x.k === k);
        if (i >= 0) d.cur.cards[i] = card; else d.cur.cards.push(card);
        d.cur.id = rid(6);
        break;
      }
      case 'decide': {
        const d = s.deals[pid];
        if (!d || !d.cur || sl.type !== 'deal') return;
        const verdict = ['yes', 'depends', 'no'].includes(m.verdict) ? m.verdict : null;
        if (!verdict) return;
        const important = ['life', 'tech', 'same'].includes(m.important) ? m.important : null;
        d.board.unshift({ id: rid(8), cards: d.cur.cards, verdict, important, why: clean(m.why, 200), at: Date.now() });
        d.board = d.board.slice(0, MAX_BOARD);
        d.cur = null;
        break;
      }
      case 'unboard': {
        const d = s.deals[pid];
        if (d) d.board = d.board.filter((b) => b.id !== m.id);
        break;
      }
      case 'task': {
        if (sl.type !== 'task') return;
        const side = m.side === 'neg' ? 'neg' : 'pos';
        const life = LIFE.find((x) => x.id === m.life) ? m.life : null;
        const tech = TECH.find((x) => x.id === m.tech) ? m.tech : null;
        const why = clean(m.why, 240);
        if (!life || !tech) return;
        (s.tasks[pid] ||= {})[side] = { life, tech, why, at: Date.now() };
        break;
      }
    }
  }

  // ---- views ----
  teacherView() {
    const s = this.state;
    const { teacherKey, ...rest } = s;
    return { ...rest, online: [...this.online()] };
  }

  pairWork(pid, sl) {
    const s = this.state;
    return {
      pair: s.pairs[pid],
      responses: (s.responses[sl.id] || []).filter((r) => r.pairId === pid && !r.hidden),
      vote: s.polls[sl.id] ? s.polls[sl.id][pid] : undefined,
      deal: s.deals[pid] ? { cur: s.deals[pid].cur, board: s.deals[pid].board.filter((b) => !b.hidden) } : null,
      task: s.tasks[pid] || null,
    };
  }

  pupilView(pid) {
    const s = this.state;
    const sl = this.currentSlide();
    const me = s.pairs[pid];
    const v = {
      code: s.code, ended: s.ended,
      slides: s.slides.map((x) => ({ id: x.id, type: x.type, src: x.src })),
      slide: s.slide, cur: sl, total: s.slides.length,
      frozen: s.frozen, flash: s.flash, chime: s.chime,
      reveal: s.reveal, hideNames: s.hideNames,
      dealMode: s.dealMode, focusQ: s.focusQ,
      me, mine: me ? this.pairWork(pid, sl) : null,
      pairCount: Object.keys(s.pairs).length,
    };
    if (s.share && s.spotlight && s.pairs[s.spotlight]) {
      v.spot = this.pairWork(s.spotlight, sl);
      if (s.hideNames) v.spot.pair = { ...v.spot.pair, name: 'A pair in our class' };
    }
    if (s.reveal) {
      const names = (r) => (s.hideNames ? {} : { name: s.pairs[r.pairId]?.name, av: s.pairs[r.pairId]?.av });
      v.wall = (s.responses[sl.id] || []).filter((r) => !r.hidden).map((r) => ({ id: r.id, text: r.text, side: r.side, mine: r.pairId === pid, ...names(r) }));
      if (sl.type === 'poll') {
        const counts = sl.options.map(() => 0);
        for (const o of Object.values(s.polls[sl.id] || {})) counts[o]++;
        v.counts = counts;
      }
    }
    return v;
  }

  schedule() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this.flush(); }, 60);
  }

  flush(only) {
    if (!this.state) return;
    let tv = null;
    for (const [cid, c] of this.clients) {
      if (only && cid !== only) continue;
      if (c.role === 'teacher') this.io.send(cid, { t: 'state', s: (tv ||= this.teacherView()) });
      else if (c.role === 'pupil' && c.pairId) this.io.send(cid, { t: 'state', s: this.pupilView(c.pairId) });
    }
    if (!only && this.io.persist) this.io.persist(this.state);
  }
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
