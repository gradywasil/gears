import { useEffect, useRef } from 'react'
import { PALETTE } from '../sim/gear.ts'
import { gearOuterRadius } from '../render/involute.ts'
import { gearSprite } from '../render/spriteCache.ts'

export type TrayProps = {
  disabled: boolean
  onStartDrag: (teeth: number) => void
  /** Keyboard path: Enter/Space (or a click that never became a drag) places this gear. */
  onActivate: (teeth: number) => void
}

/** A palette chip: the real gear sprite, scaled down — what you drag is what you get. */
function TrayChip({
  teeth,
  onStartDrag,
  onActivate,
}: {
  teeth: number
  onStartDrag: (t: number) => void
  onActivate: (t: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const leftChip = useRef(false)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = 56
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    const sprite = gearSprite(teeth, dpr)
    const scale = (size - 6) / (gearOuterRadius(teeth) * 2)
    const w = (sprite.width / dpr) * scale
    ctx.drawImage(sprite, (size - w) / 2, (size - w) / 2, w, w)
  }, [teeth])

  return (
    <button
      type="button"
      className="tray-chip"
      onPointerDown={() => {
        leftChip.current = false
        onStartDrag(teeth)
      }}
      onPointerLeave={() => {
        leftChip.current = true
      }}
      onClick={() => {
        // A click that never became a drag (keyboard Enter/Space, or a tap in place).
        if (!leftChip.current) onActivate(teeth)
      }}
      aria-label={`Add ${teeth}-tooth gear`}
      aria-keyshortcuts="Enter"
    >
      <canvas ref={ref} width={56} height={56} aria-hidden="true" />
      <span className="tray-chip-label">{teeth}</span>
    </button>
  )
}

export function Tray({ disabled, onStartDrag, onActivate }: TrayProps) {
  return (
    <nav className="tray" aria-label="Gear palette" data-disabled={disabled || undefined}>
      {PALETTE.map((teeth) => (
        <TrayChip key={teeth} teeth={teeth} onStartDrag={onStartDrag} onActivate={onActivate} />
      ))}
    </nav>
  )
}
