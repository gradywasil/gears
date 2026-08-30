import { useEffect, useRef } from 'react'
import type { Gear } from '../sim/gear.ts'
import { gearOuterRadius } from './involute.ts'
import type { Spin } from '../sim/kinematics.ts'
import { evaluatePlacement, refusalLabel, type PlacementVerdict } from '../sim/placement.ts'
import { gearSprite } from './spriteCache.ts'

export type DragState =
  | { kind: 'new'; teeth: number }
  | { kind: 'move'; id: string; teeth: number }
  | null

export type MachineProps = {
  gears: readonly Gear[]
  spins: ReadonlyMap<string, Spin>
  angles: Readonly<Record<string, number>>
  anglesVersion: number
  running: boolean
  driveId: string | null
  selectedId: string | null
  drag: DragState
  accent: string
  danger: string
  onPlace: (teeth: number, x: number, y: number, partnerId: string | null) => void
  onMove: (id: string, x: number, y: number, partnerId: string | null) => void
  onSelect: (id: string | null) => void
  onStartMove: (id: string, teeth: number) => void
  onDragEnd: () => void
  /** Screen-reader description of the machine state. */
  ariaLabel: string
  /** Refusal feedback triggered outside the canvas (failed keyboard nudge). */
  pulse?: { x: number; y: number; teeth: number; reason: 'overlap' | 'jam' | 'phase'; at: number } | null
  /** Announces a refusal to assistive tech (aria-live lives in App). */
  onRefusal?: (reason: 'overlap' | 'jam' | 'phase') => void
}

const REFUSE_MS = 2200 // label needs reading time; oscillation fades in the first 300ms

/**
 * The machine canvas. The rAF loop lives outside React (R2): React renders the
 * chrome; this component owns the frame, the drag ghost, and refusal feedback.
 * Sim units are canvas CSS pixels (the DPR scaling is baked into the transform).
 */
export function MachineCanvas(props: MachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })

  const dragPosRef = useRef<{ x: number; y: number; inside: boolean } | null>(null)
  const shakeRef = useRef<{
    x: number
    y: number
    teeth: number
    reason: 'overlap' | 'jam' | 'phase'
    until: number
  } | null>(null)

  // External refusal pulses (failed keyboard nudges) trigger the same feedback.
  useEffect(() => {
    if (!props.pulse) return
    shakeRef.current = {
      x: props.pulse.x,
      y: props.pulse.y,
      teeth: props.pulse.teeth,
      reason: props.pulse.reason,
      until: performance.now() + REFUSE_MS,
    }
  }, [props.pulse?.at])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const rotation = new Map<string, number>()
    let dpr = 0
    let cssW = 0
    let cssH = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
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
    let syncedVersion = -1

    const drawGhost = () => {
      const { gears, drag, accent, danger } = propsRef.current
      const pos = dragPosRef.current
      if (!drag || !pos || !pos.inside) return

      const verdict: PlacementVerdict = evaluatePlacement(
        gears,
        drag.teeth,
        pos.x,
        pos.y,
        drag.kind === 'move' ? drag.id : undefined,
        rotation,
      )
      const sprite = gearSprite(drag.teeth, dpr)
      const half = sprite.width / (2 * dpr)

      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.translate(verdict.x, verdict.y)
      ctx.drawImage(sprite, -half, -half, half * 2, half * 2)
      ctx.restore()

      // Verdict ring around the ghost; partner gets a highlight ring.
      ctx.save()
      ctx.lineWidth = 2
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = verdict.valid ? accent : danger
      ctx.beginPath()
      ctx.arc(verdict.x, verdict.y, gearOuterRadius(drag.teeth) + 5, 0, 2 * Math.PI)
      ctx.stroke()
      if (verdict.partner && verdict.valid) {
        ctx.setLineDash([])
        ctx.lineWidth = 2.5
        ctx.strokeStyle = accent
        ctx.beginPath()
        ctx.arc(verdict.partner.x, verdict.partner.y, gearOuterRadius(verdict.partner.teeth) + 5, 0, 2 * Math.PI)
        ctx.stroke()
      }
      ctx.restore()
    }

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const { gears, spins, running, driveId, selectedId, angles, anglesVersion, accent } =
        propsRef.current

      if (syncedVersion !== anglesVersion) {
        for (const [id, a] of Object.entries(angles)) rotation.set(id, a)
        syncedVersion = anglesVersion
      }

      if (running) {
        for (const gear of gears) {
          const spin = spins.get(gear.id)
          if (!spin) continue
          const omega = ((spin.rpm * 2 * Math.PI) / 60) * spin.direction
          rotation.set(gear.id, (rotation.get(gear.id) ?? 0) + omega * dt)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      const movingId = propsRef.current.drag?.kind === 'move' ? propsRef.current.drag.id : null
      for (const gear of gears) {
        if (gear.id === movingId) continue // hidden while being dragged
        const sprite = gearSprite(gear.teeth, dpr)
        const half = sprite.width / (2 * dpr)
        ctx.save()
        ctx.translate(gear.x, gear.y)
        ctx.rotate(rotation.get(gear.id) ?? 0)
        ctx.drawImage(sprite, -half, -half, half * 2, half * 2)
        ctx.restore()

        if (gear.id === driveId) {
          ctx.save()
          ctx.strokeStyle = accent
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(gear.x, gear.y, gearOuterRadius(gear.teeth) + 4, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.restore()
        }
        if (gear.id === selectedId) {
          ctx.save()
          ctx.strokeStyle = accent
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.arc(gear.x, gear.y, gearOuterRadius(gear.teeth) + 10, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.restore()
        }
      }

      drawGhost()

      // Refusal feedback: a brief shake that settles into a labeled ghost.
      const shake = shakeRef.current
      if (shake) {
        if (now >= shake.until) {
          shakeRef.current = null
        } else {
          const elapsed = REFUSE_MS - (shake.until - now)
          const oscillating = Math.max(0, 1 - elapsed / 300)
          const offset = Math.sin(elapsed * 0.06) * 4 * oscillating
          const fade = Math.min(1, (shake.until - now) / 400)
          const sprite = gearSprite(shake.teeth, dpr)
          const half = sprite.width / (2 * dpr)
          ctx.save()
          ctx.globalAlpha = 0.35 * fade
          ctx.translate(shake.x + offset, shake.y)
          ctx.drawImage(sprite, -half, -half, half * 2, half * 2)
          ctx.restore()
          ctx.save()
          ctx.globalAlpha = fade
          ctx.strokeStyle = propsRef.current.danger
          ctx.lineWidth = 2
          ctx.setLineDash([6, 5])
          ctx.beginPath()
          ctx.arc(shake.x + offset, shake.y, gearOuterRadius(shake.teeth) + 5, 0, 2 * Math.PI)
          ctx.stroke()
          ctx.restore()

          // The reason, in a danger pill above the refused spot.
          const label = refusalLabel(shake.reason)
          ctx.save()
          ctx.globalAlpha = fade
          ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textW = ctx.measureText(label).width
          const pillW = textW + 20
          const pillH = 22
          let lx = shake.x
          lx = Math.max(pillW / 2 + 8, Math.min(cssW - pillW / 2 - 8, lx))
          const ly = Math.max(pillH, shake.y - gearOuterRadius(shake.teeth) - 20)
          ctx.fillStyle = propsRef.current.danger
          ctx.beginPath()
          ctx.roundRect(lx - pillW / 2, ly - pillH / 2, pillW, pillH, pillH / 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(label, lx, ly)
          ctx.restore()
        }
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    // --- Pointer interaction -------------------------------------------------
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const hitTest = (x: number, y: number): Gear | null => {
      const { gears } = propsRef.current
      for (let i = gears.length - 1; i >= 0; i--) {
        const g = gears[i]!
        if (Math.hypot(x - g.x, y - g.y) <= gearOuterRadius(g.teeth)) return g
      }
      return null
    }

    let pendingMove: { id: string; teeth: number; x: number; y: number } | null = null

    const onPointerDown = (e: PointerEvent) => {
      const { drag, onSelect } = propsRef.current
      if (drag) return // a tray drag is in flight; drops only
      const { x, y } = toLocal(e)
      const hit = hitTest(x, y)
      onSelect(hit?.id ?? null)
      if (hit) pendingMove = { id: hit.id, teeth: hit.teeth, x, y }
    }

    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = toLocal(e)
      dragPosRef.current = { x, y, inside: true }
      if (pendingMove && !propsRef.current.drag) {
        if (Math.hypot(x - pendingMove.x, y - pendingMove.y) > 4) {
          propsRef.current.onStartMove(pendingMove.id, pendingMove.teeth)
          pendingMove = null
        }
      }
      const canvasEl = canvasRef.current!
      const hovering = hitTest(x, y)
      canvasEl.style.cursor = propsRef.current.drag
        ? 'grabbing'
        : hovering
          ? 'grab'
          : 'default'
    }

    const onPointerLeave = () => {
      if (dragPosRef.current) dragPosRef.current.inside = false
    }

    const onPointerUp = (e: PointerEvent) => {
      const { drag, onPlace, onMove, onDragEnd } = propsRef.current
      pendingMove = null
      if (!drag) return
      const { x, y } = toLocal(e)
      const verdict = evaluatePlacement(
        propsRef.current.gears,
        drag.teeth,
        x,
        y,
        drag.kind === 'move' ? drag.id : undefined,
        rotation,
      )
      if (verdict.valid) {
        if (drag.kind === 'new') onPlace(drag.teeth, verdict.x, verdict.y, verdict.partner?.id ?? null)
        else onMove(drag.id, verdict.x, verdict.y, verdict.partner?.id ?? null)
      } else {
        const reason = verdict.reason === 'ok' ? 'overlap' : verdict.reason
        shakeRef.current = {
          x: verdict.x,
          y: verdict.y,
          teeth: drag.teeth,
          reason,
          until: performance.now() + REFUSE_MS,
        }
        propsRef.current.onRefusal?.(reason)
      }
      onDragEnd()
      dragPosRef.current = null
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  return <canvas ref={canvasRef} className="machine-canvas" role="img" aria-label={props.ariaLabel} />
}
