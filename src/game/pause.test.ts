import { describe, expect, it } from 'vitest'
import { resolvePauseState } from './pause'

describe('pause state', () => {
  it('switches state only when the pause shortcut is newly pressed', () => {
    expect(resolvePauseState(false, false)).toBe(false)
    expect(resolvePauseState(false, true)).toBe(true)
    expect(resolvePauseState(true, true)).toBe(false)
  })
})
