export type ControlsProps = {
  rpm: number
  running: boolean
  hasDrive: boolean
  onRpmChange: (value: number) => void
  onToggleRun: () => void
}

export function Controls({ rpm, running, hasDrive, onRpmChange, onToggleRun }: ControlsProps) {
  return (
    <div className="controls" role="group" aria-label="Machine controls">
      <button
        type="button"
        className="icon-button run-button"
        onClick={onToggleRun}
        disabled={!hasDrive}
        aria-label={running ? 'Pause machine' : 'Run machine'}
        aria-pressed={running && hasDrive}
      >
        {running ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 4.8v14.4L19 12z" fill="currentColor" />
          </svg>
        )}
      </button>
      <label className="rpm-control">
        <span className="rpm-label">Drive speed</span>
        <input
          type="range"
          min={5}
          max={120}
          step={1}
          value={rpm}
          disabled={!hasDrive}
          onChange={(e) => onRpmChange(Number(e.target.value))}
          aria-label="Drive gear speed in RPM"
        />
        <span className="mono rpm-value">{rpm} RPM</span>
      </label>
    </div>
  )
}
