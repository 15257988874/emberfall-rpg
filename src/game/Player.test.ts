import { describe, expect, it } from 'vitest'
import { Player } from './Player'

describe('Player.consumePotion', () => {
  it('distinguishes full health from an empty potion supply', () => {
    const player = new Player()

    expect(player.consumePotion()).toBe('full-health')
    player.health = 50
    expect(player.consumePotion()).toBe('healed')
    player.potions = 0
    expect(player.consumePotion()).toBe('empty')
  })
})

describe('Player.takeDamage', () => {
  it('clamps health at zero and reports defeat only on the lethal hit', () => {
    const player = new Player()

    expect(player.takeDamage(24)).toBe(false)
    expect(player.health).toBe(76)
    expect(player.takeDamage(100)).toBe(true)
    expect(player.health).toBe(0)
  })
})

describe('Player.revive', () => {
  it('restores a defeated traveler at the protected regroup location', () => {
    const player = new Player()
    player.takeDamage(200)

    player.revive()

    expect(player.health).toBe(100)
    expect(player.shieldActive).toBe(true)
    expect(player.group.position).toMatchObject({ x: 0, y: 0.15, z: 2.4 })
  })
})

describe('Player.faceTarget', () => {
  it('turns the combat forward vector toward a nearby automatic melee target', () => {
    const player = new Player()

    player.faceTarget({ x: 3, z: player.group.position.z })

    expect(player.forward.x).toBeCloseTo(1)
    expect(player.forward.z).toBeCloseTo(0)
  })
})
