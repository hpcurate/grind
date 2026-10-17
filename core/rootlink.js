/* GRIND · rootlink — CREATE's desk, read from root's own sync.

   root's Todoist sync route writes its records into `ROOT · state…` tasks in
   04 | core › claude/codex, as JSON inside a ```root fence (root/ROOT.md §10:
   "the fence is the contract, the prose is free to change"). The state can be
   split across several tasks, one record never straddling two.

   GRIND reads those tasks and keeps exactly two things: `create_v1` (works and
   sessions) and the `create` branch of `root_config_v1` (stage names). Every
   other record in the payload — and there are private ones — is dropped the
   moment it is parsed and never stored. GRIND never writes to root's tasks.

   It is only as fresh as root's last sync from whichever device logged the
   session; the card says when that was. */
'use strict';

const D = require('./derive');

const FENCE = '```root';
const TITLE = 'ROOT · ';

/* root's shipped CREATE stages (root/js/config.js), used when the payload
   carries no override for them. Keys are identities; labels are for reading. */
const DEFAULT_AREAS = [
  { key: 'production', label: 'production', color: '#a78bfa', stages: [
    { key: 'idea', label: 'idea', color: '#a78bfa', items: 4 }, { key: 'sketch', label: 'sketch', color: '#5e8cff', items: 5 },
    { key: 'arrange', label: 'arrangement', color: '#3fc9b0', items: 7 }, { key: 'mix', label: 'mixdown', color: '#e8a33d', items: 10 },
    { key: 'master', label: 'master', color: '#f0709a', items: 5 }, { key: 'done', label: 'released', color: '#5cdb7d', items: 0, terminal: true }] },
  { key: 'mixing', label: 'mixing', color: '#5ad4e6', stages: [
    { key: 'crate', label: 'crate', color: '#5ad4e6', items: 4 }, { key: 'order', label: 'order', color: '#5e8cff', items: 4 },
    { key: 'drill', label: 'drill', color: '#a78bfa', items: 4 }, { key: 'record', label: 'record', color: '#e8a33d', items: 4 },
    { key: 'played', label: 'played', color: '#5cdb7d', items: 0, terminal: true }] },
];

function unwrap(text) {
  const s = String(text || '');
  const a = s.indexOf(FENCE);
  if (a < 0) return null;
  const b = s.indexOf('```', a + FENCE.length);
  if (b < 0) return null;
  try { return JSON.parse(s.slice(a + FENCE.length, b).trim()); } catch { return null; }
}

/* Only the two records GRIND uses, from every ROOT · task found. */
function extract(tasks) {
  let create = null, createAt = 0, config = null, written = 0, device = '';
  (tasks || []).forEach(t => {
    if (!String(t.content || '').trim().startsWith(TITLE)) return;
    const body = unwrap(t.description);
    if (!body || body.route !== 'todoist' || !body.state || typeof body.state !== 'object') return;
    const at = +body.written || 0;
    if (body.state.create_v1 && at >= createAt) { create = body.state.create_v1; createAt = at; }
    const cfg = body.state.root_config_v1;
    if (cfg && typeof cfg === 'object') {
      const branch = (cfg.create && cfg.create.areas) || (cfg.overrides && cfg.overrides.create && cfg.overrides.create.areas) || null;
      if (Array.isArray(branch)) config = branch;
    }
    if (at > written) { written = at; device = String(body.device || ''); }
  });
  return { create, config, written: createAt || written, device };
}

function areasFrom(config) {
  if (!Array.isArray(config) || !config.length) return DEFAULT_AREAS;
  return config.filter(a => a && a.key && Array.isArray(a.stages)).map(a => ({
    key: String(a.key), label: String(a.label || a.key), color: String(a.color || '#7a8699'),
    stages: a.stages.filter(s => s && s.key).map(s => ({ key: String(s.key), label: String(s.label || s.key),
      color: String(s.color || a.color || '#7a8699'), items: Array.isArray(s.items) ? s.items.length : 0, terminal: !!s.terminal })),
  }));
}

/* What the desk card draws. `null` when there is no CREATE record at all. */
function summarise(found, now) {
  const rec = found && found.create;
  if (!rec || typeof rec !== 'object') return null;
  const areas = areasFrom(found.config);
  const areaOf = k => areas.find(a => a.key === k) || areas[0];
  const works = Array.isArray(rec.works) ? rec.works : [];
  const sessions = Array.isArray(rec.sessions) ? rec.sessions : [];
  const byId = new Map(works.map(w => [String(w.id), w]));

  const rows = works.map(w => {
    const a = areaOf(String(w.area || ''));
    const ix = Math.max(0, a.stages.findIndex(s => s.key === w.stage));
    const st = a.stages[ix] || a.stages[0];
    const prefix = a.key + '|' + st.key + '|';
    const ticks = Object.keys((w.done && typeof w.done === 'object') ? w.done : {}).filter(k => k.startsWith(prefix)).length;
    return {
      id: String(w.id || ''), name: String(w.name || 'untitled'), area: a.key, areaLabel: a.label, color: a.color,
      stage: st.key, stageLabel: st.label, stageColor: st.color, stageIx: ix,
      stages: a.stages.filter(s => !s.terminal).length, terminal: !!st.terminal,
      /* root lets each checklist be edited; without the override in the payload
         the shipped length is a floor, never less than what is ticked. */
      ticks, items: Math.max(st.items, ticks),
      touched: String(w.touched || w.added || ''), bpm: String(w.bpm || ''),
    };
  });
  const open = rows.filter(r => !r.terminal).sort((x, y) => (x.touched < y.touched ? 1 : x.touched > y.touched ? -1 : 0));

  const w0 = D.startOfWeek(now), m0 = D.startOfMonth(now);
  const inRange = (s, from) => { const t = D.parseDate(s.date); return isFinite(t) && t >= from; };
  const total = (list, from) => list.filter(s => inRange(s, from));
  const hours = list => Math.round(list.reduce((n, s) => n + (+s.hours || 0), 0) * 100) / 100;
  const wk = total(sessions, w0), mo = total(sessions, m0);
  const byArea = {};
  areas.forEach(a => { byArea[a.key] = hours(wk.filter(s => s.area === a.key)); });

  return {
    fetched: now, written: found.written || 0, device: found.device || '',
    areas: areas.map(a => ({ key: a.key, label: a.label, color: a.color })),
    works: open.slice(0, 8), open: open.length, finished: rows.length - open.length,
    week: { hours: hours(wk), sessions: wk.length, practice: hours(wk.filter(s => s.practice)), byArea },
    month: { hours: hours(mo), sessions: mo.length },
    recent: sessions.slice().sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0)).slice(0, 6).map(s => {
      const w = s.work ? byId.get(String(s.work)) : null;
      return { date: String(s.date || ''), hours: +s.hours || 0, area: String(s.area || ''),
               name: w ? String(w.name || '') : '', what: String(s.what || ''), practice: !!s.practice };
    }),
  };
}

/* The network half: find the section, read its tasks, summarise. */
async function fetchDesk(td, project, section, now) {
  const t = await td.resolve(project, section);
  const tasks = await td.tasks({ section_id: t.sectionId });
  const found = extract(tasks);
  if (!found.create) throw new Error('no CREATE record in root\'s sync tasks yet — run sync in root');
  return summarise(found, now);
}

module.exports = { FENCE, TITLE, DEFAULT_AREAS, unwrap, extract, summarise, fetchDesk };
