import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave } from './save'

describe('save codec', () => {
  it('round-trips progression and regional state through a versioned save', () => {
    const encoded = encodeSave({ travelerName: '灰烬旅者', level: 3, experience: 21, embers: 44, relics: [null, null, null, null, null, null], threat: 2, cleansedCount: 1, score: 900 })
    expect(decodeSave(encoded)).toMatchObject({ version: 2, travelerName: '灰烬旅者', level: 3, threat: 2, score: 900 })
  })

  it('migrates a compatible version-one save to the default traveler name', () => {
    const legacy = JSON.stringify({ version: 1, level: 1, experience: 0, embers: 0, relics: [null, null, null, null, null, null], threat: 1, cleansedCount: 0, score: 0 })

    expect(decodeSave(legacy)).toMatchObject({ version: 2, travelerName: '余烬行者' })
  })

  it('rejects malformed or incompatible save data', () => {
    expect(decodeSave('{')).toBeNull()
    expect(decodeSave(JSON.stringify({ version: 99 }))).toBeNull()
  })
})
