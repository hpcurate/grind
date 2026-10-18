# GRIND — manifest

> Read this before editing. Add a Changelog line at the bottom with every
> change, and keep the sections above it true.

## 1. What GRIND is

A standalone Windows desktop app (Electron) for production, sound design and
socials: it **counts** what you make, **teaches** drum & bass sound design,
holds the **post pipeline** and **goals**, and talks to Todoist.

| Screen | Does |
| --- | --- |
| **home** | One tile per counter (patches, samples, posts…): the number for the week / month / year / all time, the weekly aim as segments, 12 weeks of history, a +1. Then the current lesson, this week's challenge, CREATE's desk, the recent feed (undo, ↗ turn into a post idea) and the goals. |
| **learn** | 28 lessons in 6 tracks (start here, synthesis, DnB bass, drums, FX & ears, arrangement), each with steps, FL / Ableton specifics, a drill, traps and notes; plus the weekly challenge. "Ask Claude" copies a self-contained request. |
| **posts** | Idea → to film → to edit → posted, Instagram / SoundCloud. Reaching *posted* counts a post. |
| **goals** | Weekly aims per counter, and goals (a number, optionally a date) counted by a counter or by hand. |
| **settings** | Counters and their folders, Todoist, the CREATE link, the session, FLOW, DAW, shortcuts, data. |

**The session bar** sits in the title bar on every screen: start a focus
session; the thick bar fills towards the goal (default 2 h), the thin one
runs to the next break (every 50 min, 10 min long) and starts over after it.
Pause, take the break now / end it early, end the session, and the **link
button** ties FLOW to it (§9). Ending one with a minute or more of focus files
its minutes (shown as "… this week" while idle). The tray menu starts,
pauses and ends it too; the taskbar button fills with the goal.

What GRIND deliberately does **not** do: log CREATE sessions or song stages
(root's CREATE does — GRIND only reads it; the session bar is a focus clock and
its minutes stay in GRIND), flashcards (LEARN), filing general tasks
(PLAN / Todoist).

**Flex rules** (the user's, from qurOS): reduce friction, never add it.
Nothing red, no streaks, a missed aim lights nothing, minimums count. A session
ended short of its goal lights nothing either.

## 2. Run, test, ship

```
npm install
npm start            # dev
npm test             # node test/unit.cjs — the core, no window
npm run test:ui      # electron test/visual.cjs — the real app, throwaway profile, shot-*.png
npm run pack         # dist/GRIND-win32-x64/GRIND.exe  ← what the user runs
npm run icon         # redraw build/icon.ico from scripts/make-icon.cjs
npm run shortcut     # (re)write the Start-menu shortcut to the packed exe
```

**The user runs the packed exe. After any source change, finish with
`npm run pack`**, or the change never reaches the app (FLOW learnt this).
The Start-menu shortcut (`npm run shortcut`) points at
`dist/GRIND-win32-x64/GRIND.exe` and carries the AppUserModelID
`com.hugo.grind` — without it Windows drops the app's notifications.

## 3. Files

```
main.js            window, tray, the record on disk, watchers, Todoist, CREATE link, hotkeys, session clock, FLOW link, IPC
preload.js         window.grindAPI — the renderer's only door
core/store.js      the record: defaults, normalise(), the reducer (ops → record + effects)
core/files.js      folder counting: readSources() (disk) + applyScan() (pure)
core/todoist.js    the client + completedOps() (completed tasks → ops)
core/rootlink.js   CREATE's desk from root's sync tasks
core/flowlink.js   the FLOW link: named-pipe client (TUTOR has the same file)
core/derive.js     stats, week maths, goal pace, challenge of the week, ask text, the session read off the clock (UMD: main + renderer)
app/index.html     shell (strict CSP, no inline script)
app/grind.css      the look
app/app.js         the renderer
app/curriculum.js  lessons, tracks, challenges (UMD)
fonts/             JetBrains Mono + Syne, bundled (Segoe UI is remapped to a mono on this PC)
scripts/make-icon.cjs, build/icon.ico
test/unit.cjs, test/visual.cjs
```

## 4. Architecture

- **main owns the record.** The renderer never edits it: it sends
  `op(name, payload)` over IPC; main runs `Store.apply(db, op, payload, ctx)`,
  saves, carries out the returned **effects** (`rescan`, `watch`, `hotkeys`,
  `closeTask`, `session`, `unlink`) and broadcasts `{ db, status }`. Unknown ops throw.
- **The session clock lives in main** (it keeps running with the window
  hidden). The record holds when the phase began; `Derive.sessionView(s, now)`
  reads it, main checks it once a second and commits only when something
  happens (goal reached, break due, break over — each a notification with
  sound). The renderer redraws the bar every second on its own, rebuilding its
  markup only when its shape changes.
- **core/ is pure** except `files.readSources` and the Todoist client. Every
  function takes `now`; tests stand on any day.
- **The renderer rebuilds the active view as a string on every broadcast.**
  Typed input survives through `snapshotInputs()` (`data-keep` fields and the
  focused field). A field that must clear after an action is named in
  `ui.clear`. One delegated click listener dispatches on `data-act`.
- **Closing the window hides it to the tray** — watchers and hotkeys keep
  running. Quit is in the tray menu. Single-instance lock.

## 5. Storage (userData = `%APPDATA%/GRIND`)

| File | What |
| --- | --- |
| `grind.json` | the record. Written atomically (tmp + rename), debounced 250 ms. |
| `grind.json.bak` | the record as it was at launch (one step back). |
| `grind.json.unreadable-<t>` | only if the record could not be parsed — never overwritten. |
| `todoist.bin` | the token, encrypted with Windows (Electron `safeStorage`). The renderer never sees it. |
| `win-state.json` | window bounds. |

Record (`v: 1`): `counters[] {id,label,noun,color,aim,sources[{path,exts,history}],todoistLabel?}`,
`events[] {id,c,at,n,via,ref?,note?}` (via: tap · hotkey · folder · todoist · post),
`seen {counter: {fileKey: path}}`, `sourcesScanned {path: true}`, `pending[]`, `dismissed[]`,
`goals[]`, `learn {daw,current,done,notes}`, `challenge {done,rolls}`, `posts[]`,
`todoist {project,socials,production,rootProject,rootSection,lastPoll,linked{taskId:{kind,id,week?}}}`,
`desk` (CREATE summary), `session` (the live one or null: `{start,phase,phaseStart,running,focusSec,breakSec,sinceBreak,breaks,goalSec,breakEvery,breakLen,goalHit}`),
`sessions[] {start,end,focusSec,goalSec,breaks}` (the last 1000),
`settings {hotkeys,notify,window,session{goalMin,breakEvery,breakMin,notify},flowExe}`.

**Ids are identities:** counter ids, lesson ids and challenge ids file progress;
never change a shipped one (titles can change).

## 6. Counting rules (core/files.js)

- A file is known by its NTFS file id (`stat.ino`): a rename or a move between
  two watched folders never counts twice. A re-save under a new id at a known
  path is a re-save.
- First scan of a folder: `history: true` counts what is there at the files'
  own times; `history: false` only notes it. Defaults: Serum 2 `presets/curate`
  = history, `presets/User` (downloads land there too) = new only,
  `Documents/curate/samples` = history (created empty on first run).
- More than 25 new files in one scan → a **pending** question, not 25 counts.
- Deleting a file never un-counts. Undo (× on the feed) does, and the file
  stays in `seen` so it is never counted again.
- An event's time is the earlier of the file's created / modified time.
- Ticking a drill never adds to a counter — the saved file does. No double counts.
- Watchers (`fs.watch` recursive) plus a sweep every 5 minutes and on focus.

## 7. Todoist (core/todoist.js) — what GRIND writes, all of it

- **Creates** a task only on "→ todoist": a drill or challenge into
  `production`, a post into `socials`, in the `02 | curate` project, labelled
  `grind` (+ the post label). The link is kept in `todoist.linked`.
- **Closes** a task it created when the same thing is finished in GRIND.
- **Reads** completed tasks in the project every 10 minutes: a linked task
  finishes its lesson / challenge / post; any other completed task with the
  post label counts a post (`td:<id>` ref; undone ones go to `dismissed` and
  never return).
- Never moves, renames, reschedules, reopens or deletes. root's CREATE reads
  and closes in the same project; neither creates what the other must parse.
- API: unified `api.todoist.com/api/v1` — `/projects`, `/sections`, `/tasks`,
  `/tasks/{id}/close`, `/tasks/completed/by_completion_date` (`items`,
  `next_cursor`). Names match folded ("02|curate" = "02 | curate").

## 8. The CREATE link (core/rootlink.js) — read-only

root's Todoist sync writes `ROOT · state…` tasks in `04 | core › claude/codex`
with JSON inside a ```` ```root ```` fence (root/ROOT.md §10: the fence is the
contract). GRIND reads them, keeps **only** `create_v1` and
`root_config_v1.create.areas`, summarises (hours this week by area, works in
progress with their stage, recent sessions) and drops the rest of the payload
on the spot — it contains private records. Fresh only as of root's last sync.
GRIND never writes to root's tasks or storage.

## 9. The FLOW link (core/flowlink.js)

The same link TUTOR has. FLOW (`github/flow`) listens on the named pipe
`\\.\pipe\hugo-flow-link`, one JSON object per line; GRIND connects when the
link button is pressed, starting FLOW first if it is not running (path in
settings, default `Documents/github/flow/dist/FLOW-win32-x64/FLOW.exe`).
Linking with no session running starts one.

- grind → flow: `{t:'hello',app:'GRIND',v:1}`, `{t:'show'}`, `{t:'session',phase,running,left,total,focus,goal,label}`
  on every change and every 2 s (`phase:'idle'` with no session), `{t:'bye'}`.
- flow → grind: `{t:'hello',app:'FLOW',v:1}`, `{t:'cmd',cmd:'toggle'|'skip'|'end'}`, `{t:'bye'}`.
- While linked GRIND is the clock: FLOW's timer shows the session, its music
  pauses on the breaks, it wears a **GRIND** chip, and its own play / skip
  buttons come back here as commands.
- **One app at a time:** if TUTOR links, FLOW tells GRIND bye (GRIND shows
  "FLOW unlinked"; the session keeps running). Unlinking keeps the session;
  ending the session unlinks.
- `GRIND_FLOW_PIPE` moves the pipe and stops GRIND from launching FLOW — the
  GUI test runs a stand-in FLOW on a private pipe, so it never touches a real one.

## 10. Things that will bite you

- **contextBridge names are non-configurable globals.** `const grindAPI = …`
  in app.js is a parse-time SyntaxError and the UI goes dead. app.js uses `bridge`.
- **The preload is sandboxed** (Electron default): no `clipboard`/`shell` there.
  Clipboard and openExternal go through IPC handlers in main.
- **Hotkeys are Ctrl+Alt+Shift+n, never Ctrl+Alt+n**: on AZERTY Ctrl+Alt is
  AltGr; a global Ctrl+Alt+digit would steal @ # { [ from every app. Off by default.
- **A CSS rule inside `@container` gains no specificity.** A later plain rule
  wins over it — the narrow-tile rule is written `.tile .weeks` for that reason.
- **The GUI test must never touch the real machine:** it replaces the `clip`
  and `open-url` handlers with recorders, turns notifications off (the
  session's too — they make a sound) and puts the FLOW link on a private pipe.
  Keep it so.
- `fs.rmSync` of the test profile can hit EPERM while Chromium holds files —
  it is wrapped; leftover temp folders are harmless.
- The renderer rebuilds every broadcast (folder scans broadcast often): any new
  input needs an `id` (and `data-keep` if it is not state-backed) or it loses
  what is typed.

## Changelog

- **1.0.0 — 2026-10-17** — first version. Counters with live folder counting
  (Serum 2 presets, rendered samples), Todoist posts, bursts held for a yes,
  undo; 28-lesson DnB sound-design curriculum (FL + Ableton) with drills,
  notes and "ask Claude"; 30 weekly challenges; post pipeline; goals and
  weekly aims; Todoist send / close / poll; read-only CREATE desk from root's
  sync; tray, optional global hotkeys, silent notifications. 24 unit + 16 GUI checks.
- **1.1.0 — 2026-10-18** — the session bar in the title bar (focus / breaks /
  goal, the same one TUTOR has, in GRIND's orange and teal) and the FLOW link
  (FLOW follows GRIND's session and wears a GRIND chip; FLOW now names
  whichever app is linked and hands over when another one links). Session and
  FLOW cards in settings; tray items; taskbar progress. 26 unit + 18 GUI checks.
