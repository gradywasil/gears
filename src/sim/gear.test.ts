import { describe, expect, it } from 'vitest'
import { MODULE, PALETTE, makeGear, radiusOf } from './gear.ts'

describe('gear model', () => {
  it('derives radius from tooth count with module 6', () => {
    expect(MODULE).toBe(6)
    expect(radiusOf(10)).toBeCloseTo(30)
    expect(radiusOf(72)).toBeCloseTo(216)
  })

  it('palette is the committed eight counts', () => {
    expect([...PALETTE]).toEqual([10, 14, 18, 24, 32, 42, 56, 72])
  })

  it('rejects non-integer or absurd tooth counts', () => {
    expect(() => makeGear('g', 10.5, 0, 0)).toThrow()
    expect(() => makeGear('g', 3, 0, 0)).toThrow()
  })
})
