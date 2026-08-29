import { useEffect, useRef } from 'react'
import type { Gear } from '../sim/gear.ts'
import type { Spin } from '../sim/kinematics.ts'
import { gearSprite } from './spriteCache.ts'

export type MachineProps = {
  gears: readonly Gear[]
  /** Only gears present here spin; absent gears are stationary. */
  spins: ReadonlyMap<string, Spin>
  /** Initial rotation per gear (radians, tooth-center-at-angle-0 convention). */
  angles: ReadonlyMap<string, number>
  running: boolean
}

/**
 * The machine canvas. The rAF loop lives outside React (R2): React renders the
 * chrome, this component owns the frame. Rotation advances by dt each frame so
 * animation is frame-rate independent.
 */
export function MachineCanvas({ gears, spins, angles, running }: MachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ gears, spins, angles: new Map(angles), running })

  useEffect(() => {
    stateRef.current.gears = gears
    stateRef.current.spins = spins
    stateRef.current.running = running
  }, [gears, spins, running])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const rotation = new Map(angles)
    let dpr = 0
    let cssW = 0
    let cssH = 0

    const resize = () => {
      const next = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      if (next !== dpr) {
        dpr = next
      }
      cssW = rect.width
      cssH = rect.height
      canvas.width = Math.max(1, Math.round(cssW * dpr))
      canvas.height = Math.max(1, Math.round(cssH * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let last = performance.now()
    let frame = 0

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const { gears: gs, spins: sp, running: run } = stateRef.current

      if (run) {
        for (const gear of gs) {
          const spin = sp.get(gear.id)
          if (!spin) continue
          const omega = ((spin.rpm * 2 * Math.PI) / 60) * spin.direction
          rotation.set(gear.id, (rotation.get(gear.id) ?? 0) + omega * dt)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)
      for (const gear of gs) {
        const sprite = gearSprite(gear.teeth, dpr)
        const half = sprite.width / (2 * dpr)
        ctx.save()
        ctx.translate(gear.x, gear.y)
        ctx.rotate(rotation.get(gear.id) ?? 0)
        ctx.drawImage(sprite, -half, -half, half * 2, half * 2)
        ctx.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="machine-canvas" />
}
