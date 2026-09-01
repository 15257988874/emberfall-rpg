import { describe, expect, it } from 'vitest'
import { applyExperience, calculateCombatStats, createProgression, rollRelic } from './progression'

describe('progression', () => {
  it('levels up while carrying surplus experience into the next threshold', () => {
    const result = applyExperience(createProgression(), 135)
    expect(result.level).toBe(2)
    expect(result.experience).toBe(35)
  })

  it('rolls a deterministic rarity-scaled relic from threat and seed', () => {
    expect(rollRelic(3, 17)).toMatchObject({ tier: 'rare', power: 42 })
  })

  it('provides a viable baseline attack and scales both damage values with advancement', () => {
    const base = calculateCombatStats(createProgression())
    const advanced = calculateCombatStats({ ...createProgression(), level: 3, relics: [{ id: 'relic', tier: 'rare', power: 42 }, null, null, null, null, null] })

    expect(base).toEqual({ basicAttackDamage: 3, spellDamage: 5 })
    expect(advanced.basicAttackDamage).toBeGreaterThan(base.basicAttackDamage)
    expect(advanced.spellDamage).toBeGreaterThan(base.spellDamage)
  })
})
