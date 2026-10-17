/* GRIND · files — counting what lands in the watched folders.

   readSources() is the only part that touches the disk; applyScan() is pure,
   so the counting rules can be tested without a filesystem.

   The rules, in the order they are asked:
   - A file is known by its NTFS file id (stat.ino), which survives a rename or
     a move between two watched folders, so neither counts twice. A volume that
     reports no id falls back to the lowercased path.
   - A file that comes back at a known path under a new id (an app that saves
     by writing a temp file and renaming it over the old one) is a re-save,
     not a new file.
   - The first scan of a folder either counts what is already there, at the
     files' own times (`history: true` — your own preset folder), or only notes
     it (`history: false` — a shared folder full of downloads).
   - More than BURST new files in one scan is held as a question instead of
     counted: dropping a preset pack into a watched folder is not 200 patches.
   - Deleting a file never un-counts it. Undo is the way to say "that one
     does not count". */
'use strict';

const fs = require('fs');
const path = require('path');

const BURST = 25;
const MAX_DEPTH = 10;
const MAX_FILES = 50000;

function walk(dir, exts, out, depth) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (out.length >= MAX_FILES) return;
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < MAX_DEPTH) walk(p, exts, out, depth + 1); }
    else if (e.isFile() && exts.includes(path.extname(e.name).toLowerCase())) out.push(p);
  }
}

function fileInfo(p) {
  try {
    const st = fs.statSync(p, { bigint: true });
    const key = st.ino && st.ino !== 0n ? 'i' + st.ino.toString() : 'p' + p.toLowerCase();
    /* The earlier of created / modified: a copied file keeps its old modified
       time, a freshly rendered one has both at "now". */
    const times = [Number(st.birthtimeMs), Number(st.mtimeMs)].filter(t => t > 0);
    return { key, path: p, at: times.length ? Math.round(Math.min(...times)) : 0 };
  } catch { return null; }
}

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }

/* Every source of one counter, read. */
function readSources(counter) {
  return counter.sources.map(s => {
    const exists = isDir(s.path);
    const files = [];
    if (exists && s.exts.length) {
      const paths = [];
      walk(s.path, s.exts, paths, 0);
      paths.forEach(p => { const f = fileInfo(p); if (f) files.push(f); });
    }
    return { path: s.path, history: !!s.history, exists, files };
  });
}

/* What the reads mean for the record. Returns the next record, the events it
   added and the burst it held back (if any). */
function applyScan(db, c, reads, ctx) {
  const next = JSON.parse(JSON.stringify(db));
  const seen = next.seen[c] || (next.seen[c] = {});
  const byPath = new Map(Object.entries(seen).map(([k, p]) => [String(p).toLowerCase(), k]));
  const held = new Set(next.pending.filter(b => b.c === c).flatMap(b => b.files.map(f => f.key)));
  const fresh = [];
  const met = new Set();
  for (const r of reads) {
    if (!r.exists) continue;
    const first = !next.sourcesScanned[r.path];
    for (const f of r.files) {
      if (met.has(f.key)) continue;
      met.add(f.key);
      if (seen[f.key] != null) { if (seen[f.key] !== f.path) seen[f.key] = f.path; continue; }
      const old = byPath.get(f.path.toLowerCase());
      if (old) { delete seen[old]; seen[f.key] = f.path; continue; }
      if (held.has(f.key)) continue;
      if (first && !r.history) { seen[f.key] = f.path; continue; }
      fresh.push(f);
    }
    next.sourcesScanned[r.path] = true;
  }
  fresh.sort((a, b) => a.at - b.at);
  const when = f => (f.at > 0 && f.at <= ctx.now ? f.at : ctx.now);
  if (fresh.length > BURST) {
    const batch = { id: ctx.id('pd'), c, found: ctx.now, files: fresh.map(f => ({ key: f.key, path: f.path, at: when(f) })) };
    next.pending.push(batch);
    return { db: next, added: [], held: batch };
  }
  const added = fresh.map(f => {
    seen[f.key] = f.path;
    const ev = { id: ctx.id('ev'), c, at: when(f), n: 1, via: 'folder', ref: f.path };
    next.events.push(ev);
    return ev;
  });
  return { db: next, added, held: null };
}

function status(reads) {
  const out = {};
  reads.forEach(r => { out[r.path] = { exists: r.exists, files: r.files.length }; });
  return out;
}

module.exports = { BURST, readSources, applyScan, status, isDir };
