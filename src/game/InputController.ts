import type { PlayerInputSnapshot } from './playerState'
import { shouldQueueAction } from './controls'
import { moveIntent, type Vector2 } from './rules'

/** Captures desktop input and stores a click-to-walk target without browser scrolling. */
export class InputController {
  /** Keyboard codes currently held by the player. */
  private readonly pressedKeys = new Set<string>()
  /** One-shot action requests awaiting consumption by the frame loop. */
  private readonly actionQueue = new Set<string>()
  /** Latest valid arena point selected by a mouse click. */
  private moveTarget: Vector2 | null = null

  /** Handles key presses and queues actions according to their repeat policy. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.isGameKey(event.code)) event.preventDefault()
    if (this.isMovementKey(event.code)) this.moveTarget = null
    if (shouldQueueAction(event.code, event.repeat)) this.actionQueue.add(event.code)
    this.pressedKeys.add(event.code)
  }

  /** Handles key releases while retaining queued actions until a frame consumes them. */
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.isGameKey(event.code)) event.preventDefault()
    this.pressedKeys.delete(event.code)
  }

  /** Creates a keyboard controller and attaches global event listeners. */
  public constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false })
    window.addEventListener('keyup', this.onKeyUp, { passive: false })
  }

  /**
   * Records a valid ground-click destination for low-speed automatic movement.
   *
   * @param target - World XZ position selected from the arena floor, or `null` to cancel it.
   * @returns {void} No return value.
   * @sideEffects Replaces the existing mouse destination.
   */
  public setMoveTarget(target: Vector2 | null): void { this.moveTarget = target ? { ...target } : null }

  /**
   * Returns the current click-to-walk destination without consuming it.
   *
   * @returns {Vector2 | null} A defensive target copy, or `null` when none is active.
   * @sideEffects None.
   */
  public getMoveTarget(): Vector2 | null { return this.moveTarget ? { ...this.moveTarget } : null }

  /**
   * Clears click-to-walk after arrival or an external interrupt.
   *
   * @returns {void} No return value.
   * @sideEffects Removes the stored destination.
   */
  public clearMoveTarget(): void { this.moveTarget = null }

  /**
   * Creates one input snapshot and consumes queued one-shot action keys.
   *
   * @param targetDistance - Current player distance to the stored target, or infinity without one.
   * @returns {PlayerInputSnapshot} Frame-local state-machine input.
   * @sideEffects Clears queued action presses after exposing them once.
   */
  public consumePlayerInput(targetDistance: number): PlayerInputSnapshot {
    return {
      move: moveIntent(this.pressedKeys),
      runHeld: this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight'),
      attackPressed: this.consumeAction('Space'),
      chantHeld: this.pressedKeys.has('KeyQ'),
      dashPressed: this.consumeAction('KeyE'),
      shieldPressed: this.consumeAction('KeyF'),
      potionPressed: this.consumeAction('KeyR'),
      hasMouseTarget: this.moveTarget !== null,
      targetDistance,
    }
  }

  /**
   * Consumes the one-shot request that toggles the global pause state.
   *
   * @returns {boolean} Whether the frame should toggle between active and paused simulation.
   * @sideEffects Removes the pending Escape action after reading it.
   */
  public consumePauseInput(): boolean { return this.consumeAction('Escape') }

  /**
   * Removes global listeners when a game instance closes.
   *
   * @returns {void} No return value.
   * @sideEffects Stops this controller from retaining the page window.
   */
  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  /**
   * Reads and deletes one pending action request.
   *
   * @param code - Browser key code assigned to a one-shot action.
   * @returns {boolean} Whether that action was newly pressed.
   * @sideEffects Deletes the request after reading it.
   */
  private consumeAction(code: string): boolean {
    const requested = this.actionQueue.has(code)
    this.actionQueue.delete(code)
    return requested
  }

  /**
   * Identifies all keyboard controls requiring browser-default suppression.
   *
   * @param code - Browser keyboard code to classify.
   * @returns {boolean} Whether this code belongs to game input.
   * @sideEffects None.
   */
  private isGameKey(code: string): boolean {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyF', 'KeyR', 'Escape'].includes(code)
  }

  /**
   * Identifies directional input that must override automatic mouse travel.
   *
   * @param code - Browser keyboard code to classify.
   * @returns {boolean} Whether this code provides directional movement.
   * @sideEffects None.
   */
  private isMovementKey(code: string): boolean {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)
  }
}
