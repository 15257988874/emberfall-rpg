import { describe, expect, it } from 'vitest'
import { activeMeleeSlots } from './enemyEngagement'

describe('enemy engagement rotation', () => {
  it('permits only two melee slots during a single attack wave', () => {
    expect(activeMeleeSlots([0, 2, 4, 6], 0)).toEqual([0, 2])
  })

  it('rotates the permitted pair to the following melee slots every wave', () => {
    expect(activeMeleeSlots([0, 2, 4, 6], 2.45)).toEqual([4, 6])
    expect(activeMeleeSlots([0, 2, 4, 6], 4.9)).toEqual([0, 2])
  })

  it('keeps a sole melee enemy eligible without requiring a full pair', () => {
    expect(activeMeleeSlots([3], 24)).toEqual([3])
  })
})
