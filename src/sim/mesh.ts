/**
 * Mesh detection and the mesh graph. Two gears mesh when their center distance
 * equals the sum of pitch radii within tolerance; closer than that is overlap
 * (invalid), farther is no contact.
 */

import type { Gear } from './gear.ts'
import { areLocked, radiusOf } from './gear.ts'

/** How far center distance may sit from r1+r2 and still count as meshed. */
export const MESH_TOLERANCE = 3 // half a module

export function centerDistance(a: Gear, b: Gear): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export type MeshRelation = 'meshed' | 'overlapping' | 'apart' | 'locked'

export function meshRelation(a: Gear, b: Gear): MeshRelation {
  if (areLocked(a, b)) return 'locked' // co-axial compound pair, not a mesh
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

/**
 * The union graph: mesh edges plus compound-lock edges (a locked pair is one
 * rotating body). Locked edges do not flip direction.
 */
export function buildUnionGraph(gears: readonly Gear[]): Map<string, Array<{ id: string; mesh: boolean }>> {
  const union: Map<string, Array<{ id: string; mesh: boolean }>> = new Map(
    gears.map((g) => [g.id, []]),
  )
  for (const [a, b] of meshedPairs(gears)) {
    union.get(a.id)!.push({ id: b.id, mesh: true })
    union.get(b.id)!.push({ id: a.id, mesh: true })
  }
  for (const g of gears) {
    if (g.lockedTo && union.has(g.lockedTo)) {
      union.get(g.id)!.push({ id: g.lockedTo, mesh: false })
    }
  }
  return union
}

/**
 * Fewest MESH edges on any path from `fromId` to `toId` through the union
 * graph, or −1 when unreachable. Direction parity around a loop is this count
 * plus one (the candidate edge) mod 2 — even cycles can turn, odd ones lock.
 */
export function meshEdgesBetween(gears: readonly Gear[], fromId: string, toId: string): number {
  if (fromId === toId) return 0
  const union = buildUnionGraph(gears)
  const best = new Map<string, number>([[fromId, 0]])
  const queue: Array<{ id: string; meshCount: number }> = [{ id: fromId, meshCount: 0 }]
  while (queue.length > 0) {
    // Small graphs: a simple priority pop by meshCount is plenty.
    queue.sort((a, b) => a.meshCount - b.meshCount)
    const { id, meshCount } = queue.shift()!
    const known = best.get(id)
    if (known !== undefined && known < meshCount) continue
    for (const edge of union.get(id) ?? []) {
      const next = meshCount + (edge.mesh ? 1 : 0)
      const seen = best.get(edge.id)
      if (seen === undefined || next < seen) {
        best.set(edge.id, next)
        queue.push({ id: edge.id, meshCount: next })
      }
    }
  }
  return best.get(toId) ?? -1
}
