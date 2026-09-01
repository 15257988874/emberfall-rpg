import { describe, expect, test } from 'vitest'
import { enemyMinimapColor, projectMinimapPoint } from './minimap'

describe('minimap projection', () => {
  test('maps the player center and clamps distant actors to the frame', () => {
    expect(projectMinimapPoint({ x: 4, z: -2 }, { x: 4, z: -2 }, 14, 140)).toEqual({ x: 70, y: 70 })
    expect(projectMinimapPoint({ x: 40, z: -40 }, { x: 0, z: 0 }, 14, 140)).toEqual({ x: 140, y: 0 })
  })

  test('assigns readable threat colors by enemy role', () => {
    expect(enemyMinimapColor('boss')).toBe('#ffbd61')
    expect(enemyMinimapColor('wraith')).toBe('#c18cff')
    expect(enemyMinimapColor('crawler')).toBe('#ed6d4c')
  })
})
