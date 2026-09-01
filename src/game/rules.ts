/** Represents an XZ-plane vector used by deterministic gameplay rules. */
export interface Vector2 {
  /** Horizontal world-space component. */
  x: number
  /** Depth world-space component. */
  z: number
}

/** Represents the position, facing, and combat eligibility of an actor. */
export interface CombatTransform {
  /** Current XZ-plane location in world units. */
  position: Vector2
  /** Normalized direction the actor is facing. */
  forward: Vector2
  /** Whether this actor can give or receive melee damage. */
  alive: boolean
}

/**
 * Converts held movement keys into a unit-length XZ movement direction.
 *
 * @param keys - Keyboard codes currently held by the player.
 * @returns A normalized direction, or `{ x: 0, z: 0 }` with no directional input.
 * @sideEffects None.
 */
export function moveIntent(keys: ReadonlySet<string>): Vector2 {
  const horizontal = Number(keys.has('KeyD') || keys.has('ArrowRight'))
    - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
  const vertical = Number(keys.has('KeyS') || keys.has('ArrowDown'))
    - Number(keys.has('KeyW') || keys.has('ArrowUp'))
  const magnitude = Math.hypot(horizontal, vertical)

  if (magnitude === 0) {
    return { x: 0, z: 0 }
  }

  return { x: horizontal / magnitude, z: vertical / magnitude }
}

/**
 * Determines whether a target is a valid melee recipient for an attacker.
 *
 * @param attacker - Living actor that initiates the attack and supplies its forward direction.
 * @param target - Candidate actor that must be alive and in front of the attacker.
 * @param range - Maximum accepted XZ-plane distance in world units.
 * @param halfAngleRadians - Half of the accepted forward attack cone in radians.
 * @returns `true` only for a living target inside both range and the forward arc.
 * @sideEffects None.
 */
export function canHitTarget(
  attacker: CombatTransform,
  target: CombatTransform,
  range: number,
  halfAngleRadians: number,
): boolean {
  if (!attacker.alive || !target.alive || range <= 0 || halfAngleRadians < 0) {
    return false
  }

  const offsetX = target.position.x - attacker.position.x
  const offsetZ = target.position.z - attacker.position.z
  const distance = Math.hypot(offsetX, offsetZ)

  if (distance === 0 || distance > range) {
    return false
  }

  const targetDirectionX = offsetX / distance
  const targetDirectionZ = offsetZ / distance
  const forwardLength = Math.hypot(attacker.forward.x, attacker.forward.z)

  if (forwardLength === 0) {
    return false
  }

  const normalizedForwardX = attacker.forward.x / forwardLength
  const normalizedForwardZ = attacker.forward.z / forwardLength
  const alignment = normalizedForwardX * targetDirectionX + normalizedForwardZ * targetDirectionZ

  return alignment >= Math.cos(halfAngleRadians)
}
