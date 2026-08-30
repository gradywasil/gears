/**
 * Kinematics solver. Speeds step by the inverse tooth ratio at each mesh and
 * direction alternates (classical spur-gear train); torque scales inversely with
 * speed (power ≈ constant), reported as a multiplier relative to the drive.
 *
 * Loop locks: every mesh flips direction, so an odd cycle contradicts itself;
 * an even cycle additionally needs phase consistency around the cycle (R3).
 */

import type { Gear } from './gear.ts'
import { buildMeshGraph } from './mesh.ts'
import { meshedTheta } from './phase.ts'

export type Spin = {
  rpm: number
  direction: 1 | -1
  /** Torque relative to the drive gear: |driveRpm / rpm|. */
  torqueMultiplier: number
}

/**
 * Per-gear spin for every gear connected to the drive. Gears absent from the map
 * are stationary (disconnected from the drive). Propagation crosses two edge
 * kinds: meshes (speed × tooth ratio, direction flips) and compound locks
 * (same shaft: identical speed and direction — a locked pair is one body).
 */
export function solveTrain(
  gears: readonly Gear[],
  driveId: string,
  driveRpm: number,
): Map<string, Spin> {
  const byId = new Map(gears.map((g) => [g.id, g]))
  const drive = byId.get(driveId)
  if (!drive) throw new Error(`unknown drive gear: ${driveId}`)

  const graph = buildMeshGraph(gears)
  const spins = new Map<string, Spin>([
    [driveId, { rpm: driveRpm, direction: 1, torqueMultiplier: 1 }],
  ])
  const queue: Array<{ id: string; rpm: number; direction: 1 | -1 }> = [
    { id: driveId, rpm: driveRpm, direction: 1 },
  ]

  while (queue.length > 0) {
    const { id, rpm, direction } = queue.shift()!
    const gear = byId.get(id)!

    // Compound lock: same shaft, same everything.
    if (gear.lockedTo) {
      const partner = byId.get(gear.lockedTo)
      if (partner && !spins.has(partner.id)) {
        spins.set(partner.id, {
          rpm,
          direction,
          torqueMultiplier: Math.abs(driveRpm / rpm),
        })
        queue.push({ id: partner.id, rpm, direction })
      }
    }

    for (const neighborId of graph.get(id) ?? []) {
      if (spins.has(neighborId)) continue
      const neighbor = byId.get(neighborId)!
      const neighborRpm = (rpm * gear.teeth) / neighbor.teeth
      const neighborDirection: 1 | -1 = direction === 1 ? -1 : 1
      spins.set(neighborId, {
        rpm: neighborRpm,
        direction: neighborDirection,
        torqueMultiplier: Math.abs(driveRpm / neighborRpm),
      })
      queue.push({ id: neighborId, rpm: neighborRpm, direction: neighborDirection })
    }
  }
  return spins
}

/**
 * Whether the closed loop `cycle` (gears in order, closing back to cycle[0]) can
 * all mesh simultaneously. Odd edge counts lock by direction parity alone; even
 * counts must also return phase-consistent after one trip around the loop.
 */
export function cycleIsConsistent(cycle: readonly Gear[]): boolean {
  const k = cycle.length
  if (k < 3) return true
  if (k % 2 === 1) return false

  let theta = 0
  for (let i = 0; i < k; i++) {
    const a = cycle[i]!
    const b = cycle[(i + 1) % k]!
    theta = meshedTheta(theta, a, b)
  }
  // Consistent iff the propagated rotation lands on a tooth pitch of the start gear.
  const pitch = (2 * Math.PI) / cycle[0]!.teeth
  const residue = Math.abs(theta - Math.round(theta / pitch) * pitch)
  return residue < 1e-6
}

/**
 * Placement-time loop check: would a new mesh between `a` and `b` (currently in
 * the same component without meshing each other) jam the mechanism? Returns
 * false when the fundamental cycle the new edge closes is inconsistent.
 */
export function meshWouldJam(
  gears: readonly Gear[],
  a: Gear,
  b: Gear,
): { jams: boolean; cycle: Gear[] } {
  const graph = buildMeshGraph(gears)
  // The a–b mesh is the hypothetical new edge: exclude it from the path search so
  // the cycle found is the loop the new edge would close.
  graph.set(a.id, (graph.get(a.id) ?? []).filter((id) => id !== b.id))
  graph.set(b.id, (graph.get(b.id) ?? []).filter((id) => id !== a.id))

  const prev = new Map<string, string>()
  const queue = [a.id]
  const seen = new Set([a.id])
  while (queue.length > 0) {
    const id = queue.shift()!
    if (id === b.id) break
    for (const neighbor of graph.get(id) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor)
        prev.set(neighbor, id)
        queue.push(neighbor)
      }
    }
  }
  if (!seen.has(b.id)) return { jams: false, cycle: [] }

  const byId = new Map(gears.map((g) => [g.id, g]))
  const path: Gear[] = []
  for (let id: string | undefined = b.id; id !== undefined; id = prev.get(id)) {
    path.unshift(byId.get(id)!)
    if (id === a.id) break
  }
  // The path a→…→b plus the wrap edge b→a (the new mesh) is the closed loop.
  return { jams: !cycleIsConsistent(path), cycle: path }
}
