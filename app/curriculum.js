/* GRIND · curriculum — the lessons, the tracks they sit in and the weekly
   challenge pool. Content only; no logic.

   Loaded by the renderer as a classic <script> (window.CURRICULUM) and by
   main + the tests through require(). Lesson and challenge ids are identities:
   progress is filed under them, so an id never changes once shipped (a title
   can). A lesson's `daw.fl` / `daw.ableton` hold the DAW-specific steps; the
   rest is written to be true in both, so the curriculum survives a switch.

   Every drill says what it `makes`: 'patch', 'sample' or null. GRIND does not
   add to a counter when a drill is ticked — the preset or render you save into
   a watched folder does that on its own, so nothing is counted twice. */
(function (root, factory) {
  const C = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.CURRICULUM = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const gear = ['Serum 2', 'FabFilter suite (Pro-Q, Pro-C, Pro-L, Pro-MB, Pro-R, Saturn…)',
    'Soundtoys suite (Decapitator, EchoBoy, Crystallizer, Little AlterBoy, SuperPlate…)',
    'Beatsurfing RANDOM', 'Beatsurfing RANDOM Metal', 'Splice'];

  const tracks = [
    { id: 'start',   title: 'Start here',          color: 'or', blurb: 'Settle the DAW question, build a template that removes friction, learn to study references.' },
    { id: 'synth',   title: 'Synthesis (Serum 2)', color: 'bl', blurb: 'Waveforms, filters, envelopes, LFOs, unison, wavetables and FM — the vocabulary of every patch.' },
    { id: 'bass',    title: 'DnB bass',            color: 'vi', blurb: 'Sub, reese, split-band processing, neuro growls, resampling and movement.' },
    { id: 'drums',   title: 'Drums & breaks',      color: 'ye', blurb: 'Layered snares, kick vs sub, chopped breaks, your own top end, bus processing and groove.' },
    { id: 'fx',      title: 'FX, space & ears',    color: 'te', blurb: 'Transitions, reverb and delay as sound design, RANDOM as raw material, ear training.' },
    { id: 'arrange', title: 'Arrangement',         color: 'pk', blurb: '174 phrasing, DJ-friendly intros and outros, second-drop switch-ups.' },
  ];

  const lessons = [
    /* ── Start here ───────────────────────────────────────────────────── */
    {
      id: 'start-daw', track: 'start', tier: 1, minutes: 90,
      title: 'FL or Ableton: settle it with a drill',
      why: 'Switching DAWs is expensive, and it gets more expensive with every finished project. Decide with evidence from your own hands, not forum opinions — Serum 2, FabFilter and Soundtoys sound identical in both.',
      concept: [
        'What really differs is workflow, not sound. FL is fastest at writing: the piano roll, patterns and the channel rack get ideas down quickly. Ableton is fastest at turning sound into more sound: recording one track into another, freezing and flattening, racks with macros, audio warping.',
        'Modern DnB sound design is mostly a loop of make → render → chop → re-process. So the fair test is that loop, done the same way in both.',
        'Score the experience, not the result: how often did you stop to look something up, how many clicks did a render take, did you lose the thread?',
      ],
      steps: [
        'Write a 4-bar bassline at 174 BPM. Write the notes down so you can enter the same ones in both DAWs.',
        'Build a simple reese in Serum 2 (two detuned saws, low-pass around 1.5 kHz) and play the bassline through it.',
        'Pass 1: render it to audio and chop it into one-bar or half-bar pieces.',
        'Pass 2: put Decapitator and Pro-Q on the audio, re-process, render again.',
        'Pass 3: pitch, reverse or re-slice pieces of pass 2 into a new 2-bar riff and render it.',
        'Time yourself in each DAW and write down every moment you got stuck.',
      ],
      daw: {
        fl: [
          'Render a pattern to audio: right-click the pattern clip in the Playlist → Consolidate this clip. Or record live: load Edison on the bass mixer insert, set it to record on input, and press play.',
          'Chop: put the audio in the Playlist and cut it with the slice tool (C), or load it into Fruity Slicer.',
          'Chain FX per insert in the Mixer, and save a chain you like as a mixer state.',
        ],
        ableton: [
          'Resample: make an audio track, set Audio From to the bass track (Post FX) or to Resampling, arm it and record.',
          'Or right-click the track → Freeze Track, then Flatten. Newer Live 12 versions also have Bounce to New Track.',
          'Chop: split clips with Ctrl+E in Arrangement view, or right-click a clip → Slice to New MIDI Track.',
          'Group the FX into an Audio Effect Rack and map two or three macros (drive, filter, wet).',
        ],
      },
      plugins: ['Serum 2', 'Soundtoys Decapitator', 'FabFilter Pro-Q'],
      drill: { task: 'Do the 3-pass resample in FL, then the same 3 passes in Ableton. Note the time and the friction points for each.',
               doneWhen: 'you have two finished pass-3 riffs and a one-line verdict: which DAW you use for the next 3 months, and why', makes: 'sample' },
      traps: [
        'Judging Ableton on day one against years of FL muscle memory. Give it two full sessions before scoring.',
        'Changing the test halfway (a different bassline, a different patch). Same notes, same patch, same three passes.',
        'Switching mid-track. Whatever you pick, finish the current song in the DAW it started in.',
      ],
      listen: "Compare the two pass-3 riffs blind: rename the files, shuffle them, play them back. If you can't tell which DAW made which, the choice really is workflow only.",
    },
    {
      id: 'start-template', track: 'start', tier: 1, minutes: 60,
      title: 'A template that removes friction',
      why: 'Every minute spent setting up a session is a minute not spent on sound. A template also makes GRIND count for you: presets and renders land where it is watching.',
      concept: [
        'A good DnB template is boring: the tempo is set, the buses are ready, a reference track is waiting, and there is nothing on the master you will forget is there.',
        'Two folders matter to GRIND. Serum 2 presets saved into your own folder (presets › curate) count as patches. Audio rendered into Documents › curate › samples counts as samples. Point your render dialog there once and forget about it.',
        'Name things as you save them: curate_reese_wide_01 beats Untitled 37. Future you searches by name.',
      ],
      steps: [
        'Set the tempo to 174 and the time signature to 4/4.',
        'Make buses: DRUMS, BASS (with SUB and MID inside it), MUSIC, FX, and a REFERENCE channel that skips everything on the master.',
        'End the master with an analyser (Pro-Q, nothing boosted) and a limiter (Pro-L, bypassed). Switch the limiter on only to check loudness.',
        'Add one initialised Serum 2 on the BASS bus and one on MUSIC.',
        'Add a way to resample: an audio track for it in Ableton, an Edison on a spare insert in FL.',
        'Set the render/export folder to Documents › curate › samples.',
        'Save it as your default template.',
      ],
      daw: {
        fl: [
          "Save it into the Templates folder inside FL's user data folder (Options → File settings shows where that is), then start sessions from File → New from template.",
          'Route a channel to a bus: select it, then in the Mixer right-click the arrow under the bus → Route to this track only.',
        ],
        ableton: [
          'Settings → File & Folder → Save Current Set as Default, or File → Save Live Set As Template.',
          'Ctrl+G groups selected tracks into a bus.',
        ],
      },
      plugins: ['FabFilter Pro-Q', 'FabFilter Pro-L', 'Serum 2'],
      drill: { task: 'Build the template, and save one Serum 2 init patch called curate_init into your curate preset folder.',
               doneWhen: 'a new session opens at 174 with buses, a reference channel and the render folder already set — and GRIND counted curate_init', makes: 'patch' },
      traps: [
        'Leaving the limiter on while you work: everything sounds louder, so everything sounds better than it is.',
        'Sending the reference through the master chain. It has to skip your limiter and EQ or the comparison lies.',
      ],
      listen: 'Load a reference into the reference channel and flip between it and your session: the master meter should only move for your own sound.',
    },
    {
      id: 'start-reference', track: 'start', tier: 1, minutes: 45,
      title: 'How to study a reference track',
      why: "Most of sound design is ear. Studying references properly tells you what a sound actually is (rarely what you first think) and gives you something to A/B against.",
      concept: [
        "Pick tracks you would be proud to have made, in the sub-style you want — not your favourite track, the one whose bass or drums you want to steal.",
        'Loop 8 bars of the drop and listen in layers: sub (below ~100 Hz), mid bass (~100 Hz–2 kHz), drums, top (above ~5 kHz), FX and space. Write one line for each.',
        "Use an analyser to confirm your ears, not to replace them: where the sub's fundamental sits, how wide the mid bass is, how loud the snare is against the bass.",
      ],
      steps: [
        'Put the reference on the reference channel and turn it down until it is as loud as your own mix.',
        'Loop the first 8 bars of the first drop.',
        'Solo regions with Pro-Q: set a band to band-pass, sweep it, and listen to only that slice.',
        "Write the five lines (sub, mid bass, drums, top, FX/space). Guesses are fine: 'FM growl, formant moving, heavy OTT'.",
        'Check it in mono (Pro-Q mid/side, or Utility in Ableton). Write down what disappears.',
      ],
      daw: {
        fl: ["Give the reference its own insert routed to the master, and bypass the master's FX while you compare."],
        ableton: ["Put the reference on its own audio track with Audio To set to your interface's outputs, so it skips the master chain."],
      },
      plugins: ['FabFilter Pro-Q', 'Splice'],
      drill: { task: 'Pick 3 references (one neuro, one rolling, one dancefloor) and write the five-line breakdown for each drop.',
               doneWhen: "the three breakdowns are in this lesson's notes and you could explain each drop's bass to a friend", makes: null },
      traps: [
        'Comparing at different loudness — louder always sounds better. Level-match first.',
        'Analysing the whole track. 8 bars of the drop is enough; depth beats breadth.',
      ],
      listen: 'In the mono check, does the mid bass collapse or stay solid? Most modern DnB keeps the bass solid in mono and gets its width from the top end and FX.',
    },

    /* ── Synthesis ────────────────────────────────────────────────────── */
    {
      id: 'synth-osc', track: 'synth', tier: 1, minutes: 40,
      title: 'Oscillators: hear what a waveform is',
      why: 'Every patch starts as a waveform. If you can name one by ear, you can predict what a filter or distortion will do to it.',
      concept: [
        'Sine: only the fundamental — pure, round, the sub. Triangle: a few soft odd harmonics. Square: odd harmonics only — hollow, woody. Saw: every harmonic — bright and buzzy, the raw material of most basses.',
        "Harmonics are what filters remove and distortion adds. A filter can't take out what isn't there: low-passing a sine does nothing new, but a saw has a whole spectrum to carve.",
        "A Serum 2 wavetable is a stack of frames, and WT POS picks the frame. The Basic Shapes table morphs between the classic waveforms as you move it.",
      ],
      steps: [
        'Init a Serum 2 patch. Osc A only, everything else off.',
        'Load the Basic Shapes table and sweep WT POS slowly while holding a C2. Stop on each classic shape.',
        'Watch Pro-Q’s analyser while you sweep and see the harmonics appear.',
        'Play the same riff on each shape at C1, C2 and C3 — notice which shapes survive low and which get muddy.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2', 'FabFilter Pro-Q'],
      drill: { task: 'Render each basic shape as a one-bar note into a scratch folder (not your samples folder), rename the files 1–4 at random, shuffle, and name each one by ear.',
               doneWhen: 'you name all four correctly twice in a row', makes: null },
      traps: [
        'Laptop speakers: below ~100 Hz everything sounds like nothing. Use headphones or monitors.',
        'Moving on before the difference between square and saw is obvious. Everything after builds on it.',
      ],
      listen: 'A saw and a square on the same note: the saw buzzes with an edge, the square sounds hollow — a brass section against a clarinet.',
    },
    {
      id: 'synth-filter', track: 'synth', tier: 1, minutes: 45,
      title: 'Filters, resonance and drive',
      why: "The filter is the first tool for shaping tone and the main source of movement in a bass. Most 'talking' bass is a filter being moved.",
      concept: [
        'Low-pass removes highs (darker), high-pass removes lows (thinner), band-pass keeps a slice. Cutoff chooses where; the slope (12 or 24 dB/oct) chooses how hard.',
        'Resonance boosts the frequencies right at the cutoff: a little gives a vocal peak when you sweep, a lot whistles. Drive saturates the filter input and adds harmonics back.',
        'Key tracking makes the cutoff follow the note, so high and low notes keep the same brightness.',
      ],
      steps: [
        'Init Serum 2, Osc A on a saw, routed to Filter 1 with a 24 dB low-pass.',
        'Hold a note and sweep cutoff from closed to open. Then set resonance around 40% and sweep again.',
        'Add drive and listen to the low end thicken.',
        "Try a band-pass and a formant (vowel) filter on the same sweep — note which sounds most like a voice.",
        'Map an LFO or the mod wheel to cutoff so you can perform the sweep.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2'],
      drill: { task: "Make one saw patch and save three versions that differ only in the filter: dark and sub-friendly, a resonant 'talking' mid, and a bright lead.",
               doneWhen: 'three presets are in your curate folder and each sounds clearly different on the same notes', makes: 'patch' },
      traps: [
        'High resonance on a low note can boost the sub region hugely and eat your headroom.',
        'Filtering away a problem instead of fixing the source. If the filter has to be almost closed, the oscillator was the wrong choice.',
      ],
      listen: "Sweep a resonant low-pass slowly: at one point it says 'wow'. That vowel movement is the heart of a lot of neuro bass.",
    },
    {
      id: 'synth-env', track: 'synth', tier: 1, minutes: 40,
      title: 'Envelopes: shape is half the sound',
      why: 'The same oscillator can be a pluck, a pad, a stab or a bass — the envelope decides. Attack and decay are what make a sound sit in the groove at 174.',
      concept: [
        'ADSR: attack (how fast it starts), decay (how fast it falls), sustain (the level while held), release (how long it rings after you let go). In Serum, ENV 1 always drives the volume; the other envelopes can drive anything.',
        'At 174 BPM a 16th note lasts about 86 ms. Long releases on a busy line smear notes into each other; short decays make things punchy.',
        "A filter envelope (ENV 2 → cutoff) is the classic pluck: the filter opens on every note and closes fast.",
      ],
      steps: [
        'Init Serum 2 with a saw through a low-pass.',
        'Pluck: amp attack 0, decay ~200 ms, sustain 0, release ~100 ms. Then ENV 2 → cutoff with a short decay.',
        'Pad from the same oscillator: attack ~600 ms, high sustain, release ~1.5 s.',
        'Stab: fast attack, decay ~120 ms, sustain ~20%, short release.',
        'Play each over a 174 drum loop and adjust the decays until they groove.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2'],
      drill: { task: 'From one oscillator setting, make and save a pluck, a pad and a stab.',
               doneWhen: 'three presets are saved and each works over a 174 drum loop without smearing', makes: 'patch' },
      traps: [
        'A tiny attack (1–5 ms) instead of 0 can stop clicks — more than that kills the punch.',
        'Forgetting the release: a sound that stops dead clicks, one that rings too long muddies the next note.',
      ],
      listen: "Solo a reference's stab: how fast does it die? Most DnB stabs are much shorter than you'd guess.",
    },
    {
      id: 'synth-lfo', track: 'synth', tier: 2, minutes: 50,
      title: 'LFOs and movement at 174',
      why: 'Static sounds die in a mix. LFOs give movement — wobbles, pulses, slowly evolving tone — and syncing them to the tempo keeps that movement in the groove.',
      concept: [
        'An LFO is a slow repeating shape that moves a parameter. A rate synced to tempo (1/4, 1/8, 1/16, triplets) makes the movement part of the rhythm.',
        'The shape matters: a sine wobbles, a saw ramps, a square jumps, and a shape you draw can be a whole rhythm. Serum lets you draw LFO shapes from points and curves.',
        'Trigger mode restarts the LFO on every note (each note the same); free-running lets it evolve across notes; envelope mode runs it once.',
      ],
      steps: [
        'Saw → low-pass. Drag LFO 1 onto cutoff and sync it to 1/8.',
        'Draw a custom shape with three or four steps, so it is a rhythm rather than a wobble.',
        'Try 1/16 triplets and hear it roll against straight drums.',
        'Add LFO 2, slower (one bar), on WT POS or a second filter so the sound evolves across the bar.',
        'Compare trigger mode with free-running.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2'],
      drill: { task: 'Make a bass whose rhythm comes from a custom-drawn LFO, not from the notes: one held note should already groove at 174.',
               doneWhen: 'a single held note grooves over a drum loop and the patch is saved', makes: 'patch' },
      traps: [
        'Modulating everything at once — one or two big movements read clearer than six small ones.',
        'So much depth that the filter closes completely and leaves silent gaps.',
      ],
      listen: "In 'talking' basses, listen for movement that's in time but not on every note — usually an LFO or envelope, not automation.",
    },
    {
      id: 'synth-unison', track: 'synth', tier: 2, minutes: 40,
      title: 'Unison, width and the mono rule',
      why: 'Width makes a sound feel big, but in DnB the low end has to stay mono or it vanishes on club systems and phone speakers.',
      concept: [
        'Unison stacks copies of a voice, detuned against each other and spread across the stereo field. More voices and more detune: wider and thicker, but also blurrier.',
        'Everything below ~100–150 Hz should be mono: sub and kick in the centre. Width lives in the mids and the top.',
        'So keep the sub as its own mono sine (the sub oscillator, or a separate patch) and put unison on the mid layer only — or high-pass the wide layer.',
      ],
      steps: [
        'A saw with 1 voice, then 4, 8 and 16 voices at moderate detune. Listen to the character change.',
        'Watch the width on Pro-Q’s mid/side display or a correlation meter.',
        'High-pass the unison layer around 150 Hz and put a clean sine sub with no unison under it.',
        'Check in mono: the bass should stay solid while some width disappears.',
      ],
      daw: {
        fl: ["Check width with Pro-Q in mid/side mode on the insert, or the mixer insert's stereo separation knob."],
        ableton: ["Utility has a Bass Mono switch with an adjustable frequency — put it on the bass bus around 120 Hz."],
      },
      plugins: ['Serum 2', 'FabFilter Pro-Q'],
      drill: { task: 'Build a wide mid bass with a mono sub in one Serum 2 instance (sub oscillator for the low end, unison only above it), and check it in mono.',
               doneWhen: 'the patch is wide in stereo, solid in mono, and saved', makes: 'patch' },
      traps: [
        'Unison on the sub: the low end phases in and out and the mixdown loses weight.',
        'Judging width only on headphones. Check on speakers and in mono.',
      ],
      listen: 'Flip a reference to mono: the bass loses almost nothing, the pads and FX lose most. That is the target.',
    },
    {
      id: 'synth-wavetable', track: 'synth', tier: 2, minutes: 50,
      title: 'Wavetable position: one table, many sounds',
      why: "Scanning a wavetable is Serum's superpower: modulating the table position gives evolving, growling tone from a single oscillator.",
      concept: [
        'WT POS picks or sweeps between a table’s frames. Moving it with an envelope or LFO changes the timbre over time — movement without a filter.',
        'Tables differ: some morph smoothly (pads, evolving bass), some jump between unrelated frames (aggressive, glitchy growls).',
        "The oscillator's warp modes (sync, bend, mirror, FM and others) bend the waveform further, and stacking a warp on top of table movement multiplies the variations.",
      ],
      steps: [
        'Load a harsh-sounding table on Osc A — try several from the factory set.',
        'Put LFO 1 on WT POS at 1/8, then try ENV 2 instead for a sweep on every note.',
        'Add a warp mode and move its amount with the same LFO.',
        'Run it through a low-pass with a little drive to tame the top.',
        'Save the three best moments as separate patches.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2'],
      drill: { task: 'Pick ONE wavetable and make three distinct basses from it using only WT position, one warp mode and their modulation — no filter movement allowed.',
               doneWhen: 'three presets are saved, each clearly different, all built on the same table', makes: 'patch' },
      traps: [
        'Scanning too fast on low notes — it turns into noise instead of a growl.',
        'Ignoring the table itself: a better table beats more modulation.',
      ],
      listen: "Neuro basses that speak without an obvious filter sweep are often WT position or FM amount moving.",
    },
    {
      id: 'synth-fm', track: 'synth', tier: 3, minutes: 60,
      title: 'FM: the growl engine',
      why: 'FM (frequency modulation) makes the metallic, snarling harmonics behind most neuro and modern DnB bass. Controlled FM is the difference between a growl and a mess.',
      concept: [
        "FM uses one oscillator to wobble another's pitch at audio rate, which creates new harmonics. In Serum, an oscillator's warp menu has FM modes such as FM (from B), where Osc B is the modulator.",
        'The pitch ratio between carrier and modulator sets the character: whole-number ratios (1:1, 2:1, 3:1) sound harmonic, odd ones sound metallic and clangy.',
        "FM amount is the growl knob — move it with an envelope or LFO and the sound talks. Keep the sub separate: FM in the low end is chaos.",
      ],
      steps: [
        'Osc A: a sine or simple shape (the carrier). Osc B: a sine (the modulator), its own level down so it only modulates.',
        'Set Osc A’s warp to FM (from B) and raise the amount slowly.',
        'Change Osc B’s coarse pitch (+12, +7, +19 semitones) and hear the ratio change the character.',
        'Move the FM amount with LFO 1 (1/8, or a custom shape).',
        'After the FM: a formant or band-pass filter, distortion, then the compressor in multiband (OTT-style) mode.',
        'Layer a clean sine sub underneath and high-pass the FM layer around 120 Hz.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2', 'FabFilter Saturn', 'Soundtoys Decapitator'],
      drill: { task: 'Make an FM growl that changes vowel across a 2-bar pattern, with a clean mono sub underneath. Render 4 bars.',
               doneWhen: 'the growl preset is saved and the 4-bar render is in your samples folder', makes: 'patch' },
      traps: [
        'Lots of FM with no movement — static noise. The movement of the FM amount is what reads as a growl.',
        'FM leaking into the sub region. Always split or high-pass.',
      ],
      listen: "In neuro drops the vowel changes about every half-bar — usually FM amount or formant moving, then hammered by distortion and multiband compression.",
    },

    /* ── DnB bass ─────────────────────────────────────────────────────── */
    {
      id: 'bass-sub', track: 'bass', tier: 1, minutes: 40,
      title: 'The sub: boring on purpose',
      why: 'The sub is what moves air in a club. It has to be clean, mono, in key and steady — every bit of character goes in the layers above it.',
      concept: [
        'A DnB sub is usually a sine (sometimes a lightly saturated sine or triangle) playing the roots an octave or two below the mid bass. Its fundamental mostly sits around 40–60 Hz.',
        'Mono, no unison, no stereo FX. Glide (portamento) on legato notes gives the classic rolling slide.',
        'Kick and sub share the same space, so decide who wins on each beat: sidechain or volume-shape the sub under the kick.',
      ],
      steps: [
        'Serum 2: init, Osc A off, the sub oscillator on as a sine (or Osc A as a pure sine). Mono and legato on, portamento ~40–80 ms.',
        'Write the sub to follow the roots of your mid bass.',
        'Add light saturation (Saturn, subtle) so the sub is audible on small speakers.',
        'Sidechain it to the kick: Pro-C with an external side-chain, fast attack, ~80–120 ms release.',
        'Check on Pro-Q: one clean peak around 40–60 Hz and nothing else.',
      ],
      daw: {
        fl: ["Sidechain: select the kick's mixer insert, right-click the routing arrow under the sub's insert → Sidechain to this track, then set Pro-C's side-chain to external (if it doesn't react, check the plugin wrapper's input routing)."],
        ableton: ['Put Pro-C (or Compressor) on the sub, open its side-chain section and set Audio From to the kick track.'],
      },
      plugins: ['Serum 2', 'FabFilter Saturn', 'FabFilter Pro-C', 'FabFilter Pro-Q'],
      drill: { task: 'Make a sub patch with glide and write an 8-bar sub line under a kick, ducked by sidechain.',
               doneWhen: 'the sub patch is saved and an 8-bar render shows one clean low peak that ducks on every kick', makes: 'patch' },
      traps: [
        'Notes too high (fundamental above ~80 Hz) — the sub starts fighting the mid bass.',
        "Notes too low (below ~35 Hz) — most systems can't reproduce them and the sub disappears.",
      ],
      listen: "Low-pass a reference at 100 Hz: you'll hear a simple, steady sine line. That is the whole job.",
    },
    {
      id: 'bass-reese', track: 'bass', tier: 2, minutes: 60,
      title: 'Reese: two saws and patience',
      why: "The reese is DnB's oldest bass and still everywhere — rolling, dark, alive. Getting it right teaches detune, phase and movement.",
      concept: [
        "Two or more saws, slightly detuned against each other. The detune makes them drift in and out of phase, and that slow beating is the reese.",
        'Low-pass away the fizz, then add movement: a slow LFO on cutoff, a chorus or phaser, distortion for grit.',
        'In a modern mix the reese carries no low end of its own: high-pass it and put a clean sub underneath.',
      ],
      steps: [
        'Serum 2: Osc A saw, Osc B saw, same octave. Detune B by ~10–20 cents (or use 2 unison voices with low detune).',
        '24 dB low-pass at ~1–2 kHz, a little drive.',
        'LFO 1 → cutoff, slow (one or two bars), small depth.',
        'Serum FX: a subtle chorus or phaser, distortion, then EQ with a high-pass around 120 Hz.',
        'Put the sub patch from the previous lesson under it.',
        'Outside Serum: Decapitator for grit, Pro-Q to tame harsh 2–4 kHz.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2', 'Soundtoys Decapitator', 'FabFilter Pro-Q'],
      drill: { task: 'Make a classic reese (two detuned saws) and a modern version of it (distorted, OTT-style multiband, wider top). Render 8 bars of each over a sub.',
               doneWhen: 'both presets are saved and both renders are in your samples folder', makes: 'patch' },
      traps: [
        'Too much detune — it sounds out of tune instead of moving.',
        'Reese in the sub region — the phase beating makes the low end pump at random.',
      ],
      listen: "Hold a long note in a reference reese: the tone slowly breathes even with no automation. That's the detune doing its job.",
    },
    {
      id: 'bass-split', track: 'bass', tier: 2, minutes: 50,
      title: 'Split-band processing',
      why: 'Heavy processing destroys low end. Splitting the bass into bands lets you wreck the mids as hard as you like while the sub stays clean.',
      concept: [
        'Split into low (sub, below ~120 Hz), mid (the character) and sometimes high (fizz and air). Process each on its own and sum them back.',
        'Low: mono, clean, maybe gentle saturation. Mid: distortion, OTT-style multiband compression, formant, chorus. High: usually tamed or removed.',
        'Watch the crossover: the bands have to sum back without a dip or a bump around the split frequency.',
      ],
      steps: [
        'Take a reese or a growl and split it into a LOW and a MID channel.',
        'LOW: low-pass at ~120 Hz, mono, no FX.',
        'MID: high-pass at ~120 Hz, then Saturn or Decapitator, then Pro-MB (or Serum’s multiband compressor).',
        'Sum them on a bus and check the result on Pro-Q’s analyser and in mono.',
      ],
      daw: {
        fl: ['Build the split inside one insert with Patcher, or route two inserts (Pro-Q low-pass vs high-pass at the same frequency) into a BASS bus. Saturn is multiband on its own: you can distort only its upper bands.'],
        ableton: ['Audio Effect Rack with two chains, LOW and MID, each starting with EQ Eight (low-pass vs high-pass at the same frequency). Roar can also distort per band.'],
      },
      plugins: ['FabFilter Saturn', 'FabFilter Pro-MB', 'Soundtoys Decapitator', 'FabFilter Pro-Q'],
      drill: { task: 'Push one bass’s MID band to absurd distortion while its LOW band stays clean. Render 8 bars.',
               doneWhen: 'the render sounds aggressive but its low end is as clean as the dry sub', makes: 'sample' },
      traps: [
        'Phase trouble at the crossover — use the same slopes on both sides, or a linear-phase split.',
        'Forgetting the LOW band must be mono. Check in mono.',
      ],
      listen: 'Solo the low end of a heavy reference drop: it stays clean even while the mids scream.',
    },
    {
      id: 'bass-neuro', track: 'bass', tier: 3, minutes: 75,
      title: 'Neuro growls: FM → formant → distortion',
      why: 'The growling, speaking bass of modern neuro is a chain: a harmonically rich source, a vowel filter, then distortion and compression that exaggerate every movement.',
      concept: [
        'Source: FM or a moving wavetable. Vowel: a formant filter or band-pass sweep. Exaggeration: distortion (adds harmonics) and multiband compression (lifts the quiet detail so everything is loud).',
        'Movement is everything: an LFO or envelope on FM amount, formant or WT position — ideally in a rhythm that answers the drums.',
        'Most of it is resampled: build a short, wild phrase, render it, then chop the best moments into a new pattern.',
      ],
      steps: [
        'Start from your FM patch (carrier + modulator).',
        'Filter: a formant/vowel type, with LFO 1 (custom shape, 1/4 or 1/8) on its position.',
        'Serum FX: distortion → multiband compressor → EQ (high-pass ~120 Hz).',
        'Outside Serum: Saturn (multiband, more drive on the mids), then Pro-MB to control the harsh peaks.',
        'Record 4 bars of yourself playing it with the mod wheel and macros moving.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2', 'FabFilter Saturn', 'FabFilter Pro-MB', 'Soundtoys Decapitator'],
      drill: { task: 'Make one growl patch, perform 8 bars with the mod wheel moving, render them, and keep the 4 best half-bar moments as separate samples.',
               doneWhen: 'the preset is saved and 4 growl one-shots are in your samples folder', makes: 'sample' },
      traps: [
        "2–5 kHz builds up fast and gets harsh. Use Pro-Q's dynamic EQ on that band rather than a static cut.",
        'Losing the groove: a growl that changes every 16th with no pattern is noise. Give it a rhythm.',
      ],
      listen: 'In neuro drops the bass phrases work like call and response with the snare — a growl, a gap, a different growl.',
    },
    {
      id: 'bass-resample', track: 'bass', tier: 3, minutes: 75,
      title: 'Resampling chains',
      why: 'Resampling gives sounds a character no single patch has: every render bakes the processing in and becomes new raw material.',
      concept: [
        'Render → process → render again. On each pass you can pitch, stretch, reverse, chop, distort, filter or layer, and the result is the source for the next pass.',
        'Keep every pass: pass 1 clean, pass 2 processed, pass 3 chopped and rearranged. The best sounds are often accidents in passes 2–3.',
        'Name and save renders as you go — they are samples, and GRIND counts them as they land in your samples folder.',
      ],
      steps: [
        'Start from any bass you made. Render 4 bars dry.',
        'Pass 2: Crystallizer or a pitch shift (Little AlterBoy), then Decapitator. Render.',
        'Pass 3: chop pass 2 into 1/8 slices, rearrange them, reverse two, pitch one down an octave. Render.',
        'Pass 4: load the result back into Serum 2 as a wavetable or sample oscillator and play it as a patch.',
      ],
      daw: {
        fl: ['Consolidate each pass (right-click the clip → Consolidate this clip), or record it with Edison on the bus.',
             "Chop with the slice tool; reverse or stretch a slice with Edison's tools."],
        ableton: ['Record each pass on an audio track with Audio From set to the bass track (Post FX).',
                  'Complex or Texture warp for stretching; R reverses a selected clip; Ctrl+E splits.'],
      },
      plugins: ['Serum 2', 'Soundtoys Crystallizer', 'Soundtoys Little AlterBoy', 'Soundtoys Decapitator'],
      drill: { task: 'Run a 4-pass resample chain from one bass, saving every pass, and turn pass 3 into a playable Serum 2 patch.',
               doneWhen: 'the 4 renders are in your samples folder and the patch built from pass 3 is saved', makes: 'sample' },
      traps: [
        'Rendering with the master limiter on — your samples come out squashed.',
        'No gain staging between passes: each render should peak around −6 dBFS so the next pass has room.',
      ],
      listen: "Heavy DnB bass often sounds impossible for one synth — that's usually several resample passes stacked.",
    },
    {
      id: 'bass-movement', track: 'bass', tier: 2, minutes: 50,
      title: 'Make every note different',
      why: "A bassline where every note sounds the same is a loop. One where every note has its own vowel, length or pitch movement is a performance — that's what makes a drop feel alive.",
      concept: [
        'The tools: velocity mapped to filter or FM, pitch bends between notes, macro automation, and alternating two or three patches across a phrase.',
        'Think call and response: note one asks, note two answers. Vary the lengths too — a short stab after a long growl reads as rhythm.',
        'Map two to four parameters to one Serum macro and automate that, instead of ten separate lanes.',
      ],
      steps: [
        'Write 2 bars of bass at 174 with clear gaps for the snare.',
        "Map velocity → FM amount or cutoff in Serum 2's mod matrix and vary the velocities.",
        'Bend the pitch on two notes (legato portamento, or a pitch envelope).',
        'Automate one macro across the 2 bars.',
        'Duplicate to 8 bars and change something every 2 bars.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2'],
      drill: { task: 'Write an 8-bar bassline where no two notes sound the same — and it still grooves.',
               doneWhen: 'an 8-bar render is in your samples folder and you can point at what changes on every note', makes: 'sample' },
      traps: [
        'Variation without groove: random changes sound like mistakes. Repeat the rhythm, vary the tone.',
        'Too many automation lanes — use macros.',
      ],
      listen: 'Follow only the bass of a reference drop for 2 bars and count how many different sounds it makes.',
    },

    /* ── Drums & breaks ───────────────────────────────────────────────── */
    {
      id: 'drums-snare', track: 'drums', tier: 1, minutes: 45,
      title: 'The DnB snare: three layers',
      why: 'After the bass, the snare is the most important thing in a DnB track. A great one is usually layers that each do one job.',
      concept: [
        'Three jobs: the transient (the crack, ~2–5 kHz), the body (the punch, ~180–250 Hz) and the tail (room, noise or reverb). Each can come from a different sample or synth.',
        "Line the layers up so their transients hit together, and cut what each one doesn't need so they don't fight.",
        'Snare on 2 and 4 of the two-step — it is what people dance to, and it has to cut through even the loudest bass.',
      ],
      steps: [
        'Pick a body sample, a crack sample, and make a noise tail (Serum noise oscillator with a short envelope, or a reverb).',
        'Pro-Q each layer: high-pass the crack, low-pass the tail, keep the body’s 200 Hz region.',
        'Nudge timing until all three peak together, then balance the levels.',
        'Bus them: a little Decapitator for glue, Pro-C for punch.',
        'Render to one sample.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Splice', 'FabFilter Pro-Q', 'Soundtoys Decapitator', 'FabFilter Pro-C', 'Serum 2'],
      drill: { task: 'Build 3 snares from layers (tight and punchy, big and roomy, gritty) and render each as a one-shot.',
               doneWhen: 'the 3 snares are in your samples folder and each cuts through a reese at the same volume', makes: 'sample' },
      traps: [
        'Too many layers — phase cancellation makes the result thinner, not thicker. Three is plenty.',
        'A snare too quiet against the bass. Check against references.',
      ],
      listen: "Solo the snare in a reference drop: the crack, then the body, then a short tail. That's the three layers.",
    },
    {
      id: 'drums-kick', track: 'drums', tier: 2, minutes: 40,
      title: 'Kick vs sub',
      why: 'In DnB the kick and the sub compete for the same low frequencies. Deciding who owns what, and when, is what makes a drop hit instead of muddle.',
      concept: [
        'A DnB kick is usually short: a click plus a quick low thump (~50–70 Hz) that gets out of the way fast.',
        "The options: tune the kick to the track's key so it agrees with the sub, shorten its tail, and sidechain or volume-shape the sub under it.",
        'Check them together in mono on an analyser: the kick should peak and decay before the sub comes back.',
      ],
      steps: [
        'Pick or make a kick and trim its tail so it is done within ~150 ms.',
        "Tune its low thump to the track's root (or the fifth).",
        'Sidechain the sub to the kick (Pro-C, fast attack, ~100 ms release).',
        "If they still clash, dip the kick slightly with Pro-Q where the sub's fundamental sits.",
        'Listen quietly — a good kick and sub stay clear at low volume.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['FabFilter Pro-C', 'FabFilter Pro-Q', 'Splice'],
      drill: { task: "Make 3 kick variations tuned to your track's key and test each against your sub with the sidechain on.",
               doneWhen: 'the 3 kicks are in your samples folder and you have picked the one that sits with the sub without mud', makes: 'sample' },
      traps: [
        "A long, boomy kick — at 174 it eats the sub's space.",
        'Tuning by numbers only. Check by ear against the bass.',
      ],
      listen: 'In a reference, the kick is short and punchy and the sub swells right after it. That swell is sidechain or volume shaping.',
    },
    {
      id: 'drums-breaks', track: 'drums', tier: 2, minutes: 60,
      title: 'Chopping breaks',
      why: "Breakbeats are DnB's DNA. Chopping and re-sequencing them gives drums a human, rolling feel that programmed one-shots can't fake.",
      concept: [
        'Classic breaks (Amen, Think, Apache…) were recorded slower; you slice them and re-sequence the hits at 174.',
        'Slice at every transient so each kick, snare and ghost note is its own slice, then write a new pattern from the slices.',
        'Breaks usually sit under the main drums as a top loop: high-passed and compressed, adding groove and texture.',
      ],
      steps: [
        'Get a break (Splice has plenty). Slice it, or set it to the project tempo.',
        'Slice at the transients — 16 slices for one bar is a good start.',
        'Write a new 2-bar pattern from the slices, keeping a snare on 2 and 4.',
        'High-pass the break around 200–300 Hz so it layers under your main kick and snare.',
        'Parallel-compress it hard (Pro-C) and blend it in.',
      ],
      daw: {
        fl: ["Fruity Slicer slices a break and maps the slices to keys (Slicex does the same in higher editions), or use the audio clip's Chop menu in the Playlist."],
        ableton: ['Right-click the break → Slice to New MIDI Track (by transient). Every slice lands on a Drum Rack pad.'],
      },
      plugins: ['Splice', 'FabFilter Pro-C', 'FabFilter Pro-Q'],
      drill: { task: 'Chop one classic break and write 4 different 2-bar patterns from it. Render each.',
               doneWhen: 'the 4 pattern renders are in your samples folder', makes: 'sample' },
      traps: [
        "Leaving the break's low end in — it fights your kick and sub. High-pass it.",
        "Over-quantising — keep some of the break's natural swing.",
      ],
      listen: "Under most rolling DnB there's a busy, shuffly layer behind the main drums — a chopped break.",
    },
    {
      id: 'drums-metal', track: 'drums', tier: 2, minutes: 45,
      title: 'Hats, metal and perc with RANDOM Metal',
      why: "The top end — hats, rides, metallic hits — gives a beat its speed and shine. RANDOM Metal is built for exactly that, and your own top end makes your drums sound like no one else's.",
      concept: [
        "RANDOM Metal is a percussion synth for cymbals, hats, shakers and metallic hits. Its randomise button has an adjustable deviance: how far each variation strays from the current sound.",
        'Design, don’t scroll: low deviance explores around a sound you like, high deviance finds something new.',
        'At 174 hats are short and crisp; shakers and rides add speed between the snares. Pan and level small hits slightly differently for life.',
      ],
      steps: [
        'Open RANDOM Metal and pick a starting sound close to a hat.',
        'Randomise with low deviance a few times and keep what you like.',
        'Shorten decays for closed hats, lengthen them for open hats and rides.',
        'Render 8 one-shots: 2 closed hats, 2 open hats, 2 rides or cymbals, 2 metallic hits.',
        'Program a 2-bar top loop at 174 with Pro-Q (high-pass ~400 Hz) and a touch of EchoBoy.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Beatsurfing RANDOM Metal', 'FabFilter Pro-Q', 'Soundtoys EchoBoy'],
      drill: { task: 'Design an 8-piece top-end kit in RANDOM Metal and render every hit as a one-shot.',
               doneWhen: 'the 8 one-shots are in your samples folder and they groove together', makes: 'sample' },
      traps: [
        'Hats too loud — the easiest thing to overdo. Turn them down until you only just miss them when muted.',
        'Every hit at the same velocity. Vary them.',
      ],
      listen: "A reference's hats are quieter than you'd expect — but you'd notice the moment they stopped.",
    },
    {
      id: 'drums-bus', track: 'drums', tier: 2, minutes: 45,
      title: 'Drum bus: glue and grit',
      why: 'Separate drums sound like samples; a processed drum bus sounds like a kit. Bus processing gives punch, cohesion and loudness.',
      concept: [
        'Parallel compression: send the drums to a second bus, squash that copy hard and blend it under the dry signal — density without losing the transients.',
        'Saturation (Decapitator, Saturn) adds harmonics and helps drums cut through on small speakers.',
        'A clipper or limiter on the drum bus can shave the peaks so the drums are louder at the same peak level.',
      ],
      steps: [
        'Route kick, snare, hats and break to a DRUMS bus.',
        'On the bus: a little Decapitator (low drive, mix ~30%).',
        'Parallel: send to a second bus with Pro-C set hard (high ratio, fast attack and release) and blend to taste.',
        'Pro-Q: cut mud around 300–500 Hz if it builds up.',
        'Optional: Pro-L with gentle gain on the drum bus to catch peaks.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Soundtoys Decapitator', 'FabFilter Pro-C', 'FabFilter Pro-Q', 'FabFilter Pro-L'],
      drill: { task: 'Make a 4-bar drum loop, process the bus, and render a dry and a processed version.',
               doneWhen: 'both renders are in your samples folder and the processed one is clearly punchier at the same peak level', makes: 'sample' },
      traps: [
        "Over-compressing the main bus until the transients disappear — that's what the parallel bus is for.",
        'Comparing processed and dry at different volumes. Level-match.',
      ],
      listen: 'Put your processed loop next to a reference loop at the same loudness. Which has more punch?',
    },
    {
      id: 'drums-groove', track: 'drums', tier: 2, minutes: 40,
      title: 'Groove: ghost notes and swing at 174',
      why: 'Groove is what makes people move. At 174, tiny timing and velocity differences decide between rolling and robotic.',
      concept: [
        'Ghost notes: quiet snares or percussion between the main hits. They add roll without crowding the groove.',
        'Swing delays every other 16th slightly. A little on hats and percussion lets a beat breathe; keep the kick and main snare tight.',
        'Velocity is groove: accent some hats, soften others.',
      ],
      steps: [
        "Start from the two-step: kick on 1, snare on 2, kick on the 'and' of 3, snare on 4.",
        'Add a few very quiet ghost snares on the 16ths before the main snares.',
        'Program hats in 8ths or 16ths with varied velocities.',
        'Swing the hats and percussion only (10–25%).',
        'Layer a chopped break underneath, low in the mix.',
      ],
      daw: {
        fl: ["The Channel Rack's swing knob affects step-sequenced patterns; the piano roll's velocity lane shapes the accents."],
        ableton: ["Drag a groove from the Groove Pool onto the hats clip only, then adjust its Base, Amount and Velocity."],
      },
      plugins: [],
      drill: { task: 'Program one beat three ways (straight, swung hats, ghost notes + break) and render 4 bars of each.',
               doneWhen: 'the 3 renders are in your samples folder and you can feel which one rolls best', makes: 'sample' },
      traps: [
        'Swinging the kick and snare — the groove gets sloppy.',
        'Ghost notes so loud they become main hits.',
      ],
      listen: "In a rolling reference, focus on the space between the snares — that's where the ghost notes live.",
    },

    /* ── FX, space & ears ─────────────────────────────────────────────── */
    {
      id: 'fx-transitions', track: 'fx', tier: 2, minutes: 45,
      title: 'Risers, impacts and downlifters',
      why: 'FX tell the listener something is about to happen. Your own transitions make arrangements flow and sound like you.',
      concept: [
        'Risers sweep up in pitch, filter or volume over 4–16 bars. Impacts are the big hit at the drop (sub boom + crash + noise). Downlifters sweep down after a hit.',
        'Reverse reverb: render a reverb tail, reverse it, and place it just before the hit.',
        "Keep them in key or noise-based so they don't clash with the track.",
      ],
      steps: [
        'Riser: Serum 2 noise (or a saw) with a filter opening and pitch rising 12–24 semitones over 8 bars, into Pro-R or SuperPlate and EchoBoy.',
        'Impact: layer a sub boom (sine with a pitch drop), a crash from RANDOM Metal and a noise burst, then render.',
        'Downlifter: reverse the riser, or pitch-drop noise through a closing filter.',
        'Reverse reverb: render a snare through a long reverb at 100% wet, reverse it, and put it before the snare.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2', 'FabFilter Pro-R', 'Soundtoys SuperPlate', 'Soundtoys EchoBoy', 'Beatsurfing RANDOM Metal'],
      drill: { task: 'Make a riser, an impact, a downlifter and a reverse-reverb swell. Render each.',
               doneWhen: 'the 4 FX renders are in your samples folder', makes: 'sample' },
      traps: [
        'Risers too loud — they should build tension, not cover the music.',
        'Reverb tails full of low end. High-pass them.',
      ],
      listen: "Count the FX layers in the 8 bars before a reference drop. There are more than you think, and they're quiet.",
    },
    {
      id: 'fx-space', track: 'fx', tier: 2, minutes: 45,
      title: 'Reverb and delay as sound design',
      why: "Space isn't only mix polish — reverb and delay can turn a dry stab into an atmosphere, or a simple sound into something huge and moving.",
      concept: [
        'A send lets many sounds share one space; an insert lets you mangle one sound.',
        'Pre-delay separates the dry hit from the reverb so it stays clear. High-pass reverbs to keep the low end clean.',
        "Creative uses: long frozen reverbs as pads, ping-pong delays at 1/8 dotted, filtered delays (EchoBoy's styles), reverb before distortion for grit.",
      ],
      steps: [
        'Make a short stab. Send it to Pro-R with ~20–40 ms pre-delay and a high-pass around 300 Hz.',
        "Insert EchoBoy at 1/8 dotted, feedback ~35%, and try several of its styles.",
        'Try reverb → Decapitator → Pro-Q on the stab, distorting the space itself.',
        'Render a big atmospheric version and a dry version.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['FabFilter Pro-R', 'Soundtoys EchoBoy', 'Soundtoys Decapitator', 'Soundtoys SuperPlate'],
      drill: { task: 'Turn one dry stab into 3 spaces: a tight room, a huge atmosphere and a rhythmic delay pattern. Render each.',
               doneWhen: 'the 3 renders are in your samples folder', makes: 'sample' },
      traps: [
        'Reverb on everything — depth needs contrast, so keep some things dry.',
        'Delay and reverb in the sub. High-pass every space.',
      ],
      listen: "In breakdowns, notice how much of the size is reverb and delay rather than more instruments.",
    },
    {
      id: 'fx-random', track: 'fx', tier: 2, minutes: 40,
      title: 'RANDOM: a raw-material machine',
      why: "Starting from a random source breaks habits. RANDOM makes sounds you'd never program — use them as raw material to resample into something yours.",
      concept: [
        'RANDOM generates a new sound at the press of a button; its deviance sets how far each variation strays from the current one.',
        'Treat it like a sample generator: generate, keep the interesting 10%, render those, and process the renders like any found sound.',
        'The value is in the curation and the processing, not the button — that is where your taste comes in.',
      ],
      steps: [
        'Open RANDOM and generate 20 sounds quickly. Keep only the ones that make you react.',
        'Render the keepers as short one-shots.',
        'Process one with Crystallizer, one with Little AlterBoy, one with Decapitator + Pro-Q.',
        'Load one into Serum 2 as a wavetable or sample oscillator and play it as a patch.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Beatsurfing RANDOM', 'Soundtoys Crystallizer', 'Soundtoys Little AlterBoy', 'Serum 2'],
      drill: { task: 'Generate, curate, process: 5 finished one-shots from RANDOM, plus one Serum 2 patch built from a RANDOM render.',
               doneWhen: 'the 5 one-shots are in your samples folder and the patch is saved', makes: 'sample' },
      traps: [
        'Keeping everything. Curation is the skill — be harsh.',
        "Using raw outputs in a track: they'll sound like someone else's preset.",
      ],
      listen: 'Play your 5 one-shots next to the raw RANDOM outputs. The processed ones should sound like they belong in your tracks.',
    },
    {
      id: 'fx-ear', track: 'fx', tier: 1, minutes: 20,
      title: 'Ear training: name the frequency',
      why: 'Knowing what 200 Hz sounds like next to 2 kHz makes EQ fast and accurate: you hear a problem and know where to cut without sweeping.',
      concept: [
        'Learn the regions: sub (30–60 Hz), low bass (60–120), mud (200–500), boxiness (500–1k), presence and harshness (2–5k), air (10k+).',
        'Boost and guess: boost a narrow band, guess the frequency, check. Pink noise first, then real mixes.',
        'Short daily sessions beat long rare ones. Repeat this lesson as often as you like.',
      ],
      steps: [
        'Put pink noise or a full mix through Pro-Q.',
        'Close your eyes and drag a narrow +9 dB band somewhere at random (or use an ear-training app). Flip bypass, listen, guess.',
        'Write the guess and the real value. Ten rounds.',
        'Then the same with cuts — harder.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['FabFilter Pro-Q'],
      drill: { task: 'Ten boost-and-guess rounds on a full mix, aiming for octave accuracy.',
               doneWhen: 'you score 8 out of 10 within an octave', makes: null },
      traps: [
        'Peeking at the screen while guessing.',
        'Long sessions — ears tire after about 20 minutes.',
      ],
      listen: 'Mud (~300 Hz) sounds like a blanket; harshness (~3–4 kHz) makes you want to turn it down.',
    },

    /* ── Arrangement ──────────────────────────────────────────────────── */
    {
      id: 'arr-phrasing', track: 'arrange', tier: 1, minutes: 45,
      title: '174 phrasing and the DJ-friendly intro',
      why: "DnB gets played by DJs. If a track's sections don't land on the phrase lengths they expect, it won't get played — and phrasing also makes drops hit harder.",
      concept: [
        'DnB moves in 8-, 16- and 32-bar phrases. Something should change at least every 8 bars; big changes land on 16 or 32.',
        'A common skeleton: intro 16–32 bars (drum-led, mixable), build, drop 1 (16–32), breakdown, build, drop 2 (16–32, switched up), outro 16–32 bars (mixable, mirroring the intro).',
        'Intro and outro are tools for DJs: a clear beat and few melodic elements, so another track can mix over them.',
      ],
      steps: [
        'Take an 8-bar loop you made and mark the timeline every 16 bars.',
        'Intro: 32 bars of drums with hints of the drop, adding something every 8 bars.',
        'Drop 1 at bar 33 (or 65 for a long intro).',
        'Breakdown: 16–32 bars without drums, bringing in the melody or atmosphere.',
        'Drop 2, then a 32-bar outro with drums and fewer elements.',
      ],
      daw: {
        fl: ['Add time markers in the Playlist (right-click the timeline) at each section.'],
        ableton: ['Add locators (Create → Add Locator) at each section in Arrangement view.'],
      },
      plugins: [],
      drill: { task: 'Arrange one existing idea into a full DJ-friendly skeleton (intro, drop, breakdown, drop, outro) on 16/32-bar boundaries.',
               doneWhen: 'the timeline is laid out with markers and a DJ could mix in and out of it', makes: null },
      traps: [
        'An intro that starts with the melody — DJs need beats first.',
        'Odd phrase lengths (12 bars) — they trip up mixing.',
      ],
      listen: 'Count bars in a reference: almost every change lands on a multiple of 8.',
    },
    {
      id: 'arr-switch', track: 'arrange', tier: 2, minutes: 50,
      title: 'The second drop switch-up',
      why: 'A second drop that copies the first wastes the best moment in the track. Switch-ups keep the energy rising, and they are what DJs and crowds remember.',
      concept: [
        'Change at least one major element: a new bass sound or pattern, a different groove, a half-time section, a new hook.',
        'Keep enough of drop 1 to feel connected: same key, similar energy, a recognisable motif.',
        'Common switches: the same rhythm on a different bass patch, a rhythm flip, a 4-bar tease of drop 1 then something new.',
      ],
      steps: [
        'Copy drop 1 to where drop 2 goes.',
        'Swap the bass patch for one of your newer ones, keeping the notes.',
        'Change the groove (a new break chop or kick pattern).',
        'Add a new 2-bar fill every 8 bars.',
        'Play drop 1 and drop 2 back to back: drop 2 should feel bigger or more surprising.',
      ],
      daw: { fl: [], ableton: [] },
      plugins: ['Serum 2'],
      drill: { task: 'Write 3 switch-ups of the same first drop (new bass sound, new groove, new pattern) and render 8 bars of each.',
               doneWhen: 'the 3 renders are in your samples folder and one of them clearly beats drop 1', makes: 'sample' },
      traps: [
        'Changing everything at once — it stops feeling like the same track.',
        'A weaker second drop. The switch should raise the energy, not lower it.',
      ],
      listen: 'Compare the first 8 bars of each drop in a reference. What changed?',
    },
  ];

  /* The weekly pool. One a week, walked in a fixed shuffled order; a reroll
     takes the next one for that week only. */
  const challenges = [
    { id: 'one-osc', title: 'One oscillator only', makes: 'patch', text: 'A full bass from a single oscillator — no sub osc, no noise, no second oscillator. All movement comes from modulation and FX.' },
    { id: 'init-20', title: 'Init patch, 20 minutes', makes: 'patch', text: "Start from Serum 2's init patch and finish a usable bass in 20 minutes. Save it whatever happens." },
    { id: 'noise-bass', title: 'Bass from noise', makes: 'patch', text: 'A bass whose only source is noise (the noise oscillator or a noise sample). Filters and resonance do the rest.' },
    { id: 'no-filter', title: 'No filter', makes: 'patch', text: 'A growl with every filter off: wavetable position, warp and FX only.' },
    { id: 'five-passes', title: 'Five passes', makes: 'sample', text: 'Resample one sound five times. Only pass 5 is allowed in a track.' },
    { id: 'snare-sprint', title: 'Snare sprint', makes: 'sample', text: 'Five different snares in 30 minutes. Render all of them.' },
    { id: 'steal-30', title: 'Steal a sound in 30 minutes', makes: 'patch', text: 'Pick one sound from a reference drop and recreate it in 30 minutes. Compare, and write down what was missing.' },
    { id: 'metal-only', title: 'Top end only', makes: 'sample', text: 'A 2-bar top loop made only from RANDOM Metal — no hat samples.' },
    { id: 'ratio-hunt', title: 'Ratio hunt', makes: 'patch', text: 'Make an FM bass, then save versions at four different modulator ratios. Which ratio is your sound?' },
    { id: 'one-macro', title: 'One macro', makes: 'patch', text: 'A patch where one macro takes the sound from soft to destroyed — musical all the way.' },
    { id: 'all-reversed', title: 'Everything reversed', makes: 'sample', text: 'A 4-bar loop where every sound has been reversed at least once.' },
    { id: 'make-it-talk', title: 'Make it talk', makes: 'patch', text: 'A bass that clearly says a vowel sequence (a-e-i-o-u) with formant filtering.' },
    { id: 'phone-test', title: 'Phone test', makes: 'patch', text: 'A bass that still sounds heavy on a phone speaker. Check it on your phone before saving.' },
    { id: 'eight-bars-daily', title: '8 bars a day', makes: 'sample', text: 'Every day this week, make one 8-bar idea and render it. Seven ideas, no finishing allowed.' },
    { id: 'three-layers', title: 'Three-layer bass', makes: 'sample', text: 'Sub + mid + top, each from a different patch, glued on one bus. Render 8 bars.' },
    { id: 'remake-old', title: 'Remake an old one', makes: 'patch', text: 'Open a patch you made at least a month ago and make it better without starting over. Save it as _v2.' },
    { id: 'random-seven', title: 'RANDOM roulette', makes: 'sample', text: 'Generate 10 sounds in RANDOM. You must use number 7 in a loop, whatever it is.' },
    { id: 'half-time', title: 'Half-time switch', makes: 'sample', text: 'Take a 174 loop and make a half-time version of it (snare on 3). Render both.' },
    { id: 'granular-pad', title: 'Granular smear', makes: 'sample', text: 'Run a bass through Crystallizer until it becomes a pad. Render 8 bars.' },
    { id: 'stab-pack', title: 'Stab pack', makes: 'sample', text: 'Four chord stabs in the same key, each rendered as a one-shot.' },
    { id: 'sub-groove', title: 'Sub-only groove', makes: 'sample', text: 'A groove where the only melodic element is the sub — and it is still interesting.' },
    { id: 'flip-break', title: 'Flip a break', makes: 'sample', text: 'Chop a classic break until it is unrecognisable, but still grooves.' },
    { id: 'show-process', title: 'Show the process', makes: 'post', text: 'Screen-record 30 seconds of a patch being made and turn it into a post.' },
    { id: 'before-after', title: 'Before / after', makes: 'post', text: "Post a dry vs processed version of one of this week's sounds." },
    { id: 'fx-pack', title: 'Transition pack', makes: 'sample', text: 'Three risers and three impacts in the same key.' },
    { id: 'copy-chain', title: 'Steal a chain', makes: 'patch', text: 'Copy an FX chain from a tutorial onto your own sound, then change three things until it is yours.' },
    { id: 'no-samples', title: 'No-sample drums', makes: 'sample', text: 'A full drum loop with no samples: Serum 2 and RANDOM Metal only.' },
    { id: 'tempo-artefacts', title: 'Off-tempo artefacts', makes: 'sample', text: 'Render a sound at 140, stretch it to 174, and use the artefacts as the feature.' },
    { id: 'mono-week', title: 'Mono loop', makes: 'sample', text: 'Mix a loop entirely in mono, then open it up. Does it still hit?' },
    { id: 'own-wavetable', title: 'Your own wavetable', makes: 'patch', text: 'Render a sound you made, import it into Serum 2 as a wavetable, and build a patch from it.' },
  ];

  return { gear, tracks, lessons, challenges };
});
