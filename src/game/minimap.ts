import type { EncounterEnemyKind } from './encounter'

/** Two-dimensional point used by the minimap's top-down projection. */
export interface MinimapPoint {
  /** Horizontal world coordinate. */
  x: number
  /** Depth world coordinate. */
  z: number
}

/** Pixel coordinate returned by the minimap projection. */
export interface MinimapPixel {
  /** Horizontal canvas coordinate. */
  x: number
  /** Vertical canvas coordinate. */
  y: number
}

/**
 * Projects a world point around a moving center into a bounded square map.
 *
 * @param point - Actor world position.
 * @param center - Player/world center position.
 * @param range - World-unit radius represented by the map.
 * @param size - Square canvas size in CSS/device pixels.
 * @returns {MinimapPixel} Clamped pixel coordinate with north mapped upward.
 * @sideEffects None.
 */
export function projectMinimapPoint(point: MinimapPoint, center: MinimapPoint, range: number, size: number): MinimapPixel {
  const safeRange = Math.max(0.001, range)
  const half = Math.max(0, size) / 2
  const x = Math.max(-1, Math.min(1, (point.x - center.x) / safeRange))
  const z = Math.max(-1, Math.min(1, (point.z - center.z) / safeRange))
  return { x: Math.round(half + x * half), y: Math.round(half + z * half) }
}

/**
 * Returns the compact threat color used for an enemy marker.
 *
 * @param kind - Encounter enemy role.
 * @returns {string} CSS hex color suitable for a 2D canvas fill.
 * @sideEffects None.
 */
export function enemyMinimapColor(kind: EncounterEnemyKind): string {
  return ({ crawler: '#ed6d4c', brute: '#f09b59', wraith: '#c18cff', hunter: '#8ac6ff', boss: '#ffbd61' } as const)[kind]
}
