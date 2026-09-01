import { describe, expect, it } from 'vitest'
import { canHitTarget, moveIntent } from './rules'

describe('moveIntent', () => {
  it('normalizes diagonal movement so it cannot exceed cardinal speed', () => {
    const vector = moveIntent(new Set(['KeyW', 'KeyD']))

    expect(vector.x).toBeCloseTo(Math.SQRT1_2)
    expect(vector.z).toBeCloseTo(-Math.SQRT1_2)
  })

  it('accepts arrow key input as movement intent', () => {
    expect(moveIntent(new Set(['ArrowLeft']))).toEqual({ x: -1, z: 0 })
  })
})

describe('canHitTarget', () => {
  const attacker = {
    position: { x: 0, z: 0 },
    forward: { x: 0, z: -1 },
    alive: true,
  }

  it('accepts a living target in the forward melee arc', () => {
    expect(canHitTarget(
      attacker,
      { position: { x: 0, z: -2 }, forward: { x: 0, z: 1 }, alive: true },
      3.2,
      Math.PI * 70 / 360,
    )).toBe(true)
  })

  it('rejects a target outside the forward arc', () => {
    expect(canHitTarget(
      attacker,
      { position: { x: 2, z: 0 }, forward: { x: 0, z: 1 }, alive: true },
      3.2,
      Math.PI / 6,
    )).toBe(false)
  })

  it('rejects a defeated target and a target beyond range', () => {
    expect(canHitTarget(
      attacker,
      { position: { x: 0, z: -1 }, forward: { x: 0, z: 1 }, alive: false },
      3.2,
      Math.PI / 3,
    )).toBe(false)
    expect(canHitTarget(
      attacker,
      { position: { x: 0, z: -3.3 }, forward: { x: 0, z: 1 }, alive: true },
      3.2,
      Math.PI / 3,
    )).toBe(false)
  })
})
