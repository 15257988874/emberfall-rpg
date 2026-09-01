/** Fallback identity used for players who leave the traveler name blank. */
export const DEFAULT_TRAVELER_NAME = '余烬行者'
/** Maximum visible traveler-name length accepted by the local save and HUD. */
export const MAXIMUM_TRAVELER_NAME_LENGTH = 12

/**
 * Converts an untrusted name-entry value into a compact HUD-safe traveler identity.
 *
 * @param value - Raw text entered through the start overlay or read from local storage.
 * @returns {string} A trimmed name capped at twelve Unicode code points, or the default identity.
 * @sideEffects None.
 */
export function normalizeTravelerName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_TRAVELER_NAME
  const normalized = Array.from(value.trim()).slice(0, MAXIMUM_TRAVELER_NAME_LENGTH).join('')
  return normalized || DEFAULT_TRAVELER_NAME
}
