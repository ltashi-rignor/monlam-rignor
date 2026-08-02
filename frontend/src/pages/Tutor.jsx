import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import VoicePicker from '../components/VoicePicker'
import { FILLER_BANK, useTibetanVoice } from '../hooks/useTibetanVoice'
import { unlockAudio } from '../lib/gameSfx'
import { useI18n } from '../i18n/useI18n'

const STARTERS = [
  'བཀྲ་ཤིས་བདེ་ལེགས།',
  'ང་བོད་ཡིག་སློབ་འདོད་ཡོད།',
  "How do I say 'good morning' in Tibetan?",
  'Translate to Tibetan: I love learning your language.',
]

const GREETING =
  'བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་རིག་ནུས་དགེ་རྒན་ཡིན། སྐད་ཡིག་མིང་ཚིག་བརྡ་སྤྲོད་རིག་གནས་གང་ཡང་དྲིས་ཆོག'

const VOICE_GREETING =
  'བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་རིག་ནུས་དགེ་རྒན་ཡིན། ད་ལྟ་ཉན་བཞིན་ཡོད། ཤོད་ཤོག'

/** End turn after this much quiet once the user has spoken. */
const SILENCE_MS = 1100
const SPEECH_THRESHOLD = 0.028
const MIN_SPEECH_MS = 320
const MAX_LISTEN_MS = 20000
const LISTEN_GRACE_MS = 500
/** Wait after TTS before opening mic — stops the model from "hearing" itself. */
const POST_SPEAK_COOLDOWN_MS = 900

/** Grapheme-safe chunks for Tibetan / Latin typewriter reveal. */
function textUnits(text) {
  const s = text || ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map(
        (seg) => seg.segment,
      )
    } catch {
      /* fall through */
    }
  }
  return Array.from(s)
}

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
  ]
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || ''
}

function stripBo(s) {
  return (s || '').replace(/[\s།་\.…]+/g, '')
}

/** Drop STT that is just a filler clip or echo of the tutor’s last line. */
function isEchoOrNoise(transcript, lastAssistant) {
  const t = stripBo(transcript)
  if (t.length < 2) return true
  for (const f of FILLER_BANK) {
    const fs = stripBo(f)
    if (fs && (t === fs || (fs.length >= 2 && t.includes(fs) && t.length <= fs.length + 4))) {
      return true
    }
  }
  const a = stripBo(lastAssistant)
  if (!a) return false
  if (t === a) return true
  if (t.length >= 6 && a.includes(t)) return true
  if (t.length >= 10 && a.length >= 10 && t.slice(0, 12) === a.slice(0, 12)) return true
  return false
}

export default function Tutor() {
  const { t } = useI18n()

  const [tab, setTab] = useState('text')
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [voicePhase, setVoicePhase] = useState('idle') // idle | listening | processing | speaking
  const [inCall, setInCall] = useState(false)
  const [micSupported, setMicSupported] = useState(true)
  const [level, setLevel] = useState(0)

  const listRef = useRef(null)
  const mediaRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const listeningRef = useRef(false)
  const inCallRef = useRef(false)
  const phaseRef = useRef('idle')
  const vadCleanupRef = useRef(null)
  const turnGenRef = useRef(0)
  const typeGenRef = useRef(0)
  const voiceHistoryRef = useRef([{ role: 'assistant', content: VOICE_GREETING }])

  const beginListenRef = useRef(async () => {})
  const finishRef = useRef(async () => {})
  const voiceTurnRef = useRef(async () => {})

  const { voice, setVoice, speak, stop, playFiller, stopFiller, noteWaitMs } = useTibetanVoice()

  const typeAssistantReply = useCallback(async (baseMsgs, fullText, meta = {}) => {
    const gen = ++typeGenRef.current
    const units = textUnits(fullText || '…')
    const draft = {
      role: 'assistant',
      content: '',
      typing: true,
      usedRag: !!meta.usedRag,
      sources: meta.sources || [],
    }
    setMessages([...baseMsgs, draft])

    // Adaptive pace: short replies feel deliberate; long ones stay snappy.
    const stepMs = units.length > 220 ? 10 : units.length > 100 ? 14 : 22
    const charsPerTick = units.length > 280 ? 3 : units.length > 140 ? 2 : 1

    let i = 0
    while (i < units.length) {
      if (gen !== typeGenRef.current) return
      i = Math.min(units.length, i + charsPerTick)
      const content = units.slice(0, i).join('')
      setMessages([...baseMsgs, { ...draft, content, typing: i < units.length }])
      await new Promise((r) => window.setTimeout(r, stepMs))
    }
    if (gen !== typeGenRef.current) return
    setMessages([...baseMsgs, { ...draft, content: units.join(''), typing: false }])
  }, [])

  const setPhase = useCallback((p) => {
    phaseRef.current = p
    setVoicePhase(p)
  }, [])

  useEffect(() => {
    const ok =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    setMicSupported(ok)
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, busy, tab])

  useEffect(() => {
    inCallRef.current = inCall
  }, [inCall])

  const releaseMic = useCallback(() => {
    if (vadCleanupRef.current) {
      vadCleanupRef.current()
      vadCleanupRef.current = null
    }
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
    } catch {
      /* ignore */
    }
    recorderRef.current = null
    chunksRef.current = []
    mediaRef.current?.getTracks().forEach((track) => track.stop())
    mediaRef.current = null
    listeningRef.current = false
    setLevel(0)
  }, [])

  const endCall = useCallback(() => {
    turnGenRef.current += 1
    inCallRef.current = false
    setInCall(false)
    listeningRef.current = false
    stop()
    void stopFiller({ fade: false })
    releaseMic()
    setPhase('idle')
    setBusy(false)
  }, [releaseMic, setPhase, stop, stopFiller])

  useEffect(() => {
    if (tab !== 'voice') endCall()
    else typeGenRef.current += 1
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    typeGenRef.current += 1
    endCall()
  }, [endCall])

  const startVad = useCallback((stream, onSilenceEnd) => {
    if (vadCleanupRef.current) {
      vadCleanupRef.current()
      vadCleanupRef.current = null
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) {
      const timeoutId = window.setTimeout(() => onSilenceEnd(), MAX_LISTEN_MS)
      vadCleanupRef.current = () => window.clearTimeout(timeoutId)
      return
    }
    const ctx = new Ctx()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.55
    source.connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const startedAt = performance.now()
    let speechStartedAt = 0
    let lastSpeechAt = 0
    let raf = 0
    let ended = false

    const tick = () => {
      if (ended || !listeningRef.current) return
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      setLevel(Math.min(1, rms * 6))

      const now = performance.now()
      const elapsed = now - startedAt
      if (rms >= SPEECH_THRESHOLD) {
        if (!speechStartedAt) speechStartedAt = now
        lastSpeechAt = now
      }

      const spokenLongEnough =
        speechStartedAt && now - speechStartedAt >= MIN_SPEECH_MS && lastSpeechAt
      const quietEnough = spokenLongEnough && now - lastSpeechAt >= SILENCE_MS
      const pastGrace = elapsed >= LISTEN_GRACE_MS

      if ((pastGrace && quietEnough) || elapsed >= MAX_LISTEN_MS) {
        ended = true
        onSilenceEnd()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    vadCleanupRef.current = () => {
      ended = true
      cancelAnimationFrame(raf)
      try {
        source.disconnect()
      } catch {
        /* ignore */
      }
      ctx.close().catch(() => {})
      setLevel(0)
    }
  }, [])

  beginListenRef.current = async () => {
    if (!inCallRef.current || !micSupported || !mediaRef.current) return
    unlockAudio()
    stop()
    void stopFiller({ fade: false })
    listeningRef.current = true
    setPhase('listening')
    chunksRef.current = []

    try {
      const mime = pickRecorderMime()
      const recorder = mime
        ? new MediaRecorder(mediaRef.current, { mimeType: mime })
        : new MediaRecorder(mediaRef.current)
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data)
      }
      recorderRef.current = recorder
      recorder.start(200)
      startVad(mediaRef.current, () => {
        if (listeningRef.current) void finishRef.current()
      })
    } catch {
      listeningRef.current = false
      setPhase('idle')
      await speak('མི་ཀྲོན་སྤྱོད་ཆོག་མེད།', { crossfadeFiller: false })
      endCall()
    }
  }

  voiceTurnRef.current = async (transcript, gen) => {
    const next = [...voiceHistoryRef.current, { role: 'user', content: transcript }]
    voiceHistoryRef.current = next
    setBusy(true)
    setPhase('processing')

    const waitStarted = performance.now()
    void playFiller()

    try {
      const data = await api.tutorChat(
        next.map(({ role, content }) => ({ role, content })),
        'voice',
      )
      if (!inCallRef.current || gen !== turnGenRef.current) return

      noteWaitMs(performance.now() - waitStarted)
      const reply = (data.reply || '').trim()
      if (!reply) throw new Error(t.modules.tutorSttFail)
      voiceHistoryRef.current = [...next, { role: 'assistant', content: reply }]
      setPhase('speaking')
      const finished = await speak(reply, { crossfadeFiller: true })
      if (!inCallRef.current || gen !== turnGenRef.current) return
      if (finished === false && phaseRef.current === 'listening') return
      if (inCallRef.current) {
        await new Promise((r) => window.setTimeout(r, POST_SPEAK_COOLDOWN_MS))
        if (inCallRef.current && gen === turnGenRef.current) void beginListenRef.current()
      }
    } catch (e) {
      console.warn(e)
      if (!inCallRef.current || gen !== turnGenRef.current) return
      await stopFiller({ fade: false })
      await speak('དགོངས་དག ཡང་བསྐྱར་ཤོད།', { crossfadeFiller: false })
      if (inCallRef.current && gen === turnGenRef.current) {
        await new Promise((r) => window.setTimeout(r, POST_SPEAK_COOLDOWN_MS))
        if (inCallRef.current && gen === turnGenRef.current) void beginListenRef.current()
      }
    } finally {
      setBusy(false)
    }
  }

  finishRef.current = async () => {
    if (vadCleanupRef.current) {
      vadCleanupRef.current()
      vadCleanupRef.current = null
    }
    listeningRef.current = false
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      if (inCallRef.current) setPhase('idle')
      return
    }

    const blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        resolve(new Blob(chunksRef.current, { type }))
      }
      try {
        recorder.stop()
      } catch {
        resolve(null)
      }
    })

    recorderRef.current = null
    chunksRef.current = []
    if (!inCallRef.current) return

    if (!blob || blob.size < 400) {
      void beginListenRef.current()
      return
    }

    const gen = turnGenRef.current
    setBusy(true)
    setPhase('processing')
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const stt = await api.tutorStt(blob, `speech.${ext}`)
      if (!inCallRef.current || gen !== turnGenRef.current) return
      const transcript = (stt.text || '').trim()
      if (!transcript) {
        void beginListenRef.current()
        return
      }
      const lastAssistant = [...voiceHistoryRef.current].reverse().find((m) => m.role === 'assistant')
        ?.content
      if (isEchoOrNoise(transcript, lastAssistant)) {
        // Heard the tutor / a filler — keep listening without burning a Melong turn
        void beginListenRef.current()
        return
      }
      await voiceTurnRef.current(transcript, gen)
    } catch {
      if (!inCallRef.current || gen !== turnGenRef.current) return
      await stopFiller({ fade: false })
      await speak('དགོངས་དག ཡང་བསྐྱར་ཤོད།', { crossfadeFiller: false })
      if (inCallRef.current && gen === turnGenRef.current) {
        await new Promise((r) => window.setTimeout(r, POST_SPEAK_COOLDOWN_MS))
        if (inCallRef.current && gen === turnGenRef.current) void beginListenRef.current()
      }
    } finally {
      setBusy(false)
    }
  }

  async function sendText(prompt) {
    const text = (prompt ?? input).trim()
    if (!text || busy) return
    setErr('')
    typeGenRef.current += 1
    const nextMsgs = [...messages, { role: 'user', content: text }]
    setMessages(nextMsgs)
    setInput('')
    setBusy(true)
    try {
      const data = await api.tutorChat(
        nextMsgs.map(({ role, content }) => ({ role, content })),
        'text',
      )
      await typeAssistantReply(nextMsgs, data.reply || '…', {
        usedRag: !!data.used_rag,
        sources: data.retrieved_sources || [],
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function startCall() {
    if (!micSupported || inCallRef.current) return
    unlockAudio()
    turnGenRef.current += 1
    const gen = turnGenRef.current
    voiceHistoryRef.current = [{ role: 'assistant', content: VOICE_GREETING }]
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (gen !== turnGenRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      mediaRef.current = stream
      inCallRef.current = true
      setInCall(true)
      setPhase('speaking')
      await speak(VOICE_GREETING, { crossfadeFiller: false })
      if (!inCallRef.current || gen !== turnGenRef.current) return
      await new Promise((r) => window.setTimeout(r, POST_SPEAK_COOLDOWN_MS))
      if (!inCallRef.current || gen !== turnGenRef.current) return
      void beginListenRef.current()
    } catch {
      await speak('མི་ཀྲོན་སྤྱོད་ཆོག་མེད།', { crossfadeFiller: false })
      endCall()
    }
  }

  function bargeIn() {
    if (!inCallRef.current) return
    if (phaseRef.current === 'speaking' || phaseRef.current === 'processing') {
      turnGenRef.current += 1
      stop()
      void stopFiller({ fade: false })
      setBusy(false)
      void beginListenRef.current()
      return
    }
    if (phaseRef.current === 'listening') {
      void finishRef.current()
    }
  }

  function onPrimaryTap() {
    if (!inCall) {
      void startCall()
      return
    }
    bargeIn()
  }

  const statusText = !inCall
    ? t.modules.tutorCallStart
    : voicePhase === 'listening'
      ? t.modules.tutorListening
      : voicePhase === 'processing'
        ? t.modules.tutorProcessing
        : voicePhase === 'speaking'
          ? t.modules.tutorSpeaking
          : t.modules.tutorCallReady

  const orbScale = 1 + level * 0.35

  return (
    <div className="module-page tutor-page tibetan">
      <header className="page-header tutor-hero">
        <div>
          <p className="module-eyebrow">{t.modules.tutorEyebrow}</p>
          <h1>{t.modules.tutorTitle}</h1>
          {tab === 'text' && <p>{t.modules.tutorSub}</p>}
          {tab === 'voice' && <p className="tutor-voice-sub">{t.modules.tutorVoiceSub}</p>}
        </div>
        {tab === 'voice' && <VoicePicker value={voice} onChange={setVoice} />}
      </header>

      <div className="tutor-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'text'}
          className={`tutor-tab ${tab === 'text' ? 'is-active' : ''}`}
          onClick={() => {
            endCall()
            setTab('text')
          }}
        >
          {t.modules.tutorTabText}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'voice'}
          className={`tutor-tab ${tab === 'voice' ? 'is-active' : ''}`}
          onClick={() => setTab('voice')}
        >
          {t.modules.tutorTabVoice}
        </button>
      </div>

      {tab === 'text' && (
        <div className="panel tutor-shell">
          <div className="tutor-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`tutor-msg ${m.role === 'user' ? 'is-user' : 'is-ai'}`}>
                <div className="tutor-avatar">{m.role === 'user' ? 'ཁྱེད།' : 'བློ།'}</div>
                <div className="tutor-bubble-wrap">
                  <div
                    className={`tutor-bubble tibetan${m.typing ? ' is-typing' : ''}`}
                    aria-busy={m.typing ? 'true' : undefined}
                  >
                    {m.content}
                    {m.typing ? <span className="tutor-caret" aria-hidden /> : null}
                  </div>
                  {m.role === 'assistant' && m.usedRag && !m.typing && (
                    <p className="tutor-rag-note muted">{t.modules.tutorFromHandbook}</p>
                  )}
                </div>
              </div>
            ))}
            {busy && !messages.some((m) => m.typing) && (
              <div className="tutor-msg is-ai">
                <div className="tutor-avatar">བློ།</div>
                <div className="tutor-bubble tutor-bubble-thinking muted">
                  <span className="tutor-thinking-dots" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  {t.modules.thinking}
                </div>
              </div>
            )}
            {err && <p className="error">{err}</p>}
          </div>

          {messages.length <= 1 && (
            <div className="chip-row" style={{ marginBottom: 12 }}>
              {STARTERS.map((p) => (
                <button key={p} type="button" className="chip-btn" onClick={() => sendText(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <form
            className="tutor-form"
            onSubmit={(e) => {
              e.preventDefault()
              sendText()
            }}
          >
            <input
              className="tibetan"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.modules.tutorPh}
            />
            <button className="btn btn-primary" disabled={busy || !input.trim()}>
              {t.modules.send}
            </button>
          </form>
        </div>
      )}

      {tab === 'voice' && (
        <div
          className={`panel tutor-voice-stage ${inCall ? `is-${voicePhase}` : 'is-idle'} ${
            inCall ? 'is-in-call' : ''
          }`}
          aria-live="polite"
        >
          {!micSupported ? (
            <p className="muted">{t.modules.tutorMicUnsupported}</p>
          ) : (
            <>
              <div
                className="tutor-voice-orb"
                aria-hidden
                style={
                  voicePhase === 'listening'
                    ? { transform: `scale(${orbScale})`, opacity: 0.75 + level * 0.25 }
                    : undefined
                }
              />
              <p className="tutor-voice-status">{statusText}</p>
              <button
                type="button"
                className={`tutor-mic ${voicePhase === 'listening' ? 'is-listening' : ''} ${
                  voicePhase === 'processing' ? 'is-busy' : ''
                } ${voicePhase === 'speaking' ? 'is-speaking' : ''} ${!inCall ? 'is-start' : ''}`}
                onClick={onPrimaryTap}
                aria-label={statusText}
              >
                <span className="tutor-mic-ring" aria-hidden />
                <span className="tutor-mic-glyph" aria-hidden>
                  {!inCall ? (
                    <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
                    </svg>
                  ) : voicePhase === 'speaking' || voicePhase === 'processing' ? (
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                      <path d="M6 6h4v12H6V6zm8 0h4v12h-4V6z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
                    </svg>
                  )}
                </span>
              </button>
              {inCall && (
                <button type="button" className="tutor-hangup" onClick={endCall}>
                  {t.modules.tutorCallEnd}
                </button>
              )}
              {inCall && voicePhase === 'speaking' && (
                <p className="tutor-voice-hint muted">{t.modules.tutorBargeHint}</p>
              )}
              {inCall && voicePhase === 'listening' && (
                <p className="tutor-voice-hint muted">{t.modules.tutorSilenceHint}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
