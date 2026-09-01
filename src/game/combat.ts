import type { EncounterEnemyKind } from './encounter'

/** Identifies whether a damage source is mitigated by armor or magic resistance. */
export type EnemyDamageType = 'physical' | 'magic'

/** Describes attack reach, cadence, damage, and damage class for an enemy role. */
export interface EnemyCombatProfile {
  /** World-unit attack reach. */
  range: number
  /** Seconds between legal attacks. */
  cooldown: number
  /** Raw damage before player defenses. */
  damage: number
  /** Defense class that later attributes distinguish. */
  damageType: EnemyDamageType
}

/**
 * Returns the fixed combat identity for an encounter enemy role.
 *
 * @param kind - Encounter enemy role.
 * @returns {EnemyCombatProfile} Immutable behavior values for that role.
 * @sideEffects None.
 */
export function enemyCombatProfile(kind: EncounterEnemyKind): EnemyCombatProfile {
  return {
    crawler: { range: 1.8, cooldown: 1.05, damage: 8, damageType: 'physical' },
    brute: { range: 2.1, cooldown: 1.65, damage: 16, damageType: 'physical' },
    wraith: { range: 7.6, cooldown: 1.35, damage: 12, damageType: 'magic' },
    hunter: { range: 9.2, cooldown: 1.15, damage: 10, damageType: 'physical' },
    boss: { range: 4.2, cooldown: 2.2, damage: 28, damageType: 'magic' },
  }[kind]
}

/**
 * Applies shield and flat armor mitigation to one incoming damage event.
 *
 * @param rawDamage - Positive attacker damage before defenses.
 * @param armor - Flat defense that subtracts after shield reduction.
 * @param shieldActive - Whether the temporary shield absorbs 35 percent first.
 * @returns {number} Non-negative damage applied to player health.
 * @sideEffects None.
 */
export function mitigateDamage(rawDamage: number, armor: number, shieldActive: boolean): number {
  const shieldedDamage = shieldActive ? Math.ceil(rawDamage * 0.65) : rawDamage
  return Math.max(0, shieldedDamage - Math.max(0, armor))
}
