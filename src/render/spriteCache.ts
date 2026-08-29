/**
 * Per-size gear sprites (R2): each distinct tooth count is rendered once to a
 * snug, DPR-scaled offscreen canvas; every frame just rotates + drawImage.
 * The cache is invalidated when the device pixel ratio or style token changes.
 *
 * Visual world (design brief, pinned): precise-instrument register — a steel
 * ramp stepping darker with size (size reads as speed), clockwork detailing
 * (spoke holes on larger gears), rounded tips.
 */

import { radiusOf } from '../sim/gear.ts'
import { gearOuterRadius, gearPath } from './involute.ts'

export type GearStyle = {
  fill: string
  stroke: string
  hubFill: string
}

/** Steel ramp, light (10 teeth / fast) → dark (72 teeth / slow). */
const STEEL_RAMP: GearStyle[] = [
  { fill: '#C2C7CD', stroke: '#41464D', hubFill: '#ECEEF1' },
  { fill: '#B3B9C1', stroke: '#3E434A', hubFill: '#E8EBEE' },
  { fill: '#A4ABB5', stroke: '#3B4048', hubFill: '#E4E7EB' },
  { fill: '#959DA9', stroke: '#383D45', hubFill: '#E0E4E9' },
  { fill: '#868F9C', stroke: '#343A42', hubFill: '#DDE1E7' },
  { fill: '#778189', stroke: '#31363E', hubFill: '#D9DEE4' },
  { fill: '#697377', stroke: '#2D333A', hubFill: '#D5DAE1' },
  { fill: '#5B6570', stroke: '#2A2F36', hubFill: '#D1D6DE' },
]

export function styleForTeeth(teeth: number): GearStyle {
  // Snap to the nearest ramp slot for arbitrary tooth counts (10→0 … 72→7).
  const slot = Math.min(
    STEEL_RAMP.length - 1,
    Math.max(0, Math.round(((teeth - 10) * (STEEL_RAMP.length - 1)) / 62)),
  )
  return STEEL_RAMP[slot]!
}

const cache = new Map<string, HTMLCanvasElement>()

export function gearSprite(teeth: number, dpr: number, style: GearStyle = styleForTeeth(teeth)) {
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

  // Clockwork detailing: spoke holes between hub and rim on larger gears.
  const r = radiusOf(teeth)
  const holeCount = Math.min(6, Math.max(4, Math.round(teeth / 9)))
  if (teeth >= 28) {
    ctx.globalCompositeOperation = 'destination-out'
    const holeR = r * 0.16
    const orbit = r * 0.58
    for (let i = 0; i < holeCount; i++) {
      const a = (i / holeCount) * 2 * Math.PI
      ctx.beginPath()
      ctx.arc(orbit * Math.cos(a), orbit * Math.sin(a), holeR, 0, 2 * Math.PI)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  // Hub: punch a hole, then a hub disc with a ring.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(6, outer * 0.2), 0, 2 * Math.PI)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = style.hubFill
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(4, outer * 0.14), 0, 2 * Math.PI)
  ctx.fill()
  ctx.strokeStyle = style.stroke
  ctx.lineWidth = 1
  ctx.stroke()

  cache.set(key, canvas)
  return canvas
}

/** Drop cached sprites (DPR change, style change, tests). */
export function clearSpriteCache() {
  cache.clear()
}
