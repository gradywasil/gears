import { describe, expect, it } from 'vitest'
import { makeGear, radiusOf } from '../sim/gear.ts'
import { initialMachineState, machineReducer } from './machine.ts'
import { solveTrain } from '../sim/kinematics.ts'
import { meshInvariantError } from '../sim/phase.ts'
import { meshRelation } from '../sim/mesh.ts'

function place(state: MachineStateish, teeth: number, x: number, y: number, partnerId: string | null) {
  const gear = makeGear(`g${teeth}@${x},${y}`, teeth, x, y)
  return machineReducer(state, { type: 'place', gear, partnerId })
}
type MachineStateish = ReturnType<typeof initialMachineState>

describe('machine state', () => {
  it('first gear placed becomes the drive and is selected', () => {
    let s = initialMachineState()
    s = place(s, 10, 100, 100, null)
    expect(s.driveId).toBeTruthy()
    expect(s.selectedId).toBe(s.gears[0]!.id)
    expect(s.running).toBe(true)
  })

  it('placed gear phase-aligns to its partner', () => {
    let s = initialMachineState()
    s = place(s, 24, 100, 100, null)
    s = place(s, 10, 100 + radiusOf(24) + radiusOf(10), 100, s.gears[0]!.id)
    const [drive, follower] = s.gears
    const err = meshInvariantError(
      s.angles[drive.id] ?? 0,
      drive,
      s.angles[follower.id] ?? 0,
      follower,
    )
    expect(err).toBeLessThan(1e-9)
    expect(meshRelation(drive, follower)).toBe('meshed')
  })

  it('deleting the drive clears driveId; the train stops spinning', () => {
    let s = initialMachineState()
    s = place(s, 24, 100, 100, null)
    const driveId = s.gears[0]!.id
    s = place(s, 10, 100 + radiusOf(24) + radiusOf(10), 100, driveId)
    s = machineReducer(s, { type: 'delete', id: driveId })

    expect(s.gears).toHaveLength(1)
    expect(s.driveId).toBeNull()
    // driveMissing condition used by the App banner:
    expect(s.gears.length > 0 && s.driveId === null).toBe(true)
    const spins = s.driveId ? solveTrain(s.gears, s.driveId, s.rpm) : new Map()
    expect(spins.size).toBe(0)
  })

  it('setDrive re-roots the train without touching angles', () => {
    let s = initialMachineState()
    s = place(s, 24, 100, 100, null)
    s = place(s, 10, 100 + radiusOf(24) + radiusOf(10), 100, s.gears[0]!.id)
    const anglesBefore = { ...s.angles }
    const follower = s.gears[1]!
    s = machineReducer(s, { type: 'setDrive', id: follower.id })
    expect(s.driveId).toBe(follower.id)
    expect(s.angles).toEqual(anglesBefore)
    const spins = solveTrain(s.gears, s.driveId!, s.rpm)
    expect(spins.get(s.gears[0]!.id)!.direction).toBe(-1)
  })

  it('placing while drive is missing promotes the new gear to drive', () => {
    let s = initialMachineState()
    s = place(s, 24, 100, 100, null)
    s = machineReducer(s, { type: 'delete', id: s.gears[0]!.id })
    expect(s.driveId).toBeNull()
    s = place(s, 10, 500, 500, null)
    expect(s.driveId).toBe(s.gears[0]!.id)
  })

  it('moving a gear realigns its phase to the new partner', () => {
    let s = initialMachineState()
    s = place(s, 24, 100, 100, null)
    const drive = s.gears[0]!
    s = place(s, 10, 100 + radiusOf(24) + radiusOf(10), 100, drive.id)
    const mover = s.gears[1]!
    // Re-mesh the 10t directly below the drive.
    s = machineReducer(s, {
      type: 'move',
      id: mover.id,
      x: drive.x,
      y: drive.y + radiusOf(24) + radiusOf(10),
      partnerId: drive.id,
    })
    const moved = s.gears.find((g) => g.id === mover.id)!
    const err = meshInvariantError(s.angles[drive.id] ?? 0, drive, s.angles[moved.id] ?? 0, moved)
    expect(meshRelation(drive, moved)).toBe('meshed')
    expect(err).toBeLessThan(1e-9)
  })

  it('rpm clamps to the 5–120 range (P3)', () => {
    let s = initialMachineState()
    s = machineReducer(s, { type: 'setRpm', value: 999 })
    expect(s.rpm).toBe(120)
    s = machineReducer(s, { type: 'setRpm', value: 1 })
    expect(s.rpm).toBe(5)
  })
})
