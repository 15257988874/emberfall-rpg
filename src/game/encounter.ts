/** Identifies the combat behavior and reward profile of an encounter enemy. */
export type EncounterEnemyKind = 'crawler' | 'brute' | 'wraith' | 'hunter' | 'boss'

/** Defines deterministic spawn data for one enemy in a regional encounter. */
export interface EncounterEnemy {
  /** Stable id used to record an individual defeat exactly once. */
  id: string
  /** Enemy combat role. */
  kind: EncounterEnemyKind
  /** X coordinate relative to the current region origin. */
  x: number
  /** Z coordinate relative to the current region origin. */
  z: number
  /** Whether this enemy has already contributed a reward. */
  defeated: boolean
}

/** Represents one local-zone objective and its deterministic spawn set. */
export interface Encounter {
  /** Procedural biome key owning this objective. */
  biome: string
  /** Difficulty level used for enemy durability and rewards. */
  threat: number
  /** Regional enemies that must be defeated for cleansing. */
  enemies: EncounterEnemy[]
  /** Whether all encounter enemies have been defeated. */
  cleansed: boolean
  /** Number of completed cleanses represented by this record. */
  cleansedCount: number
}

/** Aggregated player gains awarded for one defeated enemy. */
export interface EncounterRewards {
  /** Experience granted toward the next player level. */
  experience: number
  /** Ember currency granted for progression and loot. */
  embers: number
  /** Score added to the active run and leaderboards. */
  score: number
}

/**
 * Creates a deterministic regional encounter containing all four regular enemy roles.
 *
 * @param biome - Procedural biome key used by the later world renderer.
 * @param threat - Positive regional difficulty level.
 * @param seed - Stable integer seed used for repeatable spawn positions.
 * @returns {Encounter} Unfinished regional objective with seven living enemies.
 * @sideEffects None.
 */
export function createEncounter(biome: string, threat: number, seed: number): Encounter {
  const normalizedThreat = Math.max(1, Math.floor(threat))
  const enemyKinds: EncounterEnemyKind[] = ['crawler', 'crawler', 'brute', 'wraith', 'hunter', 'crawler', 'wraith']
  // Every fourth zone culminates in one stronger focal target while preserving the seven-unit objective contract.
  if (normalizedThreat % 4 === 0) enemyKinds[2] = 'boss'
  let random = Math.abs(seed) || 1
  const nextRandom = (): number => {
    random = (random * 16807) % 2147483647
    return (random - 1) / 2147483646
  }
  return {
    biome,
    threat: normalizedThreat,
    enemies: enemyKinds.map((kind, index) => ({
      id: `${biome}-${seed}-${index}`,
      kind,
      x: (nextRandom() - 0.5) * 15,
      z: -5 - nextRandom() * 11,
      defeated: false,
    })),
    cleansed: false,
    cleansedCount: 0,
  }
}

/**
 * Marks one matching enemy defeated and completes the objective only after the final defeat.
 *
 * @param encounter - Existing regional objective to update immutably.
 * @param enemyId - Stable id of the enemy that was defeated.
 * @returns {Encounter} Updated encounter with duplicate or unknown ids ignored.
 * @sideEffects None.
 */
export function recordEnemyDefeat(encounter: Encounter, enemyId: string): Encounter {
  if (encounter.cleansed) return encounter
  const enemies = encounter.enemies.map((enemy) => enemy.id === enemyId ? { ...enemy, defeated: true } : enemy)
  const cleansed = enemies.every((enemy) => enemy.defeated)
  return { ...encounter, enemies, cleansed, cleansedCount: encounter.cleansedCount + Number(cleansed) }
}

/**
 * Converts a defeated role and regional threat into experience, ember, and score rewards.
 *
 * @param kind - Defeated enemy combat role.
 * @param threat - Positive regional difficulty level.
 * @returns {EncounterRewards} Deterministic rewards for a single enemy defeat.
 * @sideEffects None.
 */
export function calculateEncounterRewards(kind: EncounterEnemyKind, threat: number): EncounterRewards {
  const multiplier = Math.max(1, Math.floor(threat))
  const base = {
    crawler: { experience: 12, embers: 4, score: 80 },
    wraith: { experience: 16, embers: 6, score: 100 },
    hunter: { experience: 20, embers: 8, score: 130 },
    brute: { experience: 25, embers: 10, score: 160 },
    boss: { experience: 70, embers: 25, score: 1200 },
  }[kind]
  return { experience: base.experience * multiplier, embers: base.embers * multiplier, score: base.score }
}
