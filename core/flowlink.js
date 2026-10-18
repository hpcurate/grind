/* GRIND · the FLOW link — a local named pipe, one JSON object per line (the
   same link TUTOR uses; FLOW names whichever app is on the other end).
   FLOW listens (it is single-instance and always the same pipe); GRIND
   connects when you press the link button, and starts FLOW first if it is not
   running. While linked GRIND is the clock: it sends its session (phase, time
   left, goal) and FLOW follows — its timer shows GRIND's session, its music
   pauses on GRIND's breaks — and wears a "GRIND" chip. FLOW's own timer
   buttons send commands back. Closing either end unlinks both, and another
   app linking to FLOW takes it over (FLOW says bye here).

   grind → flow  {t:'hello',app:'GRIND',v:1} · {t:'session',…} · {t:'show'} · {t:'bye'}
   flow → grind  {t:'hello',app:'FLOW',v:1} · {t:'cmd',cmd:'toggle'|'skip'|'end'} · {t:'bye'} */
'use strict';

const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');

const PIPE = process.env.GRIND_FLOW_PIPE || '\\\\.\\pipe\\hugo-flow-link';

function create({ exe, onMessage, onState, log }) {
  let sock = null, buf = '', want = false, state = 'off', last = null, tries = 0, timer = null;
  const set = s => { if (s !== state) { const was = state; state = s; onState && onState(s, was); } };
  function send(obj) { if (sock && !sock.destroyed) { try { sock.write(JSON.stringify(obj) + '\n'); } catch {} } }

  function attach(s) {
    sock = s; buf = ''; tries = 0;
    s.setEncoding('utf8');
    s.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.t === 'hello') set('on');
        else if (m.t === 'bye') { want = false; close(); }
        else onMessage && onMessage(m);
      }
    });
    s.on('close', () => { if (sock === s) { sock = null; if (state !== 'off') set(want ? 'lost' : 'off'); want = false; } });
    s.on('error', () => {});
    send({ t: 'hello', app: 'GRIND', v: 1 });
    send({ t: 'show' });
    if (last) send(last);
  }

  function tryConnect(launched) {
    const s = net.connect(PIPE);
    s.once('connect', () => { s.removeAllListeners('error'); attach(s); });
    s.once('error', () => {
      s.destroy();
      if (!want) return;
      if (!launched) {
        const where = exe && exe();
        if (!where || !fs.existsSync(where)) { want = false; set('off'); log && log('FLOW not found at ' + where); onMessage && onMessage({ t: 'error', msg: 'FLOW not found — set its path in settings' }); return; }
        try { spawn(where, ['--grind-link'], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { want = false; set('off'); return; }
      }
      if (++tries > 40) { want = false; set('off'); onMessage && onMessage({ t: 'error', msg: 'FLOW did not answer' }); return; }
      clearTimeout(timer);
      timer = setTimeout(() => tryConnect(true), 500);
    });
  }

  function open() { if (sock) { send({ t: 'show' }); return; } want = true; tries = 0; set('connecting'); tryConnect(false); }
  function close() { want = false; clearTimeout(timer); if (sock) { send({ t: 'bye' }); try { sock.end(); } catch {} sock = null; } set('off'); }
  function update(msg) { last = msg; send(msg); }
  return { open, close, update, get state() { return state; }, get connected() { return !!sock; } };
}

module.exports = { PIPE, create };
