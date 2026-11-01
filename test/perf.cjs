/* GRIND's CPU, state by state — npm run perf (Hugo's r261021-1ey8 "optimize to run app, it uses to much cpu": "also
   applicable to flow and all the other apps"). A throwaway profile, a made-up Documents folder, the network off, FLOW's
   link on a private pipe nobody answers (the real FLOW is never launched). The meter is ../../_prompts/perf-lib.cjs
   (PERF_SPAN, PERF_SETTLE, PERF_CSS, PERF_LIST, PERF_ONLY). */
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grind-perf-'));
const profile = path.join(root, 'profile'), docs = path.join(root, 'Documents');
const touch = p => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x'); };
['reese/curate_reese_01.SerumPreset', 'stabs/curate_stab_01.SerumPreset'].forEach(f => touch(path.join(docs, 'Xfer', 'Serum 2 Presets', 'presets', 'curate', f)));
fs.mkdirSync(path.join(docs, 'curate', 'samples'), { recursive: true });
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
Object.assign(process.env, { GRIND_DOCS: docs, GRIND_NO_NET: '1', GRIND_FLOW_PIPE: '\\\\.\\pipe\\grind-perf-' + process.pid });
require('../main.js');
const P = require('../../_prompts/perf-lib.cjs')(app, BrowserWindow, 'GRIND');

app.whenReady().then(async () => {
  try {
    await P.pause(1500);
    const win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading()) await new Promise(r => win.webContents.once('did-finish-load', r));
    const js = code => win.webContents.executeJavaScript(code, true);
    const go = v => js(`document.querySelector('[data-go="${v}"]').click(); 0`);
    await P.state('home', async () => { win.show(); win.focus(); await go('home'); });
    await P.state('learn', () => go('learn'));
    await P.state('posts', () => go('posts'));
    await P.state('goals', () => go('goals'));
    await P.state('settings', () => go('settings'));
    await P.state('a session going (home)', async () => { await go('home'); await js(`document.querySelector('[data-act="sess-start"]').click(); 0`); });
    await P.state('a session going, unfocused', () => win.blur());
    await P.state('a session going, minimised', () => win.minimize());
    await P.state('in the tray (hidden), a session going', () => win.hide());
  } catch (e) { console.error(e); process.exitCode = 1; }
  P.done(process.exitCode);
});
