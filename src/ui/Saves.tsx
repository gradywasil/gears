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
}

export function Saves({ open, gears, driveId, rpm, onRestore, onClose, onQuota }: SavesProps) {
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
    const result = writeSave(
      localStorage,
      SLOT_KEYS[index]!,
      makeEnvelope(gears, driveId, rpm, name),
    )
    if (result === 'quota') onQuota()
    setVersion((v) => v + 1)
  }

  const restore = (index: number) => {
    const envelope = loadSave(localStorage, SLOT_KEYS[index]!)
    if (envelope) onRestore(envelope)
    onClose()
  }

  const remove = (index: number) => {
    localStorage.removeItem(SLOT_KEYS[index]!)
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
      <ul>
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const info = infos[i]
          return (
            <li key={i}>
              <input
                type="text"
                value={names[i] ?? ''}
                placeholder={info?.name ?? `Design ${i + 1}`}
                onChange={(e) => {
                  const next = [...names]
                  next[i] = e.target.value
                  setNames(next)
                }}
                aria-label={`Name for save slot ${i + 1}`}
              />
              <span className="slot-date">
                {info ? new Date(info.savedAt).toLocaleDateString() : 'empty'}
              </span>
              <button type="button" className="secondary-button" onClick={() => saveTo(i)}>
                Save
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => restore(i)}
                disabled={!info}
              >
                Restore
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => remove(i)}
                disabled={!info}
                aria-label={`Delete save slot ${i + 1}`}
              >
                Delete
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
