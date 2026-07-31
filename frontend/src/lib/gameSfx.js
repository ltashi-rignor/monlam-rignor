/**
 * Kid-friendly game SFX via Web Audio (no asset files).
 * Claps / win chime / lose boing / level fanfare.
 */

let ctx = null

function ac() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq, when, dur, type = 'sine', gain = 0.12) {
  const a = ac()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime + when)
  g.gain.setValueAtTime(0.0001, a.currentTime + when)
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + when + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + when)
  o.stop(a.currentTime + when + dur + 0.05)
}

function noiseBurst(when, dur, gain = 0.18) {
  const a = ac()
  if (!a) return
  const n = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, n, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const src = a.createBufferSource()
  src.buffer = buf
  const g = a.createGain()
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 1800
  f.Q.value = 0.7
  g.gain.setValueAtTime(gain, a.currentTime + when)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(a.currentTime + when)
}

/** Happy clap + sparkle when answer is correct */
export function playWin() {
  const a = ac()
  if (!a) return
  noiseBurst(0, 0.08, 0.22)
  noiseBurst(0.07, 0.07, 0.16)
  noiseBurst(0.13, 0.09, 0.12)
  tone(523.25, 0.02, 0.18, 'triangle', 0.1)
  tone(659.25, 0.1, 0.2, 'triangle', 0.1)
  tone(783.99, 0.18, 0.28, 'triangle', 0.11)
}

/** Soft “uh-oh” when wrong */
export function playLose() {
  const a = ac()
  if (!a) return
  tone(220, 0, 0.22, 'square', 0.07)
  tone(165, 0.14, 0.32, 'square', 0.06)
  noiseBurst(0.05, 0.12, 0.08)
}

/** Bigger celebration after a streak / round clear */
export function playFanfare() {
  const a = ac()
  if (!a) return
  const notes = [392, 523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => tone(f, i * 0.08, 0.35, 'triangle', 0.1))
  noiseBurst(0.35, 0.15, 0.2)
  noiseBurst(0.42, 0.12, 0.14)
}

export function unlockAudio() {
  ac()
}
