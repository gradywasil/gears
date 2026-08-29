import { describe, expect, it } from 'vitest'
import { makeGear, radiusOf } from './gear.ts'
import { buildMeshGraph, connectedComponents, meshRelation } from './mesh.ts'

function atOrigin(teeth: number) {
  return makeGear('a', teeth, 0, 0)
}

describe('mesh detection', () => {
  it('marks exact-touch centers as meshed', () => {
    const a = atOrigin(10)
    const d = radiusOf(10) + radiusOf(20)
    const b = makeGear('b', 20, d, 0)
    expect(meshRelation(a, b)).toBe('meshed')
  })

  it('accepts center distance within tolerance', () => {
    const a = atOrigin(10)
    const d = radiusOf(10) + radiusOf(20) + 2.9
    const b = makeGear('b', 20, d, 0)
    expect(meshRelation(a, b)).toBe('meshed')
  })

  it('marks closer centers as overlapping', () => {
    const a = atOrigin(10)
    const d = radiusOf(10) + radiusOf(20) - 4
    const b = makeGear('b', 20, d, 0)
    expect(meshRelation(a, b)).toBe('overlapping')
  })

  it('marks distant centers as apart', () => {
    const a = atOrigin(10)
    const b = makeGear('b', 20, 500, 500)
    expect(meshRelation(a, b)).toBe('apart')
  })
})

describe('mesh graph', () => {
  it('links mutually meshed gears', () => {
    const d = radiusOf(10) + radiusOf(20)
    const gears = [
      makeGear('a', 10, 0, 0),
      makeGear('b', 20, d, 0),
      makeGear('c', 20, 500, 500),
    ]
    const graph = buildMeshGraph(gears)
    expect(graph.get('a')).toEqual(['b'])
    expect(graph.get('b')).toEqual(['a'])
    expect(graph.get('c')).toEqual([])
  })

  it('splits components correctly', () => {
    const d12 = radiusOf(10) + radiusOf(20)
    const d23 = radiusOf(20) + radiusOf(30)
    const gears = [
      makeGear('a', 10, 0, 0),
      makeGear('b', 20, d12, 0),
      makeGear('c', 30, d12 + d23, 0),
      makeGear('solo', 40, 500, 500),
    ]
    const components = connectedComponents(gears).map((c) => c.sort())
    expect(components).toHaveLength(2)
    expect(components).toContainEqual(['a', 'b', 'c'])
    expect(components).toContainEqual(['solo'])
  })
})
