import { useMemo } from 'react'
import { MachineCanvas } from './render/MachineCanvas.tsx'
import { makeGear, radiusOf } from './sim/gear.ts'
import { solveTrain } from './sim/kinematics.ts'
import { meshedTheta } from './sim/phase.ts'

export const APP_TITLE = 'The Interlocking Gear Animator'

const DRIVE_RPM = 30

/** M1 harness: a fixed three-gear train proving phase-correct meshing at speed. */
export function App() {
  const { gears, spins, angles } = useMemo(() => {
    const drive = makeGear('drive', 24, 320, 320)
    const mid = makeGear('mid', 10, drive.x + radiusOf(24) + radiusOf(10), drive.y)
    const a = (40 * Math.PI) / 180
    const big = makeGear(
      'big',
      42,
      mid.x + (radiusOf(10) + radiusOf(42)) * Math.cos(a),
      mid.y + (radiusOf(10) + radiusOf(42)) * Math.sin(a),
    )
    const train = [drive, mid, big]

    const thetaMid = meshedTheta(0, drive, mid)
    const thetaBig = meshedTheta(thetaMid, mid, big)
    return {
      gears: train,
      spins: solveTrain(train, 'drive', DRIVE_RPM),
      angles: new Map([
        ['drive', 0],
        ['mid', thetaMid],
        ['big', thetaBig],
      ]),
    }
  }, [])

  return (
    <main>
      <MachineCanvas gears={gears} spins={spins} angles={angles} running />
    </main>
  )
}
