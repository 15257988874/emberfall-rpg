import { describe, expect, it } from 'vitest'
import { advancePlayerState, createPlayerState, type PlayerInputSnapshot } from './playerState'

/** Creates an empty player input snapshot for each isolated transition test. */
function input(overrides: Partial<PlayerInputSnapshot> = {}): PlayerInputSnapshot {
  return {
    move: { x: 0, z: 0 },
    runHeld: false,
    attackPressed: false,
    chantHeld: false,
    dashPressed: false,
    shieldPressed: false,
    potionPressed: false,
    hasMouseTarget: false,
    targetDistance: Infinity,
    ...overrides,
  }
}

describe('advancePlayerState', () => {
  it('selects walk and run from directional input', () => {
    const walking = advancePlayerState(createPlayerState(), input({ move: { x: 0, z: -1 } }), 0.016)
    const running = advancePlayerState(walking.state, input({ move: { x: 1, z: 0 }, runHeld: true }), 0.016)

    expect(walking.state.kind).toBe('walk')
    expect(running.state.kind).toBe('run')
  })

  it('interrupts chant with directional input and selects run with Shift', () => {
    const chanting = { ...createPlayerState(), kind: 'chant' as const, chantTime: 0.4 }
    const result = advancePlayerState(chanting, input({ move: { x: 1, z: 0 }, runHeld: true, chantHeld: true }), 0.016)

    expect(result.state.kind).toBe('run')
    expect(result.events.interruptedChant).toBe(true)
  })

  it('lets a basic attack interrupt chant before its release', () => {
    const chanting = { ...createPlayerState(), kind: 'chant' as const, chantTime: 0.6 }
    const result = advancePlayerState(chanting, input({ attackPressed: true, chantHeld: true }), 0.016)

    expect(result.state.kind).toBe('attack')
    expect(result.events.startedAttack).toBe(true)
    expect(result.events.interruptedChant).toBe(true)
  })

  it('emits a cast only when Q releases after the minimum chant duration', () => {
    const chanting = { ...createPlayerState(), kind: 'chant' as const, chantTime: 0.62 }
    const result = advancePlayerState(chanting, input({ chantHeld: false }), 0.016)

    expect(result.state.kind).toBe('cast')
    expect(result.events.startedCast).toBe(true)
  })

  it('returns idle when a walking target is inside the arrival radius', () => {
    const walking = { ...createPlayerState(), kind: 'walk' as const, mouseTargetActive: true }
    const result = advancePlayerState(walking, input({ hasMouseTarget: true, targetDistance: 0.12 }), 0.016)

    expect(result.state.kind).toBe('idle')
    expect(result.state.mouseTargetActive).toBe(false)
  })

  it('emits a shockwave only once while a cast crosses its impact time', () => {
    const casting = { ...createPlayerState(), kind: 'cast' as const, stateTime: 0.23, castImpactFired: false }
    const first = advancePlayerState(casting, input(), 0.04)
    const second = advancePlayerState(first.state, input(), 0.04)

    expect(first.events.castShockwave).toBe(true)
    expect(second.events.castShockwave).toBe(false)
  })
})
