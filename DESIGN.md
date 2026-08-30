---
name: The Interlocking Gear Animator
description: A precise-instrument gear-train sandbox on a clockmaker's bench.
colors:
  bench-paper: "#ECE9E2"
  panel: "#FBFAF7"
  panel-deep: "#F4F2EC"
  charcoal-ink: "#201D19"
  ink-secondary: "#6E675C"
  hairline: "#D8D3C8"
  hairline-strong: "#B9B2A3"
  signal-orange: "#C63D0F"
  signal-orange-soft: "rgba(198, 61, 15, 0.12)"
  danger-red: "#B3261E"
  steel-lightest: "#C2C7CD"
  steel-light: "#B3B9C1"
  steel-2: "#A4ABB5"
  steel-3: "#959DA9"
  steel-4: "#868F9C"
  steel-dark: "#697377"
  steel-darkest: "#5B6570"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
  heading:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    letterSpacing: "normal"
  numeric:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
rounded:
  pill: "999px"
  chip: "12px"
  panel: "14px"
  input: "8px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "18px"
components:
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  button-icon-run:
    backgroundColor: "{colors.signal-orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    size: "32px"
  chip-palette:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.chip}"
    height: "60px"
    width: "60px"
  panel-floating:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.panel}"
    padding: "14px 16px"
  input-slot-name:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.input}"
    padding: "4px 8px"
  badge-drive:
    backgroundColor: "{colors.signal-orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: The Interlocking Gear Animator

## Overview

**Creative North Star: "The Clockmaker's Bench"**

A warm paper bench under even studio light; mechanisms of quiet steel; one maker's-mark
orange reserved for state. The system practices restraint as a material — hairline
borders instead of heavy chrome, a single soft shadow where something genuinely lifts
off the bench, and numerals treated as instruments. The machine on the canvas is the
only spectacle; everything else is a tool that recedes while you work.

The register is precise-instrument (Teenage Engineering / Braun heritage) seeded with
four echo-worlds: satisfying-machine motion, clockwork/orrery detailing, construction-
toy tactility, and instrument-lab restraint. Nothing gamified, nothing skeuomorphic-
antique, nothing dashboard-generic — those are the confirmed rejections.

**Key Characteristics:**
- Warm paper ground with cool steel mechanisms and exactly one accent
- Hairline borders carry structure; a single offset shadow carries lift
- Monospaced tabular numerals for every measurement; sans chrome everywhere else
- Size reads as meaning: the steel ramp darkens with tooth count (small = fast = light)
- The canvas is the instrument; chrome hugs the edges

*(North Star and overview language derived from the approved design brief
(docs/ultron/design-brief.md) during the finishing phase's document pass; flagged as
revisable at the finishing gate.)*

## Colors

One accent on warm neutrals; steel ramp belongs to the mechanisms, not the chrome.

### Primary
- **Signal Orange** (#C63D0F): the maker's mark. Drive ring, selection dashes, active
  run control, focus rings, text selection, the Drive badge. Never decorative.

### Neutral
- **Bench Paper** (#ECE9E2): the canvas ground — the bench everything sits on.
- **Panel** (#FBFAF7): raised chrome surfaces (top bar, tray, cards).
- **Panel Deep** (#F4F2EC): the tray rail's recessed tone; slot inputs.
- **Charcoal Ink** (#201D19): primary text and icon strokes.
- **Ink Secondary** (#6E675C): labels, dates, quiet captions.
- **Hairline** (#D8D3C8): resting borders.
- **Hairline Strong** (#B9B2A3): borders that respond (hover, icon buttons).

### Mechanism (the gear steel ramp, light → dark with tooth count)
- **Steel Lightest** (#C2C7CD) → **Steel Darkest** (#5B6570): gear bodies step darker
  as tooth count grows — small fast gears read light, large slow gears read dense.
  Hub discs lighten the family; tooth strokes stay near-charcoal.

### Tertiary
- **Danger Red** (#B3261E): refused placements, destructive actions only.

### Named Rules
**The One Mark Rule.** Signal Orange appears only where state lives (drive, selection,
active, focus, danger-adjacent). If it decorates, it's wrong.

**The Bench Rule.** The canvas ground is never broken by chrome floating on it except
panels, prompts, and toasts — all hairline-bordered with the one structural shadow.

## Typography

**Display/Body Font:** ui-sans-serif, system-ui, sans-serif
**Label/Mono Font:** ui-monospace, 'SF Mono', Menlo, Consolas, monospace

**Character:** System faces by conviction, not default — the instrument register reads
in the numerals: every measurement is monospaced tabular so digits don't dance as
values update live. Chrome text stays small and quiet.

### Hierarchy
- **Title** (600, 0.95rem): app name in the top bar; the only display-ish moment.
- **Heading** (600, 0.9rem): panel headers ("Saves", inspector gear name).
- **Body** (400, 0.88rem): inspector values, prompt copy.
- **Label** (400, 0.78rem, Ink Secondary): control labels, slot dates, tray counts.
- **Numeric** (mono, 400, 0.82rem, tabular-nums): RPM, torque multipliers, dates.

### Named Rules
**The Instrument Numeral Rule.** Any number that can change while watched is set in
the mono tabular face. Numbers are readouts, not prose.

## Layout

Fixed single view: top bar (title left; Saves + run control + RPM slider right), left
tray rail (60px chips + 8px gaps, scrolls if cramped), canvas filling the remainder.
The inspector floats bottom-right on the canvas; the saves panel top-right; prompts
center-top; toast center-bottom. Below 720px the tray moves to a bottom row. Spacing
rhythm: 6/8 inside controls, 14/18 between regions; more space above headings than below.

## Elevation & Depth

Structural, not decorative. The bench is flat paper; depth exists only where something
physically lifts off it.

### Shadow Vocabulary
- **Panel Lift** (`0 1px 2px rgba(32,29,25,0.08), 0 4px 14px rgba(32,29,25,0.1)`):
  the one shadow; floating panels, the toast, hovered tray chips.

### Named Rules
**The Lift Rule.** A shadow means "this floats above the bench" (inspector, saves,
toast, hover). Nothing else is elevated — hairlines do the structural work.

## Shapes

Pills for actions (999px), 12px for chips and inputs, 14px for panels. The signature
geometry is the gears themselves: true involute teeth, spoke holes on ≥28-tooth bodies,
hub ring — circles within circles, never rounded rectangles pretending to be machines.

## Components

### Buttons
- **Shape:** full pill (999px).
- **Secondary (default action):** Panel ground, Hairline Strong border, Charcoal text,
  5×12px padding; hover warms the border toward the accent.
- **Run control (icon):** 32px circular icon button; pressed state fills Signal
  Orange with white glyph — the one colored control, because it owns the machine's state.
- **Danger:** borderless red text; hover adds the red border. Destructive only.

### Chips (palette)
- **Style:** 60px Panel card, Hairline border, 12px radius, containing the real gear
  sprite (what you drag is what you get) with the tooth count as a tiny corner label.
- **State:** hover adds Panel Lift + border strength; while the drive is missing the
  tray dims to 60%.

### Cards / Containers
- **Corner Style:** 14px; **Background:** Panel; **Border:** 1px Hairline;
  **Shadow:** Panel Lift (they float); **Padding:** 14×16px.
- **Save-slot cards:** 12px-radius cards on Panel Deep inside the saves panel —
  occupied slots show name + date + Restore + Update + a quiet delete icon;
  empty slots collapse to a name input + Save. Footer states the autosave.

### Toast
- Ink pill, bottom-center, Panel-colored text; carries an optional Undo action
  in accent-tinted light (#F0A58A). 3.5s plain, 6s when undoable.

### Refusal pill (canvas)
- Danger-red rounded pill above a refused drop, white 12px semibold text,
  naming the cause in five words ("No room — gears would collide"). Fades with
  the shake ghost after ~2s.

### Paused pill (canvas)
- Ink pill, top-center, mono uppercase "Paused" — appears only when a drive
  exists and the machine is stopped.

### Inputs / Fields
- **Style:** Panel Deep ground, Hairline border, 8px radius, 0.78rem text.
- **Focus:** 2px Signal Orange outline with 2px offset (themed focus rings everywhere).

### Shortcuts card
- Floating panel (top-right, below the top bar) listing key → action rows:
  mono keys left, secondary-ink descriptions right. Opened from a "?" icon
  button in the top bar.

### Navigation
- The tray rail (see Chips) and the top bar. No menus, no modes — direct manipulation.

### Gear (signature component)
Canvas-drawn steel bodies on the involute geometry: 8-step steel ramp keyed to tooth
count, spoke holes on larger gears, lightened hub with ring, near-charcoal tooth
strokes. Drive wears an accent ring; selection adds a dashed accent halo; drag ghosts
run at 50% opacity with dashed verdict rings (orange = will mesh, red = refused).

## Do's and Don'ts

### Do:
- **Do** keep exactly one accent and spend it only on state.
- **Do** set every live number in mono tabular numerals.
- **Do** darken steel with size — the ramp is meaning, not decoration.
- **Do** draw chrome at the edges and let the canvas own the middle.
- **Do** use hairlines for structure and the single shadow for lift.

### Don't:
- **Don't** introduce a second accent color or decorative gradients.
- **Don't** shadow anything that doesn't float above the bench.
- **Don't** use rounded-rectangle stand-ins for mechanisms — gears are circles with
  true teeth.
- **Don't** animate chrome; the machine's rotation is the page's only motion.
- **Don't** style numbers in the proportional sans face.
