import { describe, expect, it } from 'vitest'
import { enemyCombatProfile, mitigateDamage } from './combat'

describe('combat rules', () => {
  it('gives each reference encounter role a distinct reach and cadence', () => {
    expect(enemyCombatProfile('crawler')).toMatchObject({ range: 1.8, damage: 8 })
    expect(enemyCombatProfile('hunter').range).toBeGreaterThan(enemyCombatProfile('crawler').range)
    expect(enemyCombatProfile('wraith').damageType).toBe('magic')
  })

  it('applies shield reduction before armor mitigation', () => {
    expect(mitigateDamage(20, 5, false)).toBe(15)
    expect(mitigateDamage(20, 5, true)).toBe(8)
  })
})
