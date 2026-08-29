import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { benchmarkSeed, startFpsMeter } from './dev/benchmark.ts'
import { MachineCanvas, type DragState } from './render/MachineCanvas.tsx'
import { makeGear } from './sim/gear.ts'
import { solveTrain } from './sim/kinematics.ts'
import { evaluatePlacement } from './sim/placement.ts'
import { initialMachineState, machineReducer } from './state/machine.ts'
import { AUTOSAVE_KEY, loadSave, makeEnvelope, writeSave } from './state/persistence.ts'
import { Controls } from './ui/Controls.tsx'
import { Inspector } from './ui/Inspector.tsx'
import { Saves } from './ui/Saves.tsx'
import { Tray } from './ui/Tray.tsx'

export const APP_TITLE = 'The Interlocking Gear Animator'

const ACCENT = '#C63D0F'
const DANGER = '#B3261E'
const MOTION_PREF_KEY = 'gears.motion'

/**
 * R5: pause-by-default under prefers-reduced-motion; an explicit persisted
 * user choice ('on'/'off') outranks the OS setting. Without either, the
 * machine always spins once a drive exists (town-hall D14).
 */
function initialRunning(): boolean {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(MOTION_PREF_KEY)
  } catch {
    // Storage unavailable: fall through to the OS setting.
  }
  if (stored === 'on') return true
  if (stored === 'off') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function App() {
  const [state, dispatch] = useReducer(machineReducer, undefined, initialMachineState)
  const [drag, setDrag] = useState<DragState>(null)
  const [savesOpen, setSavesOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const hydrated = useRef(false)
  const runningRef = useRef(initialRunning())
  const setRunning = useCallback((value: boolean) => {
    runningRef.current = value
    dispatch({ type: 'setRunning', value })
  }, [])

  // --- Hydrate from autosave once (T12). Angles realign from the drive.
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const envelope = loadSave(localStorage, AUTOSAVE_KEY)
      if (envelope && envelope.gears.length > 0) {
        dispatch({
          type: 'hydrate',
          gears: envelope.gears.map((g) => makeGear(g.id, g.teeth, g.x, g.y)),
          driveId: envelope.driveId,
          rpm: envelope.rpm,
          running: runningRef.current,
        })
        return
      }
    } catch {
      // Corrupt autosave already quarantined by the loader; start empty.
    }
    dispatch({ type: 'setRunning', value: runningRef.current })
  }, [])

  // Reduced-motion: follow the OS live while the user has no stored preference.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null
      try {
        stored = localStorage.getItem(MOTION_PREF_KEY)
      } catch {
        /* follow the OS */
      }
      if (stored === 'on' || stored === 'off') return
      setRunning(!event.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setRunning])

  /**
   * Session pause/play (WCAG 2.2.2). For reduced-motion users the choice also
   * persists as their override of the OS setting (R5).
   */
  const toggleRun = useCallback(() => {
    const next = !runningRef.current
    runningRef.current = next
    const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let stored: string | null = null
    try {
      stored = localStorage.getItem(MOTION_PREF_KEY)
    } catch {
      /* session-only */
    }
    if (osReduce || stored === 'on' || stored === 'off') {
      try {
        localStorage.setItem(MOTION_PREF_KEY, next ? 'on' : 'off')
      } catch {
        // Session-only; the machine still responds immediately.
      }
    }
    dispatch({ type: 'setRunning', value: next })
  }, [])

  // --- Autosave (debounced) on every design change.
  useEffect(() => {
    if (!hydrated.current) return
    const timer = window.setTimeout(() => {
      const result = writeSave(
        localStorage,
        AUTOSAVE_KEY,
        makeEnvelope(state.gears, state.driveId, state.rpm),
      )
      if (result === 'quota') setToast('Couldn’t save — browser storage is full.')
    }, 500)
    return () => window.clearTimeout(timer)
  }, [state.gears, state.driveId, state.rpm])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

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
        new Map(Object.entries(state.angles)),
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
  }, [state.selectedId, state.gears, state.angles])

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

  const running = state.running

  // Dev-only test hook (R4): state assertions for e2e without pixel scraping.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).__gears = {
      gears: () => state.gears,
      driveId: () => state.driveId,
      rpm: () => state.rpm,
      running: () => running,
      selectedId: () => state.selectedId,
      angles: () => state.angles,
      place: (teeth: number, x: number, y: number) =>
        dispatch({ type: 'place', gear: makeGear(crypto.randomUUID(), teeth, x, y), partnerId: null }),
    }
  })

  // Dev-only benchmark (T15): ?benchmark seeds a 23-gear train and reports fps.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (!window.location.search.includes('benchmark')) return
    const seed = benchmarkSeed()
    dispatch({
      type: 'hydrate',
      gears: seed,
      driveId: seed[0]!.id,
      rpm: 60,
      running: true,
    })
    startFpsMeter()
  }, [])

  return (
    <div className="app">
      <header className="top-bar">
        <h1>{APP_TITLE}</h1>
        <div className="top-bar-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSavesOpen((v) => !v)}
            aria-expanded={savesOpen}
          >
            Saves
          </button>
          <Controls
            rpm={state.rpm}
            running={running}
            hasDrive={state.driveId !== null}
            onRpmChange={(value) => dispatch({ type: 'setRpm', value })}
            onToggleRun={toggleRun}
          />
        </div>
      </header>
      <div className="workbench">
        <Tray disabled={driveMissing} onStartDrag={(teeth) => setDrag({ kind: 'new', teeth })} />
        <main className="canvas-holder">
          <MachineCanvas
            gears={state.gears}
            spins={spins}
            angles={state.angles}
            anglesVersion={state.anglesVersion}
            running={running}
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
          <Saves
            open={savesOpen}
            gears={state.gears}
            driveId={state.driveId}
            rpm={state.rpm}
            onRestore={(envelope) =>
              dispatch({
                type: 'hydrate',
                gears: envelope.gears.map((g) => makeGear(g.id, g.teeth, g.x, g.y)),
                driveId: envelope.driveId,
                rpm: envelope.rpm,
                running: running,
              })
            }
            onClose={() => setSavesOpen(false)}
            onQuota={() => setToast('Couldn’t save — browser storage is full.')}
          />
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
