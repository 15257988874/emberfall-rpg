import { enemyCombatProfile, type EnemyDamageType } from './combat'
import type { EncounterEnemyKind } from './encounter'

/** Identifies the non-overlapping portions of an enemy attack cycle. */
export type EnemyAttackPhase = 'ready' | 'windup' | 'cooldown'

/** Stores one enemy's deterministic combat-cycle progress. */
export interface EnemyAttackState {
  /** Current portion of the attack cycle. */
  phase: EnemyAttackPhase
  /** Seconds remaining in the active windup or cooldown phase. */
  remainingSeconds: number
}

/** Describes a discrete combat event emitted by the enemy attack state machine. */
export type EnemyAttackEvent =
  /** Begins a visible warning period before damage can occur. */
  | { type: 'telegraph'; duration: number }
  /** Applies one close-range strike as the warning completes. */
  | { type: 'melee'; damage: number; damageType: EnemyDamageType }
  /** Spawns one physical projectile as the warning completes. */
  | { type: 'projectile'; damage: number; damageType: EnemyDamageType }

/** Couples the next immutable attack state with an optional one-shot event. */
export interface EnemyAttackFrame {
  /** State to retain for the following simulation frame. */
  state: EnemyAttackState
  /** New attack event, or `null` while only time advances. */
  event: EnemyAttackEvent | null
}

/** Provides role-specific attack delivery and warning durations. */
interface EnemyAttackBehavior {
  /** Number of seconds that the target can react before the attack resolves. */
  windupSeconds: number
  /** Whether the resolved attack is delivered by a moving projectile. */
  projectile: boolean
}

/**
 * Creates an enemy attack state that can start an attack immediately once in range.
 *
 * @param initialDelaySeconds - Optional cooldown used to stagger a newly spawned encounter.
 * @returns {EnemyAttackState} A ready state or a delayed cooldown state.
 * @sideEffects None.
 */
export function createEnemyAttackState(initialDelaySeconds = 0): EnemyAttackState {
  const remainingSeconds = Math.max(0, initialDelaySeconds)
  return remainingSeconds > 0
    ? { phase: 'cooldown', remainingSeconds }
    : { phase: 'ready', remainingSeconds: 0 }
}

/**
 * Advances a role-specific enemy attack without creating rendering-side effects.
 *
 * @param state - Current immutable attack-cycle state.
 * @param kind - Combat role that determines warning and delivery style.
 * @param targetInRange - Whether the intended player target is inside legal attack range.
 * @param deltaSeconds - Non-negative elapsed simulation time.
 * @returns {EnemyAttackFrame} Next state and any one-shot telegraph, strike, or projectile event.
 * @sideEffects None. Large time steps resolve at most one event so a stalled frame cannot stack damage.
 */
export function advanceEnemyAttack(
  state: EnemyAttackState,
  kind: EncounterEnemyKind,
  targetInRange: boolean,
  deltaSeconds: number,
): EnemyAttackFrame {
  const elapsed = Math.max(0, deltaSeconds)
  const combat = enemyCombatProfile(kind)
  const behavior = enemyAttackBehavior(kind)

  if (state.phase === 'ready') {
    if (!targetInRange) return { state, event: null }
    return {
      state: { phase: 'windup', remainingSeconds: behavior.windupSeconds },
      event: { type: 'telegraph', duration: behavior.windupSeconds },
    }
  }

  if (state.phase === 'windup' && !targetInRange) return { state: createEnemyAttackState(), event: null }

  const remainingSeconds = Math.max(0, state.remainingSeconds - elapsed)
  if (state.phase === 'windup') {
    // Simulation deltas are decimal fractions, so treat sub-microsecond residues as elapsed.
    if (remainingSeconds > 0.000001) return { state: { phase: 'windup', remainingSeconds }, event: null }
    return {
      state: { phase: 'cooldown', remainingSeconds: combat.cooldown },
      event: behavior.projectile
        ? { type: 'projectile', damage: combat.damage, damageType: combat.damageType }
        : { type: 'melee', damage: combat.damage, damageType: combat.damageType },
    }
  }

  return remainingSeconds > 0.000001
    ? { state: { phase: 'cooldown', remainingSeconds }, event: null }
    : { state: createEnemyAttackState(), event: null }
}

/**
 * Returns attack delivery details kept separate from general combat damage values.
 *
 * @param kind - Enemy role to map to a windup and delivery behavior.
 * @returns {EnemyAttackBehavior} Immutable role-specific attack presentation values.
 * @sideEffects None.
 */
function enemyAttackBehavior(kind: EncounterEnemyKind): EnemyAttackBehavior {
  return {
    crawler: { windupSeconds: 0.34, projectile: false },
    brute: { windupSeconds: 0.5, projectile: false },
    wraith: { windupSeconds: 0.72, projectile: true },
    hunter: { windupSeconds: 0.62, projectile: true },
    boss: { windupSeconds: 0.84, projectile: false },
  }[kind]
}
