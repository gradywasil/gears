/**
 * Synthesized machine sound (fast-follow #1; v2 after user ear-test).
 * Zero audio assets: everything is WebAudio.
 *
 * Mesh voice = SCHEDULED TRANSIENT CLANKS, not modulated noise: individual
 * metallic ticks fired at the mesh's true tooth-pass rate (teeth × RPM/60 — a
 * property of the contact, since N·ω is conserved across a mesh). Each tick is
 * a pre-rendered inharmonic-metal partial stack (bell-like: f, 2.76f, 5.4f)
 * with a noise head, sharp attack, ~35 ms decay, and per-tick pitch/amplitude
 * jitter. Discrete at low rates (clack… clack), fusing into a mechanical buzz
 * at speed — the way real gearing behaves. A lookahead scheduler books ticks
 * ~180 ms ahead on the audio clock; nothing runs per animation frame.
 *
 * The drive adds a low gated hum (only above 15 RPM) tracking its RPM.
 * One-shots: mesh snap, refusal thud, save chime.
 *
 * Autoplay rules: the AudioContext is created lazily on the first user gesture
 * (pointer/keydown), so the first drag both places and unmutes.
 */

export type MeshVoice = {
  /** Tick rate in Hz: teeth × RPM / 60 (same for both gears at the mesh). */
  toothHz: number
  /** Resonance pitch for the clank, from the smaller gear's tooth count. */
  pitchHz: number
  /** Relative weight — louder when more torque flows through the mesh. */
  gain: number
}

const STORAGE_KEY = 'gears.sound'

export function storedSoundPref(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
  } catch {
    /* fall through */
  }
  return null
}

export function persistSoundPref(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Session-only.
  }
}

/** Clank resonance for a mesh, from the smaller gear's tooth count. */
export function meshPitchHz(minTeeth: number): number {
  // 10 teeth ≈ 2.1 kHz (clockwork clack); 72 ≈ 480 Hz (heavy thud-clank).
  const t = Math.min(72, Math.max(10, minTeeth))
  return 2100 - ((t - 10) / 62) * 1620
}

type MeshState = MeshVoice & { nextTickAt: number }

const LOOKAHEAD_S = 0.18
const TIMER_MS = 60
/** Above this rate the clanks perceptually fuse; stop scheduling each one. */
const MAX_SCHEDULED_HZ = 220

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private enabled = true
  private meshes = new Map<string, MeshState>()
  private running = false
  private clankBuffer: AudioBuffer | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private humFilter: BiquadFilterNode | null = null
  private schedulerId: number | null = null

  isEnabled(): boolean {
    return this.enabled
  }

  audioState(): string {
    return this.ctx?.state ?? 'uninitialized'
  }

  /** Call from any user-gesture handler; safe to call repeatedly. */
  ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    }
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = this.enabled ? 1 : 0
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -16
      limiter.ratio.value = 12
      master.connect(limiter).connect(ctx.destination)
      this.ctx = ctx
      this.master = master
      this.clankBuffer = makeClankBuffer(ctx)
      return ctx
    } catch {
      return null
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? 1 : 0, this.ctx.currentTime, 0.03)
    }
  }

  /** Sync the mesh registry with the machine; keys are stable mesh ids. */
  updateMeshes(meshes: ReadonlyMap<string, MeshVoice>, running: boolean) {
    const ctx = this.ensureContext()
    if (!ctx) return
    this.running = running

    for (const key of [...this.meshes.keys()]) {
      if (!meshes.has(key)) this.meshes.delete(key)
    }
    for (const [key, m] of meshes) {
      const existing = this.meshes.get(key)
      if (existing) {
        existing.toothHz = m.toothHz
        existing.pitchHz = m.pitchHz
        existing.gain = m.gain
      } else {
        this.meshes.set(key, { ...m, nextTickAt: ctx.currentTime + 0.05 })
      }
    }

    if (this.schedulerId === null) {
      this.schedulerId = window.setInterval(() => this.scheduleClanks(), TIMER_MS)
    }
  }

  /**
   * Book every mesh's clanks inside the lookahead window on the audio clock.
   * Amplitude budget: many meshes shouldn't play louder than one.
   */
  private scheduleClanks() {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.clankBuffer) return
    if (!this.enabled || !this.running || this.meshes.size === 0) {
      // Keep nextTickAt fresh so unmute/resume doesn't burst a backlog.
      const now = ctx.currentTime
      for (const m of this.meshes.values()) m.nextTickAt = Math.max(m.nextTickAt, now)
      return
    }
    const horizon = ctx.currentTime + LOOKAHEAD_S
    const budget = Math.min(1, 2.2 / Math.sqrt(this.meshes.size))

    for (const m of this.meshes.values()) {
      if (m.nextTickAt < ctx.currentTime) m.nextTickAt = ctx.currentTime
      if (m.toothHz > MAX_SCHEDULED_HZ) continue // perceptually fused; skip
      const interval = 1 / m.toothHz
      while (m.nextTickAt < horizon) {
        const t = m.nextTickAt
        this.fireClank(t, m.pitchHz, m.gain * budget)
        m.nextTickAt += interval
      }
    }
  }

  private fireClank(when: number, pitchHz: number, level: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.clankBuffer
    // Pitch the recorded reference (1.8 kHz) to this mesh's resonance, with
    // per-tick jitter so the machine never sounds sample-looped.
    const jitterRate = (pitchHz / 1800) * (0.92 + Math.random() * 0.16)
    src.playbackRate.value = Math.max(0.25, Math.min(4, jitterRate))
    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(1, level * (0.6 + Math.random() * 0.5)))
    src.connect(gain).connect(this.master!)
    src.start(when)
    src.onended = () => {
      src.disconnect()
      gain.disconnect()
    }
  }

  /** Drive hum: low tone tracking RPM; null or a crawl clears it. */
  updateHum(rpm: number | null) {
    const ctx = this.ensureContext()
    if (!ctx || !this.master) return
    // Gated: below 15 RPM the machine is quiet — the hum fades in as it wakes.
    if (rpm === null || rpm < 15) {
      if (this.humGain) this.humGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
      return
    }
    if (!this.humOsc) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 240
      filter.Q.value = 0.7
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(filter).connect(gain).connect(this.master)
      osc.start()
      this.humOsc = osc
      this.humGain = gain
      this.humFilter = filter
    }
    const t = ctx.currentTime
    // 15 RPM ≈ 38 Hz, 120 RPM ≈ 96 Hz — a motor that labors as you throttle up.
    const freq = 30 + (rpm / 120) * 66
    this.humOsc.frequency.setTargetAtTime(freq, t, 0.1)
    this.humFilter!.frequency.setTargetAtTime(140 + (rpm / 120) * 220, t, 0.1)
    this.humGain!.gain.setTargetAtTime(this.enabled ? 0.022 : 0, t, 0.12)
  }

  // --- One-shots -------------------------------------------------------------

  private blip(opts: {
    type: OscillatorType
    from: number
    to: number
    duration: number
    gain: number
  }) {
    const ctx = this.ensureContext()
    if (!ctx || !this.master || !this.enabled) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = opts.type
    osc.frequency.setValueAtTime(opts.from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(opts.gain, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + opts.duration + 0.02)
  }

  /** Heavier double-clank on a successful mesh. */
  snap() {
    const ctx = this.ensureContext()
    if (ctx && this.master && this.enabled && this.clankBuffer) {
      this.fireClank(ctx.currentTime, 1700, 0.5)
      this.fireClank(ctx.currentTime + 0.045, 1150, 0.35)
    }
  }

  /** Dull thud on a refused placement. */
  refusal() {
    this.blip({ type: 'sine', from: 140, to: 55, duration: 0.12, gain: 0.16 })
  }

  /** Quiet two-note chime on save. */
  chime() {
    this.blip({ type: 'sine', from: 880, to: 880, duration: 0.12, gain: 0.05 })
    window.setTimeout(() => {
      this.blip({ type: 'sine', from: 1108.7, to: 1108.7, duration: 0.16, gain: 0.05 })
    }, 90)
  }
}

/**
 * The clank: inharmonic metal partials (f, 2.76f, 5.4f — bell ratios, so it
 * reads as metal, not as a musical tone) with a 2 ms noise head and a fast
 * exponential decay. Recorded at a 1.8 kHz reference for runtime re-pitching.
 */
function makeClankBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 0.045
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  const f = 1800
  const partials = [
    { ratio: 1, amp: 1.0, decay: 55 },
    { ratio: 2.76, amp: 0.45, decay: 90 },
    { ratio: 5.4, amp: 0.22, decay: 150 },
  ]
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate
    let v = 0
    for (const p of partials) {
      v += p.amp * Math.sin(2 * Math.PI * f * p.ratio * t) * Math.exp(-p.decay * t)
    }
    // Noise head: the initial impact transient.
    if (t < 0.002) v += (Math.random() * 2 - 1) * (1 - t / 0.002) * 0.9
    data[i] = Math.max(-1, Math.min(1, v * 0.55))
  }
  return buffer
}
