import { describe, expect, test } from 'vitest'
import { applyRuneChoice, createRuneDraft, runeDamageMultiplier, runeEffect, type RuneRanks } from './rune'

describe('rune choices', () => {
  test('creates three distinct choices and excludes maxed ranks', () => {
    const ranks: RuneRanks = { attack_chain: 3 }
    const draft = createRuneDraft(17, ranks)

    expect(draft).toHaveLength(3)
    expect(new Set(draft.map((rune) => rune.id)).size).toBe(3)
    expect(draft.every((rune) => rune.id !== 'attack_chain')).toBe(true)

    const shortDraft = createRuneDraft(17, {
      attack_chain: 3,
      attack_burst: 3,
      attack_haste: 3,
      nova_echo: 3,
      nova_vortex: 3,
      nova_overload: 3,
      dash_blast: 3,
    })
    expect(new Set(shortDraft.map((rune) => rune.id)).size).toBe(shortDraft.length)
  })

  test('applies one choice without exceeding its rank cap', () => {
    const ranks: RuneRanks = { attack_haste: 2 }

    expect(applyRuneChoice(ranks, 'attack_haste')).toEqual({ attack_haste: 3 })
    expect(applyRuneChoice(ranks, 'attack_haste')).toEqual({ attack_haste: 3 })
  })

  test('scales skill damage from the selected rune family', () => {
    const ranks: RuneRanks = { attack_burst: 2, nova_overload: 1 }

    expect(runeDamageMultiplier('attack', ranks)).toBeCloseTo(1.32)
    expect(runeDamageMultiplier('nova', ranks)).toBeCloseTo(1.18)
    expect(runeDamageMultiplier('ward', ranks)).toBe(1)
  })

  test('exposes bounded runtime effects for cooldown, radius, chain, and healing runes', () => {
    const ranks: RuneRanks = { attack_chain: 2, dash_phase: 3, nova_overload: 2, ward_heal: 1 }

    expect(runeEffect(ranks, 'attack_chain')).toEqual(2)
    expect(runeEffect(ranks, 'dash_phase')).toBeCloseTo(1.65)
    expect(runeEffect(ranks, 'nova_overload')).toBeCloseTo(0.9)
    expect(runeEffect(ranks, 'ward_heal')).toBe(7)
    expect(runeEffect({}, 'dash_blast')).toBe(0)
    expect(runeEffect({}, 'ward_pulse')).toBe(0)
    expect(runeEffect({ nova_echo: 1 }, 'nova_echo')).toBeCloseTo(0.48)
    expect(runeEffect(ranks, 'missing')).toBe(0)
  })
})
