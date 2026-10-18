/* GRIND · main process.

   Owns the record (userData/grind.json), the folder watchers, the Todoist
   token and every network call, the session clock and the FLOW link. The
   renderer only ever asks: it sends ops through IPC, main runs them through
   core/store.js, saves, carries out the effects and broadcasts the new state.
   Closing the window hides it to the tray so the watchers, the hotkeys and
   the session clock keep working; Quit is in the tray menu.

   Test hooks: GRIND_DOCS stands in for the Documents folder, GRIND_NO_NET
   switches every network call off, GRIND_USERDATA points the record at a
   throwaway profile (used to smoke-test the packed exe), GRIND_FLOW_PIPE puts
   the FLOW link on a private pipe (and FLOW is never launched). */
'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, dialog, shell, clipboard,
        globalShortcut, Notification, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

if (process.env.GRIND_USERDATA) app.setPath('userData', process.env.GRIND_USERDATA);

const Store = require('./core/store');
const Files = require('./core/files');
const Todoist = require('./core/todoist');
const RootLink = require('./core/rootlink');
const FlowLink = require('./core/flowlink');
const Derive = require('./core/derive');
const C = require('./app/curriculum');

const VERSION = require('./package.json').version;
const DOCS = process.env.GRIND_DOCS || app.getPath('documents');
const NO_NET = !!process.env.GRIND_NO_NET;
const DATA = app.getPath('userData');
const DB_FILE = path.join(DATA, 'grind.json');
const TOKEN_FILE = path.join(DATA, 'todoist.bin');
const WIN_FILE = path.join(DATA, 'win-state.json');
const ICON = path.join(__dirname, 'build', 'icon.ico');
const FLOW_EXE = path.join(DOCS, 'github', 'flow', 'dist', 'FLOW-win32-x64', 'FLOW.exe');

const MIN = 60 * 1000;
const SCAN_EVERY = 5 * MIN, POLL_EVERY = 10 * MIN, DESK_EVERY = 30 * MIN;

app.setAppUserModelId('com.hugo.grind');

const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

let win = null, tray = null;
let db = null;
let uid = 0;
const status = {
  version: VERSION, net: !NO_NET,
  paths: { docs: DOCS, data: DATA },
  sources: {},
  todoist: { hasToken: false, ok: null, error: '', busy: false },
  desk: { busy: false, error: '' },
  flow: 'off',                  // the FLOW link: off · connecting · on · lost
};

const ctx = () => ({ now: Date.now(), id: p => p + '_' + Date.now().toString(36) + '_' + (uid++).toString(36) });

/* ── The record on disk ───────────────────────────────────────────────── */
function load() {
  let raw = null, fresh = false;
  try { raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') {
      /* Unreadable, not missing: keep the bad file beside the new one rather
         than overwriting the only copy of the history. */
      try { fs.copyFileSync(DB_FILE, DB_FILE + '.unreadable-' + Date.now()); } catch {}
      try { raw = JSON.parse(fs.readFileSync(DB_FILE + '.bak', 'utf8')); } catch { raw = null; }
    }
    fresh = !raw;
  }
  db = Store.normalise(raw, DOCS);
  if (fresh) {
    /* First run: the samples folder GRIND counts from is made, empty, so FL's
       render dialog has somewhere to point at. Nothing else is created. */
    db.counters.forEach(c => c.sources.forEach(s => {
      if (/[\\/]curate[\\/]samples$/i.test(s.path)) { try { fs.mkdirSync(s.path, { recursive: true }); } catch {} }
    }));
    writeNow();
  }
}

let saveT = null, backedUp = false;
function save() { clearTimeout(saveT); saveT = setTimeout(writeNow, 250); }
function writeNow() {
  clearTimeout(saveT); saveT = null;
  try {
    fs.mkdirSync(DATA, { recursive: true });
    if (!backedUp && fs.existsSync(DB_FILE)) { fs.copyFileSync(DB_FILE, DB_FILE + '.bak'); backedUp = true; }
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error('[grind] save failed', e); }
}

function snapshot() { return { db, status, now: Date.now() }; }
function broadcast() { if (win && !win.isDestroyed()) win.webContents.send('state', snapshot()); }
function toast(msg) { if (win && !win.isDestroyed()) win.webContents.send('toast', String(msg)); }

function commit(op, payload) {
  const r = Store.apply(db, op, payload, ctx());
  db = r.db;
  save();
  effects(r.effects);
  broadcast();
  return r;
}

function effects(list) {
  const seen = new Set();
  list.forEach(fx => {
    const k = fx.type + ':' + (fx.c || fx.id || '');
    if (seen.has(k)) return;
    seen.add(k);
    if (fx.type === 'rescan') setImmediate(() => scanCounter(fx.c));
    else if (fx.type === 'watch') setImmediate(rewatch);
    else if (fx.type === 'hotkeys') setImmediate(registerHotkeys);
    else if (fx.type === 'closeTask') closeTask(fx.id);
    else if (fx.type === 'session') { flowUpdate(); refreshTray(); }
    else if (fx.type === 'unlink') unlinkFlow();
  });
}

/* ── The session clock ────────────────────────────────────────────────────
   The record keeps when the phase began; this reads the clock once a second
   and changes the record only when something happens — the goal is reached,
   a break is due, a break is over. Those are worth a sound: a break nobody
   hears is no break. Counting stays silent. */
function sessionTick() {
  const s = db && db.session;
  if (!s || !s.running) return;
  const v = Derive.sessionView(s, Date.now());
  if (s.phase === 'focus') {
    if (!s.goalHit && v.focus >= s.goalSec) { commit('session.goal'); sessionNotify('Session goal reached', `${Math.round(s.goalSec / 60)} minutes of focus — keep going or end the session.`); }
    if (s.breakEvery > 0 && v.since >= s.breakEvery) { commit('session.phase', { phase: 'break' }); sessionNotify('Break', `${Math.round(s.breakLen / 60)} minutes — stand up, rest your ears, look away from the screen.`); }
  } else if (v.left <= 0) { commit('session.phase', { phase: 'focus' }); sessionNotify('Back to it', 'The break is over.'); }
}
function sessionNotify(title, body) {
  if (!db.settings.session.notify || !Notification.isSupported()) return;
  try { new Notification({ title, body, silent: false, icon: ICON }).show(); } catch {}
}

/* ── The FLOW link (core/flowlink.js) ─────────────────────────────────────
   GRIND is the clock, FLOW follows: its timer shows this session, its music
   pauses on the breaks. FLOW's own timer buttons come back as commands. */
let unlinking = false;
const flow = FlowLink.create({
  exe: () => (process.env.GRIND_FLOW_PIPE ? null : db.settings.flowExe || FLOW_EXE),
  onState: (s, was) => {
    status.flow = s;
    if (s === 'on') flowUpdate();
    if (was === 'on' && s !== 'on' && !unlinking) toast(s === 'lost' ? 'FLOW closed — unlinked' : 'FLOW unlinked');
    broadcast();
  },
  onMessage: m => {
    if (m.t === 'error') { toast(m.msg); return; }
    if (m.t !== 'cmd') return;
    if (m.cmd === 'toggle') commit(!db.session ? 'session.start' : db.session.running ? 'session.pause' : 'session.resume');
    else if (m.cmd === 'skip' && db.session) commit('session.phase', { phase: db.session.phase === 'focus' ? 'break' : 'focus' });
    else if (m.cmd === 'end' && db.session) commit('session.end');
  },
});
function flowUpdate() {
  if (!flow.connected) return;
  const v = Derive.sessionView(db.session, Date.now());
  flow.update(v ? { t: 'session', phase: v.phase, running: v.running, left: Math.round(v.left), total: Math.round(v.total),
                    focus: Math.round(v.focus), goal: v.goal, label: 'GRIND' }
                : { t: 'session', phase: 'idle', running: false, label: 'GRIND' });
}
function unlinkFlow() {
  if (flow.state === 'off') return;
  unlinking = true;
  try { flow.close(); } finally { unlinking = false; }
}

/* ── Counting files ───────────────────────────────────────────────────── */
function scanCounter(id) {
  const c = db.counters.find(x => x.id === id);
  if (!c || !c.sources.length) return;
  const reads = Files.readSources(c);
  Object.assign(status.sources, Files.status(reads));
  const before = JSON.stringify([db.seen[id], db.sourcesScanned, db.pending.length]);
  const r = Files.applyScan(db, id, reads, ctx());
  db = r.db;
  const changed = r.added.length || r.held || before !== JSON.stringify([db.seen[id], db.sourcesScanned, db.pending.length]);
  if (changed) save();
  if (r.added.length) announce(c, r.added);
  if (r.held) toast(`${r.held.files.length} new files in a ${c.label} folder — count them?`);
  broadcast();
}
function scanAll() { db.counters.forEach(c => { if (c.sources.length) scanCounter(c.id); }); }

/* A count you did not see happen is worth a line, not a fanfare: one toast in
   the window, and a silent Windows notification if GRIND is not in front.
   A first scan that imports old files says nothing. */
function announce(c, added) {
  const recent = added.filter(e => Date.now() - e.at < 15 * MIN);
  if (!recent.length) return;
  const name = recent.length === 1 ? path.basename(recent[0].ref || '').replace(/\.[^.]+$/, '') : recent.length + ' new';
  const week = Derive.counterStats(db, c.id, Date.now()).week;
  const msg = `+${recent.length} ${recent.length === 1 ? c.noun : c.label} · ${name} · ${week} this week`;
  toast(msg);
  notify('GRIND', msg);
}
function notify(title, body) {
  if (!db.settings.notify || (win && win.isFocused()) || !Notification.isSupported()) return;
  try { new Notification({ title, body, silent: true, icon: ICON }).show(); } catch {}
}

const watchers = new Map();     // folder → FSWatcher
const queued = new Map();       // counter id → timer
function queueScan(id) {
  clearTimeout(queued.get(id));
  queued.set(id, setTimeout(() => { queued.delete(id); scanCounter(id); }, 1500));
}
function rewatch() {
  const want = new Map();
  db.counters.forEach(c => c.sources.forEach(s => {
    const k = path.resolve(s.path).toLowerCase();
    if (!want.has(k)) want.set(k, { path: s.path, ids: new Set() });
    want.get(k).ids.add(c.id);
  }));
  for (const [k, w] of watchers) if (!want.has(k)) { try { w.close(); } catch {} watchers.delete(k); }
  for (const [k, { path: p, ids }] of want) {
    if (watchers.has(k) || !Files.isDir(p)) continue;
    try {
      const w = fs.watch(p, { recursive: true }, () => ids.forEach(queueScan));
      w.on('error', () => { try { w.close(); } catch {} watchers.delete(k); });
      watchers.set(k, w);
    } catch { /* retried on the next sweep */ }
  }
}

/* ── Todoist ──────────────────────────────────────────────────────────── */
let tokenCache;
function readToken() {
  if (tokenCache !== undefined) return tokenCache;
  tokenCache = null;
  try {
    const buf = fs.readFileSync(TOKEN_FILE);
    tokenCache = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : null;
  } catch {}
  status.todoist.hasToken = !!tokenCache;
  return tokenCache;
}
function td() {
  if (NO_NET) throw new Error('network is off (test mode)');
  const t = readToken();
  if (!t) throw new Error('no Todoist token yet — add it in settings');
  return Todoist.client(t);
}

let ids = {};                   // resolved project/section ids, by "project|section"
async function target(project, section) {
  const k = Todoist.fold(project) + '|' + Todoist.fold(section || '');
  if (!ids[k]) ids[k] = await td().resolve(project, section);
  return ids[k];
}

async function guarded(kind, fn) {
  const s = kind === 'desk' ? status.desk : status.todoist;
  s.busy = true; broadcast();
  try { const out = await fn(); s.error = ''; if (kind !== 'desk') s.ok = true; return { ok: true, ...(out || {}) }; }
  catch (e) {
    if (e.status === 404) ids = {};
    s.error = e.message || String(e);
    if (kind !== 'desk' && /token/i.test(s.error)) s.ok = false;
    return { ok: false, error: s.error };
  }
  finally { s.busy = false; broadcast(); }
}

let polling = false, lastPollTry = 0;
async function poll() {
  if (NO_NET || !readToken() || polling) return { ok: false, error: NO_NET ? 'network is off' : polling ? 'already checking' : 'no token' };
  polling = true; lastPollTry = Date.now();
  try {
    return await guarded('todoist', async () => {
      const now = Date.now();
      const since = Math.max(now - 30 * 24 * 60 * MIN, (db.todoist.lastPoll || 0) - 60 * MIN);
      const { projectId } = await target(db.todoist.project);
      const items = await td().completed(since, now, projectId);
      const ops = Todoist.completedOps(db, items);
      ops.forEach(([op, p]) => { try { db = Store.apply(db, op, p, ctx()).db; } catch (e) { console.warn('[grind] poll op', op, e.message); } });
      db = Store.apply(db, 'todoist.polled', { at: now }, ctx()).db;
      save();
      if (ops.length) toast(ops.length === 1 ? 'Todoist: 1 thing ticked off' : `Todoist: ${ops.length} things ticked off`);
      return { found: ops.length };
    });
  } finally { polling = false; }
}

async function closeTask(id) {
  if (NO_NET || !readToken()) return;
  const r = await guarded('todoist', () => td().close(id));
  if (!r.ok && !/not found/i.test(r.error)) toast('Todoist: could not close the task — ' + r.error);
}

function taskFor(x) {
  if (x.kind === 'lesson') {
    const l = C.lessons.find(q => q.id === x.id);
    if (!l) throw new Error('no such lesson');
    return { section: db.todoist.production, labels: ['grind'], content: 'GRIND · drill · ' + l.title,
             description: `${l.drill.task}\n\nDone when: ${l.drill.doneWhen}\n\nSent from GRIND — ticking this marks the drill done there.` };
  }
  if (x.kind === 'challenge') {
    const ch = C.challenges.find(q => q.id === x.id);
    if (!ch) throw new Error('no such challenge');
    return { section: db.todoist.production, labels: ['grind'], content: `GRIND · challenge ${x.week} · ${ch.title}`,
             description: `${ch.text}\n\nSent from GRIND — ticking this marks the week's challenge done there.` };
  }
  if (x.kind === 'post') {
    const p = db.posts.find(q => q.id === x.id);
    if (!p) throw new Error('no such post');
    const pc = Store.postCounter(db);
    return { section: db.todoist.socials, labels: ['grind'].concat(pc && pc.todoistLabel ? [pc.todoistLabel] : []),
             content: `${p.platform} · ${p.kind} · ${p.title}`,
             description: (p.notes ? p.notes + '\n\n' : '') + 'Sent from GRIND — ticking this marks the post as posted there.' };
  }
  throw new Error('nothing to send');
}
async function send(x) {
  return guarded('todoist', async () => {
    const t = taskFor(x);
    const where = await target(db.todoist.project, t.section);
    const res = await td().add({ content: t.content, description: t.description, projectId: where.projectId,
                                 sectionId: where.sectionId, labels: t.labels });
    if (!res || !res.id) throw new Error('Todoist did not return the new task');
    db = Store.apply(db, 'todoist.link', { taskId: res.id, kind: x.kind, id: x.id, week: x.week }, ctx()).db;
    save();
    return { taskId: res.id };
  });
}

async function refreshDesk() {
  if (NO_NET || !readToken()) return { ok: false, error: NO_NET ? 'network is off' : 'no token' };
  return guarded('desk', async () => {
    const td0 = td();
    const desk = await RootLink.fetchDesk({ resolve: (p, s) => target(p, s), tasks: q => td0.tasks(q) },
                                          db.todoist.rootProject, db.todoist.rootSection, Date.now());
    db = Store.apply(db, 'desk.set', { desk }, ctx()).db;
    save();
  });
}

/* ── Hotkeys ──────────────────────────────────────────────────────────────
   Ctrl+Alt+Shift+1…9, one per counter in order. Never plain Ctrl+Alt: on an
   AZERTY keyboard Ctrl+Alt *is* AltGr, and AltGr+digit types @ # { [ | — a
   global shortcut there would take those characters away from every app. */
function registerHotkeys() {
  globalShortcut.unregisterAll();
  if (!db.settings.hotkeys) return;
  db.counters.slice(0, 9).forEach((c, i) => {
    try {
      globalShortcut.register('CommandOrControl+Alt+Shift+' + (i + 1), () => {
        commit('tap', { c: c.id, via: 'hotkey' });
        const week = Derive.counterStats(db, c.id, Date.now()).week;
        toast(`+1 ${c.noun} · ${week} this week`);
        notify('GRIND', `+1 ${c.noun} · ${week} this week`);
      });
    } catch {}
  });
}

/* ── Window ───────────────────────────────────────────────────────────── */
const SIZE = { width: 1280, height: 840, minWidth: 1000, minHeight: 680 };
function readWin() { try { return JSON.parse(fs.readFileSync(WIN_FILE, 'utf8')); } catch { return {}; } }
function writeWin() {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(WIN_FILE, JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() })); } catch {}
}
function fits(b) {
  return b && screen.getAllDisplays().some(({ workArea: r }) =>
    b.x >= r.x - 10 && b.y >= r.y - 10 && b.x + b.width <= r.x + r.width + 10 && b.y + b.height <= r.y + r.height + 10);
}
function createWindow() {
  const saved = readWin();
  const b = fits(saved.bounds) ? saved.bounds : { width: SIZE.width, height: SIZE.height };
  win = new BrowserWindow({
    ...b, minWidth: SIZE.minWidth, minHeight: SIZE.minHeight,
    backgroundColor: '#060607', title: 'GRIND', frame: false, show: false, icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { if (saved.maximized) win.maximize(); win.show(); });
  let t = null;
  const queue = () => { clearTimeout(t); t = setTimeout(writeWin, 400); };
  win.on('moved', queue); win.on('resized', queue);
  win.on('maximize', () => { queue(); win.webContents.send('win:maxed', true); });
  win.on('unmaximize', () => { queue(); win.webContents.send('win:maxed', false); });
  let focusT = 0;
  win.on('focus', () => {
    if (Date.now() - focusT < 60 * 1000) return;
    focusT = Date.now();
    scanAll();
    if (Date.now() - lastPollTry > 2 * MIN) poll();
  });
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); writeWin(); win.hide(); } });
}

function trayMenu() {
  const s = db.session;
  return Menu.buildFromTemplate([
    { label: 'Show GRIND', click: showWin },
    { type: 'separator' },
    { label: !s ? 'Start a session' : s.running ? 'Pause the session' : 'Resume the session',
      click: () => commit(!db.session ? 'session.start' : db.session.running ? 'session.pause' : 'session.resume') },
    ...(s ? [{ label: 'End the session', click: () => commit('session.end') }] : []),
    { type: 'separator' },
    ...db.counters.map(c => ({ label: `+1 ${c.noun}`, click: () => { commit('tap', { c: c.id, via: 'tap' }); } })),
    { type: 'separator' },
    { label: 'Quit GRIND', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}
function refreshTray() { if (tray && !tray.isDestroyed()) tray.setContextMenu(trayMenu()); }
function showWin() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function createTray() {
  tray = new Tray(ICON);
  tray.setToolTip('GRIND');
  tray.setContextMenu(trayMenu());
  tray.on('click', showWin);
}

app.on('second-instance', showWin);

app.whenReady().then(() => {
  if (!primary) return;
  load();
  status.todoist.hasToken = !!readToken();
  createWindow();
  createTray();
  registerHotkeys();
  rewatch();
  scanAll();
  setInterval(() => { rewatch(); scanAll(); }, SCAN_EVERY);
  setInterval(poll, POLL_EVERY);
  setInterval(refreshDesk, DESK_EVERY);
  setTimeout(() => { poll(); refreshDesk(); }, 2500);
  setInterval(sessionTick, 1000);
  setInterval(flowUpdate, 2000);          // keeps FLOW's countdown honest between changes
});

app.on('before-quit', () => { app.isQuitting = true; writeWin(); unlinkFlow(); if (db) writeNow(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); for (const w of watchers.values()) { try { w.close(); } catch {} } });
app.on('window-all-closed', () => { /* the tray keeps GRIND alive */ });

/* ── IPC ──────────────────────────────────────────────────────────────── */
ipcMain.handle('state', () => snapshot());
ipcMain.handle('op', (_e, op, payload) => {
  try { commit(op, payload); if (op.startsWith('counter.')) refreshTray(); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message || String(e) }; }
});
ipcMain.handle('scan', () => { rewatch(); scanAll(); return { ok: true }; });
ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: DOCS });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('folder:make', (_e, p) => {
  if (!db.counters.some(c => c.sources.some(s => s.path === p))) return { ok: false, error: 'not a watched folder' };
  try { fs.mkdirSync(p, { recursive: true }); rewatch(); scanAll(); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('open-path', (_e, p) => {
  const allowed = p === DATA || db.counters.some(c => c.sources.some(s => s.path === p));
  return allowed && Files.isDir(p) ? shell.openPath(p) : 'not allowed';
});
ipcMain.handle('pick-exe', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'App', extensions: ['exe'] }] });
  return r.canceled ? null : r.filePaths[0];
});
/* The link button: linking with no session running starts one — FLOW has
   nothing to follow otherwise. Unlinking leaves the session running. */
ipcMain.handle('flow:link', (_e, on) => {
  if (on) { if (!db.session) commit('session.start'); flow.open(); }
  else unlinkFlow();
  broadcast();
  return { ok: true };
});
ipcMain.on('win:progress', (_e, v) => { if (win && !win.isDestroyed()) win.setProgressBar(v == null || v < 0 ? -1 : Math.min(1, Math.max(0, v))); });
ipcMain.handle('open-url', (_e, u) => { if (/^https:\/\//.test(String(u))) shell.openExternal(String(u)); });
ipcMain.handle('clip', (_e, text) => { clipboard.writeText(String(text || '')); return true; });
ipcMain.handle('todoist:token', async (_e, token) => {
  token = String(token || '').trim();
  if (!token) return { ok: false, error: 'paste the token first' };
  if (NO_NET) return { ok: false, error: 'network is off (test mode)' };
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Windows could not encrypt the token here' };
  try { await Todoist.client(token).check(); }
  catch (e) { return { ok: false, error: e.message }; }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, safeStorage.encryptString(token));
  tokenCache = token; ids = {};
  status.todoist = { hasToken: true, ok: true, error: '', busy: false };
  broadcast();
  poll(); refreshDesk();
  return { ok: true };
});
ipcMain.handle('todoist:forget', () => {
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
  tokenCache = null; ids = {};
  status.todoist = { hasToken: false, ok: null, error: '', busy: false };
  broadcast();
  return { ok: true };
});
ipcMain.handle('todoist:send', (_e, x) => send(x || {}));
ipcMain.handle('todoist:poll', () => poll());
ipcMain.handle('desk:refresh', () => refreshDesk());
ipcMain.handle('todoist:settings', (_e, p) => { ids = {}; try { commit('todoist.set', p); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('data:export', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(DOCS, 'grind-' + Derive.isoDate(Date.now()) + '.json'),
                                               filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, JSON.stringify(db, null, 2));
  return { ok: true, path: r.filePath };
});
ipcMain.handle('data:folder', () => shell.openPath(DATA));

ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:max', () => { if (!win) return; if (win.isMaximized()) win.unmaximize(); else win.maximize(); });
ipcMain.on('win:close', () => { if (win) { writeWin(); win.hide(); } });

module.exports = { _test: { get db() { return db; }, scanAll, commit, status, sessionTick } };
