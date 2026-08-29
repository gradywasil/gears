/**
 * Mesh-phase math (R3, corrected). Convention: a gear's rotation angle θ places a
 * tooth center at local angle 0; teeth repeat every 2π/N.
 *
 * The corrected alignment formula carries the odd-tooth term π(N_B − 1)/N_B — the
 * naive π/N_B constant collides tooth-on-tooth when N_B is odd.
 */

import type { Gear } from './gear.ts'

/** World angle of b's center as seen from a. */
export function centerAngle(a: Gear, b: Gear): number {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/** Wrap an angle-like value to (−π, π]. */
export function wrapAngle(x: number): number {
  return (((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
}

/** Rotation for b that interlocks its teeth with a rotating at thetaA. */
export function meshedTheta(thetaA: number, a: Gear, b: Gear): number {
  const ratio = a.teeth / b.teeth
  const phi = centerAngle(a, b)
  return -ratio * thetaA + (1 + ratio) * phi + (Math.PI * (b.teeth - 1)) / b.teeth
}

/** The naive (WRONG for odd N_B) formula, kept for the regression test. */
export function naiveMeshedTheta(thetaA: number, a: Gear, b: Gear): number {
  const ratio = a.teeth / b.teeth
  const phi = centerAngle(a, b)
  return -ratio * thetaA + (1 + ratio) * phi + Math.PI / b.teeth
}

/**
 * Signed distance from interlock for a claimed (thetaA, thetaB) pair, via the
 * rolling invariant (φ−θA)·N_A + (φ+π−θB)·N_B ≡ π (mod 2π). Zero = interlocked.
 */
export function meshInvariantError(thetaA: number, a: Gear, thetaB: number, b: Gear): number {
  const phi = centerAngle(a, b)
  const value = (phi - thetaA) * a.teeth + (phi + Math.PI - thetaB) * b.teeth - Math.PI
  return Math.abs(wrapAngle(value))
}
