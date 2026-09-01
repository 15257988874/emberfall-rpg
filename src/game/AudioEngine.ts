import { AUDIO_PREFERENCE_KEY, readAudioMuted, toggleAudioMuted } from './audioState'

type AudioEvent = 'attack' | 'hit' | 'cast' | 'dash' | 'shield' | 'potion' | 'enemy-hit' | 'loot' | 'level' | 'region'

/** Generates a small original ambient loop and combat cues without external assets. */
export class AudioEngine {
  /** Lazily-created browser audio graph, unavailable in non-browser test contexts. */
  private context: AudioContext | null = null
  /** Master gain used by the mute toggle. */
  private master: GainNode | null = null
  /** Music gain separated from short combat effects. */
  private music: GainNode | null = null
  /** Effect gain used for combat feedback. */
  private effects: GainNode | null = null
  /** Timer driving the low-volume ambient sequence. */
  private musicTimer: number | null = null
  /** Next scheduled music step. */
  private musicStep = 0
  /** Current mute state persisted on this device. */
  private muted: boolean

  /** Reads the persisted preference without constructing an AudioContext. */
  public constructor() {
    this.muted = readAudioMuted(typeof localStorage === 'undefined' ? null : localStorage.getItem(AUDIO_PREFERENCE_KEY))
  }

  /**
   * Unlocks audio from a user gesture and starts the ambient loop once.
   *
   * @returns {Promise<void>} Resolves after a suspended context is resumed.
   * @sideEffects Creates browser audio nodes and a repeating timer.
   */
  public async unlock(): Promise<void> {
    this.ensureContext()
    if (!this.context) return
    if (this.context.state === 'suspended') await this.context.resume()
    if (this.musicTimer === null) {
      this.musicStep = 0
      this.musicTimer = window.setInterval(() => this.scheduleMusicStep(), 560)
    }
  }

  /**
   * Toggles and persists the device audio preference.
   *
   * @returns {boolean} `true` when audio is enabled after the toggle.
   * @sideEffects Updates local storage and gain automation.
   */
  public toggle(): boolean {
    this.muted = toggleAudioMuted(this.muted)
    if (typeof localStorage !== 'undefined') localStorage.setItem(AUDIO_PREFERENCE_KEY, this.muted ? '1' : '0')
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.64, this.context.currentTime, 0.025)
    if (!this.muted) void this.unlock()
    return !this.muted
  }

  /** Reports whether the engine is currently audible. */
  public get enabled(): boolean { return !this.muted }

  /**
   * Plays a short procedural cue for a game event.
   *
   * @param event - Combat or progression event to sonify.
   * @sideEffects Schedules oscillator and noise nodes when audio is unlocked.
   */
  public play(event: AudioEvent): void {
    if (this.muted || !this.context || this.context.state !== 'running' || !this.effects) return
    const now = this.context.currentTime
    const presets: Record<AudioEvent, [number, number, OscillatorType]> = {
      attack: [240, 0.09, 'triangle'], hit: [92, 0.12, 'square'], cast: [180, 0.3, 'sine'], dash: [720, 0.16, 'sawtooth'],
      shield: [430, 0.32, 'sine'], potion: [680, 0.22, 'sine'], 'enemy-hit': [120, 0.13, 'square'], loot: [760, 0.16, 'triangle'], level: [540, 0.42, 'sine'], region: [330, 0.75, 'sine'],
    }
    const [frequency, duration, type] = presets[event]
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * (event === 'hit' || event === 'enemy-hit' ? 0.55 : 1.35)), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(event === 'region' ? 0.11 : 0.07, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(this.effects)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.03)
  }

  /** Releases timers and audio nodes when the game is disposed. */
  public dispose(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer)
    this.musicTimer = null
    void this.context?.close()
    this.context = null
  }

  /** Creates the graph only after a trusted user gesture reaches the game. */
  private ensureContext(): void {
    if (this.context || typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    this.context = new AudioContextClass()
    this.master = this.context.createGain()
    this.music = this.context.createGain()
    this.effects = this.context.createGain()
    this.master.gain.value = this.muted ? 0 : 0.64
    this.music.gain.value = 0.16
    this.effects.gain.value = 0.78
    this.music.connect(this.master)
    this.effects.connect(this.master)
    this.master.connect(this.context.destination)
  }

  /** Schedules one low-volume chord step from the original ambient loop. */
  private scheduleMusicStep(): void {
    if (!this.context || this.context.state !== 'running' || this.muted || !this.music) return
    const root = [55, 52, 48, 50][Math.floor(this.musicStep / 4) % 4]
    const when = this.context.currentTime + 0.04
    ;[root, root + 7, root + 12].forEach((frequency, index) => this.scheduleTone(frequency, when + index * 0.03, 0.46, 0.018, 'sine', this.music as GainNode))
    this.musicStep = (this.musicStep + 1) % 16
  }

  /** Schedules one damped tone on a selected destination bus. */
  private scheduleTone(frequency: number, when: number, duration: number, volume: number, type: OscillatorType, destination: GainNode): void {
    if (!this.context) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.03)
  }
}
