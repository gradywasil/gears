/**
 * Gear domain model. One universal module for every gear, so any pair can mesh
 * and radius is a pure function of tooth count (town-hall D7).
 */

/** Tooth module: px per tooth of pitch diameter (R3: m = 6). */
export const MODULE = 6

/** Palette tooth counts (P1), roughly doubling for dramatic ratio variety. */
export const PALETTE = [10, 14, 18, 24, 32, 42, 56, 72] as const

export type Gear = {
  id: string
  teeth: number
  x: number
  y: number
}

/** Pitch radius: r = m·N/2 (R3). */
export function radiusOf(teeth: number): number {
  return (MODULE * teeth) / 2
}

/** Tip (outer) radius: teeth extend one addendum beyond the pitch circle. */
export function tipRadiusOf(teeth: number): number {
  return radiusOf(teeth) + MODULE
}

export function makeGear(id: string, teeth: number, x: number, y: number): Gear {
  if (!Number.isInteger(teeth) || teeth < 6 || teeth > 200) {
    throw new Error(`teeth out of range: ${teeth}`)
  }
  return { id, teeth, x, y }
}
