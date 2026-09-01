/** Local-storage key used for the per-device audio mute preference. */
export const AUDIO_PREFERENCE_KEY = 'embers-abyss-audio-v1'

/**
 * Reads the explicit muted marker used by the audio preference.
 *
 * @param storedValue - Raw local-storage value.
 * @returns {boolean} Whether audio should start muted.
 * @sideEffects None.
 */
export function readAudioMuted(storedValue: string | null): boolean { return storedValue === '1' }

/**
 * Flips the current mute preference.
 *
 * @param muted - Current mute state.
 * @returns {boolean} Next mute state.
 * @sideEffects None.
 */
export function toggleAudioMuted(muted: boolean): boolean { return !muted }
