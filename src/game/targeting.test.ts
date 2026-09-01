import { describe, expect, it } from 'vitest'
import { canReleaseFirebolt, resolveLockedTarget } from './targeting'

describe('enemy target locking', () => {
  it('prefers a newly clicked living enemy and clears a target that has been defeated', () => {
    expect(resolveLockedTarget('crawler-0', 'hunter-3', ['crawler-0', 'hunter-3'])).toBe('hunter-3')
    expect(resolveLockedTarget('hunter-3', null, ['crawler-0'])).toBeNull()
  })

  it('retains a living selected enemy between pointer events', () => {
    expect(resolveLockedTarget('wraith-1', null, ['wraith-1', 'brute-2'])).toBe('wraith-1')
  })
})

describe('automatic firebolt delivery', () => {
  it('releases only for an in-range living lock after its independent cooldown ends', () => {
    expect(canReleaseFirebolt('wraith-1', 11.9, 0)).toBe(true)
    expect(canReleaseFirebolt('wraith-1', 12.01, 0)).toBe(false)
    expect(canReleaseFirebolt('wraith-1', 8, 0.01)).toBe(false)
    expect(canReleaseFirebolt(null, 2, 0)).toBe(false)
  })
})
