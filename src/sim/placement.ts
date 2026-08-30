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
import { meshRelation } from './mesh.ts'
import { buildMeshGraph } from './mesh.ts'
import { meshedTheta } from './phase.ts'

/** How far the cursor may sit from the ideal mesh circle to snap. */
export const SNAP_RANGE = 20

/** Allowed phase misalignment for secondary meshes, as a fraction of tooth pitch. */
const PHASE_TOLERANCE = 1 / 6

/** Plain-language refusal copy (critique clarify): five words, names the problem. */
export function refusalLabel(reason: 'overlap' | 'jam' | 'phase'): string {
  if (reason === 'overlap') return 'No room — gears would collide'
  if (reason === 'jam') return 'Would lock the mechanism'
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
  valid: boolean
  reason: 'ok' | 'overlap' | 'jam' | 'phase'
}

/** Shortest mesh-graph path length between two gears, or −1 if disconnected. */
function meshPathLength(gears: readonly Gear[], fromId: string, toId: string): number {
  if (fromId === toId) return 0
  const graph = buildMeshGraph(gears)
  const seen = new Set([fromId])
  let frontier = [fromId]
  let depth = 0
  while (frontier.length > 0) {
    depth += 1
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbor of graph.get(id) ?? []) {
        if (neighbor === toId) return depth
        if (!seen.has(neighbor)) {
          seen.add(neighbor)
          next.push(neighbor)
        }
      }
    }
    frontier = next
  }
  return -1
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

  // Nearest snap candidate: smallest |d − ideal| within SNAP_RANGE.
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

  // All gears the snapped position meshes (partner first by construction).
  const partners = others.filter((g) => meshRelation(candidate, g) === 'meshed')

  // Rule 1: tip overlap with any non-partner refuses.
  for (const g of others) {
    if (partners.includes(g)) continue
    const minClear = newTip + tipRadiusOf(g.teeth) - 0.5
    if (Math.hypot(x - g.x, y - g.y) < minClear) {
      return { x, y, partner, partners, valid: false, reason: 'overlap' }
    }
  }

  // Rule 2a: odd closed loops lock regardless of phase.
  for (let i = 1; i < partners.length; i++) {
    const pathLen = meshPathLength(others, partners[0]!.id, partners[i]!.id)
    if (pathLen >= 0 && pathLen % 2 === 1) {
      return { x, y, partner, partners, valid: false, reason: 'jam' }
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
        return { x, y, partner, partners, valid: false, reason: 'phase' }
      }
    }
  }

  return { x, y, partner, partners, valid: true, reason: 'ok' }
}
