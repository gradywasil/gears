import { describe, expect, it } from 'vitest'
import { makeGear, radiusOf, tipRadiusOf } from './gear.ts'
import { evaluatePlacement, refusalLabel } from './placement.ts'
import { meshedTheta } from './phase.ts'

describe('refusal labels', () => {
  it('name each refusal cause in plain language', () => {
    expect(refusalLabel('overlap')).toBe('No room — gears would collide')
    expect(refusalLabel('jam')).toBe('Would lock the mechanism')
    expect(refusalLabel('phase')).toBe('Teeth out of phase — wait a turn')
  })
})

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

  it('refuses tip overlap: pitch-apart but teeth interpenetrating (user-reported bug)', () => {
    // A(20t) at origin, B(20t) meshed to its right. A 10t dropped so it snaps
    // to A at an angle placing it 100.5px from B — pitch-sum is 96 ("apart")
    // but tip-sum is 102, so the teeth would physically cross.
    const a = makeGear('a', 20, 0, 0)
    const b = makeGear('b', 20, radiusOf(20) * 2, 0)
    const theta = Math.acos((22500 - 100.5 * 100.5) / 21600) // dB = 100.5
    const cursor = { x: 95 * Math.cos(theta), y: 95 * Math.sin(theta) }
    const v = evaluatePlacement([a, b], 10, cursor.x, cursor.y)
    expect(v.partner?.id).toBe('a')
    expect(Math.hypot(v.x - b.x, v.y - b.y)).toBeCloseTo(100.5, 3)
    expect(Math.hypot(v.x - b.x, v.y - b.y)).toBeLessThan(tipRadiusOf(10) + tipRadiusOf(20))
    expect(v.valid).toBe(false)
    expect(v.reason).toBe('overlap')
  })

  it('refuses multi-mesh when a secondary partner phase-clashes (user-reported bug)', () => {
    // Two independent 20t gears; a 42t would mesh both at once, but their
    // angles are arbitrary — the required simultaneous interlock is impossible.
    const a = makeGear('a', 20, 0, 0)
    const b = makeGear('b', 20, 240, 0)
    const d = radiusOf(42) + radiusOf(20) // 186
    const cx = 120
    const cy = Math.sqrt(d * d - 120 * 120)
    const angles = new Map([
      ['a', 0],
      ['b', 1.0], // arbitrary phase
    ])
    const v = evaluatePlacement([a, b], 42, cx, cy, undefined, angles)
    expect(v.partners).toHaveLength(2)
    expect(v.valid).toBe(false)
    expect(v.reason).toBe('phase')
  })

  it('accepts multi-mesh when the secondary partner phase lines up', () => {
    const a = makeGear('a', 20, 0, 0)
    const b = makeGear('b', 20, 240, 0)
    const d = radiusOf(42) + radiusOf(20)
    const cx = 120
    const cy = Math.sqrt(d * d - 120 * 120)
    const candidate = makeGear('c', 42, cx, cy)
    const thetaC = meshedTheta(0, a, candidate)
    const thetaB = meshedTheta(thetaC, candidate, b)
    const angles = new Map([
      ['a', 0],
      ['b', thetaB],
    ])
    const v = evaluatePlacement([a, b], 42, cx, cy, undefined, angles)
    expect(v.partners).toHaveLength(2)
    expect(v.valid).toBe(true)
    expect(v.reason).toBe('ok')
  })
})
