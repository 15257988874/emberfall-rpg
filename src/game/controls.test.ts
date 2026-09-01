import { describe, expect, it } from 'vitest'
import { shouldQueueAction } from './controls'

describe('combat input queueing', () => {
  it('allows repeated space keydown events so a held basic attack continues through cooldowns', () => {
    expect(shouldQueueAction('Space', false)).toBe(true)
    expect(shouldQueueAction('Space', true)).toBe(true)
  })

  it('keeps utility abilities as one-shot actions while a key remains held', () => {
    expect(shouldQueueAction('KeyF', false)).toBe(true)
    expect(shouldQueueAction('KeyF', true)).toBe(false)
  })

  it('keeps the pause shortcut edge-triggered while escape remains held', () => {
    expect(shouldQueueAction('Escape', false)).toBe(true)
    expect(shouldQueueAction('Escape', true)).toBe(false)
  })
})
