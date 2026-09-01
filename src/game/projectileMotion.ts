import type { Vector2 } from './rules'

/** Stores render-independent projectile position, direction, speed, and remaining range. */
export interface ProjectileMotion {
  /** Current horizontal world position. */
  x: number
  /** Current depth world position. */
  z: number
  /** Unit horizontal direction that remains fixed for this projectile's lifetime. */
  direction: Vector2
  /** World units travelled each second. */
  speed: number
  /** Maximum distance the projectile may still travel before despawning. */
  remainingDistance: number
}

/** Couples a next projectile state with its out-of-range result. */
export interface ProjectileMotionFrame {
  /** Motion data to carry into the next simulation frame. */
  motion: ProjectileMotion
  /** Whether the projectile has reached its maximum travel distance. */
  expired: boolean
}

/**
 * Builds a normalized projectile trajectory from a source point and intended direction.
 *
 * @param origin - Initial horizontal world position.
 * @param direction - Any non-zero horizontal direction toward the target at fire time.
 * @param speed - Positive world-unit velocity per second.
 * @param maximumDistance - Positive total distance available to this projectile.
 * @returns {ProjectileMotion} A bounded, normalized projectile state.
 * @sideEffects None. A zero direction is replaced with forward depth so malformed callers remain safe.
 */
export function createProjectileMotion(origin: Vector2, direction: Vector2, speed: number, maximumDistance: number): ProjectileMotion {
  const length = Math.hypot(direction.x, direction.z)
  const normalizedDirection = length > 0
    ? { x: direction.x / length, z: direction.z / length }
    : { x: 0, z: -1 }
  return {
    x: origin.x,
    z: origin.z,
    direction: normalizedDirection,
    speed: Math.max(0, speed),
    remainingDistance: Math.max(0, maximumDistance),
  }
}

/**
 * Advances a projectile without allowing a slow frame to move it beyond its expiry boundary.
 *
 * @param motion - Current immutable projectile trajectory.
 * @param deltaSeconds - Non-negative elapsed simulation time.
 * @returns {ProjectileMotionFrame} Next bounded position and expiry state.
 * @sideEffects None.
 */
export function advanceProjectile(motion: ProjectileMotion, deltaSeconds: number): ProjectileMotionFrame {
  const travelDistance = Math.min(motion.remainingDistance, motion.speed * Math.max(0, deltaSeconds))
  const remainingDistance = Math.max(0, motion.remainingDistance - travelDistance)
  return {
    motion: {
      ...motion,
      x: motion.x + motion.direction.x * travelDistance,
      z: motion.z + motion.direction.z * travelDistance,
      remainingDistance,
    },
    expired: remainingDistance === 0,
  }
}
