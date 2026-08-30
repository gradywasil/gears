import { describe, expect, it } from 'vitest'
import { SoundEngine, meshPitchHz, storedSoundPref } from './engine.ts'

describe('sound engine helpers', () => {
  it('maps the smaller gear to a brighter tick filter', () => {
    expect(meshPitchHz(10)).toBeCloseTo(3000)
    expect(meshPitchHz(72)).toBeCloseTo(650)
    expect(meshPitchHz(24)).toBeGreaterThan(meshPitchHz(42))
    // Out-of-range counts clamp, never blow up the filter.
    expect(meshPitchHz(4)).toBeCloseTo(3000)
    expect(meshPitchHz(300)).toBeCloseTo(650)
  })

  it('defaults to on when no preference is stored (or storage is absent)', () => {
    expect(storedSoundPref()).toBe(null) // node has no localStorage; guarded
    expect(new SoundEngine().isEnabled()).toBe(true)
  })
})
