# The Interlocking Gear Animator

Build a working machine in under a minute: drag gears onto the bench, feel them
snap into mesh, and watch the whole train come alive at physically accurate
speeds — with live RPM and torque readouts.

A mechanical sandbox for anyone. No engineering background required; the physics
is real anyway.

## What you get

- **Snap-to-mesh building** — drag any of eight gear sizes (10–72 teeth) from the
  tray. A ghost preview shows exactly where it will snap and which gear it will
  mesh with before you let go.
- **Compound gears** — drop a gear straight onto another gear's center and it
  locks onto the same shaft (a bolt marks the pair). Both layers turn as one
  body, each meshing the train at its own size — chain pairs for real
  multi-stage gearbox ratios. Unlock from the inspector whenever you like.
- **Physically honest motion** — true involute tooth profiles, phase-correct
  meshing, speed stepped by exact tooth ratios, direction alternating at every
  mesh. Impossible placements (collisions, mechanisms that would lock, teeth out
  of phase) are refused, with a reason.
- **Live measurements** — click any gear: RPM, torque multiplier, and spin
  direction, updating as you drag the drive's speed slider (5–120 RPM).
- **The drive is yours** — the first gear you place drives the machine; make any
  other gear the drive whenever you like.
- **It sounds like a machine** — synthesized mesh ticks whose rate follows each
  contact's tooth-pass frequency (the train's ratios become audible: a 10-tooth
  gear ticks five times a second at 30 RPM, a meshed 72-tooth turns the same
  contact into a low whir), a drive hum that labors as you throttle up, and
  quiet mechanical feedback for snaps, refusals, and saves. Zero audio files —
  all WebAudio. Speaker toggle in the top bar; your choice persists.
- **Safe to experiment** — undo toasts on every destructive action, arrow-key
  nudging, full keyboard play (Enter places, Space runs/pauses, Esc closes).
- **Your bench persists** — continuous autosave plus six named design slots,
  all in your browser's local storage. No account, no server, works offline
  once loaded.
- **Reduced motion respected** — with your OS reduce-motion setting on, the
  machine loads paused and fully drawn, with a visible play control.

## Quick start

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`) and drag a gear in.

### Everything else

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build
npm run check     # typecheck + lint + unit tests
npm run e2e       # Playwright end-to-end suite (downloads Chromium on first run)
```

## How it works

Every gear shares one tooth module, so any pair can mesh: radius is a pure
function of tooth count, and the snap lands at the exact mesh distance. Speeds
step by the inverse tooth ratio at each mesh (a 10-tooth driving a 20-tooth
halves the speed and doubles the torque), direction alternates, and each new
gear's phase is computed so its teeth interlock with partners it touches —
including multi-gear meshes, which are validated against the current rotation
phases of every partner before they're allowed. Compound pairs propagate speed
unchanged through their shared shaft while each layer's meshes step the ratio
at that layer's own tooth count.

Rendering is Canvas 2D with per-size sprite caching: each gear size is drawn
once to an offscreen canvas and rotated cheaply every frame, which is why a
30-gear train still runs at 60 fps on a modest laptop.

## Keyboard

| Key | Action |
| --- | --- |
| `Enter` | place the focused tray gear |
| `Arrow keys` | nudge the selected gear (`Shift` = larger steps) |
| `Delete` / `Backspace` | remove the selected gear |
| `Space` | run / pause the machine |
| `Esc` | close panels and selection |

## Troubleshooting

- **A drop was refused** — the pill tells you why: no room (teeth would
  collide), the mechanism would lock (a loop of gears can't all turn), the
  teeth are out of phase (multi-mesh drops only work when the phases line up —
  wait a turn or pause to build), or the shaft is full (compounds are pairs).
- **Nothing spins** — every train needs a drive. If you deleted it, select any
  gear and choose *Set as drive*.
- **No sound?** — browsers only allow audio after your first click or keypress;
  place or nudge something and the machine starts speaking. The speaker button
  in the top bar mutes it (and remembers).
- **Lost work?** — the bench autosaves continuously; check the *Saves* panel.
