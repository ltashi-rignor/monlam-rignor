import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { listenMsForSentence } from '../data/speakSentences'
import { playFanfare, playLose, unlockAudio } from '../lib/gameSfx'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import VoicePlaybackBar from './VoicePlaybackBar'
import { useI18n } from '../i18n/useI18n'

const BAR_COUNT = 7
const GREAT_SCORE = 90
const LOW_SCORE = 50
const POST_TTS_COOLDOWN_MS = 700

function effortScore(target, heard) {
  const norm = (s) =>
    String(s || '')
      .replace(/[\s་༌།༎]+/g, '')
      .replace(/[^\u0F00-\u0FFF]/g, '')
  const a = norm(target)
  const b = norm(heard)
  if (!b) return 35
  if (!a) return 50
  const setA = new Set(a)
  let hit = 0
  for (const ch of b) if (setA.has(ch)) hit += 1
  const overlap = hit / Math.max(a.length, b.length)
  return Math.round(Math.min(100, Math.max(45, overlap * 100 + 20)))
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || ''
}

function scoreBand(score) {
  if (score == null) return 'ok'
  if (score >= GREAT_SCORE) return 'great'
  if (score < LOW_SCORE) return 'low'
  return 'ok'
}

/** Embedded guided speaking — drills come from the story scenes. */
export default function SpeakDrill({ drills = [], voiceApi = null }) {
  const { t } = useI18n()
  const localVoice = useTibetanVoice()
  const {
    speak,
    stop,
    loading: ttsBusy,
    playing: ttsPlaying = false,
    playbackProgress = 0,
  } = voiceApi || localVoice
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('ready')
  const [heard, setHeard] = useState('')
  const [score, setScore] = useState(null)
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [listenProgress, setListenProgress] = useState(0)
  const [modelPlaying, setModelPlaying] = useState(false)

  const mediaRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const rafRef = useRef(0)
  const timerRef = useRef(0)
  const tickRef = useRef(0)
  const audioCtxRef = useRef(null)
  const currentRef = useRef(null)
  const sessionRef = useRef(0)
  const micArmedRef = useRef(false)
  const drillsKey = useMemo(
    () => drills.map((d) => d.id || d.prompt).join('|'),
    [drills],
  )

  const safeDrills = drills.length ? drills : []
  const current = safeDrills[index] || safeDrills[0] || null
  currentRef.current = current

  const isListening = phase === 'listening'
  const isScoring = phase === 'scoring'

  function clearTimers() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = 0
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = 0
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }

  function teardownMic() {
    micArmedRef.current = false
    clearTimers()
    try {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.ondataavailable = null
        mediaRef.current.onstop = null
        mediaRef.current.stop()
      }
    } catch {
      /* ignore */
    }
    mediaRef.current = null
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    try {
      audioCtxRef.current?.close()
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null
    setLevel(0)
    setSecondsLeft(0)
    setListenProgress(0)
  }

  useEffect(() => () => teardownMic(), [])

  useEffect(() => {
    sessionRef.current += 1
    stop()
    teardownMic()
    setIndex(0)
    setHeard('')
    setScore(null)
    setError('')
    setPhase('ready')
    setModelPlaying(false)
  }, [drillsKey, stop])

  function startLevelMeter(stream) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i += 1) sum += data[i]
        const avg = sum / data.length / 255
        setLevel(Math.min(1, avg * 2.2))
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch {
      /* optional */
    }
  }

  async function playModel() {
    if (!current || isListening || isScoring || modelPlaying) return
    // Freeze the exact UI string so TTS cannot drift from what is on screen
    const line = String(current.prompt || '').trim()
    if (!line) return
    unlockAudio()
    sessionRef.current += 1
    teardownMic()
    setHeard('')
    setScore(null)
    setError('')
    setPhase('ready')
    setModelPlaying(true)
    stop()
    try {
      await speak(line)
    } finally {
      await new Promise((r) => window.setTimeout(r, POST_TTS_COOLDOWN_MS))
      setModelPlaying(false)
    }
  }

  async function startListen() {
    if (!current || isListening || isScoring || modelPlaying || ttsBusy) return
    unlockAudio()
    stop()
    teardownMic()
    setError('')
    setHeard('')
    setScore(null)
    const session = ++sessionRef.current
    micArmedRef.current = true
    setPhase('listening')
    const listenMs = listenMsForSentence(current.prompt)
    setSecondsLeft(Math.ceil(listenMs / 1000))
    setListenProgress(0)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (session !== sessionRef.current || !micArmedRef.current) {
        stream.getTracks().forEach((tr) => tr.stop())
        return
      }
      streamRef.current = stream
      startLevelMeter(stream)

      const mime = pickMime()
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      mediaRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const armed = micArmedRef.current && session === sessionRef.current
        micArmedRef.current = false
        clearTimers()
        setLevel(0)
        streamRef.current?.getTracks().forEach((tr) => tr.stop())
        streamRef.current = null
        try {
          audioCtxRef.current?.close()
        } catch {
          /* ignore */
        }
        audioCtxRef.current = null
        mediaRef.current = null

        if (!armed) {
          setPhase('ready')
          setSecondsLeft(0)
          return
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mime || 'audio/webm',
        })
        setPhase('scoring')
        try {
          const data = await api.tutorStt(blob)
          if (session !== sessionRef.current) {
            setPhase('ready')
            return
          }
          const text = (data?.text || data?.transcript || '').trim()
          const target = String(currentRef.current?.prompt || '').trim()
          const s = effortScore(target, text)
          setHeard(text)
          setScore(s)
          setPhase('scored')
          if (s >= GREAT_SCORE) playFanfare()
          else if (s < LOW_SCORE) playLose()
        } catch (err) {
          if (session === sessionRef.current) {
            setError(err.message || t.speak.retry)
            setPhase('ready')
          }
        }
      }

      recorder.start(200)
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Date.now() - started
        const left = Math.max(0, listenMs - elapsed)
        setSecondsLeft(Math.ceil(left / 1000))
        setListenProgress(Math.min(1, elapsed / listenMs))
      }, 80)
      timerRef.current = window.setTimeout(() => {
        if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
      }, listenMs)
    } catch {
      teardownMic()
      setError(t.speak.micDenied)
      setPhase('ready')
    }
  }

  function stopListen() {
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    else {
      teardownMic()
      setPhase('ready')
    }
  }

  function resetTake() {
    sessionRef.current += 1
    stop()
    teardownMic()
    setHeard('')
    setScore(null)
    setError('')
    setPhase('ready')
    setModelPlaying(false)
  }

  function prevDrill() {
    resetTake()
    setIndex((i) => (i - 1 + safeDrills.length) % safeDrills.length)
  }

  function nextDrill() {
    resetTake()
    setIndex((i) => (i + 1) % safeDrills.length)
  }

  if (!safeDrills.length || !current) {
    return <p className="muted">{t.story.speakEmpty}</p>
  }

  const statusLabel = modelPlaying || ttsBusy || ttsPlaying
    ? t.speak.playingModel
    : phase === 'listening'
      ? t.speak.listening
      : phase === 'scoring'
        ? t.speak.scoring
        : phase === 'scored'
          ? t.speak.scored
          : t.speak.readyHint

  const band = scoreBand(score)
  const encourageText =
    band === 'great'
      ? t.speak.encourageGreat
      : band === 'low'
        ? t.speak.encourageLow
        : t.speak.encourage

  const targetLine = String(current.prompt || '').trim()

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = (BAR_COUNT - 1) / 2
    const dist = Math.abs(i - center) / center
    const base = isListening ? 0.18 + level * (1 - dist * 0.55) : 0.12
    return Math.max(0.12, Math.min(1, base + (isListening ? level * 0.35 : 0)))
  })

  const micLocked = modelPlaying || ttsBusy || ttsPlaying || isScoring
  const modelActive = modelPlaying || ttsBusy || ttsPlaying
  const voiceProgress = ttsBusy && !ttsPlaying ? 0 : playbackProgress

  return (
    <div
      className={`speak-card speak-drill is-${phase}${modelActive ? ' is-playing' : ''}`}
      aria-live="polite"
      aria-busy={isListening || isScoring || modelActive}
    >
      <p className="speak-progress" dir="ltr">
        {t.speak.sentence} {index + 1}/{safeDrills.length}
      </p>
      {current.caption ? <p className="speak-scene-tag muted">{current.caption}</p> : null}
      <p className="speak-target-label">{t.speak.sayThis}</p>
      <p className="speak-prompt speak-sentence" lang="bo">
        {targetLine}
      </p>

      <div className={`speak-stage is-${phase}${modelActive ? ' is-playing' : ''}`}>
        <div className={`speak-status-pill is-${phase}${modelActive ? ' is-playing' : ''}`}>
          <span className="speak-status-dot" aria-hidden />
          <span>{statusLabel}</span>
          {isListening && (
            <strong className="speak-countdown" dir="ltr">
              {secondsLeft}s
            </strong>
          )}
        </div>

        <VoicePlaybackBar
          active={modelActive || isListening}
          indeterminate={ttsBusy && !ttsPlaying}
          value={isListening ? listenProgress : voiceProgress}
          label={isListening ? t.speak.listening : t.speak.playingModel}
          className="speak-voice-bar"
        />

        <div className="speak-meter" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className="speak-meter-bar" style={{ transform: `scaleY(${h})` }} />
          ))}
        </div>

        <button
          type="button"
          className={`speak-mic ${isListening ? 'is-listening' : ''} ${
            isScoring ? 'is-scoring' : ''
          } ${modelPlaying ? 'is-locked' : ''}`}
          onClick={() => {
            if (micLocked) return
            if (isListening) stopListen()
            else startListen()
          }}
          disabled={micLocked}
          aria-pressed={isListening}
          aria-label={isListening ? t.speak.stop : t.speak.repeat}
        >
          <span className="speak-mic-ring" aria-hidden />
          <span className="speak-mic-ring speak-mic-ring-delay" aria-hidden />
          <span className="speak-mic-glyph" aria-hidden>
            {isScoring ? (
              <span className="speak-mic-dots">···</span>
            ) : isListening ? (
              <span className="speak-mic-stop" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                <path
                  d="M5 11a7 7 0 0 0 14 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </button>

        <p className="speak-mic-caption">
          {modelActive
            ? t.speak.playingModel
            : isListening
              ? t.speak.tapToStop
              : isScoring
                ? t.speak.scoring
                : t.speak.tapToSpeak}
        </p>
      </div>

      <div className="speak-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={prevDrill}
          disabled={isListening || isScoring || modelActive || safeDrills.length < 2}
        >
          {t.speak.prev}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={playModel}
          disabled={isListening || isScoring || modelActive}
        >
          {modelActive ? t.speak.playing : t.speak.listen}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={nextDrill}
          disabled={isListening || isScoring || modelActive || safeDrills.length < 2}
        >
          {t.speak.next}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {phase === 'scored' && (
        <div className={`speak-result is-${band}`} key={`result-${index}-${score}`}>
          {band === 'great' && (
            <div className="speak-burst" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="speak-burst-piece" style={{ '--i': i }} />
              ))}
            </div>
          )}
          {band === 'great' && <p className="speak-impact-label">{t.speak.greatHit}</p>}
          {band === 'low' && <p className="speak-impact-label is-low">{t.speak.softHit}</p>}
          <p className="speak-target-recall">
            {t.speak.target}: <strong className="tibetan">{targetLine}</strong>
          </p>
          <p>
            {t.speak.youSaid}:{' '}
            <strong className="tibetan">
              {band === 'great' ? targetLine : heard || '—'}
            </strong>
          </p>
          <p className={`speak-score is-${band}`} dir="ltr">
            {score}
            <span>{t.speak.effort}</span>
          </p>
          <p className="muted">{encourageText}</p>
          <div className="speak-result-actions">
            <button type="button" className="btn btn-accent" onClick={startListen}>
              {t.speak.tryAgain}
            </button>
            <button type="button" className="btn btn-primary" onClick={nextDrill}>
              {t.speak.next}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Build speak drills from story scenes — exact same text as Read mode. */
export function drillsFromStory(story) {
  const scenes = story?.scenes || []
  const out = []
  scenes.forEach((sc, i) => {
    const text = String(sc?.text || '').trim()
    if (!text) return
    out.push({
      id: `${story?.id || 'story'}-scene-${i}`,
      prompt: text,
      meaning: '',
      meaningBo: '',
      caption: String(sc?.caption || '').trim(),
    })
  })
  return out
}
