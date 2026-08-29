/**
 * Placement rules (town-hall D11): ghost preview + refuse. A drop near an
 * existing gear snaps to the exact mesh distance; overlap with any non-partner
 * or a kinematically impossible loop refuses the placement. Nothing ever
 * auto-pushes. Unmeshed free placement is allowed (the first gear needs it, and
 * approved journeys have unmeshed gears waiting to be connected).
 */

import type { Gear } from './gear.ts'
import { radiusOf } from './gear.ts'
import { meshRelation } from './mesh.ts'
import { meshWouldJam } from './kinematics.ts'

/** How far the cursor may sit from the ideal mesh circle to snap. */
export const SNAP_RANGE = 20

export type PlacementVerdict = {
  /** Final position for the ghost / drop. */
  x: number
  y: number
  /** Partner the placement will mesh with (nearest valid candidate). */
  partner: Gear | null
  /** Every gear the snapped position meshes (may include several). */
  partners: Gear[]
  valid: boolean
  reason: 'ok' | 'overlap' | 'jam'
}

export function evaluatePlacement(
  gears: readonly Gear[],
  teeth: number,
  cursorX: number,
  cursorY: number,
  draggedId?: string,
): PlacementVerdict {
  const others = gears.filter((g) => g.id !== draggedId)
  const newRadius = radiusOf(teeth)

  // Nearest snap candidate: smallest |d − ideal| within SNAP_RANGE.
  let partner: Gear | null = null
  let partnerError = SNAP_RANGE
  for (const g of others) {
    const ideal = newRadius + radiusOf(g.teeth)
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
    const ideal = newRadius + radiusOf(partner.teeth)
    const d = Math.hypot(cursorX - partner.x, cursorY - partner.y) || 1
    x = partner.x + ((cursorX - partner.x) / d) * ideal
    y = partner.y + ((cursorY - partner.y) / d) * ideal
  }

  const candidate: Gear = { id: draggedId ?? '__candidate__', teeth, x, y }

  // All gears the snapped position meshes (partner first).
  const partners = others.filter((g) => meshRelation(candidate, g) === 'meshed')

  // Overlap with any non-partner refuses.
  for (const g of others) {
    if (partners.includes(g)) continue
    if (meshRelation(candidate, g) === 'overlapping') {
      return { x, y, partner, partners, valid: false, reason: 'overlap' }
    }
  }

  // Any closing loop that would jam refuses.
  const withCandidate = [...others, candidate]
  for (const g of partners) {
    if (meshWouldJam(withCandidate, candidate, g).jams) {
      return { x, y, partner, partners, valid: false, reason: 'jam' }
    }
  }

  return { x, y, partner, partners, valid: true, reason: 'ok' }
}
