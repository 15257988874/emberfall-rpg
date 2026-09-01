/** Maximum horizontal distance at which a selected enemy receives automatic firebolt pressure. */
export const FIREBOLT_RANGE = 12

/**
 * Resolves the one enemy that remains selected after a pointer event and subsequent deaths.
 *
 * @param currentTargetId - Existing locked enemy identifier, or `null` without a current lock.
 * @param clickedTargetId - Living enemy identifier selected by the current pointer event, or `null`.
 * @param livingTargetIds - Identifiers of all currently living enemies in the active encounter.
 * @returns {string | null} A newly clicked living target, a still-living prior target, or `null`.
 * @sideEffects None. A dead or despawned target never remains locked.
 */
export function resolveLockedTarget(currentTargetId: string | null, clickedTargetId: string | null, livingTargetIds: readonly string[]): string | null {
  if (clickedTargetId !== null && livingTargetIds.includes(clickedTargetId)) return clickedTargetId
  return currentTargetId !== null && livingTargetIds.includes(currentTargetId) ? currentTargetId : null
}

/**
 * Determines whether a locked enemy may receive a new automatic firebolt this frame.
 *
 * @param targetId - Current selected enemy identifier, or `null` without a valid lock.
 * @param horizontalDistance - XZ-plane distance from the traveler to the selected enemy.
 * @param cooldownSeconds - Remaining independent firebolt cooldown in seconds.
 * @returns {boolean} Whether a firebolt should be released now.
 * @sideEffects None. Out-of-range, invalid, and cooling-down targets cannot spawn a projectile.
 */
export function canReleaseFirebolt(targetId: string | null, horizontalDistance: number, cooldownSeconds: number): boolean {
  return targetId !== null && Number.isFinite(horizontalDistance) && horizontalDistance <= FIREBOLT_RANGE && cooldownSeconds <= 0
}
