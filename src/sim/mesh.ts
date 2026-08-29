/**
 * Mesh detection and the mesh graph. Two gears mesh when their center distance
 * equals the sum of pitch radii within tolerance; closer than that is overlap
 * (invalid), farther is no contact.
 */

import type { Gear } from './gear.ts'
import { radiusOf } from './gear.ts'

/** How far center distance may sit from r1+r2 and still count as meshed. */
export const MESH_TOLERANCE = 3 // half a module

export function centerDistance(a: Gear, b: Gear): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export type MeshRelation = 'meshed' | 'overlapping' | 'apart'

export function meshRelation(a: Gear, b: Gear): MeshRelation {
  const ideal = radiusOf(a.teeth) + radiusOf(b.teeth)
  const d = centerDistance(a, b)
  if (Math.abs(d - ideal) <= MESH_TOLERANCE) return 'meshed'
  return d < ideal ? 'overlapping' : 'apart'
}

export function meshedPairs(gears: readonly Gear[]): Array<[Gear, Gear]> {
  const pairs: Array<[Gear, Gear]> = []
  for (let i = 0; i < gears.length; i++) {
    for (let j = i + 1; j < gears.length; j++) {
      if (meshRelation(gears[i]!, gears[j]!) === 'meshed') {
        pairs.push([gears[i]!, gears[j]!])
      }
    }
  }
  return pairs
}

export type MeshGraph = Map<string, string[]>

export function buildMeshGraph(gears: readonly Gear[]): MeshGraph {
  const graph: MeshGraph = new Map(gears.map((g) => [g.id, []]))
  for (const [a, b] of meshedPairs(gears)) {
    graph.get(a.id)!.push(b.id)
    graph.get(b.id)!.push(a.id)
  }
  return graph
}

/** Connected components as arrays of gear ids; isolated gears are their own component. */
export function connectedComponents(gears: readonly Gear[]): string[][] {
  const graph = buildMeshGraph(gears)
  const seen = new Set<string>()
  const components: string[][] = []
  for (const gear of gears) {
    if (seen.has(gear.id)) continue
    const component: string[] = []
    const queue = [gear.id]
    seen.add(gear.id)
    while (queue.length > 0) {
      const id = queue.shift()!
      component.push(id)
      for (const neighbor of graph.get(id) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    components.push(component)
  }
  return components
}
