import type { Vector2 } from './rules'

/** Enumerates every visible high-level action state of the ember knight. */
export type PlayerStateKind = 'idle' | 'walk' | 'run' | 'attack' | 'chant' | 'cast'

/** Stores the state-machine memory needed to continue an animation across frames. */
export interface PlayerState {
  /** Current high-level action selected by input priority and state duration. */
  kind: PlayerStateKind
  /** Seconds spent in the current action state. */
  stateTime: number
  /** Accumulated held-Q duration used to validate a cast release. */
  chantTime: number
  /** Prevents the cast impact from firing more than once. */
  castImpactFired: boolean
  /** Tracks whether a ground-click destination remains active. */
  mouseTargetActive: boolean
}

/** Captures all player controls needed by the state machine for one simulation frame. */
export interface PlayerInputSnapshot {
  /** Normalized keyboard movement direction in the XZ plane. */
  move: Vector2
  /** Whether `Shift` is held while keyboard movement is active. */
  runHeld: boolean
  /** One-shot press that starts a basic melee attack. */
  attackPressed: boolean
  /** Held-Q state used for chanting and cast release. */
  chantHeld: boolean
  /** One-shot request to dash toward the pointer direction. */
  dashPressed: boolean
  /** One-shot request to raise the defensive shield. */
  shieldPressed: boolean
  /** One-shot request to consume a potion. */
  potionPressed: boolean
  /** Whether the game currently owns a ground-click movement destination. */
  hasMouseTarget: boolean
  /** Current distance to the mouse destination in world units. */
  targetDistance: number
}

/** Identifies instantaneous gameplay events emitted while advancing one frame. */
export interface PlayerActionEvents {
  /** Signals that a melee swing began this frame. */
  startedAttack: boolean
  /** Signals that a valid chant release began the cast animation. */
  startedCast: boolean
  /** Signals the one frame on which the area spell applies damage. */
  castShockwave: boolean
  /** Signals a chant stopped before it naturally released. */
  interruptedChant: boolean
  /** Forwards a valid dash key press to the combat scene. */
  requestedDash: boolean
  /** Forwards a valid shield key press to the combat scene. */
  requestedShield: boolean
  /** Forwards a valid potion key press to the combat scene. */
  requestedPotion: boolean
}

/** Combines persistent state-machine data with frame-local action events. */
export interface PlayerStateUpdate {
  /** State that should drive pose and movement during the following frame. */
  state: PlayerState
  /** One-shot action notifications consumed by presentation and combat code. */
  events: PlayerActionEvents
}

/** Minimum Q-hold duration that turns a release into a spell cast. */
export const MINIMUM_CHANT_SECONDS = 0.45
/** Duration for which a basic melee swing retains state priority. */
export const ATTACK_SECONDS = 0.34
/** Duration for which a cast retains state priority. */
export const CAST_SECONDS = 0.9
/** Time after cast start at which the shockwave applies area damage. */
export const CAST_IMPACT_SECONDS = 0.26
/** Ground-target distance below which click-to-walk finishes. */
export const TARGET_ARRIVAL_DISTANCE = 0.2

/**
 * Creates a fresh player state that starts idle without a queued destination.
 *
 * @returns {PlayerState} Default idle state.
 * @sideEffects None.
 */
export function createPlayerState(): PlayerState {
  return {
    kind: 'idle',
    stateTime: 0,
    chantTime: 0,
    castImpactFired: false,
    mouseTargetActive: false,
  }
}

/**
 * Advances deterministic player state using one input snapshot and time delta.
 *
 * @param previous - State retained from the previous simulation frame.
 * @param input - Keyboard and ground-target intent captured for this frame.
 * @param deltaSeconds - Positive elapsed time in seconds.
 * @returns {PlayerStateUpdate} Next persistent state and one-shot gameplay events.
 * @sideEffects None.
 */
export function advancePlayerState(
  previous: PlayerState,
  input: PlayerInputSnapshot,
  deltaSeconds: number,
): PlayerStateUpdate {
  const delta = Math.max(0, deltaSeconds)
  const events = createEvents(input)

  if (previous.kind === 'cast' && previous.stateTime < CAST_SECONDS) {
    const stateTime = previous.stateTime + delta
    const emitsImpact = !previous.castImpactFired && previous.stateTime < CAST_IMPACT_SECONDS && stateTime >= CAST_IMPACT_SECONDS

    return {
      state: {
        ...previous,
        stateTime,
        castImpactFired: previous.castImpactFired || emitsImpact,
        mouseTargetActive: input.hasMouseTarget || previous.mouseTargetActive,
      },
      events: { ...events, castShockwave: emitsImpact },
    }
  }

  if (previous.kind === 'attack' && previous.stateTime < ATTACK_SECONDS) {
    return {
      state: { ...previous, stateTime: previous.stateTime + delta, mouseTargetActive: input.hasMouseTarget || previous.mouseTargetActive },
      events,
    }
  }

  if (input.attackPressed) {
    return {
      state: createState('attack', input.hasMouseTarget || previous.mouseTargetActive),
      events: { ...events, startedAttack: true, interruptedChant: previous.kind === 'chant' },
    }
  }

  if (previous.kind === 'chant') {
    if (hasKeyboardMovement(input)) {
      return {
        state: createMovementState(input, false),
        events: { ...events, interruptedChant: true },
      }
    }

    if (!input.chantHeld) {
      if (previous.chantTime >= MINIMUM_CHANT_SECONDS) {
        return {
          state: createState('cast', input.hasMouseTarget || previous.mouseTargetActive),
          events: { ...events, startedCast: true },
        }
      }

      return { state: createMovementState(input, false), events: { ...events, interruptedChant: true } }
    }

    return {
      state: { ...previous, stateTime: previous.stateTime + delta, chantTime: previous.chantTime + delta },
      events,
    }
  }

  if (input.chantHeld && !hasKeyboardMovement(input)) {
    return {
      state: { ...createState('chant', input.hasMouseTarget || previous.mouseTargetActive), chantTime: delta },
      events,
    }
  }

  return { state: createMovementState(input, previous.mouseTargetActive), events }
}

/**
 * Produces zeroed action events while preserving one-shot non-state actions.
 *
 * @param input - Current player input snapshot.
 * @returns {PlayerActionEvents} Events for a frame before state-specific changes.
 * @sideEffects None.
 */
function createEvents(input: PlayerInputSnapshot): PlayerActionEvents {
  return {
    startedAttack: false,
    startedCast: false,
    castShockwave: false,
    interruptedChant: false,
    requestedDash: input.dashPressed,
    requestedShield: input.shieldPressed,
    requestedPotion: input.potionPressed,
  }
}

/**
 * Detects non-zero keyboard movement, which overrides click targets and chanting.
 *
 * @param input - Current player input snapshot.
 * @returns {boolean} Whether directional keyboard input is present.
 * @sideEffects None.
 */
function hasKeyboardMovement(input: PlayerInputSnapshot): boolean {
  return input.move.x !== 0 || input.move.z !== 0
}

/**
 * Selects idle, walking, or running after all higher-priority states finish.
 *
 * @param input - Current player input snapshot.
 * @param previousMouseTarget - Ground-target status held by the previous state.
 * @returns {PlayerState} Base movement state with click-target completion applied.
 * @sideEffects None.
 */
function createMovementState(input: PlayerInputSnapshot, previousMouseTarget: boolean): PlayerState {
  if (hasKeyboardMovement(input)) {
    return createState(input.runHeld ? 'run' : 'walk', false)
  }

  const mouseTargetActive = input.hasMouseTarget || previousMouseTarget
  if (mouseTargetActive && input.targetDistance > TARGET_ARRIVAL_DISTANCE) {
    return createState('walk', true)
  }

  return createState('idle', false)
}

/**
 * Creates a reset state record when a state transition begins.
 *
 * @param kind - Newly selected state kind.
 * @param mouseTargetActive - Whether click-to-walk should resume after a timed action.
 * @returns {PlayerState} State with fresh timers.
 * @sideEffects None.
 */
function createState(kind: PlayerStateKind, mouseTargetActive: boolean): PlayerState {
  return {
    kind,
    stateTime: 0,
    chantTime: 0,
    castImpactFired: false,
    mouseTargetActive,
  }
}
