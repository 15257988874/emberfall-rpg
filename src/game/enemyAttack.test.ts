import { describe, expect, it } from 'vitest'
import { advanceEnemyAttack, createEnemyAttackState } from './enemyAttack'

describe('enemy attack state', () => {
  it('makes a ranged enemy telegraph before firing one projectile', () => {
    let state = createEnemyAttackState()

    let frame = advanceEnemyAttack(state, 'hunter', true, 0.01)
    state = frame.state
    expect(frame.event).toEqual({ type: 'telegraph', duration: 0.62 })

    frame = advanceEnemyAttack(state, 'hunter', true, 0.61)
    state = frame.state
    expect(frame.event).toBeNull()

    frame = advanceEnemyAttack(state, 'hunter', true, 0.01)
    expect(frame.event).toEqual({ type: 'projectile', damage: 10, damageType: 'physical' })
    expect(frame.state.phase).toBe('cooldown')
  })

  it('makes a close-range enemy wind up and then land a melee strike', () => {
    let state = createEnemyAttackState()

    state = advanceEnemyAttack(state, 'brute', true, 0.01).state
    const strike = advanceEnemyAttack(state, 'brute', true, 0.52)

    expect(strike.event).toEqual({ type: 'melee', damage: 16, damageType: 'physical' })
    expect(strike.state.phase).toBe('cooldown')
  })

  it('does not begin an attack while the target is out of range', () => {
    const frame = advanceEnemyAttack(createEnemyAttackState(), 'wraith', false, 2)

    expect(frame.state.phase).toBe('ready')
    expect(frame.event).toBeNull()
  })

  it('respects an initial attack delay so a group does not telegraph in the same frame', () => {
    let state = createEnemyAttackState(0.35)

    let frame = advanceEnemyAttack(state, 'crawler', true, 0.34)
    state = frame.state
    expect(frame.event).toBeNull()
    expect(state.phase).toBe('cooldown')

    frame = advanceEnemyAttack(state, 'crawler', true, 0.01)
    state = frame.state
    expect(frame.event).toBeNull()
    expect(state.phase).toBe('ready')

    frame = advanceEnemyAttack(state, 'crawler', true, 0.01)
    expect(frame.event).toEqual({ type: 'telegraph', duration: 0.34 })
  })

  it('cancels a melee windup when that enemy loses its engagement slot', () => {
    let state = advanceEnemyAttack(createEnemyAttackState(), 'crawler', true, 0.01).state
    const frame = advanceEnemyAttack(state, 'crawler', false, 0.4)

    expect(frame.event).toBeNull()
    expect(frame.state).toEqual(createEnemyAttackState())
  })
})
