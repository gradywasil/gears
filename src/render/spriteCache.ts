/**
 * Per-size gear sprites (R2): each distinct tooth count is rendered once to a
 * snug, DPR-scaled offscreen canvas; every frame just rotates + drawImage.
 * The cache is invalidated when the device pixel ratio or style token changes.
 */

import { PALETTE } from '../sim/gear.ts'
import { gearOuterRadius, gearPath } from './involute.ts'

export type GearStyle = {
  fill: string
  stroke: string
  hubFill: string
}

/** Placeholder M1 styling; T6 replaces this with the committed visual world. */
export const DEFAULT_STYLE: GearStyle = {
  fill: '#8a8f98',
  stroke: '#3c4046',
  hubFill: '#e8eaed',
}

const cache = new Map<string, HTMLCanvasElement>()

export function gearSprite(teeth: number, dpr: number, style: GearStyle = DEFAULT_STYLE) {
  const key = `${teeth}|${dpr}|${style.fill}`
  const hit = cache.get(key)
  if (hit) return hit

  const outer = gearOuterRadius(teeth)
  const size = Math.ceil(outer * 2) + 4
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(size * dpr)
  canvas.height = Math.ceil(size * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.translate(size / 2, size / 2)

  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.5
  ctx.fillStyle = style.fill
  ctx.strokeStyle = style.stroke
  const path = gearPath(teeth)
  ctx.fill(path)
  ctx.stroke(path)

  // Hub: punch a hole, then a hub disc.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(6, outer * 0.18), 0, 2 * Math.PI)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = style.hubFill
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(4, outer * 0.12), 0, 2 * Math.PI)
  ctx.fill()

  const sprite: HTMLCanvasElement = canvas
  cache.set(key, sprite)
  return sprite
}

/** Drop cached sprites (DPR change, style change, tests). */
export function clearSpriteCache() {
  cache.clear()
}

export const SPRITE_TEETH = PALETTE
