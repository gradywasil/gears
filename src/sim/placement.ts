/**
 * Placement rules (town-hall D11): ghost preview + refuse. A drop near an
 * existing gear snaps to the exact mesh distance; physical interference with
 * any non-partner or a phase-inconsistent multi-mesh refuses the placement.
 * Nothing ever auto-pushes. Unmeshed free placement is allowed (the first gear
 * needs it, and approved journeys have unmeshed gears waiting to be connected).
 *
 * Two interference rules:
 * 1. Tip overlap — teeth extend one addendum past the pitch circle, so a
 *    non-partner is only clear when center distance ≥ tipR₁ + tipR₂. Pitch
 *    distance alone would accept placements whose teeth interpenetrate.
 * 2. Phase consistency — a gear meshing several partners must interlock with
 *    all of them at once. Its angle is pinned by the snap partner; every other
 *    partner's current rotation must then land within a fraction of a tooth
 *    pitch of the required phase. Odd closed loops lock regardless (each mesh
 *    reverses direction), which the structural check catches first.
 */

import type { Gear } from './gear.ts'
import { radiusOf, tipRadiusOf } from './gear.ts'
import { meshEdgesBetween, meshRelation } from './mesh.ts'
import { meshedTheta } from './phase.ts'

/** How far the cursor may sit from the ideal mesh circle to snap. */
export const SNAP_RANGE = 20

/** Drop within this radius of a gear's center to lock a compound instead. */
export const LOCK_RADIUS = 26

/** Allowed phase misalignment for secondary meshes, as a fraction of tooth pitch. */
const PHASE_TOLERANCE = 1 / 6

/** Plain-language refusal copy (critique clarify): five words, names the problem. */
export function refusalLabel(reason: 'overlap' | 'jam' | 'phase' | 'locked'): string {
  if (reason === 'overlap') return 'No room — gears would collide'
  if (reason === 'jam') return 'Would lock the mechanism'
  if (reason === 'locked') return 'Shaft is full — pairs only'
  return 'Teeth out of phase — wait a turn'
}

export type PlacementVerdict = {
  /** Final position for the ghost / drop. */
  x: number
  y: number
  /** Partner the placement snaps to (phase anchor for multi-mesh). */
  partner: Gear | null
  /** Every gear the snapped position meshes (may include several). */
  partners: Gear[]
  /** Compound lock: the gear the drop shares a shaft with (drop-on-center). */
  lock: Gear | null
  valid: boolean
  reason: 'ok' | 'overlap' | 'jam' | 'phase' | 'locked'
}

export function evaluatePlacement(
  gears: readonly Gear[],
  teeth: number,
  cursorX: number,
  cursorY: number,
  draggedId?: string,
  angles?: ReadonlyMap<string, number>,
): PlacementVerdict {
  const others = gears.filter((g) => g.id !== draggedId)
  const newTip = tipRadiusOf(teeth)
  const fail = (reason: PlacementVerdict['reason'], x: number, y: number, lock: Gear | null = null) => ({
    x,
    y,
    partner: null,
    partners: [],
    lock,
    valid: false,
    reason,
  })

  // --- Compound lock: drop near an unlocked gear's center (fast-follow #3). ---
  let lock: Gear | null = null
  let lockError = LOCK_RADIUS
  for (const g of others) {
    const d = Math.hypot(cursorX - g.x, cursorY - g.y)
    if (d <= lockError) {
      lock = g
      lockError = d
    }
  }
  if (lock) {
    const draggedLocked =
      draggedId !== undefined && gears.some((g) => g.id === draggedId && g.lockedTo)
    if (lock.lockedTo) {
      // Pairs only: the shaft is taken.
      return fail('locked', lock.x, lock.y, lock)
    }
    if (draggedLocked) {
      return fail('locked', lock.x, lock.y, lock)
    }
    const candidate: Gear = { id: draggedId ?? '__candidate__', teeth, x: lock.x, y: lock.y }
    const layerPartners = others.filter(
      (g) => g.id !== lock.id && meshRelation(candidate, g) === 'meshed',
    )
    // The co-axial base is intentional overlap; everything else must clear.
    for (const g of others) {
      if (g.id === lock.id || layerPartners.includes(g)) continue
      const minClear = newTip + tipRadiusOf(g.teeth) - 0.5
      if (Math.hypot(candidate.x - g.x, candidate.y - g.y) < minClear) {
        return fail('overlap', candidate.x, candidate.y, lock)
      }
    }
    // The locked layer co-rotates with the base: its angle IS the base's angle.
    if (angles && layerPartners.length > 0) {
      const thetaCandidate = angles.get(lock.id) ?? 0
      for (const other of layerPartners) {
        const pitch = (2 * Math.PI) / other.teeth
        const required = meshedTheta(thetaCandidate, candidate, other)
        const actual = angles.get(other.id) ?? 0
        const residue = Math.abs(actual - required - Math.round((actual - required) / pitch) * pitch)
        if (residue > pitch * PHASE_TOLERANCE) {
          return fail('phase', candidate.x, candidate.y, lock)
        }
        // Direction parity through the body: path back to the base counts mesh
        // edges only (locked edges don't flip); plus this new mesh must be even.
        const meshEdges = meshEdgesBetween(others, lock.id, other.id)
        if (meshEdges >= 0 && (meshEdges + 1) % 2 === 1) {
          return fail('jam', candidate.x, candidate.y, lock)
        }
      }
    } else if (layerPartners.length > 0) {
      // Angle-free callers still get the structural parity check.
      for (const other of layerPartners) {
        const meshEdges = meshEdgesBetween(others, lock.id, other.id)
        if (meshEdges >= 0 && (meshEdges + 1) % 2 === 1) {
          return fail('jam', candidate.x, candidate.y, lock)
        }
      }
    }
    return { x: lock.x, y: lock.y, partner: null, partners: layerPartners, lock, valid: true, reason: 'ok' }
  }

  // --- Mesh / free placement (as before, generalized to union parity). ------
  let partner: Gear | null = null
  let partnerError = SNAP_RANGE
  for (const g of others) {
    const ideal = radiusOf(teeth) + radiusOf(g.teeth)
    const d = Math.hypot(cursorX - g.x, cursorY - g.y)
    const err = Math.abs(d - ideal)
    if (err <= partnerError) {
      partner = g
      partnerError = err
    }
  }

  let x = cursorX
  let y = cursorY
  if (partner) {
    const ideal = radiusOf(teeth) + radiusOf(partner.teeth)
    const d = Math.hypot(cursorX - partner.x, cursorY - partner.y) || 1
    x = partner.x + ((cursorX - partner.x) / d) * ideal
    y = partner.y + ((cursorY - partner.y) / d) * ideal
  }

  const candidate: Gear = { id: draggedId ?? '__candidate__', teeth, x, y }
  const partners = others.filter((g) => meshRelation(candidate, g) === 'meshed')

  // Rule 1: tip overlap with any non-partner refuses.
  for (const g of others) {
    if (partners.includes(g)) continue
    const minClear = newTip + tipRadiusOf(g.teeth) - 0.5
    if (Math.hypot(x - g.x, y - g.y) < minClear) {
      return { x, y, partner, partners, lock: null, valid: false, reason: 'overlap' }
    }
  }

  // Rule 2a: odd closed loops lock. The cycle's mesh-edge count is the anchor
  // link + path + the closing link (both flipping meshes), so an odd path jams.
  for (let i = 1; i < partners.length; i++) {
    const meshEdges = meshEdgesBetween(others, partners[0]!.id, partners[i]!.id)
    if (meshEdges >= 0 && meshEdges % 2 === 1) {
      return { x, y, partner, partners, lock: null, valid: false, reason: 'jam' }
    }
  }

  // Rule 2b: every secondary partner's current phase must accept the anchor's.
  if (partners.length >= 2 && angles) {
    const anchor = partners[0]!
    const thetaCandidate = meshedTheta(angles.get(anchor.id) ?? 0, anchor, candidate)
    for (let i = 1; i < partners.length; i++) {
      const other = partners[i]!
      const pitch = (2 * Math.PI) / other.teeth
      const required = meshedTheta(thetaCandidate, candidate, other)
      const actual = angles.get(other.id) ?? 0
      const residue = Math.abs(actual - required - Math.round((actual - required) / pitch) * pitch)
      if (residue > pitch * PHASE_TOLERANCE) {
        return { x, y, partner, partners, lock: null, valid: false, reason: 'phase' }
      }
    }
  }

  return { x, y, partner, partners, lock: null, valid: true, reason: 'ok' }
}
