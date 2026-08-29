/**
 * Dev-only performance harness (T15): `?benchmark` seeds a 23-gear serpentine
 * train (two rows joined by a double corner) spinning at 60 RPM and reports
 * rolling fps in document.title as `BENCH:<fps>`. Never active in production
 * builds (guarded by import.meta.env.DEV at the call site too).
 */

import { makeGear, radiusOf, type Gear } from '../sim/gear.ts'

export function benchmarkSeed(): Gear[] {
  const gears: Gear[] = []
  const row1 = 11
  const corner = 2
  const row2 = 10
  const total = row1 + corner + row2
  let x = 80
  let y = 170
  let heading = 0 // 0° right, 90° down, 180° left
  for (let i = 0; i < total; i++) {
    const teeth = i % 2 === 0 ? 10 : 14
    gears.push(makeGear(`bench-${i}`, teeth, x, y))
    if (i === total - 1) break
    const nextTeeth = (i + 1) % 2 === 0 ? 10 : 14
    const side = radiusOf(teeth) + radiusOf(nextTeeth)
    if (i === row1 - 1) heading = 90
    else if (i === row1 + corner - 1) heading = 180
    x += side * Math.cos((heading * Math.PI) / 180)
    y += side * Math.sin((heading * Math.PI) / 180)
  }
  return gears
}

export function startFpsMeter() {
  let frames = 0
  let windowStart = performance.now()
  const tick = (now: number) => {
    frames += 1
    if (now - windowStart >= 2000) {
      const fps = (frames * 1000) / (now - windowStart)
      document.title = `BENCH:${fps.toFixed(1)}`
      frames = 0
      windowStart = now
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
