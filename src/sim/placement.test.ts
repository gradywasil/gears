import { describe, expect, it } from 'vitest'
import { makeGear, radiusOf } from './gear.ts'
import { evaluatePlacement } from './placement.ts'

describe('placement evaluation', () => {
  it('snaps a nearby cursor to the exact mesh distance', () => {
    const a = makeGear('a', 20, 0, 0)
    const ideal = radiusOf(10) + radiusOf(20)
    // Cursor 12px outside the ideal circle.
    const v = evaluatePlacement([a], 10, ideal + 12, 0)
    expect(v.partner?.id).toBe('a')
    expect(v.valid).toBe(true)
    expect(Math.hypot(v.x - a.x, v.y - a.y)).toBeCloseTo(ideal, 6)
  })

  it('refuses overlap with a non-partner gear', () => {
    const a = makeGear('a', 20, 0, 0)
    const b = makeGear('b', 20, radiusOf(20) * 2, 0)
    // Dropping a 20t right on top of a: no snap (already meshed distance? no —
    // cursor at a's center), heavily overlapping.
    const v = evaluatePlacement([a, b], 20, 5, 5)
    expect(v.valid).toBe(false)
    expect(v.reason).toBe('overlap')
  })

  it('refuses a placement that closes an impossible loop', () => {
    // Line of three 20t gears; a fourth 20t placed to mesh both ends would
    // close... build the canonical case: three gears where the new one meshes
    // two already-connected gears forming an odd cycle.
    const s = radiusOf(20) * 2
    const base = [
      makeGear('p0', 20, 0, 0),
      makeGear('p1', 20, s, 0),
    ]
    // New 20t at the equilateral apex meshes both p0 and p1; p0-p1 already
    // mesh → triangle (odd cycle) → jam.
    const apex = { x: s / 2, y: (s * Math.sqrt(3)) / 2 }
    const v = evaluatePlacement(base, 20, apex.x, apex.y)
    expect(v.partners.map((g) => g.id).sort()).toEqual(['p0', 'p1'])
    expect(v.valid).toBe(false)
    expect(v.reason).toBe('jam')
  })

  it('allows free placement away from everything', () => {
    const a = makeGear('a', 20, 0, 0)
    const v = evaluatePlacement([a], 10, 500, 500)
    expect(v.partner).toBeNull()
    expect(v.valid).toBe(true)
    expect(v.reason).toBe('ok')
  })

  it('excludes the dragged gear from candidates when moving', () => {
    const a = makeGear('a', 20, 0, 0)
    const b = makeGear('b', 10, radiusOf(20) + radiusOf(10), 0)
    // Moving a away: b must not count a's current position as snap partner.
    const v = evaluatePlacement([a, b], 20, 400, 400, 'a')
    expect(v.partner?.id).not.toBe('a')
  })
})
