import { describe, expect, it } from 'vitest'
import { makeGear, radiusOf, type Gear } from './gear.ts'
import { cycleIsConsistent, meshWouldJam, solveTrain } from './kinematics.ts'

function trainAlong(counts: number[], driveRpm = 60) {
  const gears: Gear[] = []
  let x = 0
  counts.forEach((teeth, i) => {
    if (i > 0) x += radiusOf(counts[i - 1]!) + radiusOf(teeth)
    gears.push(makeGear(`g${i}`, teeth, x, 0))
  })
  return { gears, spins: solveTrain(gears, 'g0', driveRpm) }
}

describe('kinematics solver', () => {
  it('steps speed by inverse tooth ratio and flips direction', () => {
    const { spins } = trainAlong([10, 20])
    expect(spins.get('g1')!.rpm).toBeCloseTo(30)
    expect(spins.get('g1')!.direction).toBe(-1)
  })

  it('chains ratios through a train', () => {
    const { spins } = trainAlong([10, 20, 40])
    expect(spins.get('g2')!.rpm).toBeCloseTo(15)
    expect(spins.get('g2')!.direction).toBe(1)
  })

  it('scales torque as the inverse of speed', () => {
    const { spins } = trainAlong([10, 20, 40])
    expect(spins.get('g0')!.torqueMultiplier).toBeCloseTo(1)
    expect(spins.get('g2')!.torqueMultiplier).toBeCloseTo(4)
  })

  it('drives branches independently from the mesh graph', () => {
    const d = (a: number, b: number) => radiusOf(a) + radiusOf(b)
    const gears = [
      makeGear('drive', 20, 0, 0),
      makeGear('left', 10, -d(20, 10), 0),
      makeGear('right', 40, d(20, 40), 0),
    ]
    const spins = solveTrain(gears, 'drive', 60)
    expect(spins.get('left')!.rpm).toBeCloseTo(120)
    expect(spins.get('right')!.rpm).toBeCloseTo(30)
  })

  it('leaves disconnected gears out of the spin map', () => {
    const gears = [
      makeGear('a', 10, 0, 0),
      makeGear('b', 20, radiusOf(10) + radiusOf(20), 0),
      makeGear('far', 20, 900, 900),
    ]
    const spins = solveTrain(gears, 'a', 60)
    expect(spins.has('far')).toBe(false)
  })

  it('throws for an unknown drive', () => {
    expect(() => solveTrain([makeGear('a', 10, 0, 0)], 'nope', 60)).toThrow()
  })

  it('compound locks: same shaft, same speed and direction; ratio passes through', () => {
    // Drive 10t locked with a 40t; the 40t layer meshes a 20t.
    const drive = { ...makeGear('drive', 10, 0, 0), lockedTo: 'big' }
    const big = {
      ...makeGear('big', 40, 0, 0),
      lockedTo: 'drive',
    }
    const follower = makeGear('follower', 20, radiusOf(40) + radiusOf(20), 0)
    const spins = solveTrain([drive, big, follower], 'drive', 60)

    // One body: the locked layer co-rotates at the drive's exact speed.
    expect(spins.get('big')!.rpm).toBeCloseTo(60)
    expect(spins.get('big')!.direction).toBe(1)

    // The mesh from the 40t layer: 60 × 40/20 = 120 RPM, flipped.
    expect(spins.get('follower')!.rpm).toBeCloseTo(120)
    expect(spins.get('follower')!.direction).toBe(-1)
  })
})

describe('loop consistency', () => {
  function polygon(counts: number[], angleDeg: number) {
    // Regular-ish placement: walk directions rotating by `angleDeg` each step,
    // each step length = sum of adjacent radii (counts alternate to make this uniform).
    const gears: Gear[] = []
    let x = 0
    let y = 0
    let heading = 0
    counts.forEach((teeth, i) => {
      gears.push(makeGear(`p${i}`, teeth, x, y))
      const next = counts[(i + 1) % counts.length]!
      const step = radiusOf(teeth) + radiusOf(next)
      heading += (angleDeg * Math.PI) / 180
      x += step * Math.cos(heading)
      y += step * Math.sin(heading)
    })
    return gears
  }

  it('locks odd cycles by direction parity', () => {
    const tri = polygon([20, 20, 20], 60)
    // place last vertex so the closing edge also meshes: regular triangle
    const fixed = [
      makeGear('p0', 20, 0, 0),
      makeGear('p1', 20, radiusOf(20) * 2, 0),
      makeGear('p2', 20, radiusOf(20), radiusOf(20) * Math.sqrt(3)),
    ]
    void tri
    expect(cycleIsConsistent(fixed)).toBe(false)
  })

  it('accepts a consistent square of equal gears', () => {
    const s = radiusOf(20) * 2
    const square = [
      makeGear('p0', 20, 0, 0),
      makeGear('p1', 20, s, 0),
      makeGear('p2', 20, s, s),
      makeGear('p3', 20, 0, s),
    ]
    expect(cycleIsConsistent(square)).toBe(true)
  })

  it('rejects the 10-20-10-20 rhombus at 45° and accepts it at 90°/60°', () => {
    function rhombus(alphaDeg: number) {
      const a = (alphaDeg * Math.PI) / 180
      const step = radiusOf(10) + radiusOf(20)
      return [
        makeGear('p0', 10, 0, 0),
        makeGear('p1', 20, step, 0),
        makeGear('p2', 10, step + step * Math.cos(a), step * Math.sin(a)),
        makeGear('p3', 20, step * Math.cos(a), step * Math.sin(a)),
      ]
    }
    expect(cycleIsConsistent(rhombus(45))).toBe(false)
    expect(cycleIsConsistent(rhombus(90))).toBe(true)
    expect(cycleIsConsistent(rhombus(60))).toBe(true)
  })
})

describe('placement jam check', () => {
  it('flags a closing mesh that would jam', () => {
    // Three gears in a line; a fourth placed to close a triangle (odd cycle).
    const s = radiusOf(20) * 2
    const existing = [
      makeGear('p0', 20, 0, 0),
      makeGear('p1', 20, s, 0),
      makeGear('p2', 20, s / 2, (s * Math.sqrt(3)) / 2),
    ]
    // p2 already meshes p0 and p1; "new mesh" p0-p1 would close the triangle.
    const { jams } = meshWouldJam(existing, existing[0]!, existing[1]!)
    expect(jams).toBe(true)
  })

  it('allows a closing mesh that stays consistent', () => {
    const s = radiusOf(20) * 2
    const existing = [
      makeGear('p0', 20, 0, 0),
      makeGear('p1', 20, s, 0),
      makeGear('p2', 20, s * 2, 0),
      makeGear('p3', 20, s * 2, s),
      makeGear('p4', 20, s, s),
      makeGear('p5', 20, 0, s),
    ]
    // Open ring p0..p5; closing mesh p5-p0 completes a hexagon (even cycle).
    const { jams } = meshWouldJam(existing, existing[0]!, existing[5]!)
    expect(jams).toBe(false)
  })

  it('reports no jam for gears in different components', () => {
    const existing = [
      makeGear('a', 10, 0, 0),
      makeGear('b', 20, 900, 900),
    ]
    const { jams, cycle } = meshWouldJam(existing, existing[0]!, existing[1]!)
    expect(jams).toBe(false)
    expect(cycle).toEqual([])
  })
})
