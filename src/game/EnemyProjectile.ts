import * as THREE from 'three'
import type { EnemyDamageType } from './combat'
import type { EncounterEnemyKind } from './encounter'
import { advanceProjectile, createProjectileMotion, type ProjectileMotion } from './projectileMotion'

/** Represents one enemy projectile that can be avoided before it reaches the player. */
export class EnemyProjectile {
  /** Root object that the game adds and removes from the Three.js scene. */
  public readonly group = new THREE.Group()
  /** Raw damage delivered if the projectile collides before expiring. */
  public readonly damage: number
  /** Defense class applied by the game when the projectile hits. */
  public readonly damageType: EnemyDamageType
  /** Origin role used for player-facing combat feedback. */
  public readonly sourceKind: EncounterEnemyKind
  /** Whether this projectile should remain in the simulation and scene. */
  public alive = true
  /** Render-independent travel state that bounds projectile distance. */
  private motion: ProjectileMotion

  /**
   * Creates a glowing projectile whose direction is fixed when an enemy releases it.
   *
   * @param sourceKind - Enemy role that produced this projectile.
   * @param origin - World-space source position.
   * @param target - Player world-space position captured when the projectile fires.
   * @param damage - Raw combat damage before player defenses.
   * @param damageType - Physical or magic defense class for the hit.
   * @returns {EnemyProjectile} A live projectile ready to add to the scene.
   * @sideEffects Allocates Three.js meshes and materials.
   */
  public constructor(sourceKind: EncounterEnemyKind, origin: THREE.Vector3, target: THREE.Vector3, damage: number, damageType: EnemyDamageType) {
    this.sourceKind = sourceKind
    this.damage = damage
    this.damageType = damageType
    const direction = new THREE.Vector3().subVectors(target, origin)
    direction.y = 0
    this.motion = createProjectileMotion({ x: origin.x, z: origin.z }, { x: direction.x, z: direction.z }, sourceKind === 'hunter' ? 11.5 : 8.7, 15)
    this.group.position.set(origin.x, 0.94, origin.z)

    const color = sourceKind === 'hunter' ? 0xffd576 : 0x8bbcff
    const bolt = new THREE.Mesh(
      new THREE.SphereGeometry(sourceKind === 'hunter' ? 0.16 : 0.2, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96 }),
    )
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.78, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.36, depthWrite: false }),
    )
    trail.rotation.x = Math.PI / 2
    trail.position.z = 0.32
    this.group.rotation.y = Math.atan2(-this.motion.direction.x, -this.motion.direction.z)
    this.group.add(bolt, trail)
  }

  /**
   * Advances flight and detects a close player collision before range expiry.
   *
   * @param deltaSeconds - Elapsed simulation time.
   * @param playerPosition - Current player world position used for collision detection.
   * @returns {boolean} `true` only on the frame where the projectile collides.
   * @sideEffects Moves the mesh and may mark the projectile dead.
   */
  public update(deltaSeconds: number, playerPosition: THREE.Vector3): boolean {
    if (!this.alive) return false
    const frame = advanceProjectile(this.motion, deltaSeconds)
    this.motion = frame.motion
    this.group.position.set(this.motion.x, 0.94 + Math.sin(performance.now() * 0.018) * 0.06, this.motion.z)
    const collides = Math.hypot(playerPosition.x - this.motion.x, playerPosition.z - this.motion.z) <= 0.68
    if (collides || frame.expired) this.alive = false
    return collides
  }

  /** Releases mesh geometry and materials when the projectile is removed during play. */
  public dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    })
  }
}
