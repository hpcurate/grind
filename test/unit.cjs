/* GRIND · unit checks for everything that is not a window: the week maths,
   the reducer, the folder-counting rules (on a real temp folder), the Todoist
   rules (against a fake fetch), the CREATE reader and the curriculum.
   Run: npm test */
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const D = require('../core/derive');
const Store = require('../core/store');
const Files = require('../core/files');
const Todoist = require('../core/todoist');
const RootLink = require('../core/rootlink');
const C = require('../app/curriculum');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
let uid = 0;
const ctxAt = now => ({ now, id: p => p + '_' + (uid++) });
const T = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = T(2026, 10, 17);                     // a Saturday, ISO week 42
const docs = path.join(os.tmpdir(), 'grind-docs-fixture');
const fresh = () => Store.normalise(null, docs);
const run = (db, op, p, now = NOW) => Store.apply(db, op, p, ctxAt(now));

/* ── derive ── */
test('ISO weeks start on Monday and number like the calendar', () => {
  assert.equal(D.weekKey(NOW), '2026-W42');
  assert.equal(D.weekKey(T(2026, 1, 1)), '2026-W01');
  assert.equal(D.weekKey(T(2024, 12, 30)), '2025-W01');
  assert.equal(D.weekKey(T(2027, 1, 3)), '2026-W53');
  assert.equal(new Date(D.startOfWeek(NOW)).getDay(), 1);
  assert.equal(D.isoDate(D.startOfWeek(NOW)), '2026-10-12');
  assert.equal(D.parseDate('2026-10-12'), new Date(2026, 9, 12).getTime());
});

test('counter totals land in the right windows', () => {
  let db = fresh();
  const at = [T(2026, 10, 12, 9), T(2026, 10, 16), T(2026, 10, 3), T(2026, 2, 1), T(2025, 12, 31)];
  at.forEach(t => { db = run(db, 'tap', { c: 'patches' }, t).db; });
  db = run(db, 'tap', { c: 'patches', n: 3 }, T(2026, 10, 17, 8)).db;
  const s = D.counterStats(db, 'patches', NOW);
  assert.deepEqual([s.week, s.month, s.year, s.all], [5, 6, 7, 8]);
  assert.equal(s.weeks.length, 12);
  assert.equal(s.weeks[11].n, 5);
  assert.equal(s.days.length, 7);
  assert.equal(D.counterStats(db, 'samples', NOW).all, 0);
});

test('goal pace says what is needed and what is happening, and finishes', () => {
  let db = fresh();
  for (let i = 0; i < 10; i++) db = run(db, 'tap', { c: 'patches' }, T(2026, 10, 1 + i)).db;
  db = run(db, 'goal.add', { label: '40 patches', c: 'patches', n: 40, from: '2026-10-01', by: '2026-11-30' }).db;
  const p = D.goalProgress(db, db.goals[0], NOW);
  assert.equal(p.done, 10);
  assert.equal(p.left, 30);
  assert.ok(p.needPerWeek > 4.5 && p.needPerWeek < 5, String(p.needPerWeek));   // 30 left over ~6.4 weeks
  assert.ok(p.doingPerWeek > 4, String(p.doingPerWeek));
  assert.equal(p.finished, false);
  db = run(db, 'goal.add', { label: 'EP', n: 1 }).db;
  db = run(db, 'goal.bump', { id: db.goals[1].id, dir: 1 }).db;
  assert.equal(D.goalProgress(db, db.goals[1], NOW).finished, true);
  const late = D.goalProgress(db, db.goals[0], T(2026, 12, 15));
  assert.equal(late.overdue, true);
  db = run(db, 'goal.add', { label: 'today', c: 'patches', n: 100, from: '2026-10-17' }).db;
  for (let i = 0; i < 5; i++) db = run(db, 'tap', { c: 'patches' }).db;
  assert.equal(D.goalProgress(db, db.goals[2], NOW).doingPerWeek, 5, 'one good day is not 35 a week');
});

test('finishing the current lesson hands "current" to the next one not done', () => {
  let db = fresh();
  db = run(db, 'learn.current', { id: 'bass-reese' }).db;
  assert.equal(D.currentLesson(db, C).id, 'bass-reese');
  db = run(db, 'learn.done', { id: 'bass-reese' }).db;
  assert.equal(db.learn.current, null);
  assert.equal(D.currentLesson(db, C).id, 'start-daw');
});

test('the weekly challenge is stable, rerolls move it, and every week has one', () => {
  let db = fresh();
  const a = D.weekChallenge(db, C, NOW), b = D.weekChallenge(db, C, NOW + 3600e3);
  assert.equal(a.challenge.id, b.challenge.id);
  db = run(db, 'challenge.reroll', { week: a.key }).db;
  assert.notEqual(D.weekChallenge(db, C, NOW).challenge.id, a.challenge.id);
  const seen = new Set();
  for (let w = 0; w < C.challenges.length; w++) seen.add(D.weekChallenge(fresh(), C, NOW + w * 7 * D.DAY).challenge.id);
  assert.equal(seen.size, C.challenges.length, 'a full lap of weeks visits every challenge once');
  db = run(db, 'challenge.done', { week: a.key, id: 'x' }).db;
  const before = D.weekChallenge(db, C, NOW).challenge.id;
  db = run(db, 'challenge.reroll', { week: a.key }).db;
  assert.equal(D.weekChallenge(db, C, NOW).challenge.id, before, 'a done week does not reroll');
});

test('the ask-Claude text carries setup, lesson, notes, progress and the question', () => {
  let db = fresh();
  db = run(db, 'learn.note', { id: 'bass-reese', text: 'detune at 14 cents felt right' }).db;
  db = run(db, 'tap', { c: 'patches' }).db;
  const t = D.askText(db, C, 'bass-reese', 'why is it thin?', NOW);
  assert.match(t, /FL Studio/);
  assert.match(t, /Serum 2/);
  assert.match(t, /Reese: two saws and patience/);
  assert.match(t, /detune at 14 cents/);
  assert.match(t, /1 patches/);
  assert.match(t, /why is it thin\?/);
  db = run(db, 'learn.daw', { daw: 'ableton' }).db;
  assert.match(D.askText(db, C, 'bass-reese', '', NOW), /Ableton Live 12 \(coming from FL Studio\)/);
});

/* ── store ── */
test('a record read at boot is rebuilt from known keys', () => {
  const db = Store.normalise({ counters: 'nope', events: [{ c: 'ghost', at: 1 }, { c: 'patches', at: 'x' }, { c: 'patches', at: 5, n: -3 }],
    learn: { daw: 'logic', done: { a: 7 } }, posts: [{ id: 'p', stage: 'viral' }], settings: { window: 'decade' }, junk: 1 }, docs);
  assert.equal(db.counters.length, 3);
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].n, 1);
  assert.equal(db.learn.daw, 'fl');
  assert.equal(db.posts[0].stage, 'idea');
  assert.equal(db.settings.window, 'week');
  assert.equal(db.junk, undefined);
  assert.deepEqual(Store.normalise(JSON.parse(JSON.stringify(db)), docs), db, 'normalising twice changes nothing');
});

test('defaults: patches watch your curate folder (history) and Serum User (new only)', () => {
  const db = fresh();
  const p = db.counters.find(c => c.id === 'patches');
  assert.ok(p.sources[0].path.endsWith(path.join('presets', 'curate')) && p.sources[0].history);
  assert.ok(p.sources[1].path.endsWith(path.join('presets', 'User')) && !p.sources[1].history);
  assert.ok(db.counters.find(c => c.id === 'samples').sources[0].path.endsWith(path.join('curate', 'samples')));
  assert.equal(db.counters.find(c => c.id === 'posts').todoistLabel, 'post');
});

test('apply never mutates the record it was given, and unknown ops throw', () => {
  const db = fresh();
  const snap = JSON.stringify(db);
  run(db, 'tap', { c: 'patches' });
  assert.equal(JSON.stringify(db), snap);
  assert.throws(() => run(db, 'nope', {}), /unknown op/);
  assert.throws(() => run(db, 'tap', { c: 'ghost' }), /no counter/);
});

test('undo takes an event off; an undone Todoist count is remembered', () => {
  let db = fresh();
  db = run(db, 'td.count', { c: 'posts', at: NOW, ref: 'td:42', note: 'reel' }).db;
  db = run(db, 'td.count', { c: 'posts', at: NOW, ref: 'td:42' }).db;
  assert.equal(db.events.length, 1, 'the same task never counts twice');
  db = run(db, 'undo', { id: db.events[0].id }).db;
  assert.equal(db.events.length, 0);
  assert.deepEqual(db.dismissed, ['td:42']);
  assert.equal(Todoist.completedOps(db, [{ id: '42', labels: ['post'], completed_at: new Date(NOW).toISOString() }]).length, 0);
});

test('a post counts once when it reaches posted, and un-counts when moved back', () => {
  let db = fresh();
  db = run(db, 'post.add', { title: 'reese walkthrough', platform: 'instagram', kind: 'reel' }).db;
  const id = db.posts[0].id;
  for (let i = 0; i < 3; i++) db = run(db, 'post.move', { id, dir: 1 }).db;
  assert.equal(db.posts[0].stage, 'posted');
  assert.equal(db.events.filter(e => e.c === 'posts').length, 1);
  db = run(db, 'post.move', { id, dir: 1 }).db;
  assert.equal(db.events.length, 1, 'moving past the last stage is a no-op');
  db = run(db, 'post.move', { id, dir: -1 }).db;
  assert.equal(db.events.length, 0);
  assert.equal(db.posts[0].posted, null);
});

test('finishing something GRIND sent closes its task; finishing it from Todoist does not', () => {
  let db = fresh();
  db = run(db, 'post.add', { title: 'x' }).db;
  const pid = db.posts[0].id;
  db = run(db, 'todoist.link', { taskId: 't1', kind: 'post', id: pid }).db;
  assert.equal(db.posts[0].taskId, 't1');
  let r = run(db, 'post.move', { id: pid, stage: 'posted' });
  assert.deepEqual(r.effects, [{ type: 'closeTask', id: 't1' }]);
  r = run(db, 'post.move', { id: pid, stage: 'posted', via: 'todoist' });
  assert.deepEqual(r.effects, []);
  db = run(db, 'todoist.link', { taskId: 't2', kind: 'lesson', id: 'bass-sub' }).db;
  assert.deepEqual(run(db, 'learn.done', { id: 'bass-sub' }).effects, [{ type: 'closeTask', id: 't2' }]);
  assert.deepEqual(run(db, 'learn.done', { id: 'bass-sub', via: 'todoist' }).effects, []);
  db = run(db, 'todoist.link', { taskId: 't3', kind: 'challenge', id: 'one-osc', week: '2026-W42' }).db;
  assert.deepEqual(run(db, 'challenge.done', { week: '2026-W42', id: 'one-osc' }).effects, [{ type: 'closeTask', id: 't3' }]);
});

test('counters: add, rename, aim, move, folders, remove', () => {
  let db = fresh();
  db = run(db, 'counter.add', { label: 'Stems', noun: 'stem' }).db;
  const c = db.counters[3];
  assert.equal(c.id, 'stems');
  db = run(db, 'counter.add', { label: 'stems' }).db;
  assert.equal(db.counters[4].id, 'stems-2');
  db = run(db, 'counter.update', { id: 'stems', aim: 4, label: 'stem bounces', color: 'pk' }).db;
  assert.equal(db.counters[3].aim, 4);
  db = run(db, 'counter.move', { id: 'stems', dir: -1 }).db;
  assert.equal(db.counters[2].id, 'stems');
  const r = run(db, 'source.add', { c: 'stems', path: path.join(docs, 'stems'), exts: ['WAV', 'flac'] });
  assert.deepEqual(r.db.counters[2].sources[0].exts, ['.wav', '.flac']);
  assert.ok(r.effects.some(e => e.type === 'rescan'));
  assert.throws(() => run(r.db, 'source.add', { c: 'stems', path: path.join(docs, 'stems') }), /already watched/);
  db = run(r.db, 'tap', { c: 'stems' }).db;
  db = run(db, 'goal.add', { label: 'g', c: 'stems', n: 3 }).db;
  db = run(db, 'counter.remove', { id: 'stems' }).db;
  assert.ok(!db.counters.some(x => x.id === 'stems'));
  assert.equal(db.events.length, 0);
  assert.equal(db.goals[0].c, null, 'a goal outlives its counter as a by-hand goal');
});

test('goal validation', () => {
  const db = fresh();
  assert.throws(() => run(db, 'goal.add', { label: '', n: 3 }), /name/);
  assert.throws(() => run(db, 'goal.add', { label: 'x', n: 0 }), /above zero/);
});

/* ── files ── */
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'grind-files-')); }
function touch(p, ageMs = 0) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x' + Math.random());
  if (ageMs) { const t = new Date(Date.now() - ageMs); fs.utimesSync(p, t, t); }
}
function setup(history = true) {
  const dir = tmp();
  let db = fresh();
  db.counters[0].sources = [{ path: path.join(dir, 'curate'), exts: ['.serumpreset', '.fxp'], history },
                            { path: path.join(dir, 'User'), exts: ['.serumpreset', '.fxp'], history: false }];
  return { dir, db };
}
const scan = (db, now = Date.now()) => Files.applyScan(db, 'patches', Files.readSources(db.counters[0]), ctxAt(now));

test('first scan counts your own folder at file times and only notes the shared one', () => {
  const { dir, db } = setup();
  touch(path.join(dir, 'curate', 'reese', 'a.SerumPreset'), 40 * D.DAY);
  touch(path.join(dir, 'curate', 'b.fxp'), 2 * D.DAY);
  touch(path.join(dir, 'curate', 'notes.txt'));
  touch(path.join(dir, 'User', 'someone-elses.SerumPreset'));
  const r = scan(db);
  assert.equal(r.added.length, 2);
  assert.ok(r.added[0].at < Date.now() - 30 * D.DAY, 'an old preset is dated when it was made');
  assert.equal(Object.keys(r.db.seen.patches).length, 3, 'the User folder file is seen but not counted');
  assert.equal(scan(r.db).added.length, 0, 'a second scan changes nothing');
});

test('new files count once; renames, moves and re-saves never count again; deletes never un-count', () => {
  const { dir } = setup();
  let { db } = setup(); db.counters[0].sources[0].path = path.join(dir, 'curate'); db.counters[0].sources[1].path = path.join(dir, 'User');
  db = scan(db).db;
  touch(path.join(dir, 'curate', 'new.SerumPreset'));
  let r = scan(db);
  assert.equal(r.added.length, 1);
  db = r.db;
  fs.renameSync(path.join(dir, 'curate', 'new.SerumPreset'), path.join(dir, 'curate', 'renamed.SerumPreset'));
  r = scan(db); assert.equal(r.added.length, 0, 'rename'); db = r.db;
  fs.mkdirSync(path.join(dir, 'User'), { recursive: true });
  fs.renameSync(path.join(dir, 'curate', 'renamed.SerumPreset'), path.join(dir, 'User', 'moved.SerumPreset'));
  r = scan(db); assert.equal(r.added.length, 0, 'move between watched folders'); db = r.db;
  const p = path.join(dir, 'User', 'moved.SerumPreset');
  fs.unlinkSync(p); touch(p);
  r = scan(db); assert.equal(r.added.length, 0, 're-save under a new file id'); db = r.db;
  fs.unlinkSync(p);
  r = scan(db); assert.equal(r.db.events.length, 1, 'delete keeps the count');
});

test('a burst of files waits for a yes', () => {
  const { dir, db: db0 } = setup();
  let db = scan(db0).db;
  for (let i = 0; i < Files.BURST + 5; i++) touch(path.join(dir, 'curate', 'pack', `p${i}.fxp`));
  const r = scan(db);
  assert.equal(r.added.length, 0);
  assert.equal(r.db.pending.length, 1);
  assert.equal(r.db.pending[0].files.length, Files.BURST + 5);
  assert.equal(scan(r.db).db.pending.length, 1, 'a held burst is not held twice');
  const yes = run(r.db, 'pending.accept', { id: r.db.pending[0].id }).db;
  assert.equal(yes.events.length, Files.BURST + 5);
  assert.equal(scan(yes).added.length, 0);
  const no = run(r.db, 'pending.ignore', { id: r.db.pending[0].id }).db;
  assert.equal(no.events.length, 0);
  assert.equal(scan(no).added.length, 0, 'ignored files stay ignored');
  db = no;
});

test('a missing folder is reported, not fatal', () => {
  const db = fresh();
  db.counters[0].sources = [{ path: path.join(tmp(), 'nope'), exts: ['.fxp'], history: true }];
  const reads = Files.readSources(db.counters[0]);
  assert.equal(reads[0].exists, false);
  assert.equal(Files.applyScan(db, 'patches', reads, ctxAt(NOW)).added.length, 0);
});

/* ── todoist ── */
function fakeFetch(routes) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url, opts });
    const u = new URL(url);
    const key = (opts.method || 'GET') + ' ' + u.pathname.replace('/api/v1', '');
    const h = routes[key];
    if (!(key in routes)) return { ok: false, status: 404, text: async () => '' };
    const out = typeof h === 'function' ? h(u, opts) : h;
    if (out && out.status) return { ok: false, status: out.status, text: async () => '' };
    return { ok: true, status: out == null ? 204 : 200, text: async () => (out == null ? '' : JSON.stringify(out)) };
  };
  f.calls = calls;
  return f;
}

test('the client folds names, pages through results and builds the right requests', async () => {
  const f = fakeFetch({
    'GET /projects': { results: [{ id: 'p1', name: '02|Curate' }], next_cursor: null },
    'GET /sections': { results: [{ id: 's1', name: 'socials' }] },
    'GET /tasks/completed/by_completion_date': u => (u.searchParams.get('cursor')
      ? { items: [{ id: 'b' }], next_cursor: null } : { items: [{ id: 'a' }], next_cursor: 'c2' }),
    'POST /tasks': (u, o) => ({ id: 'new1', echo: JSON.parse(o.body) }),
    'POST /tasks/new1/close': null,
  });
  const td = Todoist.client('tok', f);
  assert.deepEqual(await td.resolve('02 | curate', 'Socials'), { projectId: 'p1', sectionId: 's1' });
  const done = await td.completed(NOW - D.DAY, NOW, 'p1');
  assert.deepEqual(done.map(x => x.id), ['a', 'b']);
  const added = await td.add({ content: 'c', description: 'd', projectId: 'p1', sectionId: 's1', labels: ['grind', 'post'] });
  assert.deepEqual(added.echo, { content: 'c', description: 'd', project_id: 'p1', section_id: 's1', labels: ['grind', 'post'] });
  assert.equal(await td.close('new1'), null);
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer tok');
  await assert.rejects(Todoist.client('bad', fakeFetch({ 'GET /projects': { status: 401 } })).check(), /rejected the token/);
  await assert.rejects(td.resolve('nope'), /not found/);
});

test('completed tasks become progress exactly once', () => {
  let db = fresh();
  db = run(db, 'post.add', { title: 'clip' }).db;
  db = run(db, 'todoist.link', { taskId: '1', kind: 'lesson', id: 'bass-sub' }).db;
  db = run(db, 'todoist.link', { taskId: '2', kind: 'post', id: db.posts[0].id }).db;
  db = run(db, 'todoist.link', { taskId: '3', kind: 'challenge', id: 'one-osc', week: '2026-W42' }).db;
  const items = [{ id: '1' }, { id: '2', completed_at: '2026-10-16T10:00:00Z' }, { id: '3' },
                 { id: '4', labels: ['Post'], content: 'story' }, { id: '5', labels: ['other'] }];
  const ops = Todoist.completedOps(db, items);
  assert.deepEqual(ops.map(o => o[0]), ['learn.done', 'post.move', 'challenge.done', 'td.count']);
  ops.forEach(([o, p]) => { db = run(db, o, p).db; });
  assert.ok(db.learn.done['bass-sub']);
  assert.equal(db.posts[0].stage, 'posted');
  assert.equal(db.events.filter(e => e.c === 'posts').length, 2);
  assert.deepEqual(Todoist.completedOps(db, items), [], 'a second poll over the same window does nothing');
});

/* ── rootlink ── */
const fence = (title, state, written) => ({ content: title, description:
  `ROOT sync · state · device dev1\nWritten x. Do not edit by hand.\n\n\`\`\`root\n${JSON.stringify({ app: 'root', kind: 'sync', version: 1, route: 'todoist', device: 'dev1', written, days: {}, state })}\n\`\`\`` });
const CREATE_REC = {
  v: 2,
  works: [
    { id: 'w1', area: 'production', name: 'night bus', stage: 'arrange', touched: '2026-10-15', done: { 'production|arrange|intro': 'x', 'production|idea|a': 'x' } },
    { id: 'w2', area: 'mixing', name: 'set one', stage: 'drill', touched: '2026-10-16', done: {} },
    { id: 'w3', area: 'production', name: 'old one', stage: 'done', touched: '2026-01-01', done: {} },
  ],
  sessions: [
    { id: 's1', work: 'w1', area: 'production', date: '2026-10-13', hours: 2 },
    { id: 's2', work: null, area: 'mixing', date: '2026-10-17', hours: 1.5, practice: true },
    { id: 's3', work: 'w2', area: 'mixing', date: '2026-10-02', hours: 3 },
  ],
};

test('CREATE is read from ROOT · state tasks and nothing else is kept', () => {
  const tasks = [
    fence('ROOT · state', { 'do-stats-v1': { secret: 1 }, log_2026: { private: true } }, 100),
    fence('ROOT · state 2', { create_v1: CREATE_REC, tend: {} }, 100),
    { content: 'groceries', description: '```root\n{"route":"todoist","state":{"create_v1":{}}}\n```' },
    { content: 'ROOT · state 3', description: 'no fence here' },
  ];
  const found = RootLink.extract(tasks);
  assert.deepEqual(found.create, CREATE_REC);
  assert.deepEqual(Object.keys(found).sort(), ['config', 'create', 'device', 'written']);
  const s = RootLink.summarise(found, NOW);
  assert.equal(JSON.stringify(s).includes('secret'), false);
  assert.equal(JSON.stringify(s).includes('private'), false);
  assert.equal(s.week.hours, 3.5);
  assert.deepEqual(s.week.byArea, { production: 2, mixing: 1.5 });
  assert.equal(s.week.practice, 1.5);
  assert.equal(s.month.hours, 6.5);
  assert.deepEqual(s.works.map(w => w.name), ['set one', 'night bus'], 'in progress only, latest first');
  assert.equal(s.finished, 1);
  const nb = s.works[1];
  assert.equal(nb.stageLabel, 'arrangement');
  assert.equal(nb.ticks, 1);
  assert.equal(nb.items, 7);
  assert.equal(s.recent[0].date, '2026-10-17');
});

test('an edited stage list in the payload is used; without one the ticks set a floor', () => {
  const rec = JSON.parse(JSON.stringify(CREATE_REC));
  rec.works[1].done = { 'mixing|drill|a': 1, 'mixing|drill|b': 1, 'mixing|drill|c': 1, 'mixing|drill|d': 1, 'mixing|drill|e': 1 };
  let s = RootLink.summarise(RootLink.extract([fence('ROOT · state', { create_v1: rec }, 1)]), NOW);
  assert.equal(s.works[0].items, 5, 'five ticks against a shipped list of four reads 5/5, never 5/4');
  const cfg = { create: { areas: [{ key: 'mixing', label: 'dj', stages: [{ key: 'drill', label: 'practise', items: ['1', '2', '3', '4', '5', '6'] }, { key: 'played', terminal: true }] }] } };
  s = RootLink.summarise(RootLink.extract([fence('ROOT · state', { create_v1: rec, root_config_v1: cfg }, 1)]), NOW);
  assert.equal(s.works.find(w => w.name === 'set one').stageLabel, 'practise');
  assert.equal(s.works.find(w => w.name === 'set one').items, 6);
});

test('fetchDesk says so when root has not synced CREATE yet', async () => {
  const td = { resolve: async () => ({ sectionId: 's' }), tasks: async () => [] };
  await assert.rejects(RootLink.fetchDesk(td, '04 | core', 'claude/codex', NOW), /run sync in root/);
});

/* ── curriculum ── */
/* ── the session clock ── */
test('a session runs focus → break → focus and files its minutes when it ends', () => {
  const M = 60000;
  let db = fresh(), r;
  assert.deepEqual(db.settings.session, { goalMin: 120, breakEvery: 50, breakMin: 10, notify: true });
  r = run(db, 'session.start', {}, NOW); db = r.db;
  assert.deepEqual(r.effects, [{ type: 'session' }]);
  assert.equal(db.session.goalSec, 7200); assert.equal(db.session.breakEvery, 3000); assert.equal(db.session.breakLen, 600);
  assert.equal(run(db, 'session.start', { goalMin: 30 }, NOW + M).db.session.goalSec, 7200, 'a second start leaves the running one alone');
  let v = D.sessionView(db.session, NOW + 20 * M);
  assert.equal(Math.round(v.focus), 1200); assert.equal(Math.round(v.left), 1800); assert.equal(v.phase, 'focus');
  db = run(db, 'session.pause', {}, NOW + 20 * M).db;
  v = D.sessionView(db.session, NOW + 90 * M);
  assert.equal(Math.round(v.focus), 1200, 'paused time is not focus');
  db = run(db, 'session.resume', {}, NOW + 90 * M).db;
  db = run(db, 'session.phase', { phase: 'break' }, NOW + 120 * M).db;
  assert.equal(db.session.breaks, 1); assert.equal(Math.round(db.session.focusSec), 3000);
  v = D.sessionView(db.session, NOW + 124 * M);
  assert.equal(v.phase, 'break'); assert.equal(Math.round(v.left), 360); assert.equal(Math.round(v.focus), 3000, 'a break is not focus');
  db = run(db, 'session.phase', { phase: 'focus' }, NOW + 130 * M).db;
  assert.equal(db.session.sinceBreak, 0);
  r = run(db, 'session.end', {}, NOW + 140 * M); db = r.db;
  assert.equal(db.session, null);
  assert.deepEqual(r.effects.map(e => e.type), ['session', 'unlink']);
  assert.equal(db.sessions.length, 1); assert.equal(db.sessions[0].focusSec, 3600); assert.equal(db.sessions[0].breaks, 1);
  assert.equal(D.focusMinutes(db, D.startOfWeek(NOW), NOW + 200 * M), 60);
  db = run(run(db, 'session.start', {}, NOW + 200 * M).db, 'session.end', {}, NOW + 200 * M + 30000).db;
  assert.equal(db.sessions.length, 1, 'under a minute of focus is not filed');
});

test('session settings are clamped, and a session on disk survives a reload', () => {
  let db = run(fresh(), 'settings.set', { session: { goalMin: '90', breakEvery: 0, breakMin: 999 }, flowExe: '  C:\\x\\FLOW.exe ' }).db;
  assert.deepEqual(db.settings.session, { goalMin: 90, breakEvery: 0, breakMin: 120, notify: true });
  assert.equal(db.settings.flowExe, 'C:\\x\\FLOW.exe');
  db = run(db, 'session.start', {}, NOW).db;
  const v = D.sessionView(db.session, NOW + 600000);
  assert.equal(v.breakEvery, 0); assert.equal(v.nextP, null); assert.equal(Math.round(v.left), 90 * 60 - 600, 'no breaks: it counts down to the goal');
  const back = Store.normalise(JSON.parse(JSON.stringify(db)), docs);
  assert.deepEqual(back.session, db.session);
  assert.deepEqual(back.settings, db.settings);
  const junk = Store.normalise({ session: { start: 'x' }, sessions: [null, { start: 5, focusSec: -3 }], settings: { session: { goalMin: 'lots' } } }, docs);
  assert.equal(junk.session, null);
  assert.deepEqual(junk.sessions, [{ start: 5, end: 5, focusSec: 0, goalSec: 0, breaks: 0 }]);
  assert.equal(junk.settings.session.goalMin, 120);
  assert.equal(junk.settings.flowExe, null);
});

test('the curriculum is whole: unique ids, real tracks, a drill on every lesson', () => {
  const ids = new Set();
  C.lessons.forEach(l => {
    assert.ok(!ids.has(l.id), 'duplicate lesson ' + l.id); ids.add(l.id);
    assert.ok(C.tracks.some(t => t.id === l.track), l.id + ' track');
    ['title', 'why', 'listen'].forEach(k => assert.ok(l[k] && l[k].length > 10, l.id + ' ' + k));
    assert.ok(l.concept.length >= 2 && l.steps.length >= 3 && l.traps.length >= 2, l.id + ' sections');
    assert.ok(Array.isArray(l.daw.fl) && Array.isArray(l.daw.ableton), l.id + ' daw');
    assert.ok(l.drill.task && l.drill.doneWhen, l.id + ' drill');
    assert.ok([null, 'patch', 'sample'].includes(l.drill.makes), l.id + ' makes');
    assert.ok([1, 2, 3].includes(l.tier) && l.minutes > 0, l.id + ' tier/minutes');
    assert.ok(D.askText(fresh(), C, l.id, 'q', NOW).includes(l.title));
  });
  const cids = new Set(C.challenges.map(c => c.id));
  assert.equal(cids.size, C.challenges.length, 'duplicate challenge id');
  C.challenges.forEach(c => assert.ok(c.title && c.text && ['patch', 'sample', 'post'].includes(c.makes), c.id));
  C.tracks.forEach(t => assert.ok(C.lessons.some(l => l.track === t.id), t.id + ' has lessons'));
  assert.equal(C.lessons[0].id, 'start-daw', 'the DAW test is the first lesson');
});

(async () => {
  let fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ok   ' + t.name); }
    catch (e) { fail++; console.log('  FAIL ' + t.name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n       ')); }
  }
  console.log(`\n${tests.length - fail}/${tests.length} passed`);
  process.exit(fail ? 1 : 0);
})();
