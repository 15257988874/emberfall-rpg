import * as THREE from 'three'
import { advancePlayerState, createPlayerState, type PlayerActionEvents, type PlayerInputSnapshot, type PlayerState } from './playerState'
import type { Vector2 } from './rules'
import { SpellEffect } from './SpellEffect'

/** Describes state-machine output exposed to combat and HUD code each frame. */
export interface PlayerFrameResult {
  /** Current player state after this frame's transition. */
  state: PlayerState
  /** One-shot actions emitted by the state machine. */
  events: PlayerActionEvents
}

/** Identifies the business outcome of an attempted healing-potion use. */
export type PotionUseResult = 'healed' | 'full-health' | 'empty'

/** Displays and updates the player-controlled ember knight. */
export class Player {
  /** Root object added to the Three.js scene. */
  public readonly group = new THREE.Group()
  /** Current normalized horizontal facing direction used by combat rules. */
  public readonly forward = new THREE.Vector3(0, 0, -1)
  /** Current health displayed in the HUD. */
  public health = 100
  /** Remaining healing potions. */
  public potions = 3
  /** State-machine memory controlling movement and poses. */
  public state = createPlayerState()
  /** Cloak mesh moved by the six-state pose blend. */
  private readonly cloak: THREE.Mesh
  /** Armor mesh that leans into movement and chant poses. */
  private readonly armor: THREE.Mesh
  /** Ember core whose glow signals state intensity. */
  private readonly emberCore: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  /** Decorative blade pivot animated by combat poses. */
  private readonly swordPivot = new THREE.Group()
  /** Bright slash mesh visible during the melee state. */
  private readonly slash: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  /** Transparent defensive dome enabled by the shield action. */
  private readonly shield: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  /** Independent layered effects for chant, cast, and dash feedback. */
  private readonly spellEffect = new SpellEffect()
  /** Remaining shield duration in seconds. */
  private shieldTime = 0

  /** Creates the ember knight geometry and default spawn position. */
  public constructor() {
    this.group.position.set(0, 0.15, 2.4)
    this.cloak = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.58, 6), new THREE.MeshStandardMaterial({ color: 0x171622, roughness: 0.72, metalness: 0.14 }))
    this.cloak.position.y = 0.74
    this.cloak.rotation.y = Math.PI / 6
    this.armor = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.52, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc5cad1, roughness: 0.3, metalness: 0.85 }))
    this.armor.position.y = 1.16
    this.emberCore = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffb35c, emissive: 0xd73b16, emissiveIntensity: 3.4 }))
    this.emberCore.position.set(0, 1.2, -0.32)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.12, 0.11), new THREE.MeshStandardMaterial({ color: 0xf4c895, metalness: 0.72, roughness: 0.2, emissive: 0x56210e, emissiveIntensity: 0.55 }))
    blade.position.y = 0.58
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.11), new THREE.MeshStandardMaterial({ color: 0x382126, roughness: 0.72 }))
    grip.position.y = 0.08
    this.swordPivot.position.set(0.48, 0.8, -0.04)
    this.swordPivot.rotation.z = -0.35
    this.swordPivot.add(blade, grip)
    this.slash = new THREE.Mesh(new THREE.RingGeometry(0.72, 2.7, 32, 1, -1.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))
    this.slash.rotation.x = -Math.PI / 2
    this.slash.position.set(0, 0.06, -1.3)
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.18, 20, 14), new THREE.MeshBasicMaterial({ color: 0x7ed8d3, transparent: true, opacity: 0, wireframe: true, depthWrite: false }))
    this.shield.position.y = 0.85
    this.group.add(this.cloak, this.armor, this.emberCore, this.swordPivot, this.slash, this.shield, this.spellEffect.group)
  }

  /**
   * Measures horizontal distance between the player and a possible click destination.
   *
   * @param target - Ground position to measure, or `null` with no active destination.
   * @returns {number} World-unit distance, or infinity without a target.
   * @sideEffects None.
   */
  public distanceTo(target: Vector2 | null): number { return target ? Math.hypot(target.x - this.group.position.x, target.z - this.group.position.z) : Infinity }

  /**
   * Advances state, movement, smooth pose blending, shield timing, and spell effects.
   *
   * @param deltaSeconds - Simulation time elapsed since the prior frame.
   * @param input - Keyboard and action snapshot for this frame.
   * @param target - Active mouse ground destination, if any.
   * @returns {PlayerFrameResult} Current state and one-shot events for combat code.
   * @sideEffects Moves and transforms player meshes and effect children.
   */
  public update(deltaSeconds: number, input: PlayerInputSnapshot, target: Vector2 | null): PlayerFrameResult {
    const update = advancePlayerState(this.state, input, deltaSeconds)
    this.state = update.state
    this.move(deltaSeconds, input.move, target)
    this.updatePose(deltaSeconds)
    this.shieldTime = Math.max(0, this.shieldTime - deltaSeconds)
    this.shield.visible = this.shieldTime > 0
    this.shield.rotation.y += deltaSeconds * 2.4
    this.shield.material.opacity = this.shieldTime > 0 ? 0.3 + Math.sin(performance.now() * 0.008) * 0.08 : 0
    this.spellEffect.update(deltaSeconds, this.state.kind, this.state.stateTime)
    return update
  }

  /**
   * Moves the player instantly in its facing direction for the dash action.
   *
   * @returns {void} No return value.
   * @sideEffects Changes player position and creates a visual trail.
   */
  public dash(): void { this.group.position.addScaledVector(this.forward, 3.4); this.spellEffect.triggerDashTrail() }

  /**
   * Instantly aligns combat facing to a nearby automatic-attack target without moving the traveler.
   *
   * @param target - World XZ position of the selected target.
   * @returns {void} No return value.
   * @sideEffects Updates the forward vector and visible group yaw when target distance is non-zero.
   */
  public faceTarget(target: Vector2): void {
    const direction = new THREE.Vector3(target.x - this.group.position.x, 0, target.z - this.group.position.z)
    if (direction.lengthSq() === 0) return
    direction.normalize()
    this.forward.copy(direction)
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z)
  }

  /**
   * Activates a temporary defense dome around the player.
   *
   * @param durationSeconds - Defensive duration in seconds; callers use shorter durations for revive safety.
   * @returns {void} No return value.
   * @sideEffects Restarts the shield duration timer.
   */
  public activateShield(durationSeconds = 4.5): void { this.shieldTime = Math.max(0, durationSeconds) }

  /**
   * Consumes one available potion and restores a bounded amount of health.
   *
   * @returns {PotionUseResult} Whether healing occurred, health was already full, or stock was empty.
   * @sideEffects Decrements potion count and increases health on success.
   */
  public consumePotion(): PotionUseResult {
    if (this.potions <= 0) return 'empty'
    if (this.health >= 100) return 'full-health'
    this.potions -= 1
    this.health = Math.min(100, this.health + 38)
    return 'healed'
  }

  /**
   * Applies already-mitigated incoming damage to the player's bounded health pool.
   *
   * @param damage - Non-negative damage after shield and defense calculations.
   * @returns {boolean} Whether this hit reduced player health to zero.
   * @sideEffects Decrements current player health.
   */
  public takeDamage(damage: number): boolean {
    this.health = Math.max(0, this.health - Math.max(0, damage))
    return this.health === 0
  }

  /**
   * Restores a defeated traveler at the safe arena entry with a brief protective ward.
   *
   * @returns {void} No return value.
   * @sideEffects Resets health, position, facing, rotation, and defensive shield duration.
   */
  public revive(): void {
    this.health = 100
    this.group.position.set(0, 0.15, 2.4)
    this.forward.set(0, 0, -1)
    this.group.rotation.set(0, 0, 0)
    this.activateShield(2.8)
  }

  /**
   * Reports whether this player can currently receive movement and combat input.
   *
   * @returns {boolean} `true` when health has reached zero.
   * @sideEffects None.
   */
  public get isDefeated(): boolean { return this.health === 0 }

  /**
   * Reports whether the defense dome is currently reducing incoming damage.
   *
   * @returns {boolean} Whether shield time remains.
   * @sideEffects None.
   */
  public get shieldActive(): boolean { return this.shieldTime > 0 }

  /** Releases visual effect GPU resources before the parent scene is disposed. */
  public dispose(): void { this.spellEffect.dispose() }

  /** Moves according to the currently selected locomotion state and facing target. */
  private move(deltaSeconds: number, keyboardMove: Vector2, target: Vector2 | null): void {
    if (this.state.kind !== 'walk' && this.state.kind !== 'run') return
    const direction = new THREE.Vector3(keyboardMove.x, 0, keyboardMove.z)
    if (direction.lengthSq() === 0 && target) direction.set(target.x - this.group.position.x, 0, target.z - this.group.position.z).normalize()
    if (direction.lengthSq() === 0) return
    direction.normalize()
    const speed = this.state.kind === 'run' ? 8.1 : 4.35
    this.group.position.addScaledVector(direction, speed * deltaSeconds)
    this.forward.lerp(direction, Math.min(1, deltaSeconds * 16)).normalize()
    const targetAngle = Math.atan2(-this.forward.x, -this.forward.z)
    const angleDifference = Math.atan2(Math.sin(targetAngle - this.group.rotation.y), Math.cos(targetAngle - this.group.rotation.y))
    this.group.rotation.y += angleDifference * Math.min(1, deltaSeconds * 15)
  }

  /** Smoothly applies each state's body, weapon, cloak, glow, and attack-pose targets. */
  private updatePose(deltaSeconds: number): void {
    const pose = this.getPoseTargets()
    const blend = 1 - Math.exp(-deltaSeconds * pose.blendRate)
    this.armor.rotation.x += (pose.armorLean - this.armor.rotation.x) * blend
    this.cloak.rotation.z += (pose.cloakTilt - this.cloak.rotation.z) * blend
    this.swordPivot.rotation.z += (pose.swordAngle - this.swordPivot.rotation.z) * blend
    this.emberCore.material.emissiveIntensity += (pose.coreIntensity - this.emberCore.material.emissiveIntensity) * blend
    const attacking = this.state.kind === 'attack'
    this.slash.material.opacity = attacking ? Math.sin(Math.min(1, this.state.stateTime / 0.34) * Math.PI) * 0.8 : 0
    this.slash.rotation.z = attacking ? -1.2 + Math.min(1, this.state.stateTime / 0.34) * 2.4 : -1.2
  }

  /** Returns blend targets for the current visible state without mutating meshes. */
  private getPoseTargets(): { armorLean: number; cloakTilt: number; swordAngle: number; coreIntensity: number; blendRate: number } {
    switch (this.state.kind) {
      case 'walk': return { armorLean: 0.08, cloakTilt: Math.sin(this.state.stateTime * 9) * 0.08, swordAngle: -0.2, coreIntensity: 3.5, blendRate: 9 }
      case 'run': return { armorLean: 0.2, cloakTilt: Math.sin(this.state.stateTime * 15) * 0.17, swordAngle: 0.15, coreIntensity: 4.2, blendRate: 14 }
      case 'attack': return { armorLean: 0.32, cloakTilt: -0.14, swordAngle: -0.92 + Math.min(1, this.state.stateTime / 0.34) * 1.85, coreIntensity: 6.6, blendRate: 20 }
      case 'chant': return { armorLean: -0.08, cloakTilt: 0.06, swordAngle: 0.54, coreIntensity: 7.3, blendRate: 8 }
      case 'cast': return { armorLean: -0.18, cloakTilt: -0.18, swordAngle: 0.88, coreIntensity: 10.2, blendRate: 13 }
      default: return { armorLean: 0, cloakTilt: Math.sin(performance.now() * 0.002) * 0.025, swordAngle: -0.35, coreIntensity: 3.4, blendRate: 8 }
    }
  }
}
