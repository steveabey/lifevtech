// Life vs Tech — Cloudflare Worker + Durable Object.
// Each lesson is one Durable Object, named by its 4-letter room code.
// Room data (pair names, answers) is deleted when the teacher ends the lesson,
// or automatically after 4 hours without activity.

import { RoomCore, freshState, CODE_CHARS } from '../public/room-core.js';

const IDLE_LIMIT = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_TEACHER_CODE = 'walden'; // change by adding a TEACHER_CODE secret in Cloudflare

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function newCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/api/ping') return json({ app: 'lifevtech', ok: true });

    if (url.pathname === '/api/create' && req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch {}
      const expected = String(env.TEACHER_CODE || DEFAULT_TEACHER_CODE).trim().toLowerCase();
      if (String(body.teacherCode || '').trim().toLowerCase() !== expected) return json({ error: 'badcode' }, 403);
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = newCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/init?code=' + code, { method: 'POST' });
        if (r.status === 200) {
          const { key } = await r.json();
          return json({ code, key });
        }
      }
      return json({ error: 'busy' }, 503);
    }

    if (url.pathname === '/ws') {
      const code = String(url.searchParams.get('code') || '').toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) return new Response('Bad room code', { status: 400 });
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(req);
    }

    return env.ASSETS.fetch(req);
  },
};

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sockets = new Map(); // cid -> WebSocket
    this.saveTimer = null;
    this.core = new RoomCore({
      send: (cid, msg) => {
        const ws = this.sockets.get(cid);
        if (ws) try { ws.send(JSON.stringify(msg)); } catch {}
      },
      persist: (state) => this.queueSave(state),
    });
    ctx.blockConcurrencyWhile(async () => {
      const st = await ctx.storage.get('state');
      if (st && !st.ended) this.core.load(st);
    });
  }

  queueSave(state) {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      if (state.ended) {
        await this.wipe();
        return;
      }
      await this.ctx.storage.put('state', state);
    }, 1500);
  }

  async wipe() {
    this.core.state = null;
    await this.ctx.storage.deleteAll();
    for (const [cid, ws] of this.sockets) {
      try { ws.send(JSON.stringify({ t: 'error', e: 'ended' })); ws.close(1000, 'ended'); } catch {}
      this.sockets.delete(cid);
    }
  }

  async alarm() {
    const st = this.core.state;
    if (!st || st.ended || Date.now() - (st.last || 0) > IDLE_LIMIT) {
      await this.wipe();
      return;
    }
    await this.ctx.storage.setAlarm(Date.now() + 30 * 60 * 1000);
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/init') {
      if (this.core.state && !this.core.state.ended) return new Response('taken', { status: 409 });
      const key = crypto.randomUUID();
      const state = freshState(url.searchParams.get('code'), key);
      this.core.load(state);
      await this.ctx.storage.put('state', state);
      await this.ctx.storage.setAlarm(Date.now() + 30 * 60 * 1000);
      return new Response(JSON.stringify({ key }), { status: 200 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (!this.core.state) {
      server.send(JSON.stringify({ t: 'error', e: 'noroom' }));
      server.close(1000, 'noroom');
      return new Response(null, { status: 101, webSocket: client });
    }

    const cid = crypto.randomUUID();
    this.sockets.set(cid, server);
    this.core.connect(cid);
    server.addEventListener('message', (ev) => this.core.message(cid, ev.data));
    const gone = () => {
      if (!this.sockets.has(cid)) return;
      this.sockets.delete(cid);
      this.core.disconnect(cid);
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}
