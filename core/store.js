/* GRIND · store — the one record (grind.json in userData), its defaults, the
   reader that rebuilds it from known keys, and the reducer every change goes
   through.

   Pure: no fs, no Electron, no clock of its own. main.js loads and saves; the
   reducer gets `ctx = { now, id() }` and returns the next record plus a list of
   effects (rescan a counter, re-register the hotkeys, close a Todoist task)
   for main to carry out. That split is what lets test/unit.cjs drive every op
   without a window. */
'use strict';

const path = require('path');

const VERSION = 1;
const STAGES = ['idea', 'film', 'edit', 'posted'];
const PLATFORMS = ['instagram', 'soundcloud'];
const KINDS = ['reel', 'carousel', 'story', 'track', 'mix'];
const COLORS = ['ye', 'te', 'bl', 'or', 'vi', 'cy', 'pk'];
const AUDIO = ['.wav', '.aif', '.aiff', '.flac', '.mp3', '.ogg'];
const PRESETS = ['.serumpreset', '.fxp'];

/* The three counters GRIND ships with. Folders are resolved against the
   Documents folder main hands in, so the record never carries a machine path
   it did not discover. `history` says whether a folder's existing files count
   as past work the first time it is scanned: your own preset folder does,
   Serum's shared User folder (where downloaded presets also land) does not. */
function defaultCounters(docs) {
  const serum = path.join(docs, 'Xfer', 'Serum 2 Presets', 'presets');
  return [
    { id: 'patches', label: 'patches', noun: 'patch', color: 'ye', aim: 5,
      sources: [{ path: path.join(serum, 'curate'), exts: PRESETS.slice(), history: true },
                { path: path.join(serum, 'User'), exts: PRESETS.slice(), history: false }] },
    { id: 'samples', label: 'samples', noun: 'sample', color: 'te', aim: 5,
      sources: [{ path: path.join(docs, 'curate', 'samples'), exts: AUDIO.slice(), history: true }] },
    { id: 'posts', label: 'posts', noun: 'post', color: 'bl', aim: 2, sources: [], todoistLabel: 'post' },
  ];
}

function blank(docs) {
  return {
    v: VERSION,
    counters: defaultCounters(docs),
    events: [],        // { id, c, at, n, via: tap|hotkey|folder|todoist|post, ref?, note? }
    seen: {},          // counterId → { fileKey: path } — every file already counted (or baselined)
    sourcesScanned: {},// source path → true once its first scan has run
    pending: [],       // { id, c, found, files:[{key,path,at}] } — a burst of files waiting for a yes
    dismissed: [],     // refs of Todoist-counted events that were undone, so a re-poll never brings them back
    goals: [],         // { id, label, c|null, n, from, by, done }
    learn: { daw: 'fl', current: null, done: {}, notes: {} },
    challenge: { done: {}, rolls: {} },
    posts: [],         // { id, title, platform, kind, stage, notes, link, created, posted, taskId }
    todoist: { project: '02 | curate', socials: 'socials', production: 'production',
               rootProject: '04 | core', rootSection: 'claude/codex',
               lastPoll: 0, linked: {} },   // linked: taskId → { kind: lesson|challenge|post, id }
    desk: null,        // the CREATE summary last read from root's sync tasks
    settings: { hotkeys: false, notify: true, window: 'week' },
  };
}

/* ── Reading ──────────────────────────────────────────────────────────────
   A record read at boot is the most dangerous input the app has (ROOT learnt
   that twice). Every field is read through a default, every array is proved
   to be one, and anything the shape cannot account for is dropped. */
const str = (v, fb = '') => (v == null ? fb : String(v));
const num = (v, fb = 0) => (Number.isFinite(+v) ? +v : fb);
const arr = v => (Array.isArray(v) ? v : []);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const oneOf = (v, list, fb) => (list.includes(v) ? v : fb);

function normalise(raw, docs) {
  const src = obj(raw);
  const db = blank(docs);
  if (Array.isArray(src.counters) && src.counters.length) {
    db.counters = src.counters.filter(c => c && c.id).map(c => ({
      id: str(c.id), label: str(c.label, c.id), noun: str(c.noun, c.label || c.id),
      color: oneOf(c.color, COLORS, 'ye'), aim: Math.max(0, Math.round(num(c.aim, 0))),
      sources: arr(c.sources).filter(s => s && s.path).map(s => ({
        path: str(s.path), exts: arr(s.exts).map(e => str(e).toLowerCase()).filter(Boolean), history: !!s.history })),
      ...(c.todoistLabel ? { todoistLabel: str(c.todoistLabel) } : {}),
    }));
  }
  const ids = new Set(db.counters.map(c => c.id));
  db.events = arr(src.events).filter(e => e && ids.has(e.c) && Number.isFinite(+e.at)).map(e => ({
    id: str(e.id), c: str(e.c), at: +e.at, n: Math.max(1, Math.round(num(e.n, 1))), via: str(e.via, 'tap'),
    ...(e.ref ? { ref: str(e.ref) } : {}), ...(e.note ? { note: str(e.note) } : {}) }));
  Object.entries(obj(src.seen)).forEach(([c, m]) => { db.seen[c] = {}; Object.entries(obj(m)).forEach(([k, p]) => { db.seen[c][k] = str(p); }); });
  Object.keys(obj(src.sourcesScanned)).forEach(p => { db.sourcesScanned[p] = true; });
  db.pending = arr(src.pending).filter(p => p && ids.has(p.c)).map(p => ({
    id: str(p.id), c: str(p.c), found: num(p.found), files: arr(p.files).map(f => ({ key: str(f.key), path: str(f.path), at: num(f.at) })) }));
  db.dismissed = arr(src.dismissed).map(r => str(r)).filter(Boolean).slice(-500);
  db.goals = arr(src.goals).filter(g => g && g.id).map(g => ({
    id: str(g.id), label: str(g.label, 'goal'), c: g.c && ids.has(g.c) ? str(g.c) : null,
    n: Math.max(1, Math.round(num(g.n, 1))), from: str(g.from), by: str(g.by), done: Math.max(0, Math.round(num(g.done))) }));
  const L = obj(src.learn);
  db.learn = { daw: oneOf(L.daw, ['fl', 'ableton'], 'fl'), current: L.current ? str(L.current) : null, done: {}, notes: {} };
  Object.entries(obj(L.done)).forEach(([k, v]) => { const o = obj(v); db.learn.done[k] = { at: num(o.at), via: str(o.via, 'app'), ...(o.note ? { note: str(o.note) } : {}) }; });
  Object.entries(obj(L.notes)).forEach(([k, v]) => { if (v) db.learn.notes[k] = str(v); });
  const CH = obj(src.challenge);
  Object.entries(obj(CH.done)).forEach(([k, v]) => { const o = obj(v); db.challenge.done[k] = { at: num(o.at), id: str(o.id), ...(o.note ? { note: str(o.note) } : {}) }; });
  Object.entries(obj(CH.rolls)).forEach(([k, v]) => { db.challenge.rolls[k] = Math.max(0, Math.round(num(v))); });
  db.posts = arr(src.posts).filter(p => p && p.id).map(p => ({
    id: str(p.id), title: str(p.title, 'untitled'), platform: oneOf(p.platform, PLATFORMS, 'instagram'),
    kind: oneOf(p.kind, KINDS, 'reel'), stage: oneOf(p.stage, STAGES, 'idea'), notes: str(p.notes), link: str(p.link),
    created: num(p.created), posted: p.posted ? num(p.posted) : null, taskId: p.taskId ? str(p.taskId) : null }));
  const T = obj(src.todoist);
  ['project', 'socials', 'production', 'rootProject', 'rootSection'].forEach(k => { if (T[k] != null) db.todoist[k] = str(T[k]); });
  db.todoist.lastPoll = num(T.lastPoll);
  Object.entries(obj(T.linked)).forEach(([k, v]) => {
    const o = obj(v);
    if (o.kind && o.id) db.todoist.linked[k] = { kind: str(o.kind), id: str(o.id), ...(o.week ? { week: str(o.week) } : {}) };
  });
  db.desk = src.desk && typeof src.desk === 'object' ? src.desk : null;
  const S = obj(src.settings);
  db.settings = { hotkeys: !!S.hotkeys, notify: S.notify !== false, window: oneOf(S.window, ['week', 'month', 'year', 'all'], 'week') };
  return db;
}

/* ── Changing ─────────────────────────────────────────────────────────────
   apply(db, op, p, ctx) → { db, effects }. Unknown ops throw, so a typo in the
   renderer is a visible error rather than a silent no-op. The record handed in
   is not mutated: main swaps the whole thing only when an op succeeds. */
const clone = v => JSON.parse(JSON.stringify(v));

function counterOf(db, id) {
  const c = db.counters.find(x => x.id === id);
  if (!c) throw new Error('no counter "' + id + '"');
  return c;
}
function slug(s, taken) {
  let base = String(s || 'counter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'counter';
  let id = base, i = 2;
  while (taken.has(id)) id = base + '-' + i++;
  return id;
}

const OPS = {
  /* +n by hand (a tile, or a global hotkey). */
  tap(db, p, ctx) {
    counterOf(db, p.c);
    db.events.push({ id: ctx.id('ev'), c: p.c, at: ctx.now, n: Math.max(1, Math.round(+p.n || 1)), via: p.via === 'hotkey' ? 'hotkey' : 'tap' });
  },
  /* Taking an event back. A file it counted stays in `seen`, so a rescan will
     not count it again — undo means "that one does not count", not "recount". */
  undo(db, p) {
    const i = db.events.findIndex(e => e.id === p.id);
    if (i < 0) throw new Error('that event is already gone');
    const [e] = db.events.splice(i, 1);
    if (e.via === 'todoist' && e.ref) db.dismissed = db.dismissed.concat(e.ref).slice(-500);
    if (e.via === 'post' && e.ref) { const post = db.posts.find(x => 'post:' + x.id === e.ref); if (post) { post.stage = 'edit'; post.posted = null; } }
  },

  'counter.add'(db, p, ctx, fx) {
    const id = slug(p.label, new Set(db.counters.map(c => c.id)));
    db.counters.push({ id, label: str(p.label, id).trim() || id, noun: str(p.noun || p.label, id).trim() || id,
                       color: oneOf(p.color, COLORS, 'or'), aim: Math.max(0, Math.round(num(p.aim))), sources: [] });
    fx.push({ type: 'hotkeys' });
  },
  'counter.update'(db, p, ctx, fx) {
    const c = counterOf(db, p.id);
    if (p.label != null) c.label = str(p.label).trim() || c.label;
    if (p.noun != null) c.noun = str(p.noun).trim() || c.noun;
    if (p.color != null) c.color = oneOf(p.color, COLORS, c.color);
    if (p.aim != null) c.aim = Math.max(0, Math.min(999, Math.round(num(p.aim))));
    if (p.todoistLabel !== undefined) { if (p.todoistLabel) c.todoistLabel = str(p.todoistLabel).trim(); else delete c.todoistLabel; }
  },
  'counter.remove'(db, p, ctx, fx) {
    counterOf(db, p.id);
    if (db.counters.length <= 1) throw new Error('keep at least one counter');
    db.counters = db.counters.filter(c => c.id !== p.id);
    db.events = db.events.filter(e => e.c !== p.id);
    db.pending = db.pending.filter(x => x.c !== p.id);
    delete db.seen[p.id];
    db.goals.forEach(g => { if (g.c === p.id) g.c = null; });
    fx.push({ type: 'hotkeys' }, { type: 'watch' });
  },
  'counter.move'(db, p, ctx, fx) {
    const i = db.counters.findIndex(c => c.id === p.id), j = i + (p.dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= db.counters.length) return;
    [db.counters[i], db.counters[j]] = [db.counters[j], db.counters[i]];
    fx.push({ type: 'hotkeys' });
  },
  'source.add'(db, p, ctx, fx) {
    const c = counterOf(db, p.c);
    const where = str(p.path).trim();
    if (!where) throw new Error('pick a folder first');
    if (c.sources.some(s => path.resolve(s.path).toLowerCase() === path.resolve(where).toLowerCase())) throw new Error('that folder is already watched');
    const exts = arr(p.exts).length ? arr(p.exts).map(e => { e = str(e).trim().toLowerCase(); return e.startsWith('.') ? e : '.' + e; }) : AUDIO.slice();
    c.sources.push({ path: where, exts, history: !!p.history });
    fx.push({ type: 'watch' }, { type: 'rescan', c: c.id });
  },
  'source.update'(db, p, ctx, fx) {
    const c = counterOf(db, p.c);
    const s = c.sources[p.i];
    if (!s) throw new Error('no such folder');
    if (p.exts) s.exts = arr(p.exts).map(e => { e = str(e).trim().toLowerCase(); return e.startsWith('.') ? e : '.' + e; }).filter(e => e.length > 1);
    fx.push({ type: 'rescan', c: c.id });
  },
  'source.remove'(db, p, ctx, fx) {
    const c = counterOf(db, p.c);
    c.sources.splice(p.i, 1);
    fx.push({ type: 'watch' });
  },

  /* A burst of new files is held until it is answered: yes counts them at
     their own file times, no marks them seen without counting. */
  'pending.accept'(db, p, ctx) {
    const b = db.pending.find(x => x.id === p.id);
    if (!b) return;
    db.seen[b.c] = db.seen[b.c] || {};
    b.files.forEach(f => {
      db.seen[b.c][f.key] = f.path;
      db.events.push({ id: ctx.id('ev'), c: b.c, at: f.at || ctx.now, n: 1, via: 'folder', ref: f.path });
    });
    db.pending = db.pending.filter(x => x.id !== p.id);
  },
  'pending.ignore'(db, p) {
    const b = db.pending.find(x => x.id === p.id);
    if (!b) return;
    db.seen[b.c] = db.seen[b.c] || {};
    b.files.forEach(f => { db.seen[b.c][f.key] = f.path; });
    db.pending = db.pending.filter(x => x.id !== p.id);
  },

  'goal.add'(db, p, ctx) {
    const n = Math.round(num(p.n));
    if (!str(p.label).trim()) throw new Error('a goal needs a name');
    if (!(n > 0)) throw new Error('a goal needs a number above zero');
    db.goals.push({ id: ctx.id('gl'), label: str(p.label).trim(), c: p.c && db.counters.some(c => c.id === p.c) ? p.c : null,
                    n, from: str(p.from) || isoDay(ctx.now), by: str(p.by), done: 0 });
  },
  'goal.update'(db, p) {
    const g = db.goals.find(x => x.id === p.id);
    if (!g) throw new Error('no such goal');
    if (p.label != null) g.label = str(p.label).trim() || g.label;
    if (p.n != null) g.n = Math.max(1, Math.round(num(p.n, g.n)));
    if (p.by != null) g.by = str(p.by);
  },
  'goal.bump'(db, p) {
    const g = db.goals.find(x => x.id === p.id);
    if (!g || g.c) return;
    g.done = Math.max(0, g.done + (p.dir < 0 ? -1 : 1));
  },
  'goal.remove'(db, p) { db.goals = db.goals.filter(g => g.id !== p.id); },

  'learn.daw'(db, p) { db.learn.daw = oneOf(p.daw, ['fl', 'ableton'], 'fl'); },
  'learn.current'(db, p) { db.learn.current = p.id ? str(p.id) : null; },
  'learn.done'(db, p, ctx, fx) {
    db.learn.done[str(p.id)] = { at: ctx.now, via: p.via === 'todoist' ? 'todoist' : 'app' };
    /* Finishing the lesson you picked hands "current" back to the first one
       not done, so the home card moves on by itself. */
    if (db.learn.current === str(p.id)) db.learn.current = null;
    if (p.via !== 'todoist') closeLinked(db, 'lesson', str(p.id), fx);
  },
  'learn.undone'(db, p) { delete db.learn.done[str(p.id)]; },
  'learn.note'(db, p) { const t = str(p.text).trim(); if (t) db.learn.notes[str(p.id)] = t.slice(0, 4000); else delete db.learn.notes[str(p.id)]; },

  'challenge.done'(db, p, ctx, fx) {
    db.challenge.done[str(p.week)] = { at: ctx.now, id: str(p.id), ...(p.note ? { note: str(p.note).slice(0, 2000) } : {}) };
    if (p.via !== 'todoist') closeLinked(db, 'challenge', str(p.id), fx, str(p.week));
  },
  'challenge.undone'(db, p) { delete db.challenge.done[str(p.week)]; },
  'challenge.reroll'(db, p) { if (!db.challenge.done[p.week]) db.challenge.rolls[str(p.week)] = (db.challenge.rolls[p.week] || 0) + 1; },

  'post.add'(db, p, ctx) {
    const title = str(p.title).trim();
    if (!title) throw new Error('a post needs a title');
    db.posts.push({ id: ctx.id('po'), title: title.slice(0, 200), platform: oneOf(p.platform, PLATFORMS, 'instagram'),
                    kind: oneOf(p.kind, KINDS, 'reel'), stage: 'idea', notes: str(p.notes).slice(0, 4000), link: '',
                    created: ctx.now, posted: null, taskId: null });
  },
  'post.update'(db, p) {
    const x = db.posts.find(q => q.id === p.id);
    if (!x) throw new Error('no such post');
    ['title', 'notes', 'link'].forEach(k => { if (p[k] != null) x[k] = str(p[k]).slice(0, k === 'notes' ? 4000 : 400); });
    if (p.platform) x.platform = oneOf(p.platform, PLATFORMS, x.platform);
    if (p.kind) x.kind = oneOf(p.kind, KINDS, x.kind);
  },
  /* Moving a post onto `posted` is what counts it, once, under its own ref —
     so ticking its Todoist task afterwards cannot count it a second time. */
  'post.move'(db, p, ctx, fx) {
    const x = db.posts.find(q => q.id === p.id);
    if (!x) throw new Error('no such post');
    const to = p.stage ? oneOf(p.stage, STAGES, x.stage)
                       : STAGES[Math.max(0, Math.min(STAGES.length - 1, STAGES.indexOf(x.stage) + (p.dir < 0 ? -1 : 1)))];
    if (to === x.stage) return;
    const was = x.stage;
    x.stage = to;
    const ref = 'post:' + x.id;
    if (to === 'posted') {
      x.posted = p.at || ctx.now;
      const c = postCounter(db);
      if (c && !db.events.some(e => e.ref === ref)) db.events.push({ id: ctx.id('ev'), c: c.id, at: x.posted, n: 1, via: 'post', ref, note: x.title });
      if (x.taskId && p.via !== 'todoist') fx.push({ type: 'closeTask', id: x.taskId });
    } else if (was === 'posted') {
      x.posted = null;
      db.events = db.events.filter(e => e.ref !== ref);
    }
  },
  'post.remove'(db, p) {
    db.posts = db.posts.filter(x => x.id !== p.id);
    Object.keys(db.todoist.linked).forEach(k => { const l = db.todoist.linked[k]; if (l.kind === 'post' && l.id === p.id) delete db.todoist.linked[k]; });
  },

  /* A post counted from a completed Todoist task GRIND did not send. */
  'td.count'(db, p, ctx) {
    counterOf(db, p.c);
    if (!p.ref || db.events.some(e => e.ref === p.ref)) return;
    db.events.push({ id: ctx.id('ev'), c: p.c, at: num(p.at, ctx.now), n: 1, via: 'todoist', ref: str(p.ref),
                     ...(p.note ? { note: str(p.note) } : {}) });
  },
  'todoist.link'(db, p) {
    db.todoist.linked[str(p.taskId)] = { kind: str(p.kind), id: str(p.id), ...(p.week ? { week: str(p.week) } : {}) };
    if (p.kind === 'post') { const x = db.posts.find(q => q.id === p.id); if (x) x.taskId = str(p.taskId); }
  },
  'todoist.polled'(db, p) { db.todoist.lastPoll = num(p.at); },
  'desk.set'(db, p) { db.desk = p.desk && typeof p.desk === 'object' ? p.desk : null; },

  'todoist.set'(db, p) {
    ['project', 'socials', 'production', 'rootProject', 'rootSection'].forEach(k => { if (p[k] != null) db.todoist[k] = str(p[k]).trim(); });
  },
  'settings.set'(db, p, ctx, fx) {
    if (p.hotkeys != null) { db.settings.hotkeys = !!p.hotkeys; fx.push({ type: 'hotkeys' }); }
    if (p.notify != null) db.settings.notify = !!p.notify;
    if (p.window != null) db.settings.window = oneOf(p.window, ['week', 'month', 'year', 'all'], db.settings.window);
  },
};

/* Finishing something in GRIND closes the Todoist task it was sent as. */
function closeLinked(db, kind, id, fx, week) {
  Object.entries(db.todoist.linked).forEach(([taskId, l]) => {
    if (l.kind === kind && l.id === id && (!week || !l.week || l.week === week)) fx.push({ type: 'closeTask', id: taskId });
  });
}

function isoDay(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* Posts count into the counter that listens for the post label, else the one
   called `posts`. */
function postCounter(db) {
  return db.counters.find(c => c.todoistLabel) || db.counters.find(c => c.id === 'posts') || null;
}

function apply(db, op, p, ctx) {
  const fn = OPS[op];
  if (!fn) throw new Error('unknown op "' + op + '"');
  const next = clone(db);
  const fx = [];
  fn(next, p || {}, ctx, fx);
  return { db: next, effects: fx };
}

module.exports = { VERSION, STAGES, PLATFORMS, KINDS, COLORS, AUDIO, PRESETS,
                   blank, normalise, apply, postCounter, defaultCounters, OPS: Object.keys(OPS) };
