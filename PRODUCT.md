# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: user explicitly deferred the framework choice to the deep-research phase
(candidates: vanilla TypeScript + Canvas vs React + TypeScript + Canvas). Confirmed
constraints regardless of choice: fully client-side, static hosting, no backend,
localStorage persistence, evergreen browsers.

## Users

Primary: general creative/casual users who find mechanical motion satisfying — no
engineering background required. Situation: desktop or tablet, a spare few minutes,
wanting the feel of building something. Job to be done: "let me build a mesmerizing
machine in under a minute and watch it run."
Secondary (unadvertised): mechanically-curious users who absorb gear-ratio intuition as
a side effect of play.

## Product Purpose

The Interlocking Gear Animator is a casual creative toy: a browser canvas where the user
drags gears from a palette, feels them snap into a perfect mesh, sets a drive gear
spinning, and watches the entire train come alive at physically accurate relative speeds
with a live readout of RPM and torque. It exists because watching mechanisms work is a
universal delight, but building them has no low-friction path: CAD tools are heavyweight
and expert-only; physical gear sets cost money and hide RPM/torque consequences.
Success means: a new user meshes a second gear within ~30 seconds of page load; 20+ gear
trains animate at 60 fps with phase-correct tooth interlocking; readouts match
hand-computed ratios exactly; and the builder keeps adding gears past the second one.

## Positioning

Instant snap-to-mesh construction plus physically exact animation — any gear pairs with
any other (single universal tooth module), every gear spins at ω ∝ 1/N with alternating
direction and phase-correct teeth, and any gear's RPM / ×torque is one click away. No
neighboring product combines zero-learning-curve toy assembly with engineering-grade
kinematic truth; sims are either expert CAD or physically wrong.

## Operating Context

Single-page app in one browser window; works offline once loaded. Fixed single-view
canvas filling the window (no pan/zoom in MVP). Pointer-universal input (mouse/pen/touch;
tablet-class is the design floor, phones render but are not layout-optimized). Continuous
autosave plus a handful of named snapshot slots in localStorage. The machine spins the
moment a drive gear exists; paused states occur by user control, reduced-motion
preference, or a deleted drive gear.

## Capabilities and Constraints

Confirmed MVP capabilities: discrete palette of ~8 tooth counts (proposed 10–72) with one
universal module; drag-to-place with ghost snap preview; invalid drops (overlap, no mesh
partner, kinematically impossible loop) refused with shake feedback — nothing ever
auto-pushes; first gear placed is the drive (badged), reassignable via per-gear inspector;
per-gear inspector shows RPM (real units), torque (relative multiplier), direction, live;
move and delete placed gears; autosave + named slots with a versioned schema.
Confirmed non-goals (MVP): compound gears (first fast-follow), internal/ring/rack/
planetary geometry, sound (deferred; architecture leaves a hook), pan/zoom, sharing or
import/export, backend/accounts, phone-first layout, full screen-reader equivalence of the
canvas, physical-unit torque, in-place tooth-count resizing.
Explicitly undecided (recorded, not invented): framework (research); final palette counts,
slot count, RPM slider range (planning).

## Brand Commitments

Product name: "The Interlocking Gear Animator" (working title, user-supplied).

## Evidence on Hand

None. No copy, imagery, testimonials, or metrics exist yet; future work must not
fabricate any. The approved scoping brief (docs/ultron/town-hall.md) is the evidence
of record for product decisions.

## Product Principles

1. Feel is the product — motion smoothness and snap certainty outrank feature count.
2. Accuracy is credibility — relative speeds, directions, and ratios are always
   physically exact, even though units and profiles are toy-simplified.
3. Zero-mode UX — everything is direct manipulation; no modal tools to discover.
4. The layout is sacred — invalid actions refuse with feedback; nothing shoves or
   silently rearranges the user's machine.
5. Client-side forever — the core experience never depends on a network or backend.

## Accessibility & Inclusion

Established bar (town-hall decision): honor `prefers-reduced-motion` (paused/slow
default) with a visible pause control; all controls keyboard-reachable; arrow-key nudge
of the selected gear; readable text contrast. Full screen-reader equivalence of the
spatial canvas is explicitly out of scope for MVP.

---
*Derived 2026-08-29 from the approved town-hall scoping brief
(docs/ultron/town-hall.md) per the ultron pipeline handoff — without re-interviewing.
Every fact above traces to a signed-off town-hall decision.*
