import { storeRelic, type Progression, type Relic } from './progression'

/** Maximum horizontal distance at which the traveler can absorb a dropped relic. */
export const RELIC_PICKUP_DISTANCE = 1.45

/** Couples a potentially changed progression state with the pickup result. */
export interface RelicCollectionResult {
  /** Progression after a successful collection, or the original object when still out of range. */
  progression: Progression
  /** Whether the ground entity should be removed after this evaluation. */
  collected: boolean
}

/**
 * Stores a ground relic only after the player reaches the game's pickup radius.
 *
 * @param progression - Current immutable advancement and relic-slot state.
 * @param relic - Generated relic represented by the ground pickup.
 * @param horizontalDistance - Current XZ-plane distance from traveler to pickup.
 * @returns {RelicCollectionResult} Updated progression and whether the pickup is consumed.
 * @sideEffects None.
 */
export function tryCollectRelic(progression: Progression, relic: Relic, horizontalDistance: number): RelicCollectionResult {
  if (!Number.isFinite(horizontalDistance) || horizontalDistance > RELIC_PICKUP_DISTANCE) {
    return { progression, collected: false }
  }
  return { progression: storeRelic(progression, relic), collected: true }
}
