/* GRIND GUI check — the real main.js in a throwaway profile, a fake Documents
   folder (Serum 2 presets and a samples folder), the network off. Drives every
   view, drops real files into the watched folders, asserts on what the window
   shows and what lands in grind.json, and saves shot-*.png to look at.

   Never touches the real machine: the clipboard and the browser are replaced
   by recorders, notifications and hotkeys stay off.
   Run: npm run test:ui   (GRIND_LOG=1 also echoes the renderer console) */
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grind-ui-'));
const profile = path.join(root, 'profile'), docs = path.join(root, 'Documents');
const curate = path.join(docs, 'Xfer', 'Serum 2 Presets', 'presets', 'curate');
const user = path.join(docs, 'Xfer', 'Serum 2 Presets', 'presets', 'User');
const samples = path.join(docs, 'curate', 'samples');
const touch = p => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x' + Math.random()); };
['reese/curate_reese_01.SerumPreset', 'stabs/curate_stab_01.SerumPreset', 'curate_kick.fxp'].forEach(f => touch(path.join(curate, f)));
touch(path.join(user, 'someone - bass 1.SerumPreset'));

fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
process.env.GRIND_DOCS = docs;
process.env.GRIND_NO_NET = '1';

const errors = [];
app.on('web-contents-created', (_, wc) => {
  wc.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); if (process.env.GRIND_LOG) console.log('[renderer]', message); });
  wc.on('did-fail-load', (_e, code, desc) => errors.push(`${code}: ${desc}`));
});

require('../main.js');
const copied = [], opened = [];
ipcMain.removeHandler('clip'); ipcMain.handle('clip', (_e, t) => { copied.push(String(t)); return true; });
ipcMain.removeHandler('open-url'); ipcMain.handle('open-url', (_e, u) => { opened.push(String(u)); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['ok', name]); console.log('  ok   ' + name); }
  catch (e) { results.push(['FAIL', name]); console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

/* Nothing may stick out of the window sideways, and no card may be cut off. */
const FIT = `(() => {
  const bad = [], vw = innerWidth;
  const m = document.getElementById('main');
  if (m.scrollWidth > m.clientWidth + 1) bad.push('main scrolls sideways ' + m.scrollWidth + '>' + m.clientWidth);
  document.querySelectorAll('button, input, select, textarea, .tile, .card, .col').forEach(e => {
    if (!e.checkVisibility()) return;
    const r = e.getBoundingClientRect(); if (!r.width) return;
    if (r.right > vw + 1 || r.left < -1) bad.push((e.dataset.act || e.className || e.tagName) + ' x ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  document.querySelectorAll('.tile-num, .lc-title, .h1').forEach(e => { if (e.scrollWidth > e.clientWidth + 2) bad.push(e.className + ' text overflows'); });
  return bad.slice(0, 8);
})()`;

app.whenReady().then(async () => {
  let win;
  try {
    await pause(400);
    win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading()) await new Promise(r => win.webContents.once('did-finish-load', r));
    await pause(900);
    const js = code => win.webContents.executeJavaScript(code, true);
    const click = sel => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('no ' + ${JSON.stringify(sel)}); e.click(); return 1; })()`);
    const text = sel => js(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
    const until = async (code, ms = 6000, what = code) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { if (await js(code)) return; await pause(150); }
      throw new Error('timed out waiting for ' + what);
    };
    const shot = async name => fs.writeFileSync(path.join(__dirname, '..', `shot-${name}.png`), (await win.webContents.capturePage()).toPNG());
    const fit = async where => { const bad = await js(FIT); assert.deepEqual(bad, [], where + ': ' + bad.join(' | ')); };
    const num = c => js(`+(document.querySelector('[data-tile="${c}"] .tile-num') || {}).textContent`);
    const file = () => JSON.parse(fs.readFileSync(path.join(profile, 'grind.json'), 'utf8'));
    const db = () => js(`window.grindAPI.state().then(s => s.db)`);
    await js(`window.grindAPI.op('settings.set', { notify: false })`);
    await js(`localStorage.setItem('grind.view','home'); 0`);
    await click('[data-go="home"]');

    await check('opens at 1280×840 on the home screen with three counters', async () => {
      const b = win.getBounds();
      assert.equal(b.width, 1280); assert.equal(b.height, 840);
      assert.equal(await js(`document.querySelectorAll('.tile').length`), 3);
    });

    await check('the first scan counts your curate presets and skips the shared User folder', async () => {
      await until(`+(document.querySelector('[data-tile="patches"] .tile-num')||{}).textContent === 3`, 6000, 'patches = 3');
      assert.equal((await db()).events.filter(e => e.c === 'patches').length, 3);
      assert.ok(Object.values((await db()).seen.patches).some(p => p.includes('someone - bass 1')), 'the User preset is seen');
      assert.ok(fs.existsSync(samples), 'the samples folder was created on first run');
    });
    await shot('1-home'); await fit('home');

    await check('a preset saved while GRIND runs is counted within seconds', async () => {
      touch(path.join(curate, 'curate_growl_02.SerumPreset'));
      await until(`+(document.querySelector('[data-tile="patches"] .tile-num')||{}).textContent === 4`, 9000, 'patches = 4');
      assert.match(await text('.feed .ev .what'), /curate_growl_02/);
    });

    await check('+1 by hand, and undo from the feed', async () => {
      await click('[data-act="tap"][data-c="posts"]');
      await until(`+(document.querySelector('[data-tile="posts"] .tile-num')||{}).textContent === 1`);
      const id = (await db()).events.find(e => e.c === 'posts').id;
      await click(`[data-act="undo"][data-id="${id}"]`);
      await click('[data-act="confirm-yes"]');
      await until(`+(document.querySelector('[data-tile="posts"] .tile-num')||{}).textContent === 0`);
    });

    await check('a burst of renders waits for a yes, then counts them all', async () => {
      for (let i = 0; i < 30; i++) touch(path.join(samples, 'pack', `one_shot_${i}.wav`));
      await until(`!!document.querySelector('.pend')`, 9000, 'the pending banner');
      assert.equal(await num('samples'), 0);
      await shot('2-home-pending');
      await click('[data-act="pend-yes"]');
      await until(`+(document.querySelector('[data-tile="samples"] .tile-num')||{}).textContent === 30`);
      assert.equal(await js(`!!document.querySelector('.pend')`), false);
    });

    await check('the window switch changes the big numbers', async () => {
      await click('[data-act="window"][data-w="all"]');
      await until(`/all time/.test(document.querySelector('.h1').textContent)`);
      await click('[data-act="window"][data-w="week"]');
    });

    await check('learn: the DAW test is the first lesson, both DAWs read, a drill can be done', async () => {
      await click('[data-go="learn"]');
      await until(`!!document.querySelector('.rd-head h2')`);
      assert.match(await text('.rd-head h2'), /FL or Ableton/);
      assert.match(await text('.daw-box ul'), /Consolidate this clip/);
      await click('[data-act="daw-view"][data-daw="ableton"]');
      assert.match(await text('.daw-box ul'), /Freeze Track/);
      await shot('3-learn');
      await fit('learn');
      await click('[data-act="lesson-done"]');
      await until(`/undo/.test(document.querySelector('.rd-actions .btn.solid').textContent)`);
      assert.ok((await db()).learn.done['start-daw']);
    });

    await check('notes are kept as you type and survive a re-render', async () => {
      await js(`(() => { const t = document.querySelector('[data-note]'); t.focus(); t.value = 'FL took 22 min, Ableton 31'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await pause(900);
      assert.equal((await db()).learn.notes['start-daw'], 'FL took 22 min, Ableton 31');
      await js(`window.grindAPI.op('tap', { c: 'patches' })`);
      await pause(300);
      assert.equal(await js(`document.querySelector('[data-note]').value`), 'FL took 22 min, Ableton 31');
    });

    await check('ask Claude builds a self-contained request and copies it', async () => {
      await click('[data-act="ask"]');
      await js(`(() => { const q = document.getElementById('ask-q'); q.value = 'which DAW resamples faster?'; q.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      const pre = await text('#ask-pre');
      assert.match(pre, /which DAW resamples faster\?/);
      assert.match(pre, /FL took 22 min/);
      await shot('4-ask');
      await click('[data-act="ask-open"]');
      await until(`true`, 50); await pause(300);
      assert.equal(copied.length, 1);
      assert.match(copied[0], /Serum 2/);
      assert.deepEqual(opened, ['https://claude.ai/new']);
    });

    await check('a challenge can be opened, rerolled and done', async () => {
      await click('[data-act="lesson"][data-id="__ch"]');
      const first = await text('.rd-head h2');
      await click('[data-act="ch-reroll"]');
      await until(`document.querySelector('.rd-head h2').textContent !== ${JSON.stringify(first)}`);
      await click('[data-act="ch-done"]');
      await until(`Object.keys(${'1'}) && /undo/.test(document.querySelector('.rd-actions .btn.solid').textContent)`);
    });

    await check('posts: an idea moves through the board and counts once when posted', async () => {
      await click('[data-go="posts"]');
      await js(`document.getElementById('post-title').value = 'reese walkthrough, 30s'`);
      await click('[data-act="post-add"]');
      await until(`document.querySelectorAll('.pcard').length === 1`);
      assert.equal(await js(`document.getElementById('post-title').value`), '', 'the field clears after adding');
      for (let i = 0; i < 3; i++) { await click('[data-act="post-move"][data-dir="1"]'); await pause(150); }
      await until(`/posted/.test(document.querySelector('.col.k-bl').textContent) && document.querySelector('.col.k-bl .pcard')`);
      assert.equal((await db()).events.filter(e => e.c === 'posts').length, 1);
      await shot('5-posts');
      await fit('posts');
    });

    await check('goals: a counted goal and a by-hand goal', async () => {
      await click('[data-go="goals"]');
      await js(`document.getElementById('g-label').value = '200 patches'; document.getElementById('g-c').value = 'patches'; document.getElementById('g-n').value = '200'; document.getElementById('g-by').value = '2027-06-30'; 0`);
      await click('[data-act="goal-add"]');
      await until(`document.querySelectorAll('.goal').length === 1`);
      assert.match(await text('.goal .pace'), /to go/);
      await js(`document.getElementById('g-label').value = 'release an EP'; document.getElementById('g-c').value = ''; document.getElementById('g-n').value = '1'; document.getElementById('g-by').value = ''; 0`);
      await click('[data-act="goal-add"]');
      await until(`document.querySelectorAll('.goal').length === 2`);
      await click('[data-act="aim"][data-c="patches"][data-dir="1"]');
      await until(`/\\b6\\b/.test(document.querySelector('.aims .aim-row b').textContent)`);
      await shot('6-goals');
      await fit('goals');
    });

    await check('settings: folders, Todoist and the CREATE link render; network is off', async () => {
      await click('[data-go="settings"]');
      await until(`document.querySelectorAll('.src').length === 3`);
      assert.match(await text('.set'), /network off/);
      await shot('7-settings');
      await fit('settings');
    });

    await check('home still fits at the minimum window size', async () => {
      await click('[data-go="home"]');
      win.setBounds({ width: 1000, height: 680 });
      await pause(500);
      await shot('8-home-min');
      await fit('home at minimum size');
      await click('[data-go="learn"]');
      await pause(300);
      await shot('8-learn-min');
      await fit('learn at minimum size');
      win.setBounds({ width: 1280, height: 840 });
    });

    await check('everything landed in grind.json', async () => {
      await pause(600);                      // the save is debounced by 250 ms
      const d = file();
      assert.equal(d.v, 1);
      assert.ok(d.events.length >= 35);
      assert.equal(d.goals.length, 2);
      assert.equal(d.posts.length, 1);
    });

    await check('no renderer errors', async () => { assert.deepEqual(errors, []); });
  } catch (e) {
    console.error(e);
    results.push(['FAIL', 'harness']);
  }
  const fails = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed · screenshots: shot-*.png`);
  app.isQuitting = true;
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  app.exit(fails ? 1 : 0);
});
