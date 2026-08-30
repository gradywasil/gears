import { useMemo, useState } from 'react'
import type { Gear } from '../sim/gear.ts'
import {
  SLOT_COUNT,
  loadSave,
  makeEnvelope,
  slotInfo,
  writeSave,
  SLOT_KEYS,
  type SaveEnvelope,
} from '../state/persistence.ts'

export type SavesProps = {
  open: boolean
  gears: readonly Gear[]
  driveId: string | null
  rpm: number
  onRestore: (envelope: SaveEnvelope) => void
  onClose: () => void
  onQuota: () => void
  /** Called after a save that overwrote an occupied slot (previous envelope handed back for Undo). */
  onSlotSaved: (index: number, previous: SaveEnvelope | null) => void
  /** Called after a slot deletion (envelope handed back for Undo). */
  onSlotDeleted: (index: number, envelope: SaveEnvelope) => void
}

export function Saves({
  open,
  gears,
  driveId,
  rpm,
  onRestore,
  onClose,
  onQuota,
  onSlotSaved,
  onSlotDeleted,
}: SavesProps) {
  const [version, setVersion] = useState(0)
  const [names, setNames] = useState<string[]>(Array.from({ length: SLOT_COUNT }, () => ''))
  // localStorage reads are idempotent; version bumps on every save/delete.
  const infos = useMemo(
    () => (open ? Array.from({ length: SLOT_COUNT }, (_, i) => slotInfo(localStorage, i)) : []),
    [open, version],
  )
  if (!open) return null

  const saveTo = (index: number) => {
    const name = names[index]?.trim() || infos[index]?.name || `Design ${index + 1}`
    const previous = loadSave(localStorage, SLOT_KEYS[index]!)
    const result = writeSave(
      localStorage,
      SLOT_KEYS[index]!,
      makeEnvelope(gears, driveId, rpm, name),
    )
    if (result === 'quota') onQuota()
    else onSlotSaved(index, previous)
    setVersion((v) => v + 1)
  }

  const remove = (index: number) => {
    const envelope = loadSave(localStorage, SLOT_KEYS[index]!)
    localStorage.removeItem(SLOT_KEYS[index]!)
    if (envelope) onSlotDeleted(index, envelope)
    setVersion((v) => v + 1)
  }

  return (
    <section className="saves-panel" aria-label="Saved designs">
      <header>
        <h2>Saves</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close saves">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="slot-grid">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const info = infos[i]
          if (info) {
            return (
              <article key={i} className="slot-card">
                <div className="slot-card-body">
                  <span className="slot-name">{info.name}</span>
                  <span className="slot-date">{new Date(info.savedAt).toLocaleDateString()}</span>
                </div>
                <div className="slot-card-actions">
                  <div className="slot-restore-group">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        const envelope = loadSave(localStorage, SLOT_KEYS[i]!)
                        if (envelope) onRestore(envelope)
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="secondary-button slot-update"
                      onClick={() => saveTo(i)}
                      aria-label={`Overwrite save slot ${i + 1} with the current design`}
                    >
                      Update
                    </button>
                  </div>
                  <button
                    type="button"
                    className="icon-button slot-delete"
                    onClick={() => remove(i)}
                    aria-label={`Delete save slot ${i + 1}`}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </article>
            )
          }
          return (
            <article key={i} className="slot-card slot-empty">
              <input
                type="text"
                value={names[i] ?? ''}
                placeholder={`Design ${i + 1}`}
                onChange={(e) => {
                  const next = [...names]
                  next[i] = e.target.value
                  setNames(next)
                }}
                aria-label={`Name for save slot ${i + 1}`}
              />
              <button type="button" className="secondary-button" onClick={() => saveTo(i)}>
                Save
              </button>
            </article>
          )
        })}
      </div>
      <footer className="saves-foot">The bench autosaves continuously.</footer>
    </section>
  )
}
