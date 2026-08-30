/**
 * Synthesized machine sound (fast-follow #1). Zero audio assets: everything is
 * WebAudio graph — works offline, tunable at runtime.
 *
 * Physics of the palette:
 * - Each MESH emits a tick train at the tooth-pass frequency. At a mesh of
 *   gears A and B, N_A·ω_A = N_B·ω_B (the rolling condition), so the rate is a
 *   property of the contact, not of either gear — one voice per mesh.
 *   A tick train is band-passed noise amplitude-modulated at that rate: slow
 *   rates read as discrete ticks, fast rates blend into a whir, exactly like
 *   real gearing. Filter center tracks the smaller gear's size (small = bright).
 * - The drive adds a low hum whose pitch follows its RPM.
 * - One-shots: mesh snap (transient click), refusal (thud), save (chime).
 *
 * Autoplay rules: the AudioContext is created lazily on the first user gesture
 * (pointer/keydown), so the first drag both places and unmutes.
 */

export type MeshVoice = {
  /** Modulation rate in Hz: teeth × RPM / 60 (same for both gears at the mesh). */
  toothHz: number
  /** Filter center hint from the smaller gear's tooth count (bigger = lower). */
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

/** Filter center for a mesh, from the smaller gear's tooth count. */
export function meshPitchHz(minTeeth: number): number {
  // Tuned dark per user ear: 10 teeth ≈ 3 kHz (clockwork, not piercing);
  // 72 ≈ 650 Hz (heavy machinery).
  const t = Math.min(72, Math.max(10, minTeeth))
  return 3000 - ((t - 10) / 62) * 2350
}

type Voice = {
  noise: AudioBufferSourceNode
  filter: BiquadFilterNode
  carrier: GainNode
  modOsc: OscillatorNode
  modDepth: GainNode
  out: GainNode
}

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private enabled = true
  private voices = new Map<string, Voice>()
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private humFilter: BiquadFilterNode | null = null
  private noiseBuffer: AudioBuffer | null = null

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
      limiter.threshold.value = -18
      limiter.ratio.value = 12
      master.connect(limiter).connect(ctx.destination)
      this.ctx = ctx
      this.master = master
      this.noiseBuffer = makeNoiseBuffer(ctx)
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

  /** Sync mesh voices with the current machine. Keys are stable mesh ids. */
  updateMeshes(meshes: ReadonlyMap<string, MeshVoice>, running: boolean) {
    const ctx = this.ensureContext()
    if (!ctx || !this.master) return
    this.meshesNow = meshes

    // Total loudness budget across voices: many meshes shouldn't get louder.
    const totalGain = meshes.size > 0 ? Math.min(1, 2.2 / Math.sqrt(meshes.size)) : 0

    for (const key of [...this.voices.keys()]) {
      if (!meshes.has(key)) {
        const v = this.voices.get(key)!
        v.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
        window.setTimeout(() => {
          if (this.voices.get(key) === v && this.meshesNow?.get(key) === undefined) {
            this.voices.delete(key)
            try {
              v.modOsc.stop()
              v.noise.stop()
            } catch {
              /* already stopped */
            }
            v.carrier.disconnect()
            v.out.disconnect()
          }
        }, 350)
      }
    }

    for (const [key, m] of meshes) {
      let v = this.voices.get(key)
      if (!v) {
        const made = this.makeVoice()
        if (!made) continue
        v = made
        this.voices.set(key, v)
      }
      const t = ctx.currentTime
      const active = running ? m.gain * totalGain : 0
      v.out.gain.setTargetAtTime(active * 0.28, t, 0.08)
      v.modOsc.frequency.setTargetAtTime(Math.max(0.5, Math.min(400, m.toothHz)), t, 0.08)
      v.filter.frequency.setTargetAtTime(m.pitchHz, t, 0.08)
    }
  }

  private meshesNow: ReadonlyMap<string, MeshVoice> | null = null

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

  private makeVoice(): Voice | null {
    const ctx = this.ensureContext()
    if (!ctx || !this.master || !this.noiseBuffer) return null
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    noise.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500
    filter.Q.value = 1.1 // low resonance: ticks read as machinery, not whistles
    const carrier = ctx.createGain()
    carrier.gain.value = 0.5
    const out = ctx.createGain()
    out.gain.value = 0
    const modOsc = ctx.createOscillator()
    modOsc.type = 'sine'
    modOsc.frequency.value = 8
    const modDepth = ctx.createGain()
    modDepth.gain.value = 0.5
    modOsc.connect(modDepth).connect(carrier.gain)
    noise.connect(filter).connect(carrier).connect(out).connect(this.master)
    noise.start()
    modOsc.start()
    return { noise, filter, carrier, modOsc, modDepth, out }
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

  /** Mechanical click on a successful mesh. */
  snap() {
    this.blip({ type: 'square', from: 2600, to: 900, duration: 0.035, gain: 0.08 })
    this.blip({ type: 'triangle', from: 320, to: 180, duration: 0.06, gain: 0.05 })
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

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    // Slightly low-passed white noise: less hiss, more machinery.
    const white = Math.random() * 2 - 1
    last = 0.85 * last + 0.15 * white
    data[i] = last * 2.4
  }
  return buffer
}
