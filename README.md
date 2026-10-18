# GRIND

A Windows desktop hub for drum & bass production, sound design and socials.

- **Counts what you make, on its own** — Serum 2 presets saved into your preset
  folder are patches, audio rendered into `Documents/curate/samples` are
  samples, completed `@post` tasks in Todoist are posts. A +1 for everything else.
- **Teaches** — 28 lessons from oscillators to neuro growls, resampling,
  breaks and arrangement, each ending in a drill, with FL Studio and Ableton
  steps side by side, plus a weekly challenge. "Ask Claude" packs your setup,
  the lesson and your notes into one request.
- **Posts** — an idea → film → edit → posted board for Instagram and SoundCloud.
- **Goals** — weekly aims and longer goals, with the pace they need. No streaks.
- **Todoist** — send a drill, challenge or post idea as a task; ticking it
  there finishes it here.
- **CREATE** — reads your sessions and songs from root's sync, read-only.
- **Session bar** — a focus clock in the title bar with a goal and breaks;
  one click links FLOW, whose timer and music then follow it.

```
npm install
npm start          # run from source
npm test           # unit checks
npm run test:ui    # GUI checks (throwaway profile, screenshots)
npm run pack       # dist/GRIND-win32-x64/GRIND.exe
```

How it is built, what it stores and what it writes to Todoist: [GRIND.md](GRIND.md).
