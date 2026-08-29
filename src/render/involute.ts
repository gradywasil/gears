/**
 * Involute gear-tooth path generation (R3). Standard proportions: addendum 1.0·m,
 * dedendum 1.25·m, pressure angle 20°. Tooth half-width at radius ρ is
 * β(ρ) = β_base − inv(α(ρ)) with inv(α) = tan α − α — teeth narrow toward the
 * tip like true involutes. Below the base circle the flank extends radially
 * (no undercutting at toy scale).
 *
 * Convention (matches sim/phase.ts): tooth centers sit at k·2π/N, so a gear at
 * rotation 0 has a tooth center pointing along local angle 0 (+x).
 */

import { radiusOf } from '../sim/gear.ts'

const PRESSURE_ANGLE = (20 * Math.PI) / 180
const MODULE = 6

export function gearOuterRadius(teeth: number): number {
  return radiusOf(teeth) + MODULE
}

type Pt = { x: number; y: number }

function involute(alpha: number): number {
  return Math.tan(alpha) - alpha
}

/**
 * One tooth's outline, tooth centerline along +x, traversed counter-clockwise:
 * left root corner → up the left flank → left tip corner → tip center → right
 * tip corner → down the right flank → right root corner. ("Left" = −y side.)
 */
function toothOutline(teeth: number): Pt[] {
  const r = radiusOf(teeth)
  const rb = r * Math.cos(PRESSURE_ANGLE)
  const rt = r + MODULE
  const rr = Math.max(r - 1.25 * MODULE, 6)

  const alphaPitch = Math.acos(rb / r)
  const betaBase = Math.PI / (2 * teeth) + involute(alphaPitch)

  const halfWidthAt = (rho: number): number => {
    if (rho <= rb) return betaBase // radial flank below the base circle
    return betaBase - involute(Math.acos(rb / rho))
  }

  // Sample the +y flank from root to tip.
  const STEPS = 7
  const flank: Pt[] = []
  for (let i = 0; i <= STEPS; i++) {
    const rho = rr + ((rt - rr) * i) / STEPS
    const beta = halfWidthAt(rho)
    flank.push({ x: rho * Math.cos(beta), y: rho * Math.sin(beta) })
  }

  const left = flank.map((p) => ({ x: p.x, y: -p.y })) // root→tip, −y side
  const downRight = flank.slice().reverse() // tip→root, +y side
  return [...left, { x: rt, y: 0 }, ...downRight]
}

/**
 * Full gear outline as a Path2D centered on (0,0): every tooth plus the root
 * arcs across the valleys between them.
 */
export function gearPath(teeth: number): Path2D {
  const path = new Path2D()
  const r = radiusOf(teeth)
  const rr = Math.max(r - 1.25 * MODULE, 6)
  const pitch = (2 * Math.PI) / teeth
  const outline = toothOutline(teeth)

  const place = (p: Pt, a: number): Pt => ({
    x: p.x * Math.cos(a) - p.y * Math.sin(a),
    y: p.x * Math.sin(a) + p.y * Math.cos(a),
  })

  for (let k = 0; k < teeth; k++) {
    const a = k * pitch
    outline.forEach((p, i) => {
      const q = place(p, a)
      if (k === 0 && i === 0) path.moveTo(q.x, q.y)
      else path.lineTo(q.x, q.y)
    })
    // Root arc from this tooth's +y root corner across the valley to the next
    // tooth's −y root corner.
    const start = place(outline[outline.length - 1]!, a)
    const end = place(outline[0]!, a + pitch)
    const startAngle = Math.atan2(start.y, start.x)
    const endAngle = Math.atan2(end.y, end.x)
    const span = (((endAngle - startAngle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    path.arc(0, 0, rr, startAngle, startAngle + span, false)
  }
  path.closePath()
  return path
}
