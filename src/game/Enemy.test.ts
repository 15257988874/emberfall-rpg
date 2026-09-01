import { describe, expect, it } from 'vitest'
import { Enemy } from './Enemy'

describe('Enemy.takeHit', () => {
  it('subtracts the supplied combat damage and defeats only when health is depleted', () => {
    const enemy = new Enemy('brute')

    expect(enemy.takeHit(3)).toBe(false)
    expect(enemy.health).toBe(4)
    expect(enemy.takeHit(4)).toBe(true)
    expect(enemy.health).toBe(0)
    expect(enemy.alive).toBe(false)
  })
})
