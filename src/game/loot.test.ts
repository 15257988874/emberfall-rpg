import { describe, expect, it } from 'vitest'
import { tryCollectRelic } from './loot'
import { createProgression, type Relic } from './progression'

const testRelic: Relic = { id: 'relic-1-1', tier: 'rare', power: 14 }

describe('relic loot collection', () => {
  it('stores a dropped relic only once the traveler is inside pickup range', () => {
    const result = tryCollectRelic(createProgression(), testRelic, 1.2)

    expect(result.collected).toBe(true)
    expect(result.progression.relics[0]).toEqual(testRelic)
  })

  it('leaves the relic on the ground while the traveler remains out of range', () => {
    const result = tryCollectRelic(createProgression(), testRelic, 1.46)

    expect(result.collected).toBe(false)
    expect(result.progression).toEqual(createProgression())
  })
})
