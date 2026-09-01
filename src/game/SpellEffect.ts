import * as THREE from 'three'
import type { PlayerStateKind } from './playerState'

/** Renders the procedural visual layers used by the player's chant, cast, and dash. */
export class SpellEffect {
  /** Root effect object mounted as a child of the player. */
  public readonly group = new THREE.Group()
  /** Rotating ground glyph visible through chant and cast phases. */
  private readonly glyph: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  /** Large post-release energy column. */
  private readonly energyColumn: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>
  /** Expanding ground pulse emitted at cast impact. */
  private readonly pulse: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  /** Small emissive particles arranged into two counter-rotating rings. */
  private readonly orbitParticles: THREE.Mesh[] = []
  /** Fading visual traces left behind by cast and dash movement. */
  private readonly afterimages: THREE.Mesh[] = []
  /** Time remaining for a dash afterimage burst. */
  private dashTrailTime = 0

  /** Creates all procedural effect meshes in an initially dormant state. */
  public constructor() {
    const glyphMaterial = new THREE.MeshBasicMaterial({ color: 0xff9e5c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    this.glyph = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.85, 6, 2), glyphMaterial)
    this.glyph.rotation.x = -Math.PI / 2
    this.glyph.position.y = -0.08

    this.energyColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.92, 0.2, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc28c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.energyColumn.position.y = 1.9

    this.pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.08, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd2a1, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.pulse.rotation.x = -Math.PI / 2
    this.pulse.position.y = -0.05

    const particleGeometry = new THREE.SphereGeometry(0.065, 8, 8)
    for (let index = 0; index < 18; index += 1) {
      const particle = new THREE.Mesh(
        particleGeometry,
        new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0xffc576 : 0xff6c45, transparent: true, opacity: 0, depthWrite: false }),
      )
      this.orbitParticles.push(particle)
      this.group.add(particle)
    }

    const afterimageGeometry = new THREE.ConeGeometry(0.38, 1.3, 6)
    for (let index = 0; index < 4; index += 1) {
      const afterimage = new THREE.Mesh(
        afterimageGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffa261, transparent: true, opacity: 0, depthWrite: false }),
      )
      afterimage.visible = false
      this.afterimages.push(afterimage)
      this.group.add(afterimage)
    }

    this.group.add(this.glyph, this.energyColumn, this.pulse)
  }

  /**
   * Updates all spell visuals to match the player's state and animation time.
   *
   * @param deltaSeconds - Elapsed simulation time used for trail fade timing.
   * @param state - Current player action state.
   * @param stateTime - Seconds elapsed since the current state began.
   * @returns {void} No return value.
   * @sideEffects Transforms and changes opacity of effect meshes.
   */
  public update(deltaSeconds: number, state: PlayerStateKind, stateTime: number): void {
    const chanting = state === 'chant'
    const casting = state === 'cast'
    const active = chanting || casting
    const glyphOpacity = chanting ? Math.min(0.76, stateTime * 1.8) : casting ? Math.max(0, 0.72 - stateTime * 0.7) : 0
    this.glyph.material.opacity = glyphOpacity
    this.glyph.rotation.z += deltaSeconds * (chanting ? 1.6 : 4.8)
    this.glyph.scale.setScalar(active ? 0.92 + Math.sin(stateTime * 4) * 0.05 + (casting ? stateTime * 0.55 : 0) : 0.01)

    this.updateOrbitParticles(stateTime, chanting, casting)
    this.updateCastBurst(stateTime, casting)
    this.updateAfterimages(deltaSeconds, casting, stateTime)
  }

  /**
   * Starts the short afterimage burst emitted during a dash.
   *
   * @returns {void} No return value.
   * @sideEffects Makes afterimage meshes visible and resets their fade timer.
   */
  public triggerDashTrail(): void {
    this.dashTrailTime = 0.32
    this.afterimages.forEach((afterimage, index) => {
      afterimage.visible = true
      afterimage.position.set(0, 0.55, 0.45 + index * 0.45)
      const material = afterimage.material as THREE.MeshBasicMaterial
      material.opacity = 0.44 - index * 0.07
      afterimage.scale.setScalar(1 - index * 0.1)
    })
  }

  /**
   * Releases GPU resources held by all materials and geometries created by this effect.
   *
   * @returns {void} No return value.
   * @sideEffects Disposes reusable geometry and material objects.
   */
  public dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
  }

  /**
   * Positions two particle rings around the player during chant and cast.
   *
   * @param stateTime - Elapsed current-state time controlling angular phase.
   * @param chanting - Whether particles should slowly rise in the chant phase.
   * @param casting - Whether particles should accelerate and expand in the cast phase.
   * @returns {void} No return value.
   * @sideEffects Updates particle positions and material opacity.
   */
  private updateOrbitParticles(stateTime: number, chanting: boolean, casting: boolean): void {
    const active = chanting || casting
    this.orbitParticles.forEach((particle, index) => {
      const ring = index % 2
      const phase = index / 9 * Math.PI * 2 + stateTime * (ring === 0 ? 4 : -3.4)
      const radius = active ? 0.78 + ring * 0.35 + (casting ? stateTime * 0.48 : 0) : 0
      particle.position.set(Math.cos(phase) * radius, 0.3 + ring * 0.48 + (chanting ? Math.sin(stateTime * 3 + index) * 0.12 : 0), Math.sin(phase) * radius)
      const material = particle.material as THREE.MeshBasicMaterial
      material.opacity = active ? (casting ? Math.max(0, 0.88 - stateTime * 0.74) : 0.74) : 0
    })
  }

  /**
   * Animates the energy column and floor pulse after a cast release.
   *
   * @param stateTime - Elapsed cast time.
   * @param casting - Whether the player is currently casting.
   * @returns {void} No return value.
   * @sideEffects Changes column and pulse mesh scale and opacity.
   */
  private updateCastBurst(stateTime: number, casting: boolean): void {
    const columnProgress = Math.min(1, stateTime / 0.16)
    this.energyColumn.scale.set(1 + stateTime * 0.5, casting ? columnProgress * (1.8 - Math.min(1, stateTime)) * 10 : 0.01, 1 + stateTime * 0.5)
    this.energyColumn.material.opacity = casting ? Math.max(0, 0.7 - stateTime * 0.72) : 0
    const pulseProgress = Math.max(0, Math.min(1, (stateTime - 0.2) / 0.38))
    this.pulse.scale.setScalar(casting ? 0.01 + pulseProgress * 4.4 : 0.01)
    this.pulse.material.opacity = casting ? Math.max(0, 0.82 - pulseProgress * 0.82) : 0
  }

  /**
   * Fades cast afterimages and separately maintains dash afterimages.
   *
   * @param deltaSeconds - Elapsed simulation time used by the dash trail.
   * @param casting - Whether a cast is currently active.
   * @param stateTime - Elapsed cast time used for cast afterimage fade.
   * @returns {void} No return value.
   * @sideEffects Shows, positions, and fades afterimage meshes.
   */
  private updateAfterimages(deltaSeconds: number, casting: boolean, stateTime: number): void {
    this.dashTrailTime = Math.max(0, this.dashTrailTime - deltaSeconds)
    const castTrailActive = casting && stateTime > 0.16 && stateTime < 0.78
    const trailProgress = castTrailActive ? (stateTime - 0.16) / 0.62 : 1
    this.afterimages.forEach((afterimage, index) => {
      const visible = castTrailActive || this.dashTrailTime > 0
      afterimage.visible = visible
      if (!visible) return
      if (castTrailActive) {
        afterimage.position.set(0, 0.48, 0.35 + index * 0.5 + trailProgress * 0.7)
        const material = afterimage.material as THREE.MeshBasicMaterial
        material.opacity = Math.max(0, 0.42 - trailProgress * 0.42 - index * 0.055)
      } else {
        const material = afterimage.material as THREE.MeshBasicMaterial
        material.opacity = (this.dashTrailTime / 0.32) * (0.44 - index * 0.07)
      }
    })
  }
}
