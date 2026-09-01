import * as THREE from 'three'
import type { Relic, RelicTier } from './progression'

/** Maps relic quality to the distinct scene and HUD accent used for that drop. */
export const RELIC_TIER_COLORS: Record<RelicTier, number> = {
  normal: 0xb9d1d1,
  rare: 0x66b8ff,
  epic: 0xd18cff,
  legendary: 0xffbd61,
}

/** Displays one generated relic at its enemy-death location until the player collects it. */
export class LootDrop {
  /** Root scene object added and removed by the game lifecycle. */
  public readonly group = new THREE.Group()
  /** Immutable generated relic granted when the traveler reaches this pickup. */
  public readonly relic: Relic
  /** Whether this pickup still belongs in the active scene and collection loop. */
  public alive = true
  /** Original vertical position used as the center of the visual hover motion. */
  private readonly originY: number
  /** Accumulated scene time that drives bobbing and rotation without wall-clock coupling. */
  private elapsedSeconds = 0

  /**
   * Creates a quality-colored relic model at the defeated enemy's scene location.
   *
   * @param relic - Immutable relic record that this pickup represents.
   * @param position - World position where the enemy was defeated.
   * @returns {LootDrop} A live scene pickup ready to register with the game.
   * @sideEffects Allocates Three.js mesh geometry and materials.
   */
  public constructor(relic: Relic, position: THREE.Vector3) {
    this.relic = relic
    this.originY = 0.72
    this.group.position.set(position.x, this.originY, position.z)
    const color = RELIC_TIER_COLORS[relic.tier]
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.7, roughness: 0.24, metalness: 0.68 }),
    )
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.025, 8, 30),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.74, depthWrite: false }),
    )
    halo.rotation.x = Math.PI / 2
    halo.position.y = -0.58
    const beacon = new THREE.PointLight(color, 2.2, 3.6, 2)
    beacon.position.y = 0.18
    this.group.add(shard, halo, beacon)
  }

  /**
   * Advances visual hover motion while the relic waits on the ground.
   *
   * @param deltaSeconds - Elapsed frame time in seconds.
   * @returns {void} No return value.
   * @sideEffects Rotates and changes the root mesh vertical position.
   */
  public update(deltaSeconds: number): void {
    if (!this.alive) return
    this.elapsedSeconds += Math.max(0, deltaSeconds)
    this.group.rotation.y += deltaSeconds * 1.9
    this.group.position.y = this.originY + Math.sin(this.elapsedSeconds * 3.2) * 0.12
  }

  /**
   * Measures the current XZ-plane distance to a possible collector.
   *
   * @param position - Collector world position.
   * @returns {number} Horizontal world-unit distance.
   * @sideEffects None.
   */
  public distanceTo(position: THREE.Vector3): number {
    return Math.hypot(position.x - this.group.position.x, position.z - this.group.position.z)
  }

  /**
   * Marks this pickup collected so the game removes and disposes it exactly once.
   *
   * @returns {void} No return value.
   * @sideEffects Prevents further visual updates and pickup checks.
   */
  public collect(): void { this.alive = false }

  /** Releases GPU mesh resources when the pickup leaves the active scene. */
  public dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    })
  }
}
