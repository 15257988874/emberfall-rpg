import { describe, expect, it } from 'vitest'
import { formationTarget } from './enemyFormation'

describe('enemy formation', () => {
  it('assigns distinct stable ring positions around the player for each enemy slot', () => {
    const player = { x: 4, z: -3 }
    const first = formationTarget(player, 0, 7, 2.4)
    const second = formationTarget(player, 1, 7, 2.4)

    expect(Math.hypot(first.x - player.x, first.z - player.z)).toBeCloseTo(2.4)
    expect(Math.hypot(second.x - player.x, second.z - player.z)).toBeCloseTo(2.4)
    expect(first).not.toEqual(second)
  })

  it('falls back to the player position when there is no valid formation radius', () => {
    expect(formationTarget({ x: 2, z: 5 }, 2, 0, -4)).toEqual({ x: 2, z: 5 })
  })
})
