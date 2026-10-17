/* GRIND · renderer.

   Draws whatever main last broadcast ({ db, status }) and sends every change
   back as an op — it never edits the record itself. One delegated click
   listener dispatches on data-act; views are rebuilt as strings on every
   broadcast, so anything typed is carried across a rebuild (snapshotInputs).

   The bridge is read as `bridge`, never as `grindAPI`: re-declaring a
   contextBridge name in a classic script is a parse-time error. */
'use strict';
(function () {
  const bridge = window.grindAPI;
  const C = window.CURRICULUM;
  const D = window.Derive;
  const $ = s => document.querySelector(s);
  const main = $('#main');
  const modal = $('#modal');

  let S = null;
  let view = 'home';
  const ui = { lesson: null, daw: null, platform: 'instagram', bump: null, clear: new Set(), confirm: null, ask: null, editPost: null };
  try { const v = localStorage.getItem('grind.view'); if (['home', 'learn', 'posts', 'goals', 'settings'].includes(v)) view = v; } catch {}

  /* ── helpers ── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const base = p => String(p || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const counterOf = id => S.db.counters.find(c => c.id === id) || null;
  const kOf = c => 'k-' + ((c && c.color) || 'ye');
  const trackOf = id => C.tracks.find(t => t.id === id) || C.tracks[0];
  const lessonOf = id => C.lessons.find(l => l.id === id) || null;
  const postCounter = () => S.db.counters.find(c => c.todoistLabel) || counterOf('posts');
  const fmtN = n => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));
  const fmtH = h => fmtN(h) + 'h';
  const day = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const plural = (n, one, many) => (n === 1 ? one : many);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('on'), 2800);
  }
  async function op(name, payload) {
    const r = await bridge.op(name, payload);
    if (!r || !r.ok) toast((r && r.error) || 'that did not work');
    return r || { ok: false };
  }
  async function net(promise, okMsg) {
    const r = await promise;
    if (r && r.ok) { if (okMsg) toast(okMsg); }
    else toast((r && r.error) || 'that did not work');
    return r;
  }

  /* ── rendering ── */
  function render() {
    if (!S) return;
    renderChrome();
    const keep = snapshotInputs();
    const same = main.dataset.view === view;
    const top = main.scrollTop;
    main.innerHTML = '<div class="view">' + VIEWS[view]() + '</div>';
    main.dataset.view = view;
    restoreInputs(keep);
    main.scrollTop = same ? top : 0;
    if (ui.bump) { const t = main.querySelector(`[data-tile="${CSS.escape(ui.bump)}"]`); if (t) t.classList.add('bump'); ui.bump = null; }
  }
  function snapshotInputs() {
    const out = { vals: {}, focus: null };
    main.querySelectorAll('[data-keep]').forEach(el => { if (el.id && !ui.clear.has(el.id)) out.vals[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    const a = document.activeElement;
    if (a && a.id && main.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !ui.clear.has(a.id))
      out.focus = { id: a.id, v: a.value, s: a.selectionStart, e: a.selectionEnd };
    ui.clear.clear();
    return out;
  }
  function restoreInputs(k) {
    Object.entries(k.vals).forEach(([id, v]) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } });
    if (k.focus) {
      const el = document.getElementById(k.focus.id);
      if (el) { el.value = k.focus.v; el.focus(); try { if (k.focus.s != null) el.setSelectionRange(k.focus.s, k.focus.e); } catch {} }
    }
  }
  const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };

  function renderChrome() {
    document.querySelectorAll('#rail [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === view));
    const now = Date.now(), w0 = D.startOfWeek(now);
    $('#bar-mid').innerHTML = `<b>week ${esc(D.weekKey(now).slice(6))}</b> · ${esc(day(w0))} – ${esc(day(D.addDays(w0, 6)))}`;
    const td = S.status.todoist;
    const dot = td.busy ? 'busy' : td.hasToken && td.ok !== false ? 'ok' : '';
    const tdTxt = !td.hasToken ? 'todoist off' : td.busy ? 'todoist…' : td.error ? 'todoist: check settings' : 'todoist on';
    $('#rail-foot').innerHTML = `<div><span class="dot ${dot}"></span>${esc(tdTxt)}</div><div>v${esc(S.status.version)}</div>`;
  }

  /* ── HOME ── */
  function vHome() {
    const db = S.db, now = Date.now(), win = db.settings.window;
    const title = win === 'all' ? 'all time' : 'this ' + win;
    return `${pendingHtml()}
      <div class="head">
        <div style="flex:1"><div class="eyebrow">${esc(new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
          <h1 class="h1" style="margin-top:8px">${esc(title)}</h1></div>
        <div class="seg">${['week', 'month', 'year', 'all'].map(w => `<button data-act="window" data-w="${w}" class="${w === win ? 'on' : ''}">${w}</button>`).join('')}</div>
      </div>
      <div class="tiles">${db.counters.map((c, i) => tileHtml(c, i, now, win)).join('')}</div>
      <div class="cards">${learnCard()}${challengeCard(now)}${deskCard()}</div>
      <div class="cards two">${feedCard(now)}${goalsMini(now)}</div>`;
  }

  function pendingHtml() {
    if (!S.db.pending.length) return '';
    return `<div class="pending">${S.db.pending.map(b => {
      const c = counterOf(b.c);
      const names = b.files.slice(0, 6).map(f => base(f.path)).join(', ') + (b.files.length > 6 ? '…' : '');
      return `<div class="pend ${kOf(c)}"><i></i><div class="t"><b>${b.files.length} new files</b> in a ${esc(c ? c.label : b.c)} folder — count them all?
          <small>${esc(names)}</small></div>
        <button class="btn ghost sm" data-act="pend-no" data-id="${esc(b.id)}">don't count</button>
        <button class="btn solid sm" data-act="pend-yes" data-id="${esc(b.id)}">count ${b.files.length}</button></div>`;
    }).join('')}</div>`;
  }

  function sourceLine(c) {
    const parts = [];
    if (c.sources.length) {
      const miss = c.sources.filter(s => S.status.sources[s.path] && !S.status.sources[s.path].exists).length;
      parts.push(miss ? `${miss} folder${miss > 1 ? 's' : ''} missing` : `${c.sources.length} folder${c.sources.length > 1 ? 's' : ''} watched`);
    }
    if (c.todoistLabel) parts.push('todoist @' + c.todoistLabel);
    return parts.join(' · ') || 'by hand';
  }

  function tileHtml(c, i, now, win) {
    const st = D.counterStats(S.db, c.id, now);
    const aim = c.aim || 0;
    const segs = aim > 0 && aim <= 14 ? Array.from({ length: aim }, (_, j) => `<span class="${j < st.week ? 'on' : ''}"></span>`).join('') : '';
    const aimTxt = !aim ? `${st.week} this week` : st.week >= aim ? `aim met · ${st.week} this week` : `${st.week} of ${aim} this week`;
    const maxW = Math.max(1, aim, ...st.weeks.map(w => w.n));
    const weeks = st.weeks.map((w, j) => `<span class="${j === st.weeks.length - 1 ? 'now' : ''}" style="height:${Math.max(6, Math.round(w.n / maxW * 100))}%" title="${esc(w.key)}: ${w.n}"></span>`).join('');
    const rest = { week: ['month', 'year', 'all'], month: ['week', 'year', 'all'], year: ['week', 'month', 'all'], all: ['week', 'month', 'year'] }[win];
    return `<article class="tile ${kOf(c)}" data-tile="${esc(c.id)}">
      <div class="tile-shape s${i % 4}"></div>
      <div class="tile-top"><span class="tile-label">${esc(c.label)}</span><span class="tile-src">${esc(sourceLine(c))}</span></div>
      <div class="tile-num${String(st[win]).length >= 4 ? ' l4' : String(st[win]).length === 3 ? ' l3' : ''}">${st[win]}</div>
      <div class="tile-win">${win === 'all' ? 'all time' : 'this ' + win}</div>
      <div class="tile-mid"><div class="tile-sub">${rest.map(r => `${r === 'all' ? 'all' : r} ${st[r]}`).join(' · ')}</div>
        <div class="weeks" title="the last 12 weeks">${weeks}</div></div>
      <div class="tile-foot">
        <div class="aim">${segs ? `<div class="aim-segs">${segs}</div>` : ''}<div class="aim-txt">${esc(aimTxt)}</div></div>
        <button class="tile-plus" data-act="tap" data-c="${esc(c.id)}" title="+1 ${esc(c.noun)}">+1</button>
      </div>
    </article>`;
  }

  function learnCard() {
    const db = S.db, l = D.currentLesson(db, C), t = trackOf(l.track), lp = D.learnProgress(db, C);
    const done = !!db.learn.done[l.id];
    return `<article class="card k-${t.color}"><div class="card-shape tri"></div><div class="lift">
      <div class="card-hd"><span class="eyebrow">now learning · ${esc(t.title)}</span></div>
      <div class="lc-title">${esc(l.title)}</div>
      <div class="lc-drill"><b>Drill:</b> ${esc(l.drill.task)}</div>
      <div class="bar-prog"><i style="width:${Math.round(lp.done / lp.total * 100)}%"></i></div>
      <div class="muted" style="font-size:11px">${lp.done} of ${lp.total} lessons done</div>
      <div class="actions">
        <button class="btn solid sm" data-act="lesson" data-id="${esc(l.id)}">open lesson</button>
        ${done ? '<span class="done-pill">drill done</span>' : `<button class="btn sm" data-act="lesson-done" data-id="${esc(l.id)}">drill done</button>`}
      </div></div></article>`;
  }

  function makesChip(m) {
    if (!m) return '';
    return `<span class="chip">makes a ${esc(m)}</span>`;
  }

  function challengeCard(now) {
    const wc = D.weekChallenge(S.db, C, now), ch = wc.challenge;
    const sent = linkedTo('challenge', ch.id, wc.key);
    return `<article class="card k-pk"><div class="card-shape sq"></div><div class="lift">
      <div class="card-hd"><span class="eyebrow">challenge · week ${esc(wc.key.slice(6))}</span>${makesChip(ch.makes)}</div>
      <div class="lc-title">${esc(ch.title)}</div>
      <div class="ch-text">${esc(ch.text)}</div>
      <div class="actions">
        ${wc.done ? `<span class="done-pill">done</span><button class="btn ghost sm" data-act="ch-undone" data-week="${esc(wc.key)}">undo</button>`
                  : `<button class="btn solid sm" data-act="ch-done" data-week="${esc(wc.key)}" data-id="${esc(ch.id)}">done</button>
                     <button class="btn sm" data-act="ch-reroll" data-week="${esc(wc.key)}">another one</button>`}
        ${sent ? '<span class="chip">in todoist</span>' : `<button class="btn ghost sm" data-act="send" data-kind="challenge" data-id="${esc(ch.id)}" data-week="${esc(wc.key)}">→ todoist</button>`}
      </div></div></article>`;
  }

  function deskCard() {
    const d = S.db.desk, st = S.status;
    const head = `<div class="card-hd"><span class="eyebrow">desk · from CREATE</span>
      ${st.todoist.hasToken ? `<button class="btn ghost sm" data-act="desk-refresh" ${st.desk.busy ? 'disabled' : ''}>${st.desk.busy ? 'reading…' : 'refresh'}</button>` : ''}</div>`;
    let body;
    if (!st.todoist.hasToken) {
      body = `<p class="empty">Your CREATE sessions and songs show up here once a Todoist token is saved in settings. GRIND reads them from root's own sync tasks and never writes there.</p>
        <div class="actions"><button class="btn sm" data-go="settings">open settings</button></div>`;
    } else if (!d) {
      body = `<p class="empty">${st.desk.error ? esc(st.desk.error) : st.desk.busy ? 'Reading root\'s sync…' : 'Not read yet.'}</p>`;
    } else {
      const max = Math.max(1, ...d.areas.map(a => d.week.byArea[a.key] || 0));
      body = `<div class="desk-hours"><b>${esc(fmtH(d.week.hours))}</b><span class="muted">this week · ${d.week.sessions} ${plural(d.week.sessions, 'session', 'sessions')}</span></div>
        <div class="desk-areas">${d.areas.map(a => `<div class="desk-area"><span>${esc(a.label)}</span>
          <div class="bar-prog" style="--k:${esc(a.color)}"><i style="width:${Math.round((d.week.byArea[a.key] || 0) / max * 100)}%"></i></div>
          <span>${esc(fmtH(d.week.byArea[a.key] || 0))}</span></div>`).join('')}</div>
        <div class="works">${d.works.slice(0, 4).map(w => `<div class="work" style="--k:${esc(w.stageColor)}"><b>${esc(w.name)}</b>
          <small>${esc(w.stageLabel)}${w.items ? ` · ${w.ticks}/${w.items}` : ''}</small>
          <div class="stages">${Array.from({ length: w.stages }, (_, j) => `<span class="${j <= w.stageIx ? 'on' : ''}"></span>`).join('')}</div></div>`).join('')
          || '<p class="empty">Nothing in progress on the shelf.</p>'}</div>
        <div class="status-line">root synced ${esc(D.ago(d.written, Date.now()))}${st.desk.error ? ' · ' + esc(st.desk.error) : ''}</div>`;
    }
    return `<article class="card desk-card">${head}${body}</article>`;
  }

  function eventLabel(e) {
    if (e.via === 'folder') return base(e.ref);
    if (e.note) return e.note;
    return { tap: 'by hand', hotkey: 'hotkey', todoist: 'todoist', post: 'posted' }[e.via] || e.via;
  }

  function feedCard(now) {
    const evs = S.db.events.slice().sort((a, b) => b.at - a.at).slice(0, 12);
    const rows = evs.map(e => {
      const c = counterOf(e.c);
      return `<div class="ev ${kOf(c)}"><i></i>
        <div class="what"><b>+${e.n} ${esc(c ? (e.n === 1 ? c.noun : c.label) : e.c)}</b><span>${esc(eventLabel(e))}</span></div>
        <time title="${esc(new Date(e.at).toLocaleString('en-GB'))}">${esc(D.ago(e.at, now))}</time>
        <div class="acts">${e.via === 'folder' ? `<button class="btn ghost icon" data-act="to-post" data-id="${esc(e.id)}" title="turn it into a post idea">↗</button>` : ''}
          <button class="btn ghost icon" data-act="undo" data-id="${esc(e.id)}" title="this one doesn't count">×</button></div></div>`;
    }).join('');
    return `<article class="card"><div class="card-hd"><span class="eyebrow">recent</span></div>
      ${rows ? `<div class="feed">${rows}</div>` : `<p class="empty">Nothing counted yet. Save a Serum 2 preset into presets › curate, or render audio into Documents › curate › samples — it shows up here on its own. The +1 on a tile is for everything else.</p>`}</article>`;
  }

  function paceText(g, p) {
    if (p.finished) return `done — ${p.done} of ${p.n}.`;
    if (p.overdue) return `the date has passed with ${p.left} to go — move it if the goal still matters.`;
    if (p.weeksLeft == null) return `${p.left} to go · ${fmtN(p.doingPerWeek)}/week so far`;
    return `${p.left} to go · about ${fmtN(p.needPerWeek)}/week until ${esc(g.by)} · ${fmtN(p.doingPerWeek)}/week so far`;
  }

  function goalsMini(now) {
    const gs = S.db.goals.slice(0, 3);
    return `<article class="card"><div class="card-hd"><span class="eyebrow">goals</span><button class="btn ghost sm" data-go="goals">all goals</button></div>
      ${gs.length ? gs.map(g => {
        const p = D.goalProgress(S.db, g, now), c = g.c ? counterOf(g.c) : null;
        return `<div class="goal-mini ${c ? kOf(c) : 'k-or'}"><div class="row"><b style="flex:1">${esc(g.label)}</b><span class="muted">${p.done} / ${p.n}</span></div>
          <div class="bar-prog"><i style="width:${Math.round(p.pct * 100)}%"></i></div><div class="muted" style="font-size:11px">${paceText(g, p)}</div></div>`;
      }).join('') : '<p class="empty">No goals yet. A goal is a number and, if you like, a date — "200 patches by June". Counters fill it on their own.</p>'}
    </article>`;
  }

  /* ── LEARN ── */
  function linkedTo(kind, id, week) {
    return Object.values(S.db.todoist.linked).some(l => l.kind === kind && l.id === id && (!week || l.week === week));
  }

  function vLearn() {
    const db = S.db, cur = D.currentLesson(db, C);
    /* Pinned the first time the tab opens: "current" moves on when its drill
       is done, and the page you are reading must not move with it. */
    const sel = ui.lesson || (ui.lesson = cur.id);
    const wc = D.weekChallenge(db, C, Date.now());
    const aside = C.tracks.map(t => {
      const ls = C.lessons.filter(l => l.track === t.id);
      const n = ls.filter(l => db.learn.done[l.id]).length;
      return `<div class="trk k-${t.color}"><div class="trk-hd"><i></i><b>${esc(t.title)}</b><span>${n}/${ls.length}</span></div>
        ${ls.map(l => `<button class="les ${db.learn.done[l.id] ? 'done' : ''} ${sel === l.id ? 'on' : ''} ${cur.id === l.id ? 'cur' : ''}" data-act="lesson" data-id="${esc(l.id)}">
          <span class="box"></span>${esc(l.title)}</button>`).join('')}</div>`;
    }).join('');
    const chN = Object.keys(db.challenge.done).length;
    const chBlock = `<div class="trk k-pk"><div class="trk-hd"><i></i><b>Weekly challenge</b><span>${chN} done</span></div>
      <button class="les ${wc.done ? 'done' : ''} ${sel === '__ch' ? 'on' : ''}" data-act="lesson" data-id="__ch"><span class="box"></span>${esc(wc.challenge.title)}</button></div>`;
    const reader = sel === '__ch' ? challengeReader(wc) : lessonReader(lessonOf(sel) || cur, cur);
    return `<div class="learn"><aside class="tracks">${chBlock}${aside}</aside><article class="reader">${reader}</article></div>`;
  }

  function lessonReader(l, cur) {
    const db = S.db, t = trackOf(l.track), done = !!db.learn.done[l.id];
    const daw = ui.daw || db.learn.daw;
    const hasDaw = l.daw.fl.length || l.daw.ableton.length;
    const i = C.lessons.indexOf(l), next = C.lessons[i + 1];
    const sent = linkedTo('lesson', l.id);
    const makes = l.drill.makes === 'patch' ? 'Save the preset into Serum 2 › presets › curate and GRIND counts it as a patch.'
                : l.drill.makes === 'sample' ? 'Render into Documents › curate › samples and GRIND counts every file as a sample.' : '';
    const li = s => `<li>${esc(s)}</li>`;
    return `<div class="k-${t.color}">
      <div class="rd-head"><div class="tile-shape s0"></div>
        <div class="eyebrow">${esc(t.title)} · level ${l.tier} · about ${l.minutes} min</div>
        <h2>${esc(l.title)}</h2>
        <p class="why">${esc(l.why)}</p>
        <div class="rd-actions">
          ${done ? `<button class="btn solid" data-act="lesson-undone" data-id="${esc(l.id)}">drill done · undo</button>`
                 : `<button class="btn solid" data-act="lesson-done" data-id="${esc(l.id)}">mark the drill done</button>`}
          ${cur.id === l.id ? '' : `<button class="btn" data-act="lesson-current" data-id="${esc(l.id)}">make it my current lesson</button>`}
          <button class="btn" data-act="ask" data-id="${esc(l.id)}">ask Claude</button>
          ${sent ? '<button class="btn" disabled>drill is in todoist</button>' : `<button class="btn" data-act="send" data-kind="lesson" data-id="${esc(l.id)}">send drill to todoist</button>`}
          ${next ? `<button class="btn" data-act="lesson" data-id="${esc(next.id)}">next →</button>` : ''}
        </div>
      </div>
      <div class="rd-body">
        <div class="rd-main">
          <h3>The idea</h3>${l.concept.map(p => `<p>${esc(p)}</p>`).join('')}
          <h3>Steps</h3><ol>${l.steps.map(li).join('')}</ol>
          ${hasDaw ? `<div class="daw-box"><div class="row"><span class="eyebrow">in your DAW</span><span class="sp"></span>
              <div class="seg"><button data-act="daw-view" data-daw="fl" class="${daw === 'fl' ? 'on' : ''}">FL Studio</button><button data-act="daw-view" data-daw="ableton" class="${daw === 'ableton' ? 'on' : ''}">Ableton</button></div></div>
              <ul>${(l.daw[daw] || []).map(li).join('') || '<li>Nothing DAW-specific here.</li>'}</ul></div>` : ''}
          <div class="drill"><div class="row"><span class="eyebrow" style="flex:1">the drill</span>${makesChip(l.drill.makes)}</div>
            <p>${esc(l.drill.task)}</p><p class="dw">Done when ${esc(l.drill.doneWhen)}.</p>
            ${makes ? `<p class="dw">${esc(makes)}</p>` : ''}</div>
          <h3>Traps</h3><ul>${l.traps.map(li).join('')}</ul>
          <h3>Listen for</h3><p>${esc(l.listen)}</p>
        </div>
        <aside class="rd-side">
          <div class="card"><h3 style="margin-top:0">your notes</h3>
            <textarea id="note-${esc(l.id)}" data-keep data-note="${esc(l.id)}" placeholder="what worked, values you liked, questions…">${esc(db.learn.notes[l.id] || '')}</textarea>
            <div class="muted" style="font-size:11px;margin-top:6px">saved as you type · included when you ask Claude</div></div>
          ${l.plugins.length ? `<div class="card"><h3 style="margin-top:0">uses</h3><div class="plugins">${l.plugins.map(p => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>` : ''}
        </aside>
      </div></div>`;
  }

  function challengeReader(wc) {
    const db = S.db, ch = wc.challenge;
    const sent = linkedTo('challenge', ch.id, wc.key);
    const hist = Object.entries(db.challenge.done).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12)
      .map(([wk, d]) => { const x = C.challenges.find(q => q.id === d.id); return `<div><span>${esc(wk)}</span><span>${esc(x ? x.title : d.id)}</span></div>`; }).join('');
    return `<div class="k-pk">
      <div class="rd-head"><div class="tile-shape s0"></div>
        <div class="eyebrow">weekly challenge · ${esc(wc.key)}${ch.makes ? ' · makes a ' + esc(ch.makes) : ''}</div>
        <h2>${esc(ch.title)}</h2><p class="why">${esc(ch.text)}</p>
        <div class="rd-actions">
          ${wc.done ? `<button class="btn solid" data-act="ch-undone" data-week="${esc(wc.key)}">done · undo</button>`
                    : `<button class="btn solid" data-act="ch-done" data-week="${esc(wc.key)}" data-id="${esc(ch.id)}">done</button>
                       <button class="btn" data-act="ch-reroll" data-week="${esc(wc.key)}">another one</button>`}
          ${sent ? '<button class="btn" disabled>in todoist</button>' : `<button class="btn" data-act="send" data-kind="challenge" data-id="${esc(ch.id)}" data-week="${esc(wc.key)}">send to todoist</button>`}
        </div>
      </div>
      <div class="rd-body"><div class="rd-main">
        <h3>How it works</h3>
        <p>One challenge a week, the same one all week, picked from a pool of ${C.challenges.length}. "Another one" swaps it for this week only. A week without one is just a week — there is no streak to keep.</p>
        <p>Whatever it makes, save it where GRIND watches and it counts on its own.</p>
        <h3>Done so far</h3>${hist ? `<div class="hist">${hist}</div>` : '<p>None yet.</p>'}
      </div><aside class="rd-side"></aside></div></div>`;
  }

  /* ── POSTS ── */
  const STAGES = [['idea', 'vi', 'ideas'], ['film', 'ye', 'to film'], ['edit', 'te', 'to edit'], ['posted', 'bl', 'posted']];
  function vPosts() {
    const db = S.db, now = Date.now(), pc = postCounter();
    const st = pc ? D.counterStats(db, pc.id, now) : null;
    const cols = STAGES.map(([key, k, label]) => {
      let list = db.posts.filter(p => p.stage === key);
      list = key === 'posted' ? list.sort((a, b) => (b.posted || 0) - (a.posted || 0)) : list.sort((a, b) => b.created - a.created);
      const shown = key === 'posted' ? list.slice(0, 8) : list;
      return `<div class="col k-${k}"><div class="col-hd"><i></i><span class="eyebrow">${label}</span><span>${list.length}</span></div>
        ${shown.map(postCard).join('') || '<p class="empty" style="font-size:11.5px">—</p>'}
        ${list.length > shown.length ? `<p class="muted" style="font-size:11px">+${list.length - shown.length} older</p>` : ''}</div>`;
    }).join('');
    const made = db.events.filter(e => e.via === 'folder' && now - e.at < 14 * D.DAY).sort((a, b) => b.at - a.at).slice(0, 6);
    return `<div class="head"><h1 class="h1">posts</h1>
        ${st ? `<span class="muted">${st.week} this week · ${st.month} this month · ${st.all} all time</span>` : ''}</div>
      <div class="post-add">
        <input type="text" id="post-title" data-keep placeholder="a post idea — e.g. reese walkthrough, 30 seconds">
        <div class="seg">${[['instagram', 'instagram'], ['soundcloud', 'soundcloud']].map(([v, l]) => `<button data-act="post-platform" data-p="${v}" class="${ui.platform === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <select id="post-kind" data-keep>${['reel', 'carousel', 'story', 'track', 'mix'].map(k => `<option>${k}</option>`).join('')}</select>
        <button class="btn solid" data-act="post-add">add idea</button>
      </div>
      <div class="kanban">${cols}</div>
      ${made.length ? `<div class="card made"><div class="card-hd"><span class="eyebrow">from what you made lately</span></div>
        <p class="empty">Things you made are the easiest posts: a 20-second patch walkthrough, a before/after, a sample flip.</p>
        <div class="row wrap">${made.map(e => { const c = counterOf(e.c);
          return `<button class="btn sm" data-act="to-post" data-id="${esc(e.id)}"><span class="chip ${kOf(c)}" style="height:18px;padding:0 6px"><i></i></span>${esc(base(e.ref))} → idea</button>`; }).join('')}</div></div>` : ''}`;
  }
  function postCard(p) {
    const i = STAGES.findIndex(s => s[0] === p.stage);
    return `<div class="pcard ${p.taskId ? 'linked' : ''}"><b>${esc(p.title)}</b>
      ${p.notes ? `<div class="note">${esc(p.notes.length > 140 ? p.notes.slice(0, 140) + '…' : p.notes)}</div>` : ''}
      <div class="row wrap"><span class="chip">${esc(p.platform)}</span><span class="chip">${esc(p.kind)}</span>
        ${p.posted ? `<span class="chip">${esc(day(p.posted))}</span>` : ''}${p.taskId ? '<span class="chip">todoist</span>' : ''}</div>
      <div class="acts">
        <button class="btn ghost icon" data-act="post-move" data-id="${esc(p.id)}" data-dir="-1" ${i <= 0 ? 'disabled' : ''} title="back">←</button>
        <button class="btn ghost icon" data-act="post-move" data-id="${esc(p.id)}" data-dir="1" ${i >= STAGES.length - 1 ? 'disabled' : ''} title="${i === STAGES.length - 2 ? 'posted' : 'next'}">→</button>
        <span class="sp"></span>
        ${p.taskId || p.stage === 'posted' ? '' : `<button class="btn ghost sm" data-act="send" data-kind="post" data-id="${esc(p.id)}">→ todoist</button>`}
        ${p.link ? `<button class="btn ghost icon" data-act="open-link" data-url="${esc(p.link)}" title="open">↗</button>` : ''}
        <button class="btn ghost icon" data-act="post-edit" data-id="${esc(p.id)}" title="edit">✎</button>
        <button class="btn ghost icon" data-act="post-del" data-id="${esc(p.id)}" title="delete">×</button>
      </div></div>`;
  }

  /* ── GOALS ── */
  function vGoals() {
    const db = S.db, now = Date.now();
    const list = db.goals.map(g => {
      const p = D.goalProgress(db, g, now), c = g.c ? counterOf(g.c) : null;
      return `<div class="card goal ${c ? kOf(c) : 'k-or'}">
        <div class="top"><div class="h2">${esc(g.label)}</div>
          <button class="btn ghost icon" data-act="goal-del" data-id="${esc(g.id)}" title="remove">×</button></div>
        <div class="row wrap" style="margin-top:8px"><span class="chip"><i></i>${esc(c ? 'counts ' + c.label : 'counted by hand')}</span>
          <span class="chip">from ${esc(g.from)}</span>${g.by ? `<span class="chip">by ${esc(g.by)}</span>` : ''}</div>
        <div class="nums">${p.done}<small>of ${p.n}</small></div>
        <div class="bar-prog"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
        <div class="pace">${paceText(g, p)}</div>
        ${c ? '' : `<div class="actions" style="margin-top:12px"><div class="stepper"><button class="btn icon" data-act="goal-bump" data-id="${esc(g.id)}" data-dir="-1">−</button>
          <b>${g.done}</b><button class="btn icon" data-act="goal-bump" data-id="${esc(g.id)}" data-dir="1">+</button></div></div>`}
      </div>`;
    }).join('');
    const aims = db.counters.map(c => `<div class="aim-row ${kOf(c)}"><i></i><span>${esc(c.label)} <span class="muted">per week</span></span>
      <div class="stepper"><button class="btn icon" data-act="aim" data-c="${esc(c.id)}" data-dir="-1">−</button><b>${c.aim || 0}</b>
      <button class="btn icon" data-act="aim" data-c="${esc(c.id)}" data-dir="1">+</button></div></div>`).join('');
    return `<div class="head"><h1 class="h1">goals</h1></div>
      <div class="goals-grid">
        <div>${list || '<div class="card"><p class="empty">No goals yet. Add one on the right — "200 patches by June", "release an EP by summer" (counted by hand).</p></div>'}</div>
        <div>
          <div class="card aims" style="margin-bottom:16px"><div class="card-hd"><span class="eyebrow">weekly aims</span></div>
            <p class="empty" style="margin-bottom:8px">What a good week looks like. Reaching it lights the tile; missing it lights nothing.</p>${aims}</div>
          <div class="card"><div class="card-hd"><span class="eyebrow">new goal</span></div>
            <div class="form-grid">
              <label>name<input type="text" id="g-label" data-keep placeholder="200 patches"></label>
              <label>counts<select id="g-c" data-keep><option value="">by hand</option>${db.counters.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}</select></label>
              <label>number<input type="number" id="g-n" data-keep min="1" placeholder="200"></label>
              <label>by (optional)<input type="date" id="g-by" data-keep></label>
              <button class="btn solid" data-act="goal-add">add goal</button>
            </div></div>
        </div>
      </div>`;
  }

  /* ── SETTINGS ── */
  const COLORS = ['ye', 'te', 'bl', 'or', 'vi', 'cy', 'pk'];
  function vSettings() {
    const db = S.db, st = S.status, td = st.todoist;
    const ctrs = db.counters.map((c, ci) => {
      const srcs = c.sources.map((s, i) => {
        const ss = st.sources[s.path];
        const exists = ss ? ss.exists : true;
        return `<div class="src"><i class="${exists ? '' : 'miss'}"></i>
          <div class="p"><div title="${esc(s.path)}">${esc(s.path)}</div>
            <small>${exists ? (ss ? ss.files + ' files' : 'not scanned yet') : 'folder not found'} · ${s.history ? 'counted what was already there' : 'counts new files only'}</small></div>
          <input type="text" value="${esc(s.exts.join(' '))}" data-change="exts" data-c="${esc(c.id)}" data-i="${i}" id="ex-${esc(c.id)}-${i}" title="file types, space-separated">
          <div class="row" style="gap:2px">
            ${exists ? `<button class="btn ghost sm" data-act="src-open" data-path="${esc(s.path)}">open</button>`
                     : `<button class="btn ghost sm" data-act="src-make" data-path="${esc(s.path)}">create it</button>`}
            <button class="btn ghost icon" data-act="src-del" data-c="${esc(c.id)}" data-i="${i}" title="stop watching">×</button></div></div>`;
      }).join('');
      return `<div class="ctr ${kOf(c)}">
        <div class="ctr-hd">
          <div class="swatches">${COLORS.map(k => `<button class="k-${k} ${c.color === k ? 'on' : ''}" data-act="color" data-c="${esc(c.id)}" data-k="${k}" title="${k}"></button>`).join('')}</div>
          <input type="text" id="cl-${esc(c.id)}" value="${esc(c.label)}" data-change="counter" data-c="${esc(c.id)}" data-f="label" title="name (plural)">
          <input type="text" id="cn-${esc(c.id)}" value="${esc(c.noun)}" data-change="counter" data-c="${esc(c.id)}" data-f="noun" title="one of them">
          <div class="row" style="gap:2px">
            <button class="btn ghost icon" data-act="c-move" data-c="${esc(c.id)}" data-dir="-1" ${ci === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn ghost icon" data-act="c-move" data-c="${esc(c.id)}" data-dir="1" ${ci === db.counters.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn ghost icon" data-act="c-del" data-c="${esc(c.id)}" title="delete counter">×</button></div>
        </div>
        ${srcs || '<div class="muted" style="font-size:12px;padding:6px 0">No folders — counted by hand' + (c.todoistLabel ? ' and from Todoist.' : '.') + '</div>'}
        <div class="row wrap" style="margin-top:10px">
          <button class="btn sm" data-act="add-folder" data-c="${esc(c.id)}">+ watch a folder</button>
          <span class="sp"></span>
          ${c.todoistLabel != null || c.id === 'posts' ? `<label class="muted" style="font-size:11.5px">todoist label @</label>
            <input type="text" style="width:120px;height:28px" id="tl-${esc(c.id)}" value="${esc(c.todoistLabel || '')}" data-change="counter" data-c="${esc(c.id)}" data-f="todoistLabel" placeholder="post">` : ''}
        </div></div>`;
    }).join('');

    const lastPoll = db.todoist.lastPoll ? D.ago(db.todoist.lastPoll, Date.now()) : 'never';
    return `<div class="head"><h1 class="h1">settings</h1></div>
      <div class="set">
        <div class="card wide"><h3>Counters</h3>
          <div class="sub">A file that lands in a watched folder counts once — renaming or moving it between watched folders never counts it twice, and deleting it never takes it back (× on the home feed does). More than 25 new files at once waits for a yes. Folders are checked live, and every 5 minutes as a fallback.</div>
          ${ctrs}
          <div class="row wrap" style="margin-top:6px">
            <input type="text" id="nc-label" data-keep placeholder="new counter — e.g. stems" style="width:240px">
            <input type="text" id="nc-noun" data-keep placeholder="one of them — stem" style="width:200px">
            <button class="btn" data-act="c-add">add counter</button>
            <span class="sp"></span><button class="btn ghost sm" data-act="rescan">check folders now</button></div>
        </div>

        <div class="card"><h3>Todoist</h3>
          <div class="sub">GRIND creates tasks only when you press "→ todoist" (in ${esc(db.todoist.project)}, labelled @grind) and closes them when you finish the same thing here. Ticking one in Todoist finishes it here. A completed task in that project labelled @${esc((postCounter() || {}).todoistLabel || 'post')} counts as a post. Nothing is ever moved, renamed or deleted.</div>
          ${td.hasToken ? `<div class="row"><span class="chip k-te"><i></i>token saved, encrypted by Windows</span><span class="sp"></span><button class="btn ghost sm" data-act="td-forget">forget it</button></div>`
                        : `<div class="row"><input type="password" id="td-token" data-keep placeholder="API token — Todoist › settings › integrations › developer" style="flex:1"><button class="btn solid" data-act="td-token">save</button></div>`}
          <div class="kv" style="margin-top:16px">
            <label>project</label><input type="text" id="td-project" data-keep value="${esc(db.todoist.project)}">
            <label>posts go in</label><input type="text" id="td-socials" data-keep value="${esc(db.todoist.socials)}">
            <label>drills go in</label><input type="text" id="td-production" data-keep value="${esc(db.todoist.production)}">
          </div>
          <div class="row" style="margin-top:12px"><button class="btn sm" data-act="td-names">save names</button><span class="sp"></span>
            <button class="btn ghost sm" data-act="td-poll" ${td.hasToken ? '' : 'disabled'}>${td.busy ? 'checking…' : 'check now'}</button></div>
          <div class="status-line ${td.error ? 'err' : ''}">${td.error ? esc(td.error) : td.hasToken ? 'last checked ' + esc(lastPoll) + ' · every 10 minutes while GRIND runs' : 'not connected'}</div>
        </div>

        <div class="card"><h3>CREATE link</h3>
          <div class="sub">Read-only. GRIND reads root's own sync tasks, keeps CREATE's works and sessions, and drops every other record in them on the spot. It is as fresh as root's last sync.</div>
          <div class="kv">
            <label>project</label><input type="text" id="rt-project" data-keep value="${esc(db.todoist.rootProject)}">
            <label>section</label><input type="text" id="rt-section" data-keep value="${esc(db.todoist.rootSection)}">
          </div>
          <div class="row" style="margin-top:12px"><button class="btn sm" data-act="rt-save">save</button><span class="sp"></span>
            <button class="btn ghost sm" data-act="desk-refresh" ${td.hasToken ? '' : 'disabled'}>${st.desk.busy ? 'reading…' : 'read now'}</button></div>
          <div class="status-line ${st.desk.error ? 'err' : ''}">${st.desk.error ? esc(st.desk.error) : db.desk ? 'read ' + esc(D.ago(db.desk.fetched, Date.now())) + ' · root synced ' + esc(D.ago(db.desk.written, Date.now())) : 'not read yet'}</div>
        </div>

        <div class="card"><h3>Learning</h3>
          <div class="sub">Which DAW the lessons open on. Every lesson keeps both — switch any time.</div>
          <div class="seg"><button data-act="learn-daw" data-daw="fl" class="${db.learn.daw === 'fl' ? 'on' : ''}">FL Studio</button>
            <button data-act="learn-daw" data-daw="ableton" class="${db.learn.daw === 'ableton' ? 'on' : ''}">Ableton Live</button></div>
        </div>

        <div class="card"><h3>Shortcuts & notifications</h3>
          <label class="toggle"><input type="checkbox" data-change="hotkeys" ${db.settings.hotkeys ? 'checked' : ''}><span class="sw"></span>global +1 shortcuts, even while FL has focus</label>
          <div class="keys">${db.counters.slice(0, 9).map((c, i) => `<div><kbd>Ctrl+Alt+Shift+${i + 1}</kbd>+1 ${esc(c.noun)}</div>`).join('')}
            <div class="muted" style="margin-top:6px">Never plain Ctrl+Alt: on an AZERTY keyboard that is AltGr, and it would steal @ # { [ from every app.</div></div>
          <label class="toggle" style="margin-top:10px"><input type="checkbox" data-change="notify" ${db.settings.notify ? 'checked' : ''}><span class="sw"></span>silent Windows notification when something is counted while GRIND is in the background</label>
        </div>

        <div class="card"><h3>Data</h3>
          <div class="sub">Everything lives in one file on this PC (grind.json). A copy of the previous version is kept beside it.</div>
          <div class="row wrap"><button class="btn sm" data-act="export">export a copy</button><button class="btn ghost sm" data-act="data-folder">open the data folder</button></div>
          <div class="status-line">GRIND v${esc(st.version)}${st.net ? '' : ' · network off'}</div>
        </div>
      </div>`;
  }

  const VIEWS = { home: vHome, learn: vLearn, posts: vPosts, goals: vGoals, settings: vSettings };

  function go(v) {
    if (!VIEWS[v]) return;
    view = v;
    try { localStorage.setItem('grind.view', v); } catch {}
    render();
  }

  /* ── modal ── */
  function openModal(html) {
    modal.innerHTML = `<div class="sheet">${html}</div>`;
    modal.hidden = false;
    const f = modal.querySelector('[autofocus]');
    if (f) f.focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; ui.confirm = null; ui.ask = null; ui.editPost = null; ui.folder = null; }
  function confirmBox(title, body, yes, fn) {
    openModal(`<div class="h2">${esc(title)}</div><p class="soft" style="margin-top:8px">${esc(body)}</p>
      <div class="actions"><button class="btn ghost" data-act="m-close">keep it</button><button class="btn solid" data-act="confirm-yes">${esc(yes)}</button></div>`);
    ui.confirm = fn;
  }
  function openAsk(id) {
    const l = lessonOf(id);
    ui.ask = { id };
    openModal(`<div class="eyebrow">ask Claude</div><div class="h2" style="margin-top:6px">${esc(l ? l.title : 'a question')}</div>
      <p class="soft" style="margin:8px 0 14px">Write the question. GRIND adds who you are, your setup, this lesson, your notes and where you are, then copies it all — paste it into a new Claude chat.</p>
      <textarea id="ask-q" rows="5" autofocus placeholder="e.g. my reese gets thin when I add the sub underneath — what am I missing?"></textarea>
      <pre id="ask-pre"></pre>
      <div class="actions"><button class="btn ghost" data-act="m-close">close</button><button class="btn" data-act="ask-copy">copy</button>
        <button class="btn solid" data-act="ask-open">copy and open claude.ai</button></div>`);
    updateAsk();
  }
  function askText() { const q = $('#ask-q'); return D.askText(S.db, C, ui.ask.id, q ? q.value : '', Date.now()); }
  function updateAsk() { const pre = $('#ask-pre'); if (pre && ui.ask) pre.textContent = askText(); }
  function openPostEdit(id) {
    const p = S.db.posts.find(x => x.id === id);
    if (!p) return;
    ui.editPost = id;
    openModal(`<div class="eyebrow">post</div><div class="h2" style="margin-top:6px">edit</div>
      <div class="form-grid" style="margin-top:14px">
        <label>title<input type="text" id="pe-title" value="${esc(p.title)}" autofocus></label>
        <label>notes<textarea id="pe-notes" rows="4">${esc(p.notes)}</textarea></label>
        <label>link (once it is up)<input type="text" id="pe-link" value="${esc(p.link)}" placeholder="https://"></label>
        <div class="row"><label style="flex:1">platform<select id="pe-platform">${['instagram', 'soundcloud'].map(v => `<option ${p.platform === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label style="flex:1">kind<select id="pe-kind">${['reel', 'carousel', 'story', 'track', 'mix'].map(v => `<option ${p.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      </div>
      <div class="actions"><button class="btn ghost" data-act="m-close">cancel</button><button class="btn solid" data-act="post-save">save</button></div>`);
  }

  /* ── events ── */
  document.addEventListener('click', async e => {
    if (e.target === modal) { closeModal(); return; }
    const w = e.target.closest('[data-win]');
    if (w) { ({ min: bridge.minimize, max: bridge.toggleMax, close: bridge.close })[w.dataset.win](); return; }
    const g = e.target.closest('[data-go]');
    if (g) { if (!modal.hidden) closeModal(); go(g.dataset.go); return; }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const d = a.dataset;
    switch (d.act) {
      case 'window': op('settings.set', { window: d.w }); break;
      case 'tap': ui.bump = d.c; op('tap', { c: d.c }); break;
      case 'undo': {
        const ev = S.db.events.find(x => x.id === d.id), c = ev && counterOf(ev.c);
        if (!ev) break;
        confirmBox(`Don't count this ${c ? c.noun : 'one'}?`,
          ev.via === 'folder' ? `"${base(ev.ref)}" stays on disk; GRIND just stops counting it, and won't count it again.` : 'It comes off the count.',
          "don't count it", () => op('undo', { id: d.id }));
        break;
      }
      case 'to-post': {
        const ev = S.db.events.find(x => x.id === d.id), c = ev && counterOf(ev.c);
        if (!ev) break;
        const r = await op('post.add', { title: `${c ? c.noun : 'sound'} walkthrough — ${base(ev.ref)}`, platform: 'instagram', kind: 'reel' });
        if (r.ok) toast('added to post ideas');
        break;
      }
      case 'pend-yes': op('pending.accept', { id: d.id }); break;
      case 'pend-no': op('pending.ignore', { id: d.id }); break;

      case 'lesson': ui.lesson = d.id; ui.daw = null; if (view !== 'learn') go('learn'); else render(); main.scrollTop = 0; break;
      case 'lesson-done': { const r = await op('learn.done', { id: d.id }); if (r.ok) toast('drill done'); break; }
      case 'lesson-undone': op('learn.undone', { id: d.id }); break;
      case 'lesson-current': { const r = await op('learn.current', { id: d.id }); if (r.ok) toast('now on the home screen'); break; }
      case 'daw-view': ui.daw = d.daw; render(); break;
      case 'ask': openAsk(d.id); break;
      case 'ask-copy': await bridge.copy(askText()); toast('copied — paste it into Claude'); break;
      case 'ask-open': await bridge.copy(askText()); bridge.openUrl('https://claude.ai/new'); toast('copied — paste it into the new chat'); closeModal(); break;
      case 'send': await net(bridge.send({ kind: d.kind, id: d.id, week: d.week }), 'sent to Todoist'); break;

      case 'ch-done': { const r = await op('challenge.done', { week: d.week, id: d.id }); if (r.ok) toast('challenge done'); break; }
      case 'ch-undone': op('challenge.undone', { week: d.week }); break;
      case 'ch-reroll': op('challenge.reroll', { week: d.week }); break;
      case 'desk-refresh': net(bridge.refreshDesk(), 'desk read'); break;

      case 'post-platform': ui.platform = d.p; render(); break;
      case 'post-add': {
        const t = $('#post-title'), k = $('#post-kind');
        if (!t || !t.value.trim()) { toast('write the idea first'); if (t) t.focus(); break; }
        const r = await op('post.add', { title: t.value, platform: ui.platform, kind: k ? k.value : 'reel' });
        if (r.ok) { ui.clear.add('post-title'); t.value = ''; render(); }
        break;
      }
      case 'post-move': op('post.move', { id: d.id, dir: +d.dir }); break;
      case 'post-edit': openPostEdit(d.id); break;
      case 'post-save': {
        const r = await op('post.update', { id: ui.editPost, title: $('#pe-title').value, notes: $('#pe-notes').value,
          link: $('#pe-link').value, platform: $('#pe-platform').value, kind: $('#pe-kind').value });
        if (r.ok) closeModal();
        break;
      }
      case 'post-del': {
        const p = S.db.posts.find(x => x.id === d.id);
        if (p) confirmBox('Delete this post idea?', `"${p.title}"${p.stage === 'posted' ? ' — it stays counted as a post.' : ''}`, 'delete', () => op('post.remove', { id: d.id }));
        break;
      }
      case 'open-link': bridge.openUrl(d.url); break;

      case 'goal-add': {
        const label = $('#g-label').value, n = $('#g-n').value;
        const r = await op('goal.add', { label, c: $('#g-c').value || null, n, by: $('#g-by').value });
        if (r.ok) { ['g-label', 'g-n', 'g-by'].forEach(id => ui.clear.add(id)); render(); toast('goal added'); }
        break;
      }
      case 'goal-del': {
        const g0 = S.db.goals.find(x => x.id === d.id);
        if (g0) confirmBox('Remove this goal?', `"${g0.label}" — the counts behind it stay.`, 'remove', () => op('goal.remove', { id: d.id }));
        break;
      }
      case 'goal-bump': op('goal.bump', { id: d.id, dir: +d.dir }); break;
      case 'aim': { const c = counterOf(d.c); if (c) op('counter.update', { id: c.id, aim: Math.max(0, (c.aim || 0) + (+d.dir)) }); break; }

      case 'color': op('counter.update', { id: d.c, color: d.k }); break;
      case 'c-move': op('counter.move', { id: d.c, dir: +d.dir }); break;
      case 'c-del': {
        const c = counterOf(d.c);
        if (c) confirmBox(`Delete the ${c.label} counter?`, 'Its whole history goes with it. Export a copy first if you might want it.', 'delete it', () => op('counter.remove', { id: d.c }));
        break;
      }
      case 'c-add': {
        const label = $('#nc-label').value.trim();
        if (!label) { toast('name the counter first'); break; }
        const r = await op('counter.add', { label, noun: $('#nc-noun').value.trim() || label });
        if (r.ok) { ui.clear.add('nc-label'); ui.clear.add('nc-noun'); render(); }
        break;
      }
      case 'add-folder': {
        const p = await bridge.pickFolder();
        if (!p) break;
        const c = counterOf(d.c);
        const presets = c && c.sources.some(s => s.exts.includes('.serumpreset'));
        const exts = presets ? ['.serumpreset', '.fxp'] : ['.wav', '.aif', '.aiff', '.flac', '.mp3', '.ogg'];
        ui.folder = { c: d.c, path: p, exts };
        openModal(`<div class="eyebrow">watch a folder for ${esc(c ? c.label : d.c)}</div><div class="h2" style="margin-top:6px">Count what is already in it?</div>
          <p class="soft" style="margin-top:10px;word-break:break-all">${esc(p)}</p>
          <p class="soft" style="margin-top:10px">Yes counts the files already there as past work, at their own dates. No counts only the files that arrive from now on. File types: ${esc(exts.join(' '))} — editable afterwards.</p>
          <div class="actions"><button class="btn ghost" data-act="m-close">cancel</button>
            <button class="btn" data-act="folder-add" data-h="0">no, new files only</button>
            <button class="btn solid" data-act="folder-add" data-h="1">yes, count them</button></div>`);
        break;
      }
      case 'folder-add': { const f = ui.folder; closeModal(); if (f) op('source.add', { c: f.c, path: f.path, exts: f.exts, history: d.h === '1' }); break; }
      case 'src-open': bridge.openPath(d.path); break;
      case 'src-make': net(bridge.makeFolder(d.path), 'folder created'); break;
      case 'src-del': op('source.remove', { c: d.c, i: +d.i }); break;
      case 'rescan': await bridge.scan(); toast('folders checked'); break;

      case 'td-token': {
        const t = $('#td-token');
        if (!t || !t.value.trim()) { toast('paste the token first'); break; }
        const r = await net(bridge.saveToken(t.value), 'connected to Todoist');
        if (r && r.ok) ui.clear.add('td-token');
        break;
      }
      case 'td-forget': confirmBox('Forget the Todoist token?', 'GRIND stops reading and sending until you paste one again. Nothing in Todoist changes.', 'forget it', () => bridge.forgetToken()); break;
      case 'td-names': net(bridge.todoistSettings({ project: $('#td-project').value, socials: $('#td-socials').value, production: $('#td-production').value }), 'saved'); break;
      case 'td-poll': net(bridge.poll(), 'checked'); break;
      case 'rt-save': net(bridge.todoistSettings({ rootProject: $('#rt-project').value, rootSection: $('#rt-section').value }), 'saved'); break;
      case 'learn-daw': op('learn.daw', { daw: d.daw }); break;
      case 'export': { const r = await bridge.exportData(); if (r && r.ok) toast('exported'); break; }
      case 'data-folder': bridge.openData(); break;

      case 'm-close': closeModal(); break;
      case 'confirm-yes': { const fn = ui.confirm; closeModal(); if (fn) await fn(); break; }
    }
  });

  document.addEventListener('change', e => {
    const el = e.target, d = el.dataset;
    if (!d.change) return;
    if (d.change === 'counter') op('counter.update', { id: d.c, [d.f]: el.value });
    else if (d.change === 'exts') op('source.update', { c: d.c, i: +d.i, exts: el.value.split(/[\s,]+/).filter(Boolean) });
    else if (d.change === 'hotkeys') op('settings.set', { hotkeys: el.checked });
    else if (d.change === 'notify') op('settings.set', { notify: el.checked });
  });

  const noteT = {};
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'ask-q') { updateAsk(); return; }
    if (el.dataset.note) {
      const id = el.dataset.note;
      clearTimeout(noteT[id]);
      noteT[id] = setTimeout(() => op('learn.note', { id, text: el.value }), 600);
    }
  });

  document.addEventListener('keydown', e => {
    if (!modal.hidden) {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ui.ask) modal.querySelector('[data-act="ask-open"]').click();
      return;
    }
    if (e.key === 'Enter' && e.target.id === 'post-title') { e.preventDefault(); main.querySelector('[data-act="post-add"]').click(); }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-5]$/.test(e.key) && !typing()) {
      e.preventDefault();
      go(['home', 'learn', 'posts', 'goals', 'settings'][+e.key - 1]);
    }
  });

  /* ── boot ── */
  bridge.onState(s => { S = s; render(); });
  bridge.onToast(toast);
  bridge.state().then(s => { S = s; render(); });
  /* "x min ago" and the week line move on their own; a rebuild a minute keeps
     them honest, skipped while something is being typed. */
  setInterval(() => { if (S && modal.hidden && !typing()) render(); }, 60 * 1000);
})();
