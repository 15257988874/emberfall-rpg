import { describe, expect, test } from 'vitest'
import { readAudioMuted, toggleAudioMuted } from './audioState'

describe('audio preference state', () => {
  test('reads only the explicit muted marker', () => {
    expect(readAudioMuted('1')).toBe(true)
    expect(readAudioMuted('0')).toBe(false)
    expect(readAudioMuted(null)).toBe(false)
  })

  test('toggles the muted state', () => {
    expect(toggleAudioMuted(false)).toBe(true)
    expect(toggleAudioMuted(true)).toBe(false)
  })
})
