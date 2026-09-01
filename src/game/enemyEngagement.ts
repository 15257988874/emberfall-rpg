/** Duration in seconds for which the same melee pair controls the inner attack ring. */
export const MELEE_ENGAGEMENT_WAVE_SECONDS = 2.4
/** Maximum number of melee enemies allowed to start attacks in a single wave. */
export const MAXIMUM_ACTIVE_MELEE_ENEMIES = 2

/**
 * Selects the current two melee attackers using stable encounter slots and a repeating wave timer.
 *
 * @param meleeSlots - Stable indexes of living non-ranged enemies in the encounter array.
 * @param elapsedSeconds - Non-negative encounter combat time in seconds.
 * @returns {number[]} Up to two stable slots permitted to use the inner attack ring this frame.
 * @sideEffects None. Empty inputs return an empty list and negative time begins at the first wave.
 */
export function activeMeleeSlots(meleeSlots: readonly number[], elapsedSeconds: number): number[] {
  if (meleeSlots.length === 0) return []
  const wave = Math.floor(Math.max(0, elapsedSeconds) / MELEE_ENGAGEMENT_WAVE_SECONDS)
  const startIndex = (wave * MAXIMUM_ACTIVE_MELEE_ENEMIES) % meleeSlots.length
  return Array.from({ length: Math.min(MAXIMUM_ACTIVE_MELEE_ENEMIES, meleeSlots.length) }, (_, index) => meleeSlots[(startIndex + index) % meleeSlots.length])
}
