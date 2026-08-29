/**
 * localStorage persistence (R6): versioned envelope per key, ordered pure
 * migration chain, corruption quarantine, quota-safe writes.
 * Keys: gears.autosave + gears.slot.0..5. Save names render as text only.
 */

import type { Gear } from '../sim/gear.ts'

export const SCHEMA_VERSION = 1

export type SaveEnvelope = {
  v: number
  savedAt: number
  name?: string
  gears: Array<Pick<Gear, 'id' | 'teeth' | 'x' | 'y'>>
  driveId: string | null
  rpm: number
}

export const AUTOSAVE_KEY = 'gears.autosave'
export const SLOT_KEYS = Array.from({ length: 6 }, (_, i) => `gears.slot.${i}`)
export const SLOT_COUNT = 6

const migrations: Array<(old: SaveEnvelope) => SaveEnvelope> = []
function migrate(envelope: SaveEnvelope): SaveEnvelope {
  let current = envelope
  while (current.v < SCHEMA_VERSION) {
    const step = migrations[current.v]
    if (!step) break // unknown intermediate; keep as-is rather than throw
    current = step(current)
  }
  return current
}

function parseEnvelope(raw: string | null, key: string, storage: Storage): SaveEnvelope | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SaveEnvelope).v === 'number' &&
      Array.isArray((parsed as SaveEnvelope).gears)
    ) {
      const envelope = parsed as SaveEnvelope
      if (envelope.v > SCHEMA_VERSION) return null // newer than this build: ignore
      return migrate(envelope)
    }
    quarantine(storage, key, raw)
    return null
  } catch {
    quarantine(storage, key, raw)
    return null
  }
}

function quarantine(storage: Storage, key: string, raw: string) {
  try {
    storage.setItem(`${key}.corrupt`, raw)
  } catch {
    // Quota exhausted while quarantining: drop the backup silently.
  }
}

export function loadSave(storage: Storage, key: string): SaveEnvelope | null {
  return parseEnvelope(storage.getItem(key), key, storage)
}

export function writeSave(
  storage: Storage,
  key: string,
  envelope: SaveEnvelope,
): 'ok' | 'quota' {
  try {
    storage.setItem(key, JSON.stringify(envelope))
    return 'ok'
  } catch {
    return 'quota'
  }
}

export function makeEnvelope(
  gears: readonly Gear[],
  driveId: string | null,
  rpm: number,
  name?: string,
): SaveEnvelope {
  return {
    v: SCHEMA_VERSION,
    savedAt: Date.now(),
    name,
    gears: gears.map((g) => ({ id: g.id, teeth: g.teeth, x: g.x, y: g.y })),
    driveId,
    rpm,
  }
}

export function slotInfo(storage: Storage, index: number): { name: string; savedAt: number } | null {
  const envelope = loadSave(storage, SLOT_KEYS[index]!)
  if (!envelope) return null
  return { name: envelope.name ?? 'Untitled', savedAt: envelope.savedAt }
}
