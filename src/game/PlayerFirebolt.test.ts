import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PlayerFirebolt } from './PlayerFirebolt'

describe('PlayerFirebolt', () => {
  it('delivers its stored damage once when it reaches the selected enemy', () => {
    const target = new THREE.Vector3(0, 0.2, -1.2)
    const bolt = new PlayerFirebolt('wraith-1', new THREE.Vector3(0, 0.2, 0), target, 5)

    expect(bolt.targetId).toBe('wraith-1')
    expect(bolt.update(0.04, target)).toBe(false)
    expect(bolt.update(0.08, target)).toBe(true)
    expect(bolt.alive).toBe(false)
  })
})
