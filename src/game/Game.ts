import * as THREE from 'three'
import { Enemy } from './Enemy'
import { EnemyProjectile } from './EnemyProjectile'
import { PlayerFirebolt } from './PlayerFirebolt'
import { LootDrop, RELIC_TIER_COLORS } from './LootDrop'
import { calculateEncounterRewards, createEncounter, recordEnemyDefeat, type Encounter } from './encounter'
import { enemyCombatProfile, mitigateDamage, type EnemyDamageType } from './combat'
import { activeMeleeSlots } from './enemyEngagement'
import { formationTarget } from './enemyFormation'
import { applyExperience, calculateCombatStats, createProgression, rollRelic, type Progression, type Relic } from './progression'
import { tryCollectRelic } from './loot'
import { resolvePauseState } from './pause'
import { canReleaseFirebolt, resolveLockedTarget } from './targeting'
import { decodeSave, encodeSave } from './save'
import { InputController } from './InputController'
import { Player } from './Player'
import { DEFAULT_TRAVELER_NAME, normalizeTravelerName } from './traveler'
import { applyRuneChoice, createRuneDraft, runeDamageMultiplier, runeEffect, type RuneDefinition, type RuneRanks } from './rune'
import { AudioEngine } from './AudioEngine'
import { enemyMinimapColor, projectMinimapPoint } from './minimap'

/** Collects DOM elements whose contents reflect the current combat state. */
interface GameHud {
  /** Current traveler identity displayed above the player health meter. */
  travelerName: HTMLElement
  /** Fill element that represents the player's remaining health. */
  playerHealthFill: HTMLDivElement
  /** Player current/max health text. */
  playerHealthText: HTMLElement
  /** Fill element that represents the enemy's remaining health. */
  enemyHealthFill: HTMLDivElement
  /** Textual enemy combat state. */
  enemyState: HTMLParagraphElement
  /** Transient center-screen combat feedback. */
  combatMessage: HTMLDivElement
  /** Textual current player state indicator. */
  playerState: HTMLParagraphElement
  /** Current potion quantity indicator. */
  potionCount: HTMLParagraphElement
  /** Current regional objective progress text. */
  objective: HTMLParagraphElement
  /** Player advancement and run score summary. */
  rewards: HTMLParagraphElement
  /** Current level and occupied relic-slot count. */
  relicSummary: HTMLElement
  /** Six display slots matching the persistent relic inventory order. */
  relicSlots: HTMLElement[]
  /** Overlay that visually confirms the combat simulation is frozen. */
  pauseOverlay: HTMLElement
  /** Button used to toggle ambient music and combat cues. */
  audioToggle: HTMLButtonElement
  /** Canvas displaying nearby enemies around the traveler. */
  minimapCanvas: HTMLCanvasElement
}

/** Owns the Three.js scene, frame simulation, and DOM HUD for the prototype. */
export class Game {
  /** WebGL renderer used to draw the arena. */
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  /** Root Three.js world. */
  private readonly scene = new THREE.Scene()
  /** Elevated perspective camera that follows the player. */
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80)
  /** Input source for movement and one-shot attacks. */
  private readonly input = new InputController()
  /** Procedural music and combat cue engine, unlocked from the start gesture. */
  private readonly audio = new AudioEngine()
  /** Controllable ember knight. */
  private readonly player = new Player()
  /** Player-selected identity persisted into the browser-local run profile. */
  private travelerName = DEFAULT_TRAVELER_NAME
  /** Current procedurally seeded regional encounter. */
  private encounter: Encounter = createEncounter('蚀光晶原', 1, 19)
  /** Runtime meshes paired with encounter enemy ids. */
  private enemies: Array<{ id: string; entity: Enemy }> = []
  /** Active ranged attacks that remain dodgeable between release and impact. */
  private projectiles: EnemyProjectile[] = []
  /** Active player firebolts traveling toward their selected enemies. */
  private playerFirebolts: PlayerFirebolt[] = []
  /** Ground relics awaiting a nearby traveler pickup. */
  private lootDrops: LootDrop[] = []
  /** Heads-up display nodes updated after combat changes. */
  private readonly hud: GameHud
  /** Clock used to calculate simulation deltas. */
  private readonly clock = new THREE.Clock()
  /** Converts canvas pointer coordinates into terrain world positions. */
  private readonly raycaster = new THREE.Raycaster()
  /** Normalized pointer coordinate supplied to the terrain raycaster. */
  private readonly pointer = new THREE.Vector2()
  /** Existing floor mesh that accepts click-to-walk raycasts. */
  private arenaFloor: THREE.Mesh | null = null
  /** Animation frame identifier cleared during disposal. */
  private animationFrame = 0
  /** Remaining lockout time before another basic attack may begin. */
  private attackCooldown = 0
  /** Remaining lockout before another dash may start. */
  private dashCooldown = 0
  /** Remaining lockout before another shield may start. */
  private shieldCooldown = 0
  /** Remaining lockout before a selected enemy can receive another automatic firebolt. */
  private fireboltCooldown = 0
  /** Remaining duration for the central combat feedback message. */
  private messageTime = 0
  /** Experience earned from this active regional encounter. */
  private experience = 0
  /** Ember currency earned from enemies and cleansing. */
  private embers = 0
  /** Score eligible for later local and online leaderboards. */
  private score = 0
  /** Persistent-in-memory progression earned during this run. */
  private progression: Progression = createProgression()
  /** Permanent rune ranks selected after cleansing each region. */
  private runeRanks: RuneRanks = {}
  /** Time remaining before a cleansed region becomes a higher-threat encounter. */
  private respawnTime = 0
  /** Elapsed active-combat time used to rotate the limited melee engagement slots. */
  private encounterCombatTime = 0
  /** Whether the traveler has dismissed the opening gate and allowed combat simulation to run. */
  private started = false
  /** Whether the active encounter simulation is intentionally frozen by the player. */
  private paused = false
  /** Stable encounter id of the enemy selected by the latest valid pointer click. */
  private lockedEnemyId: string | null = null
  /** Ground reticle rendered below the currently selected enemy. */
  private readonly targetReticle = new THREE.Mesh(
    new THREE.TorusGeometry(0.94, 0.045, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthWrite: false }),
  )
  /** Opening interface that accepts the active traveler identity. */
  private startOverlay: HTMLElement | null = null
  /** Form listener target retained so disposal can release the event handler. */
  private startForm: HTMLFormElement | null = null
  /** Rune selection layer shown between cleansed encounters. */
  private runeOverlay: HTMLElement | null = null
  /** Whether combat is waiting for the traveler to select one rune. */
  private runeSelectionActive = false
  /** Current deterministic rune choices rendered in the selection layer. */
  private runeChoices: RuneDefinition[] = []

  /**
   * Creates and mounts a complete playable prototype into the supplied container.
   *
   * @param container - Empty DOM element that receives the canvas and game HUD.
   * @returns {Game} A running game instance.
   * @sideEffects Adds DOM nodes, keyboard listeners, a WebGL context, and an animation loop.
   */
  public constructor(container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.className = 'game-canvas'
    container.append(this.renderer.domElement)
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)

    this.configureScene()
    this.createArena()
    this.targetReticle.rotation.x = Math.PI / 2
    this.targetReticle.position.y = 0.13
    this.targetReticle.visible = false
    this.scene.add(this.targetReticle)
    this.restoreSave()
    this.hud = this.createHud(container)
    this.hud.audioToggle.addEventListener('click', this.onAudioToggle)
    this.syncAudioToggle()
    this.createRuneOverlay(container)
    this.scene.add(this.player.group)
    this.spawnEncounter()
    this.createStartOverlay(container)
    window.addEventListener('resize', this.onResize)
    this.onResize()
    this.animate()
  }

  /**
   * Stops rendering and releases global listeners and GPU resources.
   *
   * @returns {void} No return value.
   * @sideEffects Cancels animation, removes DOM event listeners, and disposes renderer resources.
   */
  public dispose(): void {
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.onResize)
    this.input.dispose()
    this.audio.dispose()
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.startForm?.removeEventListener('submit', this.onStartSubmit)
    this.runeOverlay?.removeEventListener('click', this.onRuneChoiceClick)
    this.hud.audioToggle.removeEventListener('click', this.onAudioToggle)
    this.player.dispose()
    this.projectiles.forEach((projectile) => projectile.dispose())
    this.playerFirebolts.forEach((firebolt) => firebolt.dispose())
    this.lootDrops.forEach((drop) => drop.dispose())
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.renderer.dispose()
  }

  /** Resizes renderer output and camera projection to the viewport. */
  private readonly onResize = (): void => {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  /**
   * Converts a canvas click into regroup, enemy lock, loot approach target, or ordinary click-to-walk movement.
   *
   * @param event - Pointer event relative to the renderer canvas.
   * @returns {void} No return value.
   * @sideEffects Restores a defeated player or updates the selected enemy, loot, or floor target.
   */
  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.arenaFloor || event.button !== 0 || this.runeSelectionActive) return
    if (this.player.isDefeated) {
      this.player.revive()
      this.input.clearMoveTarget()
      this.projectiles.forEach((projectile) => {
        this.scene.remove(projectile.group)
        projectile.dispose()
      })
      this.projectiles = []
      this.clearLockedEnemy()
      this.showCombatMessage('余烬重燃 · 获得短暂庇护')
      return
    }
    const bounds = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const selectedLoot = this.lootDrops.find((drop) => this.raycaster.intersectObject(drop.group, true).length > 0)
    if (selectedLoot) {
      this.input.setMoveTarget({ x: selectedLoot.group.position.x, z: selectedLoot.group.position.z })
      this.showCombatMessage(`${selectedLoot.relic.tier} 遗物已锁定`)
      return
    }
    const selectedEnemy = this.enemies.find(({ entity }) => entity.alive && this.raycaster.intersectObject(entity.group, true).length > 0)
    if (selectedEnemy) {
      this.lockedEnemyId = resolveLockedTarget(this.lockedEnemyId, selectedEnemy.id, this.getLivingEnemies().map(({ id }) => id))
      this.input.clearMoveTarget()
      this.player.faceTarget({ x: selectedEnemy.entity.group.position.x, z: selectedEnemy.entity.group.position.z })
      this.showCombatMessage(`锁定 ${selectedEnemy.entity.kind} · 火矢预备`)
      return
    }
    const hit = this.raycaster.intersectObject(this.arenaFloor, false)[0]
    if (hit) this.input.setMoveTarget({ x: hit.point.x, z: hit.point.z })
  }

  /** Sets global fog, lighting, and initial camera placement. */
  private configureScene(): void {
    this.scene.background = new THREE.Color(0x101116)
    this.scene.fog = new THREE.FogExp2(0x101116, 0.052)

    const ambient = new THREE.HemisphereLight(0x6f7ca0, 0x210d08, 1.55)
    this.scene.add(ambient)

    const moonlight = new THREE.DirectionalLight(0xb9cbff, 2.25)
    moonlight.position.set(-8, 15, 7)
    moonlight.castShadow = true
    moonlight.shadow.mapSize.set(1024, 1024)
    moonlight.shadow.camera.left = -14
    moonlight.shadow.camera.right = 14
    moonlight.shadow.camera.top = 14
    moonlight.shadow.camera.bottom = -14
    this.scene.add(moonlight)

    const lavaLight = new THREE.PointLight(0xff4826, 16, 16, 2)
    lavaLight.position.set(-3, 1.6, -3)
    this.scene.add(lavaLight)

    this.camera.position.set(0, 13.2, 11.5)
    this.camera.lookAt(0, 0, 0)
  }

  /** Creates a volcanic stone arena, glowing fissures, ruined pillars, and floating embers. */
  private createArena(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 30, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x23232a, roughness: 0.93, metalness: 0.05 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    this.arenaFloor = floor

    const tileMaterial = new THREE.MeshStandardMaterial({ color: 0x35343c, roughness: 0.86, metalness: 0.1 })
    for (let x = -7; x <= 7; x += 1) {
      for (let z = -6; z <= 6; z += 1) {
        if ((x + z) % 3 === 0) {
          const tile = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), tileMaterial)
          tile.position.set(x * 2.1, 0.02, z * 2.1)
          tile.rotation.y = ((x * 7 + z * 11) % 4) * 0.04
          tile.receiveShadow = true
          this.scene.add(tile)
        }
      }
    }

    const fissureMaterial = new THREE.MeshBasicMaterial({ color: 0xff4a24, transparent: true, opacity: 0.92 })
    const fissures = [
      [-4.2, -5.1, 5.8, 0.08],
      [4.8, -2.8, 4.6, -0.32],
      [0.5, 4.4, 5.2, 0.44],
      [-7.3, 4.5, 3.6, -0.7],
    ]
    fissures.forEach(([x, z, length, rotation]) => {
      const fissure = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.17), fissureMaterial)
      fissure.rotation.set(-Math.PI / 2, 0, rotation)
      fissure.position.set(x, 0.075, z)
      this.scene.add(fissure)
    })

    const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2b34, roughness: 0.74, metalness: 0.18 })
    const pillarPositions = [[-11, -8, 3.4], [11, -7, 4.8], [-12, 6, 4.2], [12, 6, 3.1]]
    pillarPositions.forEach(([x, z, height]) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.66, height, 7), pillarMaterial)
      pillar.position.set(x, height / 2, z)
      pillar.rotation.z = (x + z) * 0.012
      pillar.castShadow = true
      pillar.receiveShadow = true
      this.scene.add(pillar)
    })

    const emberGeometry = new THREE.BufferGeometry()
    const emberCount = 130
    const emberPositions = new Float32Array(emberCount * 3)
    for (let index = 0; index < emberCount; index += 1) {
      const offset = index * 3
      emberPositions[offset] = (Math.random() - 0.5) * 30
      emberPositions[offset + 1] = Math.random() * 4.5 + 0.1
      emberPositions[offset + 2] = (Math.random() - 0.5) * 26
    }
    emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
    const embers = new THREE.Points(
      emberGeometry,
      new THREE.PointsMaterial({ color: 0xff9055, size: 0.055, transparent: true, opacity: 0.72, sizeAttenuation: true }),
    )
    this.scene.add(embers)
  }

  /**
   * Creates the overlay required to communicate current combat state.
   *
   * @param container - Parent application element above which the overlay is mounted.
   * @returns {GameHud} References used by the simulation to update the overlay.
   * @sideEffects Appends HUD elements to the application container.
   */
  private createHud(container: HTMLElement): GameHud {
    const hud = document.createElement('aside')
    hud.className = 'hud'
    hud.innerHTML = `
      <header class="brand-lockup"><span class="eyebrow">ASHEN REALM // 01</span><h1>余烬深渊</h1></header>
      <section class="vital-panel player-panel"><span class="player-identity"></span><div class="meter"><i></i></div><b>100 / 100</b></section>
      <section class="vital-panel enemy-panel"><span>深渊哨卫</span><div class="meter enemy-meter"><i></i></div><p>锁定目标</p></section>
      <section class="state-panel"><span>姿态</span><p>待机</p><b>药剂 3</b></section>
      <section class="objective-panel"><span>当前试炼</span><p>清除区域中的腐化物</p><b>剩余 7 个敌人</b><i>进度 0%</i><em>等级 1 · 遗物 0 / 6</em></section>
      <ol class="relic-rack" aria-label="遗物槽"><li class="relic-slot empty"></li><li class="relic-slot empty"></li><li class="relic-slot empty"></li><li class="relic-slot empty"></li><li class="relic-slot empty"></li><li class="relic-slot empty"></li></ol>
      <div class="combat-message" aria-live="polite"></div>
      <section class="pause-overlay" aria-live="polite" aria-hidden="true"><span>试炼已暂停</span><b>按 ESC 继续</b></section>
      <button class="audio-toggle" type="button" aria-label="切换音乐与音效" title="音乐与音效"><span>♫</span><b>声场</b></button>
      <canvas class="minimap" width="140" height="140" aria-label="区域小地图"></canvas>
      <div class="key-hints" aria-label="操作按键"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span></span><kbd class="space-key">SPACE</kbd></div>
    `
    container.append(hud)

    return {
      travelerName: hud.querySelector('.player-identity') as HTMLElement,
      playerHealthFill: hud.querySelector('.player-panel i') as HTMLDivElement,
      playerHealthText: hud.querySelector('.player-panel b') as HTMLElement,
      enemyHealthFill: hud.querySelector('.enemy-meter i') as HTMLDivElement,
      enemyState: hud.querySelector('.enemy-panel p') as HTMLParagraphElement,
      combatMessage: hud.querySelector('.combat-message') as HTMLDivElement,
      playerState: hud.querySelector('.state-panel p') as HTMLParagraphElement,
      potionCount: hud.querySelector('.state-panel b') as HTMLParagraphElement,
      objective: hud.querySelector('.objective-panel b') as HTMLParagraphElement,
      rewards: hud.querySelector('.objective-panel i') as HTMLParagraphElement,
      relicSummary: hud.querySelector('.objective-panel em') as HTMLElement,
      relicSlots: Array.from(hud.querySelectorAll<HTMLElement>('.relic-slot')),
      pauseOverlay: hud.querySelector('.pause-overlay') as HTMLElement,
      audioToggle: hud.querySelector('.audio-toggle') as HTMLButtonElement,
      minimapCanvas: hud.querySelector('.minimap') as HTMLCanvasElement,
    }
  }

  /** Creates the post-region rune choice layer and delegates card clicks to one listener. */
  private createRuneOverlay(container: HTMLElement): void {
    const overlay = document.createElement('section')
    overlay.className = 'rune-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    overlay.innerHTML = `
      <div class="rune-dialog" role="dialog" aria-labelledby="rune-title">
        <span class="rune-overline">区域净化 // 余烬回响</span>
        <h2 id="rune-title">选择一枚符文</h2>
        <p>让下一片深渊按照你的方式燃烧。</p>
        <div class="rune-choices"></div>
      </div>
    `
    overlay.addEventListener('click', this.onRuneChoiceClick)
    container.append(overlay)
    this.runeOverlay = overlay
  }

  /** Opens the deterministic rune draft after the current region has been cleansed. */
  private openRuneDraft(): void {
    this.runeChoices = createRuneDraft(this.encounter.threat + this.encounter.cleansedCount, this.runeRanks)
    if (this.runeChoices.length === 0) return
    const choiceHost = this.runeOverlay?.querySelector<HTMLElement>('.rune-choices')
    if (!choiceHost) return
    choiceHost.innerHTML = this.runeChoices.map((rune) => {
      const currentRank = this.runeRanks[rune.id] ?? 0
      return `<button class="rune-card rune-${rune.skill}" type="button" data-rune-id="${rune.id}">
        <span class="rune-glyph">${rune.glyph}</span><span class="rune-skill">${rune.skill}</span>
        <strong>${rune.name}</strong><p>${rune.description(currentRank + 1)}</p><small>当前 ${currentRank} · 等级 ${currentRank + 1} / ${rune.maxRank}</small>
      </button>`
    }).join('')
    this.runeSelectionActive = true
    this.runeOverlay?.classList.add('visible')
    this.runeOverlay?.setAttribute('aria-hidden', 'false')
  }

  /** Applies a selected rune and releases the simulation back to the next encounter timer. */
  private readonly onRuneChoiceClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-rune-id]') : null
    const runeId = target?.dataset.runeId
    if (!runeId || !this.runeSelectionActive) return
    this.runeRanks = applyRuneChoice(this.runeRanks, runeId)
    this.runeSelectionActive = false
    this.runeOverlay?.classList.remove('visible')
    this.runeOverlay?.setAttribute('aria-hidden', 'true')
    const selected = this.runeChoices.find((rune) => rune.id === runeId)
    this.showCombatMessage(`${selected?.name ?? '符文'} 已铭刻`)
    this.persistSave()
  }

  /**
   * Mounts the opening gate that collects a safe traveler identity before combat begins.
   *
   * @param container - Game root that owns both the canvas and all overlay interfaces.
   * @returns {void} No return value.
   * @sideEffects Appends a focusable form and registers its submit listener.
   */
  private createStartOverlay(container: HTMLElement): void {
    const overlay = document.createElement('section')
    overlay.className = 'start-overlay'
    overlay.innerHTML = `
      <div class="start-ritual" aria-hidden="true"><i></i><i></i><i></i></div>
      <form class="start-panel" aria-label="进入余烬深渊">
        <p class="start-kicker">EMBERFALL // DESCENT</p>
        <h2>余烬深渊</h2>
        <p class="start-copy">残响在深处苏醒。</p>
        <label for="traveler-name">旅者名</label>
        <input id="traveler-name" name="travelerName" maxlength="12" autocomplete="nickname" value="">
        <button type="submit">踏入深渊</button>
      </form>
    `
    const input = overlay.querySelector<HTMLInputElement>('#traveler-name')
    const form = overlay.querySelector<HTMLFormElement>('form')
    if (!input || !form) throw new Error('Start overlay controls are unavailable.')
    input.value = this.travelerName
    form.addEventListener('submit', this.onStartSubmit)
    container.append(overlay)
    this.startOverlay = overlay
    this.startForm = form
    requestAnimationFrame(() => input.focus())
  }

  /**
   * Persists the submitted traveler identity and begins the currently staged encounter.
   *
   * @param event - Native form-submit event emitted by the start overlay.
   * @returns {void} No return value.
   * @sideEffects Starts simulation, updates the HUD, saves the profile, and removes the opening overlay after its exit transition.
   */
  private readonly onStartSubmit = (event: Event): void => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const nameInput = form.elements.namedItem('travelerName')
    this.travelerName = normalizeTravelerName(nameInput instanceof HTMLInputElement ? nameInput.value : null)
    this.started = true
    void this.audio.unlock()
    this.persistSave()
    this.updateHud()
    this.startOverlay?.classList.add('leaving')
    window.setTimeout(() => this.startOverlay?.remove(), 260)
  }

  /** Toggles procedural music and updates the compact HUD control label. */
  private readonly onAudioToggle = (): void => {
    this.audio.toggle()
    this.syncAudioToggle()
  }

  /** Synchronizes the audio button state with the current engine preference. */
  private syncAudioToggle(): void {
    this.hud.audioToggle.classList.toggle('muted', !this.audio.enabled)
    this.hud.audioToggle.querySelector('b')!.textContent = this.audio.enabled ? '声场' : '静音'
    this.hud.audioToggle.setAttribute('aria-pressed', String(!this.audio.enabled))
  }

  /** Runs one simulation step and requests the next rendered animation frame. */
  private readonly animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate)
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    const pausePressed = this.input.consumePauseInput()
    this.paused = this.started ? resolvePauseState(this.paused, pausePressed) : false
    this.hud.pauseOverlay.classList.toggle('visible', this.paused)
    this.hud.pauseOverlay.setAttribute('aria-hidden', String(!this.paused))

    if (!this.paused && !this.runeSelectionActive) {
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds)
    this.dashCooldown = Math.max(0, this.dashCooldown - deltaSeconds)
    this.shieldCooldown = Math.max(0, this.shieldCooldown - deltaSeconds)
    this.fireboltCooldown = Math.max(0, this.fireboltCooldown - deltaSeconds)
    this.messageTime = Math.max(0, this.messageTime - deltaSeconds)
    this.respawnTime = Math.max(0, this.respawnTime - deltaSeconds)
    if (this.encounter.cleansed && this.respawnTime === 0) this.startNextEncounter()

    if (this.started && !this.player.isDefeated) {
      this.encounterCombatTime += deltaSeconds
      const moveTarget = this.input.getMoveTarget()
      const playerInput = this.input.consumePlayerInput(this.player.distanceTo(moveTarget))
      const playerFrame = this.player.update(deltaSeconds, playerInput, moveTarget)
      if (moveTarget && !playerFrame.state.mouseTargetActive) this.input.clearMoveTarget()
      this.handlePlayerActions(playerFrame.events)
      this.updateLockedEnemy(deltaSeconds)
      this.updatePlayerFirebolts(deltaSeconds)
      this.updateEnemies(deltaSeconds)
      this.updateProjectiles(deltaSeconds)
      this.updateLootDrops(deltaSeconds)
    }
    } else {
      // Discard actions issued during pause so resume cannot trigger delayed combat inputs.
      this.input.consumePlayerInput(Infinity)
    }
    this.updateCamera(deltaSeconds)
    this.updateHud()
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Applies frame-local player action events with scene-specific cooldown and damage effects.
   *
   * @param events - One-shot events emitted by the pure player state machine.
   * @returns {void} No return value.
   * @sideEffects Moves the player, starts shield/potion feedback, and damages the enemy.
   */
  private handlePlayerActions(events: import('./playerState').PlayerActionEvents): void {
    if (events.startedAttack) this.tryMelee()
    if (events.castShockwave) this.tryShockwave()
    if (events.requestedDash && this.dashCooldown === 0) {
      this.player.dash()
      const dashCooldownReduction = runeEffect(this.runeRanks, 'dash_phase')
      this.dashCooldown = Math.max(0.35, 1.25 - dashCooldownReduction)
      const blastRadius = 2.2
      const blastDamage = Math.max(1, Math.round(calculateCombatStats(this.progression).spellDamage * runeEffect(this.runeRanks, 'dash_blast')))
      this.getLivingEnemies().forEach(({ id, entity }) => {
        if (entity.group.position.distanceTo(this.player.group.position) <= blastRadius && entity.takeHit(blastDamage)) this.recordDefeat(id, entity)
      })
      if (runeEffect(this.runeRanks, 'dash_guard') > 0) this.player.activateShield(2.8 + runeEffect(this.runeRanks, 'dash_guard') * 0.03)
      this.audio.play('dash')
      this.showCombatMessage('裂隙步')
    }
    if (events.requestedShield && this.shieldCooldown === 0) {
      this.player.activateShield()
      this.shieldCooldown = 5.5
      const healingPercent = runeEffect(this.runeRanks, 'ward_heal')
      if (healingPercent > 0) this.player.health = Math.min(100, this.player.health + healingPercent)
      const pulseRadius = 4
      const pulseDamage = Math.max(1, Math.round(calculateCombatStats(this.progression).spellDamage * runeEffect(this.runeRanks, 'ward_pulse')))
      this.getLivingEnemies().forEach(({ id, entity }) => {
        if (entity.group.position.distanceTo(this.player.group.position) <= pulseRadius && entity.takeHit(pulseDamage)) this.recordDefeat(id, entity)
      })
      this.audio.play('shield')
      this.showCombatMessage('铜卫结界')
    }
    if (events.requestedPotion) {
      const potionResult = this.player.consumePotion()
      if (potionResult === 'healed') this.audio.play('potion')
      this.showCombatMessage(potionResult === 'healed' ? '生命回流' : potionResult === 'empty' ? '药剂已耗尽' : '生命已满')
    }
  }

  /**
   * Moves each live enemy toward a stable assigned ring position before processing its combat event.
   *
   * @param deltaSeconds - Elapsed simulation time shared by enemy locomotion and attack states.
   * @returns {void} No return value.
   * @sideEffects Updates enemy transforms and may create damage or projectile effects through attack events.
   */
  private updateEnemies(deltaSeconds: number): void {
    const playerPosition = this.player.group.position
    const totalSlots = this.enemies.length
    const meleeSlots = this.enemies
      .map(({ entity }, slot) => ({ entity, slot }))
      .filter(({ entity }) => entity.alive && entity.kind !== 'wraith' && entity.kind !== 'hunter')
      .map(({ slot }) => slot)
    const activeMelee = new Set(activeMeleeSlots(meleeSlots, this.encounterCombatTime))
    this.enemies.forEach(({ entity }, slot) => {
      if (!entity.alive) return
      const profile = enemyCombatProfile(entity.kind)
      const isRanged = entity.kind === 'wraith' || entity.kind === 'hunter'
      const attackPermitted = isRanged || activeMelee.has(slot)
      const radiusMultiplier = isRanged ? 0.72 : attackPermitted ? 0.9 : 2.05
      const slotPosition = formationTarget({ x: playerPosition.x, z: playerPosition.z }, slot, totalSlots, profile.range * radiusMultiplier)
      const formationDestination = new THREE.Vector3(slotPosition.x, entity.group.position.y, slotPosition.z)
      this.handleEnemyAttack(entity, entity.update(deltaSeconds, playerPosition, formationDestination, attackPermitted))
    })
  }

  /** Attempts a basic attack and applies damage only when the deterministic rule allows it. */
  private tryMelee(): void {
    if (this.attackCooldown > 0) {
      return
    }

    this.attackCooldown = 0.5
    const target = this.getLivingEnemies().find(({ entity }) => entity.group.position.distanceTo(this.player.group.position) <= 3.2)

    if (!target) {
      this.showCombatMessage('攻击落空')
      return
    }

    this.player.faceTarget({ x: target.entity.group.position.x, z: target.entity.group.position.z })
    const combatStats = calculateCombatStats(this.progression)
    const damage = Math.max(1, Math.round(combatStats.basicAttackDamage * runeDamageMultiplier('attack', this.runeRanks)))
    this.audio.play('attack')
    this.showCombatMessage(target.entity.takeHit(damage) ? this.recordDefeat(target.id, target.entity) : `余烬斩击  -  ${damage}`)
  }

  /** Applies the cast shockwave to a living enemy inside its radial range. */
  private tryShockwave(): void {
    const shockwaveRadius = 5.9 + runeEffect(this.runeRanks, 'nova_overload')
    const targets = this.getLivingEnemies().filter(({ entity }) => entity.group.position.distanceTo(this.player.group.position) <= shockwaveRadius)
    if (targets.length === 0) {
      this.showCombatMessage('余烬震环未命中')
      return
    }
    const combatStats = calculateCombatStats(this.progression)
    const damage = Math.max(1, Math.round(combatStats.spellDamage * runeDamageMultiplier('nova', this.runeRanks)))
    this.audio.play('cast')
    const vortexStrength = runeEffect(this.runeRanks, 'nova_vortex')
    if (vortexStrength > 0) {
      targets.forEach(({ entity }) => {
        const direction = this.player.group.position.clone().sub(entity.group.position).setY(0).normalize()
        entity.group.position.addScaledVector(direction, Math.min(1.4, vortexStrength * 0.55))
      })
    }
    const defeated = targets.filter(({ entity }) => entity.takeHit(damage)).map(({ id, entity }) => this.recordDefeat(id, entity))
    const echoDamage = Math.max(0, Math.round(damage * runeEffect(this.runeRanks, 'nova_echo')))
    if (echoDamage > 0) targets.forEach(({ id, entity }) => { if (entity.alive && entity.takeHit(echoDamage)) this.recordDefeat(id, entity) })
    this.showCombatMessage(defeated[0] ?? `余烬震环命中 ${targets.length} 个目标`)
  }

  /**
   * Applies a role-specific enemy attack event after its windup has resolved.
   *
   * @param enemy - Live enemy that emitted the current event.
   * @param event - Optional event generated by the enemy state machine this frame.
   * @returns {void} No return value.
   * @sideEffects May damage the player or add a projectile mesh to the scene.
   */
  private handleEnemyAttack(enemy: Enemy, event: import('./enemyAttack').EnemyAttackEvent | null): void {
    if (!event || event.type === 'telegraph') return
    if (event.type === 'melee') {
      const stillInReach = Math.hypot(
        enemy.group.position.x - this.player.group.position.x,
        enemy.group.position.z - this.player.group.position.z,
      ) <= 2.3 + (enemy.kind === 'boss' ? 1.9 : 0)
      if (stillInReach) this.applyEnemyDamage(enemy.kind, event.damage, event.damageType)
      else this.showCombatMessage(`${enemy.kind} 的攻击落空`)
      return
    }

    const projectile = new EnemyProjectile(enemy.kind, enemy.group.position, this.player.group.position, event.damage, event.damageType)
    this.projectiles.push(projectile)
    this.scene.add(projectile.group)
  }

  /**
   * Advances all active enemy projectiles and removes each impact or expired projectile immediately.
   *
   * @param deltaSeconds - Elapsed simulation time for bounded projectile movement.
   * @returns {void} No return value.
   * @sideEffects Applies projectile damage and disposes completed projectile GPU resources.
   */
  private updateProjectiles(deltaSeconds: number): void {
    this.projectiles = this.projectiles.filter((projectile) => {
      const hitPlayer = projectile.update(deltaSeconds, this.player.group.position)
      if (hitPlayer) this.applyEnemyDamage(projectile.sourceKind, projectile.damage, projectile.damageType)
      if (projectile.alive) return true
      this.scene.remove(projectile.group)
      projectile.dispose()
      return false
    })
  }

  /**
   * Keeps the selected enemy valid, positions its reticle, and releases timed firebolts in range.
   *
   * @param deltaSeconds - Elapsed simulation time used to animate the target reticle.
   * @returns {void} No return value.
   * @sideEffects May clear a stale lock, rotate the reticle, turn the player, and spawn one firebolt.
   */
  private updateLockedEnemy(deltaSeconds: number): void {
    const livingEnemies = this.getLivingEnemies()
    this.lockedEnemyId = resolveLockedTarget(this.lockedEnemyId, null, livingEnemies.map(({ id }) => id))
    const target = this.getLockedEnemy()
    this.targetReticle.visible = target !== null
    if (!target) return

    this.targetReticle.position.set(target.entity.group.position.x, 0.13, target.entity.group.position.z)
    this.targetReticle.rotation.z += deltaSeconds * 2.8
    this.player.faceTarget({ x: target.entity.group.position.x, z: target.entity.group.position.z })
    const distance = Math.hypot(target.entity.group.position.x - this.player.group.position.x, target.entity.group.position.z - this.player.group.position.z)
    if (!canReleaseFirebolt(this.lockedEnemyId, distance, this.fireboltCooldown)) return

    const firebolt = new PlayerFirebolt(
      target.id,
      this.player.group.position,
      target.entity.group.position,
      Math.max(1, Math.round(calculateCombatStats(this.progression).spellDamage * runeDamageMultiplier('attack', this.runeRanks))),
    )
    this.playerFirebolts.push(firebolt)
    this.scene.add(firebolt.group)
    this.fireboltCooldown = Math.max(0.24, 0.66 * (1 - runeEffect(this.runeRanks, 'attack_haste')))
    this.showCombatMessage(`火矢追击 ${target.entity.kind}`)
  }

  /**
   * Advances player firebolts and resolves impact only against each bolt's selected living enemy.
   *
   * @param deltaSeconds - Elapsed simulation time used to move each active firebolt.
   * @returns {void} No return value.
   * @sideEffects Damages selected enemies, records defeats, and disposes completed firebolt meshes.
   */
  private updatePlayerFirebolts(deltaSeconds: number): void {
    this.playerFirebolts = this.playerFirebolts.filter((firebolt) => {
      const target = this.enemies.find(({ id, entity }) => id === firebolt.targetId && entity.alive)
      if (!target) {
        firebolt.alive = false
      } else if (firebolt.update(deltaSeconds, target.entity.group.position)) {
        const defeated = target.entity.takeHit(firebolt.damage)
        const targetMessage = defeated ? this.recordDefeat(target.id, target.entity) : `余烬火矢  -  ${firebolt.damage}`
        const chainCount = runeEffect(this.runeRanks, 'attack_chain')
        const chainDamage = Math.max(1, Math.round(firebolt.damage * (0.3 + chainCount * 0.1)))
        if (chainCount > 0) this.getLivingEnemies().filter(({ id }) => id !== target.id).slice(0, chainCount).forEach(({ id, entity }) => { if (entity.takeHit(chainDamage)) this.recordDefeat(id, entity) })
        this.audio.play('hit')
        this.showCombatMessage(targetMessage)
      }
      if (firebolt.alive) return true
      this.scene.remove(firebolt.group)
      firebolt.dispose()
      return false
    })
  }

  /**
   * Animates ground relics and grants each one only after the traveler enters pickup range.
   *
   * @param deltaSeconds - Elapsed simulation time for hover animation.
   * @returns {void} No return value.
   * @sideEffects May update progression, save the game, dispose collected meshes, and show pickup feedback.
   */
  private updateLootDrops(deltaSeconds: number): void {
    this.lootDrops = this.lootDrops.filter((drop) => {
      drop.update(deltaSeconds)
      const collection = tryCollectRelic(this.progression, drop.relic, drop.distanceTo(this.player.group.position))
      if (!collection.collected) return true
      this.progression = collection.progression
      this.audio.play('loot')
      drop.collect()
      this.scene.remove(drop.group)
      drop.dispose()
      this.persistSave()
      this.showCombatMessage(`获得 ${drop.relic.tier} 遗物 +${drop.relic.power}`)
      return false
    })
  }

  /**
   * Applies one already-released enemy attack after physical or magic defense mitigation.
   *
   * @param sourceKind - Enemy role responsible for this hit.
   * @param rawDamage - Damage before armor, magic resistance, and shield mitigation.
   * @param damageType - Defense class determining the static player defense value.
   * @returns {void} No return value.
   * @sideEffects Decrements player health and refreshes combat feedback.
   */
  private applyEnemyDamage(sourceKind: string, rawDamage: number, damageType: EnemyDamageType): void {
    const defense = damageType === 'physical' ? 5 : 3
    const damage = mitigateDamage(rawDamage, defense, this.player.shieldActive)
    const defeated = this.player.takeDamage(damage)
    this.audio.play('enemy-hit')
    const thornsRatio = this.player.shieldActive ? runeEffect(this.runeRanks, 'ward_thorns') : 0
    if (thornsRatio > 0) {
      const attacker = this.getLivingEnemies().find(({ entity }) => entity.kind === sourceKind)
      if (attacker) {
        const reflected = Math.max(1, Math.round(calculateCombatStats(this.progression).spellDamage * thornsRatio))
        if (attacker.entity.takeHit(reflected)) this.recordDefeat(attacker.id, attacker.entity)
      }
    }
    this.showCombatMessage(defeated ? '旅者倒下 · 点击地面重新集结' : `${sourceKind} ${damageType === 'magic' ? '灵火' : '利爪'}命中 -${damage}`)
  }

  /**
   * Smoothly interpolates the elevated view toward the player's current location.
   *
   * @param deltaSeconds - Elapsed simulation time used for frame-rate independent camera damping.
   * @returns {void} No return value.
   * @sideEffects Changes camera transform and orientation.
   */
  private updateCamera(deltaSeconds: number): void {
    const target = this.player.group.position
    const desiredPosition = new THREE.Vector3(target.x, target.y + 13.2, target.z + 11.5)
    const damping = 1 - Math.exp(-deltaSeconds * 5.5)
    this.camera.position.lerp(desiredPosition, damping)
    this.camera.lookAt(target.x, 0.4, target.z - 1.4)
  }

  /** Synchronizes health and temporary combat feedback in the DOM overlay. */
  private updateHud(): void {
    const remaining = this.getLivingEnemies()
    const lockedTarget = this.getLockedEnemy()
    const target = lockedTarget?.entity ?? remaining[0]?.entity
    this.hud.enemyHealthFill.style.transform = `scaleX(${target ? target.health / target.maxHealth : 0})`
    this.hud.enemyState.textContent = target ? `${lockedTarget ? '锁定 ' : ''}${target.kind} 生命 ${target.health} / ${target.maxHealth}` : '区域已净化'
    this.hud.travelerName.textContent = this.travelerName
    this.hud.playerState.textContent = this.player.isDefeated
      ? '倒下'
      : ({ idle: '待机', walk: '步行', run: '奔跑', attack: '普攻', chant: '吟唱', cast: '施法' } as const)[this.player.state.kind]
    this.hud.playerHealthFill.style.transform = `scaleX(${this.player.health / 100})`
    this.hud.playerHealthText.textContent = `${this.player.health} / 100`
    this.hud.potionCount.textContent = `药剂 ${this.player.potions}`
    this.hud.objective.textContent = this.encounter.cleansed ? '区域净化完成' : `剩余 ${remaining.length} 个敌人`
    this.hud.rewards.textContent = `经验 ${this.progression.experience}/${this.progression.level * 100} · 余烬 ${this.progression.embers} · 积分 ${this.score}`
    const runeCount = Object.values(this.runeRanks).reduce((total, rank) => total + rank, 0)
    this.hud.relicSummary.textContent = `等级 ${this.progression.level} · 遗物 ${this.progression.relics.filter(Boolean).length} / 6 · 符文 ${runeCount}`
    this.hud.relicSlots.forEach((slot, index) => {
      const relic = this.progression.relics[index]
      slot.className = `relic-slot ${relic?.tier ?? 'empty'}`
      slot.textContent = relic ? `${relic.power}` : ''
      if (relic) slot.style.setProperty('--relic-color', `#${RELIC_TIER_COLORS[relic.tier].toString(16).padStart(6, '0')}`)
      else slot.style.removeProperty('--relic-color')
    })
    this.updateMinimap()
    this.hud.combatMessage.classList.toggle('visible', this.messageTime > 0)
  }

  /** Draws a compact top-down exploration map centered on the current traveler. */
  private updateMinimap(): void {
    const canvas = this.hud.minimapCanvas
    const context = canvas.getContext('2d')
    if (!context) return
    const size = canvas.width
    const center = { x: this.player.group.position.x, z: this.player.group.position.z }
    context.clearRect(0, 0, size, size)
    context.fillStyle = 'rgba(7, 13, 17, .74)'
    context.fillRect(0, 0, size, size)
    context.strokeStyle = 'rgba(143, 217, 210, .25)'
    context.lineWidth = 1
    context.strokeRect(.5, .5, size - 1, size - 1)
    context.beginPath()
    context.arc(size / 2, size / 2, size * .39, 0, Math.PI * 2)
    context.strokeStyle = 'rgba(143, 217, 210, .18)'
    context.stroke()
    context.strokeStyle = 'rgba(143, 217, 210, .1)'
    context.beginPath()
    context.moveTo(size / 2, 12)
    context.lineTo(size / 2, size - 12)
    context.moveTo(12, size / 2)
    context.lineTo(size - 12, size / 2)
    context.stroke()
    this.enemies.forEach(({ entity }) => {
      if (!entity.alive) return
      const marker = projectMinimapPoint({ x: entity.group.position.x, z: entity.group.position.z }, center, 14, size)
      const locked = this.lockedEnemyId !== null && this.enemies.find(({ entity: current }) => current === entity)?.id === this.lockedEnemyId
      context.fillStyle = enemyMinimapColor(entity.kind)
      context.globalAlpha = locked ? 1 : .76
      context.beginPath()
      context.arc(marker.x, marker.y, entity.kind === 'boss' ? 5 : 3, 0, Math.PI * 2)
      context.fill()
      if (locked) {
        context.strokeStyle = '#fff1bd'
        context.lineWidth = 1
        context.stroke()
      }
    })
    context.globalAlpha = 1
    context.fillStyle = '#b9e1df'
    context.beginPath()
    context.moveTo(size / 2, size / 2 - 6)
    context.lineTo(size / 2 - 4, size / 2 + 5)
    context.lineTo(size / 2 + 4, size / 2 + 5)
    context.closePath()
    context.fill()
    context.fillStyle = '#ed9b67'
    context.font = '700 8px Inter, sans-serif'
    context.fillText('N', size / 2 - 3, 11)
  }

  /**
   * Displays a short central message for a combat result.
   *
   * @param text - Human-readable result of the current attack attempt.
   * @returns {void} No return value.
   * @sideEffects Updates the HUD message and restarts its visibility timer.
   */
  private showCombatMessage(text: string): void {
    this.hud.combatMessage.textContent = text
    this.messageTime = 0.72
  }

  /** Returns living enemies sorted by current distance to the player. */
  private getLivingEnemies(): Array<{ id: string; entity: Enemy }> {
    return this.enemies.filter(({ entity }) => entity.alive).sort((left, right) => left.entity.group.position.distanceToSquared(this.player.group.position) - right.entity.group.position.distanceToSquared(this.player.group.position))
  }

  /**
   * Returns the live enemy currently selected by pointer input, if its encounter id remains valid.
   *
   * @returns {{ id: string; entity: Enemy } | null} The selected living enemy, or `null` without a valid lock.
   * @sideEffects None.
   */
  private getLockedEnemy(): { id: string; entity: Enemy } | null {
    return this.enemies.find(({ id, entity }) => id === this.lockedEnemyId && entity.alive) ?? null
  }

  /**
   * Clears the current enemy selection and hides the matching ground reticle.
   *
   * @returns {void} No return value.
   * @sideEffects Stops automatic firebolt targeting until another enemy is clicked.
   */
  private clearLockedEnemy(): void {
    this.lockedEnemyId = null
    this.targetReticle.visible = false
  }

  /** Records a kill, creates its collectible relic, updates regional progress, and returns combat feedback. */
  private recordDefeat(id: string, enemy: Enemy): string {
    const reward = calculateEncounterRewards(enemy.kind, this.encounter.threat)
    this.experience += reward.experience
    this.embers += reward.embers
    this.score += reward.score
    const previousLevel = this.progression.level
    this.progression = applyExperience({ ...this.progression, embers: this.progression.embers + reward.embers }, reward.experience)
    if (this.progression.level > previousLevel) this.audio.play('level')
    this.spawnLootDrop(rollRelic(this.encounter.threat, this.score + reward.experience), enemy.group.position)
    this.encounter = recordEnemyDefeat(this.encounter, id)
    if (id === this.lockedEnemyId) this.clearLockedEnemy()
    if (this.encounter.cleansed) {
      this.respawnTime = 8
      this.audio.play('region')
      this.openRuneDraft()
    }
    this.persistSave()
    return this.encounter.cleansed ? `区域净化完成 · +${reward.score} 积分` : `${enemy.kind} 已击败 · 遗物坠落`
  }

  /**
   * Creates and registers an uncollected relic at a defeated enemy's location.
   *
   * @param relic - Generated reward that will enter progression only after pickup.
   * @param position - World position occupied by the defeated enemy.
   * @returns {void} No return value.
   * @sideEffects Adds a new Three.js pickup group to the scene and active loot list.
   */
  private spawnLootDrop(relic: Relic, position: THREE.Vector3): void {
    const drop = new LootDrop(relic, position)
    this.lootDrops.push(drop)
    this.scene.add(drop.group)
  }

  /** Spawns live Three.js enemy entities from the current immutable encounter record. */
  private spawnEncounter(): void {
    this.encounterCombatTime = 0
    this.enemies = this.encounter.enemies.map((spawn, index) => {
      // A slight initial offset produces readable attack waves as a fresh encounter approaches.
      const entity = new Enemy(spawn.kind, this.encounter.threat, index * 0.13)
      entity.group.position.set(spawn.x, 0.2, spawn.z)
      this.scene.add(entity.group)
      return { id: spawn.id, entity }
    })
  }

  /** Removes finished meshes and starts the next increasingly dangerous seeded encounter. */
  private startNextEncounter(): void {
    this.enemies.forEach(({ entity }) => this.scene.remove(entity.group))
    this.projectiles.forEach((projectile) => {
      this.scene.remove(projectile.group)
      projectile.dispose()
    })
    this.projectiles = []
    this.playerFirebolts.forEach((firebolt) => {
      this.scene.remove(firebolt.group)
      firebolt.dispose()
    })
    this.playerFirebolts = []
    this.clearLockedEnemy()
    const threat = this.encounter.threat + 1
    const cleansedCount = this.encounter.cleansedCount
    this.encounter = { ...createEncounter(['蚀光晶原', '锈蚀回廊', '熔岩断层', '暮影荒野'][cleansedCount % 4], threat, this.score + cleansedCount * 97), cleansedCount }
    this.spawnEncounter()
    this.persistSave()
    this.showCombatMessage(`威胁 ${threat} · 新区域异象苏醒`)
  }

  /** Restores validated browser-local progress without trusting malformed saved data. */
  private restoreSave(): void {
    const saved = decodeSave(localStorage.getItem('embers-abyss-save-v1'))
    if (!saved) return
    this.progression = { level: saved.level, experience: saved.experience, embers: saved.embers, relics: saved.relics }
    this.runeRanks = saved.runes ?? {}
    this.travelerName = saved.travelerName
    this.score = saved.score
    this.encounter = { ...createEncounter('蚀光晶原', Math.max(1, saved.threat), saved.score + 19), cleansedCount: saved.cleansedCount }
  }

  /** Saves the player progression and regional threat after a meaningful game-state transition. */
  private persistSave(): void {
    localStorage.setItem('embers-abyss-save-v1', encodeSave({ travelerName: this.travelerName, ...this.progression, runes: this.runeRanks, threat: this.encounter.threat, cleansedCount: this.encounter.cleansedCount, score: this.score }))
  }
}
