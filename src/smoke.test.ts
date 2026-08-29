import { describe, expect, it } from 'vitest'
import { APP_TITLE } from './App.tsx'

describe('scaffold', () => {
  it('exposes the app title', () => {
    expect(APP_TITLE).toBe('The Interlocking Gear Animator')
  })
})
