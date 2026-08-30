import type { Gear } from '../sim/gear.ts'
import type { Spin } from '../sim/kinematics.ts'

export type InspectorProps = {
  gear: Gear
  spin: Spin | null
  isDrive: boolean
  onSetDrive: () => void
  onDelete: () => void
  onClose: () => void
  onUnlock?: () => void
}

function DirectionMark({ direction }: { direction: 1 | -1 }) {
  return (
    <svg className="direction-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={direction === 1 ? 'M12 4a8 8 0 1 1-7.4 5' : 'M12 4a8 8 0 1 0 7.4 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={direction === 1 ? 'M4.2 5.5 4.6 9.6 8.6 8.6' : 'M19.8 5.5 19.4 9.6 15.4 8.6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Inspector({
  gear,
  spin,
  isDrive,
  onSetDrive,
  onDelete,
  onClose,
  onUnlock,
}: InspectorProps) {
  const rpm = spin ? spin.rpm : 0
  const torque = spin ? spin.torqueMultiplier : 1
  return (
    <aside className="inspector" aria-label="Gear inspector">
      <header>
        <h2>{gear.teeth}-tooth gear</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close inspector">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <dl>
        <div className="stat">
          <dt>Speed</dt>
          <dd>
            {spin ? (
              <>
                <DirectionMark direction={spin.direction} />
                <span className="mono">{rpm >= 100 ? rpm.toFixed(0) : rpm.toFixed(1)} RPM</span>
              </>
            ) : (
              <span className="mono dim">still</span>
            )}
          </dd>
        </div>
        <div className="stat">
          <dt>Torque</dt>
          <dd>
            {spin ? (
              <span className="mono">×{torque >= 100 ? torque.toFixed(0) : torque.toFixed(1)}</span>
            ) : (
              <span className="mono dim">—</span>
            )}
          </dd>
        </div>
      </dl>
      <footer>
        {isDrive ? (
          <span className="drive-badge">Drive</span>
        ) : (
          <button type="button" className="secondary-button" onClick={onSetDrive}>
            Set as drive
          </button>
        )}
        {gear.lockedTo && onUnlock && (
          <button type="button" className="secondary-button" onClick={onUnlock}>
            Unlock shaft
          </button>
        )}
        <button type="button" className="danger-button" onClick={onDelete}>
          Delete
        </button>
      </footer>
    </aside>
  )
}
