import { describe, expect, it, beforeEach } from 'vitest'
import { makeGear } from '../sim/gear.ts'
import {
  AUTOSAVE_KEY,
  SLOT_KEYS,
  makeEnvelope,
  loadSave,
  writeSave,
  slotInfo,
  type SaveEnvelope,
} from './persistence.ts'

class MemoryStorage implements Storage {
  map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    if (value.length > 1000) throw new DOMException('quota', 'QuotaExceededError')
    this.map.set(key, value)
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('persistence', () => {
  it('round-trips a design through the envelope', () => {
    const gears = [makeGear('a', 24, 100, 100), makeGear('b', 10, 202, 100)]
    const envelope = makeEnvelope(gears, 'a', 45, 'My train')
    expect(writeSave(storage, AUTOSAVE_KEY, envelope)).toBe('ok')

    const loaded = loadSave(storage, AUTOSAVE_KEY)
    expect(loaded).not.toBeNull()
    expect(loaded!.v).toBe(1)
    expect(loaded!.name).toBe('My train')
    expect(loaded!.gears).toHaveLength(2)
    expect(loaded!.gears[1]).toEqual({ id: 'b', teeth: 10, x: 202, y: 100 })
    expect(loaded!.driveId).toBe('a')
    expect(loaded!.rpm).toBe(45)
  })

  it('carries the version field from day one', () => {
    const envelope = makeEnvelope([], null, 30)
    expect(envelope.v).toBe(1)
  })

  it('quarantines corrupt saves and falls back to empty', () => {
    storage.setItem(AUTOSAVE_KEY, '{not json')
    expect(loadSave(storage, AUTOSAVE_KEY)).toBeNull()
    expect(storage.getItem(`${AUTOSAVE_KEY}.corrupt`)).toBe('{not json')
  })

  it('quarantines shape-invalid payloads', () => {
    storage.setItem(AUTOSAVE_KEY, JSON.stringify({ hello: 'world' }))
    expect(loadSave(storage, AUTOSAVE_KEY)).toBeNull()
    expect(storage.getItem(`${AUTOSAVE_KEY}.corrupt`)).toBe(JSON.stringify({ hello: 'world' }))
  })

  it('ignores saves from a newer schema version', () => {
    const future: SaveEnvelope = { v: 99, savedAt: 1, gears: [], driveId: null, rpm: 30 }
    storage.setItem(AUTOSAVE_KEY, JSON.stringify(future))
    expect(loadSave(storage, AUTOSAVE_KEY)).toBeNull()
    // Newer saves are ignored, not destroyed:
    expect(storage.getItem(AUTOSAVE_KEY)).toBe(JSON.stringify(future))
  })

  it('reports quota failures instead of throwing', () => {
    const big = makeEnvelope(
      Array.from({ length: 50 }, (_, i) => makeGear(`g${i}`, 72, i * 10, 0)),
      null,
      30,
      'x'.repeat(500),
    )
    expect(writeSave(storage, AUTOSAVE_KEY, big)).toBe('quota')
  })

  it('keeps slot metadata readable without the full load', () => {
    const envelope = makeEnvelope([makeGear('a', 10, 0, 0)], 'a', 30, 'Snapshot 1')
    writeSave(storage, SLOT_KEYS[2]!, envelope)
    const info = slotInfo(storage, 2)
    expect(info?.name).toBe('Snapshot 1')
    expect(info?.savedAt).toBeGreaterThan(0)
    expect(slotInfo(storage, 0)).toBeNull()
  })
})
