/**
 * Machine state and transitions. Town-hall decisions encoded here:
 * first gear placed becomes the drive (D13); move + delete only (D15);
 * always spinning once a drive exists (D14 — `running` gates animation only);
 * new/moved gears phase-align to their mesh partner via the corrected formula.
 */

import type { Gear } from '../sim/gear.ts'
import { buildMeshGraph } from '../sim/mesh.ts'
import { meshedTheta } from '../sim/phase.ts'

export type MachineState = {
  gears: Gear[]
  /** Rotation per gear id (radians); realigned on place/move, advanced per frame. */
  angles: Record<string, number>
  driveId: string | null
  rpm: number
  running: boolean
  selectedId: string | null
  /** Bumped whenever `angles` gains a realignment the canvas must merge. */
  anglesVersion: number
}

export type MachineAction =
  | { type: 'place'; gear: Gear; partnerId: string | null }
  | { type: 'move'; id: string; x: number; y: number; partnerId: string | null }
  | { type: 'delete'; id: string }
  | { type: 'setDrive'; id: string }
  | { type: 'setRpm'; value: number }
  | { type: 'setRunning'; value: boolean }
  | { type: 'select'; id: string | null }
  | { type: 'hydrate'; gears: Gear[]; driveId: string | null; rpm: number; running: boolean }

/**
 * Recompute every angle from scratch: drive at 0, each mesh neighbor phase-
 * aligned through the corrected formula (BFS over the mesh graph). Disconnected
 * gears sit at 0. Used when restoring saves (angles are not persisted).
 */
export function alignedAngles(gears: readonly Gear[], driveId: string | null): Record<string, number> {
  const angles: Record<string, number> = {}
  for (const g of gears) angles[g.id] = 0
  if (!driveId) return angles
  const byId = new Map(gears.map((g) => [g.id, g]))
  const graph = buildMeshGraph(gears)
  const queue: Array<{ id: string; theta: number }> = [{ id: driveId, theta: 0 }]
  const visited = new Set([driveId])
  while (queue.length > 0) {
    const { id, theta } = queue.shift()!
    const gear = byId.get(id)!
    for (const neighborId of graph.get(id) ?? []) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)
      const neighbor = byId.get(neighborId)!
      const neighborTheta = meshedTheta(theta, gear, neighbor)
      angles[neighborId] = neighborTheta
      queue.push({ id: neighborId, theta: neighborTheta })
    }
  }
  return angles
}

export function initialMachineState(): MachineState {
  return {
    gears: [],
    angles: {},
    driveId: null,
    rpm: 30,
    running: true,
    selectedId: null,
    anglesVersion: 0,
  }
}

export function machineReducer(state: MachineState, action: MachineAction): MachineState {
  switch (action.type) {
    case 'place': {
      const { gear, partnerId } = action
      const partner = state.gears.find((g) => g.id === partnerId)
      const angle = partner
        ? meshedTheta(state.angles[partner.id] ?? 0, partner, gear)
        : 0
      return {
        ...state,
        gears: [...state.gears, gear],
        angles: { ...state.angles, [gear.id]: angle },
        driveId: state.driveId ?? gear.id,
        selectedId: gear.id,
        anglesVersion: state.anglesVersion + 1,
      }
    }
    case 'move': {
      const moved = state.gears.find((g) => g.id === action.id)
      if (!moved) return state
      const partner = state.gears.find((g) => g.id === action.partnerId)
      const gear: Gear = { ...moved, x: action.x, y: action.y }
      const angle = partner
        ? meshedTheta(state.angles[partner.id] ?? 0, partner, gear)
        : (state.angles[action.id] ?? 0)
      return {
        ...state,
        gears: state.gears.map((g) => (g.id === action.id ? gear : g)),
        angles: { ...state.angles, [action.id]: angle },
        anglesVersion: state.anglesVersion + 1,
      }
    }
    case 'delete': {
      const angles = { ...state.angles }
      delete angles[action.id]
      const wasDrive = state.driveId === action.id
      return {
        ...state,
        gears: state.gears.filter((g) => g.id !== action.id),
        angles,
        driveId: wasDrive ? null : state.driveId,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      }
    }
    case 'setDrive':
      return state.gears.some((g) => g.id === action.id)
        ? { ...state, driveId: action.id }
        : state
    case 'setRpm':
      return { ...state, rpm: Math.min(120, Math.max(5, action.value)) }
    case 'setRunning':
      return { ...state, running: action.value }
    case 'select':
      return { ...state, selectedId: action.id }
    case 'hydrate': {
      const { gears, driveId, rpm, running } = action
      return {
        ...state,
        gears,
        driveId,
        rpm,
        running,
        selectedId: null,
        angles: alignedAngles(gears, driveId),
        anglesVersion: state.anglesVersion + 1,
      }
    }
  }
}
