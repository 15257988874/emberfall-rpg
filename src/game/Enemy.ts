import * as THREE from 'three'
import { enemyCombatProfile, type EnemyCombatProfile } from './combat'
import { advanceEnemyAttack, createEnemyAttackState, type EnemyAttackEvent, type EnemyAttackState } from './enemyAttack'
import type { EncounterEnemyKind } from './encounter'

/** Displays and updates one formation-aware abyss enemy. */
export class Enemy {
  /** Combat role determining durability, speed, and presentation. */
  public readonly kind: EncounterEnemyKind
  /** Root object added to the Three.js scene. */
  public readonly group = new THREE.Group()
  /** Current remaining health; three successful attacks defeat this prototype enemy. */
  public health: number
  /** Maximum health used by later world UI and damage feedback. */
  public readonly maxHealth: number
  /** Indicates whether the enemy remains targetable and visible. */
  public alive = true
  /** Material changed briefly to communicate a successful melee hit. */
  private readonly shellMaterial = new THREE.MeshStandardMaterial({ color: 0x4b2630, roughness: 0.5, metalness: 0.42, emissive: 0x24070a, emissiveIntensity: 1.2 })
  /** Remaining seconds of the enemy hit flash. */
  private hitFlashTime = 0
  /** Deterministic windup and recovery state that gates each outgoing attack. */
  private attackState: EnemyAttackState = createEnemyAttackState()
  /** Remaining time for the visible ground warning before an attack resolves. */
  private telegraphTime = 0
  /** Ground ring that makes enemy attack timing legible to the player. */
  private readonly telegraph: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  /** Combat reach and damage configuration for this runtime role. */
  private readonly combat: EnemyCombatProfile

  /**
   * Creates an enemy mesh, combat profile, and optionally staggered first attack timing.
   *
   * @param kind - Combat role determining visual and combat presentation.
   * @param threat - Positive encounter threat used to scale maximum health.
   * @param initialAttackDelaySeconds - Initial cooldown that prevents a fresh group from attacking in one frame.
   * @returns {Enemy} A live enemy ready to add to the Three.js scene.
   * @sideEffects Allocates mesh geometry and materials.
   */
  public constructor(kind: EncounterEnemyKind = 'crawler', threat = 1, initialAttackDelaySeconds = 0) {
    this.kind = kind
    this.combat = enemyCombatProfile(kind)
    this.attackState = createEnemyAttackState(initialAttackDelaySeconds)
    this.maxHealth = ({ crawler: 3, wraith: 4, hunter: 5, brute: 7, boss: 26 }[kind]) * Math.max(1, threat)
    this.health = this.maxHealth
    this.group.position.set(0, 0.2, -5.8)
    const radius = kind === 'boss' ? 1.35 : kind === 'brute' ? 1.02 : 0.83
    const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), this.shellMaterial)
    shell.position.y = 0.82
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xff754b, emissive: 0xef280d, emissiveIntensity: 4 }),
    )
    core.position.set(0, radius, -radius * 0.7)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.055, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xff542b, transparent: true, opacity: 0.7 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.scale.setScalar(radius)
    ring.position.y = 0.06
    this.telegraph = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 0.89, 36),
      new THREE.MeshBasicMaterial({ color: this.isRanged ? 0x8ac6ff : 0xff855c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    )
    this.telegraph.rotation.x = -Math.PI / 2
    this.telegraph.position.y = 0.095
    this.group.add(shell, core, ring, this.telegraph)
  }

  /**
   * Moves the enemy toward its assigned formation destination while tracking the player for attack range.
   *
   * @param deltaSeconds - Elapsed simulation time capped by the game loop.
   * @param target - Player world position that the enemy pursues.
   * @param formationDestination - Stable desired world point assigned to this enemy's encounter slot.
   * @param attackPermitted - Whether this enemy currently owns an engagement slot for attack windups.
   * @returns {EnemyAttackEvent | null} A telegraph, melee, or projectile event emitted this frame.
   * @sideEffects Transforms the enemy mesh, updates attack timing, and fades hit and telegraph feedback.
   */
  public update(deltaSeconds: number, target: THREE.Vector3, formationDestination: THREE.Vector3, attackPermitted = true): EnemyAttackEvent | null {
    if (!this.alive) {
      return null
    }

    const playerDirection = target.clone().sub(this.group.position)
    playerDirection.y = 0
    const distance = playerDirection.length()
    const formationDirection = formationDestination.clone().sub(this.group.position)
    formationDirection.y = 0
    const formationDistance = formationDirection.length()

    if (formationDistance > 0.16) {
      formationDirection.normalize()
      this.group.position.addScaledVector(formationDirection, Math.min(formationDistance, deltaSeconds * 2.25))
    } else if (this.isRanged && distance < this.combat.range * 0.43 && distance > 0.001) {
      playerDirection.normalize()
      this.group.position.addScaledVector(playerDirection, -deltaSeconds * 1.5)
    }
    if (distance > 0.001) this.group.rotation.y = Math.atan2(-playerDirection.x, -playerDirection.z)

    this.hitFlashTime = Math.max(0, this.hitFlashTime - deltaSeconds)
    this.telegraphTime = Math.max(0, this.telegraphTime - deltaSeconds)
    this.shellMaterial.emissiveIntensity = this.hitFlashTime > 0 ? 4.5 : 1.2
    this.group.rotation.z = Math.sin(performance.now() * 0.004) * 0.06
    const distanceAfterMovement = Math.hypot(target.x - this.group.position.x, target.z - this.group.position.z)
    const attack = advanceEnemyAttack(this.attackState, this.kind, attackPermitted && distanceAfterMovement <= this.combat.range, deltaSeconds)
    this.attackState = attack.state
    if (attack.event?.type === 'telegraph') this.telegraphTime = attack.event.duration
    this.updateTelegraph()

    return attack.event
  }

  /** Updates the warning ring's expansion and opacity from its remaining attack windup time. */
  private updateTelegraph(): void {
    const active = this.telegraphTime > 0
    this.telegraph.visible = active
    if (!active) return
    const duration = this.isRanged ? (this.kind === 'hunter' ? 0.62 : 0.72) : this.kind === 'brute' ? 0.5 : 0.34
    const normalizedProgress = 1 - this.telegraphTime / duration
    this.telegraph.scale.setScalar(1 + normalizedProgress * (this.isRanged ? 2.1 : 1.2))
    this.telegraph.material.opacity = 0.28 + Math.sin(normalizedProgress * Math.PI) * 0.44
  }

  /** Reports whether this role attacks at range instead of making direct contact. */
  private get isRanged(): boolean { return this.kind === 'wraith' || this.kind === 'hunter' }

  /**
   * Applies combat damage and hides the enemy once its health is spent.
   *
   * @param damage - Positive damage delivered by the player action after progression scaling.
   * @returns {boolean} `true` when this strike defeats the enemy; otherwise `false`.
   * @sideEffects Decrements health, triggers a flash, and may hide the entity mesh.
   */
  public takeHit(damage = 1): boolean {
    if (!this.alive) {
      return false
    }

    this.health = Math.max(0, this.health - Math.max(0, damage))
    this.hitFlashTime = 0.16

    if (this.health <= 0) {
      this.alive = false
      this.group.visible = false
      return true
    }

    return false
  }
}
