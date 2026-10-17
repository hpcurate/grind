/* GRIND · todoist — the client (main process only; the renderer never sees
   the token) and the pure rule that turns completed tasks into progress.

   What GRIND writes, and the whole of it:
   - it CREATES tasks in the curate project when you press "send to Todoist"
     (a drill, a challenge or a post idea), labelled `grind` (+ `post` for a post);
   - it CLOSES a task it created when the same thing is finished in GRIND.
   It never moves, renames, reschedules, reopens or deletes anything. root's
   CREATE reads and closes in the same project; neither app creates what the
   other has to understand. */
'use strict';

const BASE = 'https://api.todoist.com/api/v1';

/* "02 | curate" and "02|curate" are the same project — root's rule. */
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function client(token, fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  async function call(p, opts = {}) {
    if (!token) throw new Error('no Todoist token saved — add one in settings');
    let res;
    try {
      res = await f(BASE + p, { ...opts, headers: { Authorization: 'Bearer ' + token,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
    } catch { throw new Error('network error — Todoist could not be reached'); }
    if (res.status === 401 || res.status === 403) throw new Error('Todoist rejected the token');
    if (res.status === 404) { const e = new Error('not found in Todoist'); e.status = 404; throw e; }
    if (res.status === 429) throw new Error('Todoist rate limit — try again in a minute');
    if (!res.ok) throw new Error('Todoist error ' + res.status);
    const text = await res.text();               // close answers 204, no body
    return text ? JSON.parse(text) : null;
  }
  async function getAll(p, params = {}, key = 'results') {
    const out = [];
    let cursor = null, guard = 0;
    do {
      const q = new URLSearchParams({ ...params, limit: '200' });
      if (cursor) q.set('cursor', cursor);
      const page = await call(p + '?' + q);
      if (Array.isArray(page)) { out.push(...page); cursor = null; }
      else { out.push(...((page && page[key]) || [])); cursor = (page && page.next_cursor) || null; }
    } while (cursor && ++guard < 50);
    return out;
  }
  async function resolve(project, section) {
    const projects = await getAll('/projects');
    const proj = projects.find(p => fold(p.name) === fold(project));
    if (!proj) throw new Error(`project "${project}" not found in Todoist`);
    if (!section) return { projectId: proj.id, sectionId: null };
    const sections = await getAll('/sections', { project_id: proj.id });
    const sec = sections.find(s => fold(s.name) === fold(section));
    if (!sec) throw new Error(`section "${section}" not found in ${proj.name}`);
    return { projectId: proj.id, sectionId: sec.id };
  }
  return {
    call, getAll, resolve,
    async check() { await call('/projects?limit=1'); return true; },
    async add(task) {
      const body = { content: task.content, description: task.description || '', project_id: task.projectId,
                     ...(task.sectionId ? { section_id: task.sectionId } : {}), labels: task.labels || [] };
      return call('/tasks', { method: 'POST', body: JSON.stringify(body) });
    },
    async close(id) { return call('/tasks/' + encodeURIComponent(id) + '/close', { method: 'POST' }); },
    async tasks(params) { return getAll('/tasks', params); },
    /* Completed between two moments. Todoist answers windows of up to ~3
       months; GRIND never asks for more than 30 days at a time. */
    async completed(sinceMs, untilMs, projectId) {
      return getAll('/tasks/completed/by_completion_date',
        { since: new Date(sinceMs).toISOString(), until: new Date(untilMs).toISOString(),
          ...(projectId ? { project_id: projectId } : {}) }, 'items');
    },
  };
}

/* Completed tasks → ops. A task GRIND linked finishes the thing it was sent
   for; any other completed task carrying the post label counts as a post.
   Returns [op, payload] pairs for the reducer, plus refs already handled so a
   second poll over the same window changes nothing. */
function completedOps(db, items) {
  const ops = [];
  const postC = db.counters.find(c => c.todoistLabel) || null;
  const label = postC ? fold(postC.todoistLabel) : null;
  items.forEach(t => {
    const id = String(t.id || t.task_id || '');
    if (!id) return;
    const at = Date.parse(t.completed_at || '') || Date.now();
    const link = db.todoist.linked[id];
    if (link) {
      if (link.kind === 'lesson' && !db.learn.done[link.id]) ops.push(['learn.done', { id: link.id, via: 'todoist' }]);
      else if (link.kind === 'challenge' && !db.challenge.done[link.week || '']) ops.push(['challenge.done', { week: link.week, id: link.id }]);
      else if (link.kind === 'post') {
        const p = db.posts.find(x => x.id === link.id);
        if (p && p.stage !== 'posted') ops.push(['post.move', { id: p.id, stage: 'posted', at, via: 'todoist' }]);
      }
      return;
    }
    const labels = Array.isArray(t.labels) ? t.labels.map(fold) : [];
    if (postC && label && labels.includes(label) && !db.events.some(e => e.ref === 'td:' + id) && !(db.dismissed || []).includes('td:' + id))
      ops.push(['td.count', { c: postC.id, at, ref: 'td:' + id, note: String(t.content || '').slice(0, 200) }]);
  });
  return ops;
}

module.exports = { BASE, fold, client, completedOps };
