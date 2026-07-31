/**
 * Vocab Rain — vocabulary typing game.
 * Melong generates the word pack; words fall; type English meaning.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { playFanfare, playLose, playWin, unlockAudio } from '../lib/gameSfx'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import VoicePicker from '../components/VoicePicker'
import { bo } from '../i18n/bo'

const THEMES = [
  { id: 'all', labelKey: 'partyThemeAll' },
  { id: 'animals', labelKey: 'partyThemeAnimals' },
  { id: 'family', labelKey: 'partyThemeFamily' },
  { id: 'nature', labelKey: 'partyThemeNature' },
  { id: 'food', labelKey: 'partyThemeFood' },
  { id: 'greetings', labelKey: 'partyThemeGreetings' },
  { id: 'numbers', labelKey: 'partyThemeNumbers' },
]

const BALLOON_COLORS = ['#1a6b76', '#c47a16', '#2a9d8f', '#e9c46a', '#f4a261', '#0d3d45']
const START_SPEED = 7.5
const SPEED_STEP = 0.55
const MAX_SPEED = 22
const FLOOR = 88
const PACK_SIZE = 14

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function answersFor(word) {
  if (Array.isArray(word?.answers) && word.answers.length) {
    return [...new Set(word.answers.map(normalize).filter(Boolean))]
  }
  const parts = String(word?.english || '')
    .split(/[/|,]/)
    .map((p) => normalize(p))
    .filter(Boolean)
  const full = normalize(word?.english)
  const wylie = normalize(word?.wylie)
  return [...new Set([...parts, full, wylie].filter(Boolean))]
}

function pickWord(pool, avoidId) {
  if (!pool?.length) return null
  const opts = pool.length < 2 ? pool : pool.filter((w) => w.id !== avoidId)
  return opts[Math.floor(Math.random() * opts.length)]
}

function makeBalloons(n = 14) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    left: 6 + Math.random() * 88,
    delay: Math.random() * 0.35,
    dur: 1.6 + Math.random() * 1.1,
    size: 28 + Math.random() * 28,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    drift: (Math.random() - 0.5) * 80,
  }))
}

function makeConfetti(n = 28) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c-${Date.now()}-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.1 + Math.random() * 0.9,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    rot: Math.random() * 360,
  }))
}

export default function LetterParty() {
  const { voice, setVoice, speak } = useTibetanVoice()
  const [phase, setPhase] = useState('lobby') // lobby | loading | play | over
  const [theme, setTheme] = useState('animals')
  const [pool, setPool] = useState([])
  const [source, setSource] = useState('ai')
  const [loadError, setLoadError] = useState('')
  const [word, setWord] = useState(null)
  const [y, setY] = useState(0)
  const [speed, setSpeed] = useState(START_SPEED)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('mr_vocab_rain_best') || 0))
  const [input, setInput] = useState('')
  const [balloons, setBalloons] = useState([])
  const [confetti, setConfetti] = useState([])
  const [cheer, setCheer] = useState('')
  const [shake, setShake] = useState(false)

  const inputRef = useRef(null)
  const wordRef = useRef(null)
  const poolRef = useRef([])
  const themeRef = useRef(theme)
  const speedRef = useRef(START_SPEED)
  const yRef = useRef(0)
  const scoreRef = useRef(0)
  const phaseRef = useRef(phase)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    wordRef.current = word
  }, [word])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    poolRef.current = pool
  }, [pool])

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  const clearFx = useCallback(() => {
    setBalloons([])
    setConfetti([])
    setCheer('')
  }, [])

  const celebrate = useCallback(
    (big = false) => {
      setBalloons(makeBalloons(big ? 20 : 12))
      setConfetti(makeConfetti(big ? 36 : 22))
      setCheer(big ? bo.modules.partyCheerBig : bo.modules.partyCheer)
      if (big) playFanfare()
      else playWin()
      window.setTimeout(clearFx, big ? 2600 : 1800)
    },
    [clearFx],
  )

  const gameOver = useCallback(() => {
    if (phaseRef.current !== 'play') return
    phaseRef.current = 'over'
    setPhase('over')
    playLose()
    setShake(true)
    window.setTimeout(() => setShake(false), 500)
    setBest((b) => {
      const next = Math.max(b, scoreRef.current)
      localStorage.setItem('mr_vocab_rain_best', String(next))
      return next
    })
  }, [])

  const spawn = useCallback(
    (avoidId, nextSpeed) => {
      const w = pickWord(poolRef.current, avoidId)
      if (!w) {
        gameOver()
        return
      }
      setWord(w)
      wordRef.current = w
      setY(0)
      yRef.current = 0
      setInput('')
      if (typeof nextSpeed === 'number') {
        setSpeed(nextSpeed)
        speedRef.current = nextSpeed
      }
      speak(w.tibetan)
      window.setTimeout(() => inputRef.current?.focus(), 40)
    },
    [speak, gameOver],
  )

  const beginPlay = useCallback(
    (words, themeId, packSource) => {
      setPool(words)
      poolRef.current = words
      setSource(packSource || 'ai')
      setTheme(themeId)
      themeRef.current = themeId
      scoreRef.current = 0
      setScore(0)
      setInput('')
      setShake(false)
      clearFx()
      const s = START_SPEED
      setSpeed(s)
      speedRef.current = s
      phaseRef.current = 'play'
      setPhase('play')
      spawn(null, s)
    },
    [clearFx, spawn],
  )

  const start = async (themeId) => {
    unlockAudio()
    setLoadError('')
    setTheme(themeId)
    phaseRef.current = 'loading'
    setPhase('loading')
    try {
      const pack = await api.generateVocabRain(themeId, PACK_SIZE, 'easy')
      const words = Array.isArray(pack.words) ? pack.words : []
      if (!words.length) throw new Error(bo.modules.partyLoadEmpty)
      beginPlay(words, themeId, pack.source || 'ai')
    } catch (err) {
      setLoadError(err.message || bo.modules.partyLoadFail)
      phaseRef.current = 'lobby'
      setPhase('lobby')
    }
  }

  useEffect(() => {
    if (phase !== 'play') {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
      return undefined
    }

    const tick = (ts) => {
      if (phaseRef.current !== 'play') return
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts
      const ny = yRef.current + speedRef.current * dt
      yRef.current = ny
      setY(ny)
      if (ny >= FLOOR) {
        gameOver()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameOver])

  const tryMatch = (raw) => {
    if (phaseRef.current !== 'play' || !wordRef.current) return false
    const typed = normalize(raw)
    if (!typed) return false
    const ok = answersFor(wordRef.current).some((a) => a === typed)
    if (!ok) return false

    const nextScore = scoreRef.current + 1
    scoreRef.current = nextScore
    setScore(nextScore)
    celebrate(nextScore > 0 && nextScore % 5 === 0)
    const nextSpeed = Math.min(MAX_SPEED, speedRef.current + SPEED_STEP)
    spawn(wordRef.current.id, nextSpeed)
    return true
  }

  const onInput = (e) => {
    const v = e.target.value
    setInput(v)
    tryMatch(v)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (phase !== 'play') return
    unlockAudio()
    if (!normalize(input)) return
    if (tryMatch(input)) return
    gameOver()
  }

  const themeLabel = (id) => {
    const t = THEMES.find((x) => x.id === id)
    return t ? bo.modules[t.labelKey] : id
  }

  const hintAnswers = useMemo(() => (word ? answersFor(word) : []), [word])

  return (
    <div className="module-page tibetan party-page rain-page">
      <div className="party-fx" aria-hidden>
        {balloons.map((b) => (
          <span
            key={b.id}
            className="party-balloon"
            style={{
              left: `${b.left}%`,
              width: b.size,
              height: b.size * 1.25,
              background: b.color,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
              '--drift': `${b.drift}px`,
            }}
          />
        ))}
        {confetti.map((c) => (
          <span
            key={c.id}
            className="party-confetti"
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </div>

      {cheer && <p className="party-cheer">{cheer}</p>}

      <header className="party-header">
        <div>
          <p className="module-eyebrow">{bo.modules.partyEyebrow}</p>
          <h1>{bo.modules.partyTitle}</h1>
          <p className="party-sub">{bo.modules.partySub}</p>
        </div>
        <VoicePicker value={voice} onChange={setVoice} />
      </header>

      {(phase === 'lobby' || phase === 'loading') && (
        <section className="party-lobby">
          <div className="rain-lobby-art" aria-hidden>
            <span className="rain-lobby-drop">ཆུ</span>
            <span className="rain-lobby-drop">ཉི་མ</span>
            <span className="rain-lobby-drop">ཁྱི</span>
          </div>
          <p className="party-lobby-lead">{bo.modules.partyPickLevel}</p>
          <p className="rain-how">{bo.modules.partyAiNote}</p>
          {loadError && <p className="error">{loadError}</p>}
          {phase === 'loading' ? (
            <p className="rain-loading">{bo.modules.partyLoading}</p>
          ) : (
            <div className="rain-theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="party-level-card"
                  onClick={() => start(t.id)}
                >
                  <strong>{bo.modules[t.labelKey]}</strong>
                  <span>{bo.modules.partyAiPack}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {(phase === 'play' || phase === 'over') && (
        <section className={'rain-stage' + (shake ? ' is-shake' : '')}>
          <div className="party-hud rain-hud">
            <span>
              {bo.modules.partyScore} <b dir="ltr">{score}</b>
            </span>
            <span>
              {bo.modules.partyBest} <b dir="ltr">{best}</b>
            </span>
            <span className="rain-theme-chip">{themeLabel(theme)}</span>
            <span className="rain-source-chip" dir="ltr">
              {source === 'ai' ? bo.modules.partySourceAi : bo.modules.partySourceFallback}
            </span>
          </div>

          <div className="rain-sky" aria-live="polite">
            <div className="rain-floor-line" aria-hidden />
            {word && phase === 'play' && (
              <button
                type="button"
                className="rain-falling tibetan"
                style={{ top: `${y}%`, left: '50%' }}
                onClick={() => speak(word.tibetan)}
                aria-label={bo.modules.listen}
              >
                {word.tibetan}
              </button>
            )}
            {phase === 'over' && word && (
              <div className="rain-over-card">
                <h2>{bo.modules.partyOverTitle}</h2>
                <p className="rain-over-word tibetan">{word.tibetan}</p>
                <p className="rain-over-answer" dir="ltr">
                  {bo.modules.partyOverAnswer}: {hintAnswers[0] || word.english}
                </p>
                <p className="party-done-score" dir="ltr">
                  {score}
                </p>
                <div className="party-done-actions">
                  <button type="button" className="btn btn-primary" onClick={() => start(theme)}>
                    {bo.modules.partyPlayAgain}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setPhase('lobby')}>
                    {bo.modules.partyChangeLevel}
                  </button>
                </div>
              </div>
            )}
          </div>

          {phase === 'play' && (
            <form className="rain-typebar" onSubmit={onSubmit}>
              <label className="rain-type-label" htmlFor="rain-input">
                {bo.modules.partyTypeHint}
              </label>
              <input
                id="rain-input"
                ref={inputRef}
                className="rain-input"
                dir="ltr"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={input}
                onChange={onInput}
                placeholder="water, dog, mother…"
              />
              <button type="submit" className="btn btn-primary">
                {bo.modules.partyGo}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
