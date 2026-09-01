import { describe, expect, it } from 'vitest'
import { advanceProjectile, createProjectileMotion } from './projectileMotion'

describe('projectile motion', () => {
  it('moves a projectile at a fixed speed toward its intended direction', () => {
    const motion = createProjectileMotion({ x: 0, z: 2 }, { x: 1, z: 0 }, 8, 12)
    const frame = advanceProjectile(motion, 0.25)

    expect(frame.motion).toMatchObject({ x: 2, z: 2, remainingDistance: 10 })
    expect(frame.expired).toBe(false)
  })

  it('caps travel at the configured maximum distance instead of overshooting', () => {
    const motion = createProjectileMotion({ x: 0, z: 0 }, { x: 3, z: 4 }, 10, 6)
    const frame = advanceProjectile(motion, 1)

    expect(frame.motion.x).toBeCloseTo(3.6)
    expect(frame.motion.z).toBeCloseTo(4.8)
    expect(frame.motion.remainingDistance).toBe(0)
    expect(frame.expired).toBe(true)
  })
})
