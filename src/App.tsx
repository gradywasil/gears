import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { benchmarkSeed, startFpsMeter } from './dev/benchmark.ts'
import { MachineCanvas, type DragState, type MachineProps as MachineCanvasProps } from './render/MachineCanvas.tsx'
import { makeGear } from './sim/gear.ts'
import { solveTrain } from './sim/kinematics.ts'
import { evaluatePlacement, refusalLabel } from './sim/placement.ts'
import { initialMachineState, machineReducer } from './state/machine.ts'
import { AUTOSAVE_KEY, SLOT_KEYS, loadSave, makeEnvelope, writeSave } from './state/persistence.ts'
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
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const [pulse, setPulse] = useState<MachineCanvasProps['pulse']>(null)
  const [liveRefusal, setLiveRefusal] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const hydrated = useRef(false)
  const runningRef = useRef(initialRunning())
  const setRunning = useCallback((value: boolean) => {
    runningRef.current = value
    dispatch({ type: 'setRunning', value })
  }, [])

  /** Snapshot the whole machine (angles included) for one-step Undo. */
  const designSnapshot = useCallback(() => {
    return {
      gears: state.gears,
      angles: state.angles,
      driveId: state.driveId,
      rpm: state.rpm,
    }
  }, [state])
  const restoreSnapshot = useCallback((snapshot: ReturnType<typeof designSnapshot>) => {
    // Hydrate recomputes phases from geometry — consistent by construction.
    dispatch({
      type: 'hydrate',
      gears: snapshot.gears,
      driveId: snapshot.driveId,
      rpm: snapshot.rpm,
      running: runningRef.current,
    })
  }, [])

  const deleteGear = useCallback(
    (id: string) => {
      const snapshot = designSnapshot()
      dispatch({ type: 'delete', id })
      setToast({
        message: 'Gear deleted',
        undo: () => {
          restoreSnapshot(snapshot)
          setToast(null)
        },
      })
    },
    [designSnapshot, restoreSnapshot],
  )

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
      if (result === 'quota') setToast({ message: 'Couldn’t save — browser storage is full.' })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [state.gears, state.driveId, state.rpm])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 6000 : 3500)
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

  // Keyboard: Esc closes overlays, Space runs/pauses, Delete removes, arrows nudge.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') {
        if (savesOpen) setSavesOpen(false)
        else if (state.selectedId) dispatch({ type: 'select', id: null })
        return
      }
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        toggleRun()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        deleteGear(state.selectedId)
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
      } else if (verdict.reason !== 'ok') {
        setPulse({ x: gear.x, y: gear.y, teeth: gear.teeth, reason: verdict.reason, at: Date.now() })
        setLiveRefusal(refusalLabel(verdict.reason))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selectedId, state.gears, state.angles, savesOpen, deleteGear, toggleRun])

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
  const onSelect = useCallback((id: string | null) => {
    setLiveRefusal(null)
    dispatch({ type: 'select', id })
  }, [])
  const onStartMove = useCallback((id: string, teeth: number) => setDrag({ kind: 'move', id, teeth }), [])

  /**
   * Keyboard placement (critique adapt): place a gear from the tray at the
   * canvas center, spiraling outward until a valid spot (or snap) is found.
   */
  const placeFromTrayActivate = useCallback(
    (teeth: number) => {
      const canvas = document.querySelector('.machine-canvas') as HTMLCanvasElement | null
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const angles = new Map(Object.entries(state.angles))
      for (const r of [0, 90, 180, 270, 380]) {
        const steps = r === 0 ? 1 : 8
          for (let i = 0; i < steps; i++) {
          const a = (i / steps) * 2 * Math.PI + (r === 0 ? 0 : Math.PI / 8)
          const x = cx + r * Math.cos(a)
          const y = cy + r * Math.sin(a)
          const verdict = evaluatePlacement(state.gears, teeth, x, y, undefined, angles)
          if (verdict.valid) {
            dispatch({
              type: 'place',
              gear: makeGear(crypto.randomUUID(), teeth, verdict.x, verdict.y),
              partnerId: verdict.partner?.id ?? null,
            })
            return
          }
        }
      }
      setToast({ message: 'No room on the bench for that gear.' })
    },
    [state.gears, state.angles],
  )

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
            className="icon-button"
            onClick={() => setShortcutsOpen((v) => !v)}
            aria-expanded={shortcutsOpen}
            aria-label="Keyboard shortcuts"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M9.4 9.2a2.9 2.9 0 1 1 4.4 2.5c-.9.6-1.8 1.1-1.8 2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="17.6" r="0.9" fill="currentColor" />
            </svg>
          </button>
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
        <Tray
          disabled={driveMissing}
          onStartDrag={(teeth) => setDrag({ kind: 'new', teeth })}
          onActivate={placeFromTrayActivate}
        />
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
            pulse={pulse}
            onRefusal={(reason) => setLiveRefusal(refusalLabel(reason))}
            ariaLabel={`Gear train canvas. ${state.gears.length} gear${state.gears.length === 1 ? '' : 's'}${state.driveId && running ? `, spinning at ${state.rpm} RPM drive speed` : ''}.`}
          />
          <div className="sr-only" aria-live="polite">
            {liveRefusal
              ? liveRefusal
              : selected
                ? selected.id === state.driveId
                  ? `Drive gear selected: ${selected.teeth} teeth at ${state.rpm} RPM.`
                  : spins.has(selected.id)
                    ? `Selected ${selected.teeth}-tooth gear: ${spins.get(selected.id)!.rpm.toFixed(1)} RPM, ×${spins.get(selected.id)!.torqueMultiplier.toFixed(1)} torque.`
                    : `Selected ${selected.teeth}-tooth gear: stationary.`
                : ''}
          </div>
          {state.gears.length === 0 && (
            <div className="first-run">
              <p>Drag a gear from the tray onto the bench.</p>
              <p className="dim">Or focus a tray gear and press Enter. The first gear becomes the drive.</p>
            </div>
          )}
          {driveMissing && (
            <div className="drive-missing" role="status">
              The drive gear was removed. Click a gear and choose <strong>Set as drive</strong>.
            </div>
          )}
          {state.driveId !== null && !running && !driveMissing && (
            <div className="paused-pill mono" role="status">
              Paused
            </div>
          )}
          {selected && (
            <Inspector
              gear={selected}
              spin={spins.get(selected.id) ?? null}
              isDrive={selected.id === state.driveId}
              onSetDrive={() => dispatch({ type: 'setDrive', id: selected.id })}
              onDelete={() => deleteGear(selected.id)}
              onClose={() => dispatch({ type: 'select', id: null })}
            />
          )}
          <Saves
            open={savesOpen}
            gears={state.gears}
            driveId={state.driveId}
            rpm={state.rpm}
            onRestore={(envelope) => {
              const snapshot = designSnapshot()
              dispatch({
                type: 'hydrate',
                gears: envelope.gears.map((g) => makeGear(g.id, g.teeth, g.x, g.y)),
                driveId: envelope.driveId,
                rpm: envelope.rpm,
                running: running,
              })
              setToast({
                message: 'Design restored',
                undo: () => {
                  restoreSnapshot(snapshot)
                  setToast(null)
                },
              })
            }}
            onClose={() => setSavesOpen(false)}
            onQuota={() => setToast({ message: 'Couldn’t save — browser storage is full.' })}
            onSlotSaved={(index, previous) => {
              if (!previous) return
              setToast({
                message: `Slot ${index + 1} updated`,
                undo: () => {
                  writeSave(localStorage, SLOT_KEYS[index]!, previous)
                  setToast(null)
                },
              })
            }}
            onSlotDeleted={(index, envelope) => {
              setToast({
                message: `Slot ${index + 1} deleted`,
                undo: () => {
                  writeSave(localStorage, SLOT_KEYS[index]!, envelope)
                  setToast(null)
                },
              })
            }}
          />
          {shortcutsOpen && (
            <section className="shortcuts-panel" aria-label="Keyboard shortcuts">
              <header>
                <h2>Shortcuts</h2>
                <button type="button" className="icon-button" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </header>
              <dl>
                <div><dt>Enter</dt><dd>place the focused tray gear</dd></div>
                <div><dt>Drag</dt><dd>place or re-mesh a gear</dd></div>
                <div><dt>Arrow keys</dt><dd>nudge the selected gear</dd></div>
                <div><dt>Shift + arrows</dt><dd>nudge farther</dd></div>
                <div><dt>Delete</dt><dd>remove the selected gear</dd></div>
                <div><dt>Space</dt><dd>run / pause the machine</dd></div>
                <div><dt>Esc</dt><dd>close panels and selection</dd></div>
              </dl>
            </section>
          )}
          {toast && (
            <div className="toast" role="status">
              <span>{toast.message}</span>
              {toast.undo && (
                <button
                  type="button"
                  className="toast-undo"
                  onClick={toast.undo}
                >
                  Undo
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
