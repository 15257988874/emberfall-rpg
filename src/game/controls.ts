/**
 * Utility actions remain edge-triggered so holding their keys cannot repeatedly consume resources.
 */
const ONE_SHOT_ACTION_CODES = ['KeyE', 'KeyF', 'KeyR', 'Escape'] as const

/**
 * Decides whether a browser keydown event should request an in-game action.
 *
 * @param code - Browser keyboard code received from the keydown event.
 * @param isRepeat - Whether the browser emitted this event while the key remains held.
 * @returns {boolean} Whether the frame loop should receive a pending action request.
 * @sideEffects None. Basic attacks intentionally accept repeat events, while utility abilities remain one-shot.
 */
export function shouldQueueAction(code: string, isRepeat: boolean): boolean {
  return code === 'Space' || (!isRepeat && ONE_SHOT_ACTION_CODES.includes(code as typeof ONE_SHOT_ACTION_CODES[number]))
}
