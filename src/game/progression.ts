/** Enumerates the four equipment qualities used by encounter loot. */
export type RelicTier = 'normal' | 'rare' | 'epic' | 'legendary'

/** Represents an equippable procedurally generated relic. */
export interface Relic {
  /** Stable generated relic identifier. */
  id: string
  /** Quality tier that controls color and combat power. */
  tier: RelicTier
  /** Aggregated combat contribution added by this relic. */
  power: number
}

/** Holds player advancement and six inventory slots. */
export interface Progression {
  /** Current player level, beginning at one. */
  level: number
  /** Experience carried toward the next level. */
  experience: number
  /** Ember currency earned from encounters. */
  embers: number
  /** Six relic slots; null entries are empty. */
  relics: Array<Relic | null>
}

/** Aggregates the live player damage values derived from level and equipped relic power. */
export interface PlayerCombatStats {
  /** Physical damage delivered by a single completed basic attack. */
  basicAttackDamage: number
  /** Area damage delivered by the completed ember shockwave. */
  spellDamage: number
}

/**
 * Creates a default first-level progression record with empty relic slots.
 *
 * @returns {Progression} Default progression state.
 * @sideEffects None.
 */
export function createProgression(): Progression { return { level: 1, experience: 0, embers: 0, relics: Array.from({ length: 6 }, () => null) } }

/**
 * Adds experience, repeatedly consuming each level threshold while surplus remains.
 *
 * @param progression - Existing immutable progression state.
 * @param experience - Positive earned experience.
 * @returns {Progression} Updated level and carried experience.
 * @sideEffects None.
 */
export function applyExperience(progression: Progression, experience: number): Progression {
  let level = progression.level
  let carried = progression.experience + Math.max(0, experience)
  while (carried >= level * 100) { carried -= level * 100; level += 1 }
  return { ...progression, level, experience: carried }
}

/**
 * Rolls one deterministic relic for a threat level and seed without random global state.
 *
 * @param threat - Positive regional threat level.
 * @param seed - Stable drop seed.
 * @returns {Relic} Generated relic quality and power.
 * @sideEffects None.
 */
export function rollRelic(threat: number, seed: number): Relic {
  const value = Math.abs(seed) % 100
  const tier: RelicTier = value < 3 ? 'legendary' : value < 15 ? 'epic' : value < 48 ? 'rare' : 'normal'
  const multiplier = { normal: 1, rare: 2, epic: 3.4, legendary: 5.2 }[tier]
  return { id: `relic-${threat}-${seed}`, tier, power: Math.round(Math.max(1, threat) * 7 * multiplier) }
}

/**
 * Inserts a relic into the first free slot or replaces the lowest-power slot.
 *
 * @param progression - Existing immutable progression state.
 * @param relic - Newly earned relic.
 * @returns {Progression} State with the relic stored in one slot.
 * @sideEffects None.
 */
export function storeRelic(progression: Progression, relic: Relic): Progression {
  const relics = [...progression.relics]
  const empty = relics.findIndex((entry) => entry === null)
  const index = empty >= 0 ? empty : relics.reduce((lowest, entry, current) => (entry && entry.power < (relics[lowest]?.power ?? Infinity) ? current : lowest), 0)
  relics[index] = relic
  return { ...progression, relics }
}

/**
 * Calculates viable action-combat damage from permanent level and six-slot relic progression.
 *
 * @param progression - Current player progression record.
 * @returns {PlayerCombatStats} Deterministic physical and spell damage values for this frame.
 * @sideEffects None. Empty first-level progression starts at 3 basic and 5 spell damage.
 */
export function calculateCombatStats(progression: Progression): PlayerCombatStats {
  const levelBonus = Math.max(0, Math.floor(progression.level) - 1)
  const relicPower = progression.relics.reduce((total, relic) => total + (relic?.power ?? 0), 0)
  return {
    basicAttackDamage: 3 + levelBonus + Math.floor(relicPower / 18),
    spellDamage: 5 + levelBonus * 2 + Math.floor(relicPower / 12),
  }
}
