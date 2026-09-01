/**
 * Resolves whether the live simulation should remain frozen after one input frame.
 *
 * @param paused - Whether the simulation was frozen before the current input frame.
 * @param pausePressed - Whether the pause shortcut was newly pressed this frame.
 * @returns {boolean} The frozen state to apply until the next newly pressed pause shortcut.
 * @sideEffects None. Repeated keydown events must not cause a double toggle.
 */
export function resolvePauseState(paused: boolean, pausePressed: boolean): boolean {
  return pausePressed ? !paused : paused
}
