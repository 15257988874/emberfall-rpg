import type { Relic } from './progression'
import type { RuneRanks } from './rune'
import { normalizeTravelerName } from './traveler'

/** Serializable player and regional progress persisted between browser sessions. */
export interface SaveData {
  /** Codec format version used to reject incompatible older data. */
  version: 2
  /** Name displayed on the HUD and prefilled into the next start overlay. */
  travelerName: string
  /** Player current level. */
  level: number
  /** Current carried experience. */
  experience: number
  /** Current ember currency. */
  embers: number
  /** Six serialized relic slots. */
  relics: Array<Relic | null>
  /** Current regional threat. */
  threat: number
  /** Number of regions cleansed during this save. */
  cleansedCount: number
  /** Cumulative run score. */
  score: number
  /** Optional rune ranks added in save schema v2 without invalidating older payloads. */
  runes?: RuneRanks
}

/** Stores the current schema version in every encoded save payload. */
const SAVE_VERSION = 2 as const

/**
 * Serializes save payload data while owning the schema version internally.
 *
 * @param state - Current progress fields excluding the format version.
 * @returns {string} JSON ready for browser local storage.
 * @sideEffects None.
 */
export function encodeSave(state: Omit<SaveData, 'version'>): string { return JSON.stringify({ version: SAVE_VERSION, ...state }) }

/**
 * Parses a save string and rejects invalid types, versions, and unsafe progression values.
 *
 * @param encoded - Raw browser local-storage string.
 * @returns {SaveData | null} Validated save or `null` when it cannot be safely applied.
 * @sideEffects None.
 */
export function decodeSave(encoded: string | null): SaveData | null {
  if (!encoded) return null
  try {
    const value: unknown = JSON.parse(encoded)
    if (isSaveData(value)) return { ...value, travelerName: normalizeTravelerName(value.travelerName) }
    if (isLegacySaveData(value)) return { ...value, version: SAVE_VERSION, travelerName: normalizeTravelerName(null) }
    return null
  } catch { return null }
}

/**
 * Narrows untrusted JSON to the exact minimal save contract consumed by the game.
 *
 * @param value - Parsed unknown JSON value.
 * @returns {value is SaveData} Whether the payload has a supported shape.
 * @sideEffects None.
 */
function isSaveData(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return data.version === SAVE_VERSION
    && typeof data.travelerName === 'string'
    && hasProgressionShape(data)
}

/**
 * Narrows a version-one payload that lacks only the traveler-name field added by version two.
 *
 * @param value - Parsed unknown JSON value.
 * @returns {boolean} Whether this payload can be safely migrated without losing progress fields.
 * @sideEffects None.
 */
function isLegacySaveData(value: unknown): value is Omit<SaveData, 'version' | 'travelerName'> & { version: 1 } {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return data.version === 1 && hasProgressionShape(data)
}

/**
 * Validates progress fields shared by every supported local-save version.
 *
 * @param data - Object-form parsed JSON candidate.
 * @returns {boolean} Whether every progress field has a bounded primitive shape.
 * @sideEffects None.
 */
function hasProgressionShape(data: Record<string, unknown>): boolean {
  return [data.level, data.experience, data.embers, data.threat, data.cleansedCount, data.score].every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0)
    && Array.isArray(data.relics) && data.relics.length === 6
    && (data.runes === undefined || isRuneRanks(data.runes))
}

/** Validates optional rune ranks while rejecting prototype keys and negative values. */
function isRuneRanks(value: unknown): value is RuneRanks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([key, rank]) => /^[a-z_]+$/.test(key) && typeof rank === 'number' && Number.isInteger(rank) && rank >= 0 && rank <= 3)
}
