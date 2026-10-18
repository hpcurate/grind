/* GRIND · derive — everything the screens show that is computed rather than
   stored: counter totals per window, the week strip, goal pace, learning
   progress, this week's challenge and the "ask Claude" text.

   Pure and dependency-free, and loaded twice: by the renderer as a classic
   <script> (window.Derive) and by main + the tests through require(). Nothing
   here touches the clock on its own — every function takes `now` — so a test
   can stand on any day it likes. */
(function (root, factory) {
  const D = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.Derive = D;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;

  /* Weeks start on Monday (ISO). Every boundary is local midnight. */
  function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfWeek(ms) {
    const d = new Date(startOfDay(ms));
    const dow = (d.getDay() + 6) % 7;            // Monday = 0
    d.setDate(d.getDate() - dow);
    return d.getTime();
  }
  function startOfMonth(ms) { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  function startOfYear(ms) { return new Date(new Date(ms).getFullYear(), 0, 1).getTime(); }
  function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }

  /* 'YYYY-Www', the ISO week the moment falls in. */
  function weekKey(ms) {
    const d = new Date(startOfDay(ms));
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));       // Thursday of this week
    const year = d.getFullYear();
    const jan4 = new Date(year, 0, 4);
    const w = 1 + Math.round(((d - jan4) / DAY - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return year + '-W' + String(w).padStart(2, '0');
  }
  function isoDate(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* A YYYY-MM-DD read as local midnight, never as UTC. */
  function parseDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN;
  }

  const sum = (rows, from, to) => rows.reduce((n, e) => n + (e.at >= from && e.at < to ? (e.n || 1) : 0), 0);
  const eventsOf = (db, c) => (db.events || []).filter(e => e.c === c);

  /* One counter, every window the screens ask for. `weeks` is oldest first. */
  function counterStats(db, c, now, weeksBack = 12) {
    const rows = eventsOf(db, c);
    const w0 = startOfWeek(now);
    const weeks = [];
    for (let i = weeksBack - 1; i >= 0; i--) {
      const from = addDays(w0, -7 * i), to = addDays(from, 7);
      weeks.push({ key: weekKey(from), from, n: sum(rows, from, to) });
    }
    const days = [];
    for (let i = 0; i < 7; i++) {
      const from = addDays(w0, i);
      days.push({ date: isoDate(from), n: sum(rows, from, addDays(from, 1)) });
    }
    const last = rows.reduce((a, e) => (e.at > a ? e.at : a), 0);
    return {
      week: sum(rows, w0, Infinity),
      month: sum(rows, startOfMonth(now), Infinity),
      year: sum(rows, startOfYear(now), Infinity),
      all: rows.reduce((n, e) => n + (e.n || 1), 0),
      weeks, days, last: last || null,
    };
  }

  /* A goal against its deadline. Flex wording lives in the screen; this only
     says what is true: how many are done, how many weeks are left, and the
     weekly rate that would land it next to the rate since it started. */
  function goalProgress(db, g, now) {
    const from = parseDate(g.from) || now;
    const by = parseDate(g.by);
    const done = g.c ? sum(eventsOf(db, g.c), from, Infinity) : Math.max(0, +g.done || 0);
    const n = Math.max(1, +g.n || 1);
    const left = Math.max(0, n - done);
    const weeksLeft = isFinite(by) ? Math.max(0, (addDays(by, 1) - now) / (7 * DAY)) : null;
    /* At least a week: one good day is not a weekly rate. */
    const weeksIn = Math.max(1, (now - from) / (7 * DAY));
    return {
      done, n, left,
      pct: Math.min(1, done / n),
      finished: done >= n,
      weeksLeft,
      needPerWeek: weeksLeft ? left / weeksLeft : (left ? Infinity : 0),
      doingPerWeek: done / weeksIn,
      overdue: isFinite(by) && now > addDays(by, 1) && done < n,
    };
  }

  /* Lessons in curriculum order, with what is done. */
  function learnProgress(db, C) {
    const done = (db.learn && db.learn.done) || {};
    const tracks = C.tracks.map(t => {
      const ls = C.lessons.filter(l => l.track === t.id);
      return { id: t.id, title: t.title, total: ls.length, done: ls.filter(l => done[l.id]).length };
    });
    const next = C.lessons.find(l => !done[l.id]) || null;
    return { tracks, total: C.lessons.length, done: C.lessons.filter(l => done[l.id]).length, next };
  }

  /* The lesson the home screen shows: the one picked, else the first not done. */
  function currentLesson(db, C) {
    const cur = db.learn && db.learn.current;
    return C.lessons.find(l => l.id === cur) || learnProgress(db, C).next || C.lessons[0];
  }

  /* This week's challenge. The pool is walked in a fixed shuffled order (the
     same on every machine and every reload), one step a week; a reroll is one
     more step for that week only. */
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function weekChallenge(db, C, now) {
    const pool = C.challenges;
    const key = weekKey(now);
    const order = pool.map((c, i) => i).sort((a, b) => hash('g' + pool[a].id) - hash('g' + pool[b].id));
    const weekNo = Math.floor(startOfWeek(now) / (7 * DAY));
    const roll = ((db.challenge && db.challenge.rolls) || {})[key] || 0;
    const ch = pool[order[(weekNo + roll) % order.length]];
    const done = ((db.challenge && db.challenge.done) || {})[key] || null;
    return { key, challenge: ch, done, roll };
  }

  function ago(ms, now) {
    if (!ms) return 'never';
    const s = Math.max(0, (now - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    const d = Math.floor(s / 86400);
    if (d < 14) return d === 1 ? 'yesterday' : d + ' days ago';
    if (d < 60) return Math.floor(d / 7) + ' weeks ago';
    return isoDate(ms);
  }

  /* The text the "ask Claude" button copies. Self-contained: it says who is
     asking, with what tools, about which lesson and from how far along, so a
     fresh chat can answer for this setup instead of in general. */
  function askText(db, C, lessonId, question, now) {
    const l = C.lessons.find(x => x.id === lessonId) || null;
    const t = l ? C.tracks.find(x => x.id === l.track) : null;
    const daw = (db.learn && db.learn.daw) === 'ableton' ? 'Ableton Live 12' : 'FL Studio';
    const other = daw === 'FL Studio' ? 'trialling Ableton Live 12' : 'coming from FL Studio';
    const lp = learnProgress(db, C);
    const week = (db.counters || []).map(c => counterStats(db, c.id, now).week + ' ' + (c.label || c.id)).join(', ');
    const out = [
      '# GRIND — help request',
      '',
      `**Me:** learning drum & bass production, aiming to get very good at sound design. DAW: ${daw} (${other}). ` +
        `Plugins: ${C.gear.join(', ')}.`,
    ];
    if (l) {
      out.push(`**Lesson:** ${l.title} (${t ? t.title : l.track} · level ${l.tier})`);
      out.push(`**The drill:** ${l.drill.task} — done when ${l.drill.doneWhen}`);
      const note = ((db.learn && db.learn.notes) || {})[l.id];
      if (note) out.push(`**My notes so far:** ${note}`);
    }
    out.push(`**Where I am:** ${lp.done}/${lp.total} lessons done. This week: ${week || 'nothing counted yet'}.`);
    out.push('', '**My question:**', String(question || '').trim() || '(write it here)', '');
    out.push(`Answer for my setup specifically — exact ${daw} and plugin steps, values to start from, and what to listen for. ` +
      'If something depends on taste, give me two options to A/B.');
    return out.join('\n');
  }

  /* The live session read off the clock: focus so far, the time to the next
     break (or, in a break, back to focus), and how full the goal is. main uses
     it for FLOW and the alarms, the bar for what it draws. */
  function sessionView(s, now) {
    if (!s) return null;
    const dt = s.running ? Math.max(0, (now - s.phaseStart) / 1000) : 0;
    const focus = s.focusSec + (s.phase === 'focus' ? dt : 0), since = s.sinceBreak + (s.phase === 'focus' ? dt : 0);
    const v = { phase: s.phase, running: s.running, focus, since, goal: s.goalSec, breakEvery: s.breakEvery, breaks: s.breaks,
                goalP: Math.min(1, focus / Math.max(1, s.goalSec)), left: null, total: null, nextP: null };
    if (s.phase === 'break') { v.left = Math.max(0, s.breakLen - dt); v.total = s.breakLen; v.nextP = 1 - v.left / Math.max(1, s.breakLen); }
    else if (s.breakEvery > 0) { v.left = Math.max(0, s.breakEvery - since); v.total = s.breakEvery; v.nextP = since / s.breakEvery; }
    else { v.left = Math.max(0, s.goalSec - focus); v.total = s.goalSec; }
    return v;
  }
  /* Minutes of focus in finished sessions that started in [from, to). */
  function focusMinutes(db, from, to) {
    return (db.sessions || []).filter(s => s.start >= from && s.start < to).reduce((t, s) => t + (s.focusSec || 0), 0) / 60;
  }

  return { DAY, startOfDay, startOfWeek, startOfMonth, startOfYear, addDays, weekKey, isoDate, parseDate,
           counterStats, goalProgress, learnProgress, currentLesson, weekChallenge, ago, askText, hash,
           sessionView, focusMinutes };
});
