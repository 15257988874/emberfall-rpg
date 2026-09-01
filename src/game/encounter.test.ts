import { describe, expect, it } from 'vitest'
import { calculateEncounterRewards, createEncounter, recordEnemyDefeat } from './encounter'

describe('encounter rules', () => {
  it('creates a seven-enemy threat-one encounter with every combat role represented', () => {
    const encounter = createEncounter('crystal-wastes', 1, 19)

    expect(encounter.enemies).toHaveLength(7)
    expect(new Set(encounter.enemies.map((enemy) => enemy.kind)).size).toBe(4)
    expect(encounter.cleansed).toBe(false)
  })

  it('replaces one regular enemy with a boss at each fourth regional threat', () => {
    const regularEncounter = createEncounter('crystal-wastes', 3, 19)
    const bossEncounter = createEncounter('crystal-wastes', 4, 19)

    expect(regularEncounter.enemies.some((enemy) => enemy.kind === 'boss')).toBe(false)
    expect(bossEncounter.enemies).toHaveLength(7)
    expect(bossEncounter.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(1)
  })

  it('cleanses the encounter only when the final enemy is defeated', () => {
    let encounter = createEncounter('rusted-hollows', 1, 6)
    encounter.enemies.slice(0, -1).forEach((enemy) => { encounter = recordEnemyDefeat(encounter, enemy.id) })
    expect(encounter.cleansed).toBe(false)

    encounter = recordEnemyDefeat(encounter, encounter.enemies.at(-1)!.id)
    expect(encounter.cleansed).toBe(true)
    expect(encounter.cleansedCount).toBe(1)
  })

  it('scales experience, ember, and score rewards with enemy role and threat', () => {
    expect(calculateEncounterRewards('boss', 3)).toEqual({ experience: 210, embers: 75, score: 1200 })
    expect(calculateEncounterRewards('crawler', 1)).toEqual({ experience: 12, embers: 4, score: 80 })
  })
})
