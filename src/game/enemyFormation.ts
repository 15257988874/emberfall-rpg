import type { Vector2 } from './rules'

/**
 * Resolves the stable ring position assigned to one enemy within a regional encounter.
 *
 * @param playerPosition - Current player location at the formation center.
 * @param slot - Stable zero-based enemy index assigned at encounter spawn.
 * @param totalSlots - Number of living encounter slots sharing the ring.
 * @param radius - Preferred distance from the player in world units.
 * @returns {Vector2} The unique point that this enemy should approach.
 * @sideEffects None. Invalid slot counts or radii preserve the player position rather than emitting NaN coordinates.
 */
export function formationTarget(playerPosition: Vector2, slot: number, totalSlots: number, radius: number): Vector2 {
  const count = Math.floor(totalSlots)
  const safeRadius = Math.max(0, radius)
  if (count <= 0 || safeRadius === 0) return { ...playerPosition }
  const normalizedSlot = ((Math.floor(slot) % count) + count) % count
  // The half-slot rotation avoids placing a unit directly behind the camera-facing player spawn line.
  const angle = -Math.PI / 2 + ((normalizedSlot + 0.5) / count) * Math.PI * 2
  return {
    x: playerPosition.x + Math.cos(angle) * safeRadius,
    z: playerPosition.z + Math.sin(angle) * safeRadius,
  }
}
