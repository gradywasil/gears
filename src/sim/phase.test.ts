import { describe, expect, it } from 'vitest'
import { makeGear, radiusOf } from './gear.ts'
import { meshInvariantError, meshedTheta, naiveMeshedTheta } from './phase.ts'

function meshPair(nA: number, nB: number) {
  const a = makeGear('a', nA, 0, 0)
  const b = makeGear('b', nB, radiusOf(nA) + radiusOf(nB), 0)
  return { a, b }
}

describe('mesh-phase alignment', () => {
  it('interlocks even-tooth pairs', () => {
    for (const [nA, nB] of [
      [10, 20],
      [24, 56],
      [72, 10],
    ] as const) {
      const { a, b } = meshPair(nA, nB)
      const thetaB = meshedTheta(0, a, b)
      expect(meshInvariantError(0, a, thetaB, b)).toBeLessThan(1e-9)
    }
  })

  it('interlocks odd-tooth pairs — where the naive formula collides (regression)', () => {
    for (const [nA, nB] of [
      [10, 21],
      [15, 21],
      [33, 27],
    ] as const) {
      const { a, b } = meshPair(nA, nB)
      const good = meshedTheta(0, a, b)
      const bad = naiveMeshedTheta(0, a, b)
      expect(meshInvariantError(0, a, good, b)).toBeLessThan(1e-9)
      // naive leaves a half-pitch misalignment: invariant error ≈ π/N_B in gear-b units
      expect(meshInvariantError(0, a, bad, b)).toBeGreaterThan(0.01)
    }
  })

  it('conserves the invariant while both gears rotate at correct relative speed', () => {
    const { a, b } = meshPair(10, 21)
    let thetaA = 0
    let thetaB = meshedTheta(thetaA, a, b)
    const omegaA = 2 * Math.PI // rad/s
    const omegaB = (-omegaA * a.teeth) / b.teeth
    const dt = 0.016
    for (let step = 0; step < 2000; step++) {
      thetaA += omegaA * dt
      thetaB += omegaB * dt
      expect(meshInvariantError(thetaA, a, thetaB, b)).toBeLessThan(1e-9)
    }
  })

  it('realigns a moving partner: dropping onto a spinning gear still interlocks', () => {
    const { a, b } = meshPair(24, 33)
    for (const thetaA of [0, 0.3, 2.1, -1.7, 6.02]) {
      const thetaB = meshedTheta(thetaA, a, b)
      expect(meshInvariantError(thetaA, a, thetaB, b)).toBeLessThan(1e-9)
    }
  })
})
