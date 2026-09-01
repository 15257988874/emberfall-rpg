import * as THREE from 'three'
import { advanceProjectile, createProjectileMotion, type ProjectileMotion } from './projectileMotion'

/** Represents one player-fired ember bolt that tracks a selected enemy until impact or expiry. */
export class PlayerFirebolt {
  /** Root scene object added and removed by the game lifecycle. */
  public readonly group = new THREE.Group()
  /** Encounter identifier of the living enemy this firebolt is allowed to damage. */
  public readonly targetId: string
  /** Spell damage delivered when the projectile reaches its selected enemy. */
  public readonly damage: number
  /** Whether the projectile remains active in the scene and collision simulation. */
  public alive = true
  /** Render-independent path state which limits firebolt travel across a large arena. */
  private motion: ProjectileMotion

  /**
   * Creates a code-generated ember bolt from the traveler toward a selected enemy.
   *
   * @param targetId - Stable encounter id used to ensure the bolt never hits another enemy.
   * @param origin - World-space release point near the player chest.
   * @param target - World-space position captured from the selected enemy at release.
   * @param damage - Non-negative spell damage to apply on impact.
   * @returns {PlayerFirebolt} A live projectile ready to add to the Three.js scene.
   * @sideEffects Allocates Three.js mesh geometry and materials.
   */
  public constructor(targetId: string, origin: THREE.Vector3, target: THREE.Vector3, damage: number) {
    this.targetId = targetId
    this.damage = Math.max(0, damage)
    const direction = new THREE.Vector3().subVectors(target, origin)
    direction.y = 0
    this.motion = createProjectileMotion({ x: origin.x, z: origin.z }, { x: direction.x, z: direction.z }, 13, 14)
    this.group.position.set(origin.x, 1.12, origin.z)

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffc06a, transparent: true, opacity: 0.98 }),
    )
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: 0xff582e, transparent: true, opacity: 0.52, depthWrite: false }),
    )
    flame.rotation.x = Math.PI / 2
    flame.position.z = 0.38
    this.group.rotation.y = Math.atan2(-this.motion.direction.x, -this.motion.direction.z)
    this.group.add(core, flame)
  }

  /**
   * Advances the firebolt and resolves one horizontal impact against its selected enemy.
   *
   * @param deltaSeconds - Elapsed simulation time in seconds.
   * @param targetPosition - Current selected enemy position for impact testing.
   * @returns {boolean} `true` exactly once when the bolt reaches its selected enemy.
   * @sideEffects Moves the mesh and marks it dead after an impact or range expiry.
   */
  public update(deltaSeconds: number, targetPosition: THREE.Vector3): boolean {
    if (!this.alive) return false
    const frame = advanceProjectile(this.motion, deltaSeconds)
    this.motion = frame.motion
    this.group.position.set(this.motion.x, 1.12 + Math.sin(performance.now() * 0.022) * 0.05, this.motion.z)
    const hitTarget = Math.hypot(targetPosition.x - this.motion.x, targetPosition.z - this.motion.z) <= 0.44
    if (hitTarget || frame.expired) this.alive = false
    return hitTarget
  }

  /** Releases mesh geometry and materials after the firebolt leaves the scene. */
  public dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    })
  }
}
