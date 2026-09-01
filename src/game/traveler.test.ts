import { describe, expect, it } from 'vitest'
import { DEFAULT_TRAVELER_NAME, normalizeTravelerName } from './traveler'

describe('traveler identity', () => {
  it('trims a supplied traveler name and preserves readable characters', () => {
    expect(normalizeTravelerName('  灰烬旅者  ')).toBe('灰烬旅者')
  })

  it('uses the default identity for blank input and caps long names', () => {
    expect(normalizeTravelerName('  \n ')).toBe(DEFAULT_TRAVELER_NAME)
    expect(normalizeTravelerName('0123456789abcdef')).toHaveLength(12)
  })
})
