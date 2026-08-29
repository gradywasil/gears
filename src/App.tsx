import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { MachineCanvas, type DragState } from './render/MachineCanvas.tsx'
import { makeGear } from './sim/gear.ts'
import { solveTrain } from './sim/kinematics.ts'
import { evaluatePlacement } from './sim/placement.ts'
import { initialMachineState, machineReducer } from './state/machine.ts'
import { Controls } from './ui/Controls.tsx'
import { Inspector } from './ui/Inspector.tsx'
import { Tray } from './ui/Tray.tsx'

export const APP_TITLE = 'The Interlocking Gear Animator'

const ACCENT = '#C63D0F'
const DANGER = '#B3261E'

export function App() {
  const [state, dispatch] = useReducer(machineReducer, undefined, initialMachineState)
  const [drag, setDrag] = useState<DragState>(null)

  const spins = useMemo(
    () => (state.driveId ? solveTrain(state.gears, state.driveId, state.rpm) : new Map()),
    [state.gears, state.driveId, state.rpm],
  )

  const selected =
    state.selectedId !== null ? (state.gears.find((g) => g.id === state.selectedId) ?? null) : null
  const driveMissing = state.gears.length > 0 && state.driveId === null

  // Tray drags may end outside the canvas; clear them without dropping.
  useEffect(() => {
    if (!drag) return
    const end = () => setDrag(null)
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [drag])

  // Keyboard: delete the selection, nudge it (Shift = larger steps).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        dispatch({ type: 'delete', id: state.selectedId })
        return
      }
      const nudges: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const nudge = nudges[e.key]
      if (!nudge || !state.selectedId) return
      e.preventDefault()
      const gear = state.gears.find((g) => g.id === state.selectedId)
      if (!gear) return
      const step = e.shiftKey ? 12 : 2
      const verdict = evaluatePlacement(
        state.gears,
        gear.teeth,
        gear.x + nudge[0] * step,
        gear.y + nudge[1] * step,
        gear.id,
      )
      if (verdict.valid) {
        dispatch({
          type: 'move',
          id: gear.id,
          x: verdict.x,
          y: verdict.y,
          partnerId: verdict.partner?.id ?? null,
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selectedId, state.gears])

  const onPlace = useCallback(
    (teeth: number, x: number, y: number, partnerId: string | null) => {
      dispatch({ type: 'place', gear: makeGear(crypto.randomUUID(), teeth, x, y), partnerId })
    },
    [],
  )
  const onMove = useCallback(
    (id: string, x: number, y: number, partnerId: string | null) => {
      dispatch({ type: 'move', id, x, y, partnerId })
    },
    [],
  )
  const onSelect = useCallback((id: string | null) => dispatch({ type: 'select', id }), [])
  const onStartMove = useCallback((id: string, teeth: number) => setDrag({ kind: 'move', id, teeth }), [])

  return (
    <div className="app">
      <header className="top-bar">
        <h1>{APP_TITLE}</h1>
        <Controls
          rpm={state.rpm}
          running={state.running}
          hasDrive={state.driveId !== null}
          onRpmChange={(value) => dispatch({ type: 'setRpm', value })}
          onToggleRun={() => dispatch({ type: 'setRunning', value: !state.running })}
        />
      </header>
      <div className="workbench">
        <Tray disabled={driveMissing} onStartDrag={(teeth) => setDrag({ kind: 'new', teeth })} />
        <main className="canvas-holder">
          <MachineCanvas
            gears={state.gears}
            spins={spins}
            angles={state.angles}
            anglesVersion={state.anglesVersion}
            running={state.running}
            driveId={state.driveId}
            selectedId={state.selectedId}
            drag={drag}
            accent={ACCENT}
            danger={DANGER}
            onPlace={onPlace}
            onMove={onMove}
            onSelect={onSelect}
            onStartMove={onStartMove}
            onDragEnd={() => setDrag(null)}
          />
          {state.gears.length === 0 && (
            <div className="first-run">
              <p>Drag a gear from the tray onto the bench.</p>
              <p className="dim">The first gear becomes the drive.</p>
            </div>
          )}
          {driveMissing && (
            <div className="drive-missing" role="status">
              The drive gear was removed. Click a gear and choose <strong>Set as drive</strong>.
            </div>
          )}
          {selected && (
            <Inspector
              gear={selected}
              spin={spins.get(selected.id) ?? null}
              isDrive={selected.id === state.driveId}
              onSetDrive={() => dispatch({ type: 'setDrive', id: selected.id })}
              onDelete={() => dispatch({ type: 'delete', id: selected.id })}
              onClose={() => dispatch({ type: 'select', id: null })}
            />
          )}
        </main>
      </div>
    </div>
  )
}
